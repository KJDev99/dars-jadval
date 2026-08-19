import type { LessonUnit, Placement, SchoolClass, Settings, SolveStats, Teacher } from '../types'
import { SUBJECT_BY_ID } from '../data/curriculum'
import type { TeacherConstraintMap } from '../lib/rules'
import { makeRng } from '../lib/rng'

export interface SolveInput {
  classes: SchoolClass[]
  teachers: Teacher[]
  units: LessonUnit[]
  settings: Settings
  /** Mavjud jadval — undan boshlab minimal o'zgarish bilan qayta hisoblash uchun */
  baseline?: Placement[]
  /** Qo'lda qulflangan darslar — hech qachon ko'chirilmaydi */
  lockedUnitIds?: string[]
  /** Qoidalardan yig'ilgan o'qituvchi cheklovlari */
  teacherConstraints?: TeacherConstraintMap
}

export interface SolveOutput {
  placements: Placement[]
  stats: SolveStats
  notes: string[]
}

/* ─── Jarima og'irliklari ────────────────────────────────────────────────── */
/*
 * Og'irliklar shunday tanlangan-ki, barqarorlik jarimasi (maks. 200) hech qachon
 * qattiq cheklovdan ustun kelmasin: eng kichik qattiq jarima 250 dan boshlanadi.
 */
const W_CLASH = 4000 // o'qituvchi bir vaqtda ikki sinfda
const W_UNAVAIL = 2000 // o'qituvchi band kun/soatida dars
const W_GAP = 400 // ruxsat etilgandan ortiq "oyna"
const W_TDAY_OVER = 250 // kunlik yuklama oshishi
const W_SUBJ_TWICE = 400 // bitta fan bir kunda ikki marta (majburiy bo'lmasa)
const W_BALANCE = 2 // sinf darslarining kunlarga notekis taqsimlanishi
/** Barqarorlik og'irligining yuqori chegarasi — qattiq cheklovlardan past turishi shart */
export const MAX_STABILITY = 200

export function solve(input: SolveInput, onProgress?: (pct: number, cost: number) => void): SolveOutput {
  const { classes, teachers, units, settings, baseline, lockedUnitIds, teacherConstraints } = input
  const notes: string[] = []
  const t0 = Date.now()
  const rng = makeRng(settings.seed || 1)

  const C = classes.length
  const T = teachers.length
  const U = units.length
  const D = Math.max(settings.daysPrimary, settings.daysSenior)

  if (U === 0) {
    return {
      placements: [],
      stats: { cost: 0, iterations: 0, durationMs: 0, hardViolations: 0, softScore: 0, message: 'Dars birligi yo‘q' },
      notes: ['Jadval uchun dars birliklari topilmadi. Avval o‘quv reja va tarifikatsiyani to‘ldiring.'],
    }
  }

  const classIdx = new Map(classes.map((c, i) => [c.id, i]))
  const teacherIdx = new Map(teachers.map((t, i) => [t.id, i]))
  const unitIdx = new Map(units.map((u, i) => [u.id, i]))

  /* ─── Sinf parametrlari ─────────────────────────────────────────────── */
  const clsDays = new Int32Array(C)
  const clsMaxPerDay = new Int32Array(C)
  const unitsOfClass: number[][] = Array.from({ length: C }, () => [])

  for (let i = 0; i < C; i++) {
    clsDays[i] = classes[i].grade <= 4 ? settings.daysPrimary : settings.daysSenior
    clsMaxPerDay[i] = settings.maxPerDayByGrade[classes[i].grade] ?? 6
  }
  units.forEach((u, ui) => {
    const ci = classIdx.get(u.classId)
    if (ci !== undefined) unitsOfClass[ci].push(ui)
  })

  for (let i = 0; i < C; i++) {
    const need = unitsOfClass[i].length
    const cap = clsDays[i] * clsMaxPerDay[i]
    if (need > cap) {
      const newMax = Math.ceil(need / clsDays[i])
      notes.push(
        `${classes[i].grade}-${classes[i].letter}: ${need} soat ${clsDays[i]} kunga sig‘maydi ` +
          `(kunlik chegara ${clsMaxPerDay[i]}). Kunlik chegara ${newMax} ga oshirildi.`,
      )
      clsMaxPerDay[i] = newMax
    }
  }

  const P = Math.max(1, ...Array.from(clsMaxPerDay))

  /* ─── Dars birligi metama'lumotlari ─────────────────────────────────── */
  const unitTeachers: number[][] = units.map((u) =>
    Array.from(new Set(u.parts.map((p) => teacherIdx.get(p.teacherId)).filter((x): x is number => x !== undefined))),
  )
  const unitKey: string[] = units.map((u) => u.parts.map((p) => p.subjectId).sort().join('+'))
  const unitWeight = new Float32Array(U)
  const unitIsPE = new Uint8Array(U)
  units.forEach((u, i) => {
    let w = 0
    let pe = 0
    for (const p of u.parts) {
      const s = SUBJECT_BY_ID[p.subjectId]
      if (s) {
        w = Math.max(w, s.weight)
        if (p.subjectId === 'jismoniy_tarbiya') pe = 1
      }
    }
    unitWeight[i] = w
    unitIsPE[i] = pe
  })

  /* ─── O'qituvchi cheklovlari ────────────────────────────────────────── */
  const blockedSlot = new Uint8Array(T * D * P)
  const tMaxPerDay = new Int32Array(T).fill(settings.maxTeacherLessonsPerDay)
  const tMaxGap = new Int32Array(T).fill(settings.maxTeacherGapPerDay)

  teachers.forEach((t, ti) => {
    const c = teacherConstraints?.[t.id]
    const days = c?.blockedDays ?? t.unavailableDays
    for (const d of days) {
      if (d < 0 || d >= D) continue
      for (let p = 0; p < P; p++) blockedSlot[(ti * D + d) * P + p] = 1
    }
    for (const [d, p] of c?.blockedSlots ?? []) {
      if (d >= 0 && d < D && p >= 0 && p < P) blockedSlot[(ti * D + d) * P + p] = 1
    }
    if (c?.maxPerDay !== undefined) tMaxPerDay[ti] = c.maxPerDay
    if (c?.maxGap !== undefined) tMaxGap[ti] = c.maxGap
  })

  /** Dars shu kunga qo'yilishi mumkinmi — biror o'qituvchisi band bo'lmasa */
  function unitFitsDay(ui: number, d: number): boolean {
    for (const t of unitTeachers[ui]) if (teacherDayFullyBlocked[t][d]) return false
    return true
  }

  /** O'qituvchi shu kunda umuman ishlay oladimi (kun bo'yicha taqsimlashda) */
  const teacherDayFullyBlocked: boolean[][] = teachers.map((_, ti) =>
    Array.from({ length: D }, (_, d) => {
      for (let p = 0; p < P; p++) if (!blockedSlot[(ti * D + d) * P + p]) return false
      return true
    }),
  )

  /* ─── Bajarib bo'lmaydigan shartlarni oldindan aniqlash ─────────────── */
  {
    // 1) O'qituvchining haftalik soati ochiq kunlarga sig'adimi
    const hoursOf = new Int32Array(T)
    for (let ui = 0; ui < U; ui++) for (const t of unitTeachers[ui]) hoursOf[t]++
    for (let ti = 0; ti < T; ti++) {
      if (hoursOf[ti] === 0) continue
      let openDays = 0
      for (let d = 0; d < D; d++) if (!teacherDayFullyBlocked[ti][d]) openDays++
      const cap = openDays * tMaxPerDay[ti]
      if (hoursOf[ti] > cap) {
        notes.push(
          `⚠ ${teachers[ti].fullName}: ${hoursOf[ti]} soat dars bor, lekin ochiq kunlarga ko‘pi bilan ${cap} soat sig‘adi. ` +
            `Bo‘sh kun shartini yoki yuklamani kamaytiring.`,
        )
      }
    }

    // 2) Sinfning bir kunidagi darslarni o'qituvchilarsiz qoldirib bo'lmaydi
    for (let ci = 0; ci < C; ci++) {
      const list = unitsOfClass[ci]
      const dc = clsDays[ci]
      const n = list.length
      if (n === 0) continue
      const minNeeded = n - (dc - 1) * clsMaxPerDay[ci]
      if (minNeeded <= 0) continue
      for (let d = 0; d < dc; d++) {
        let placeable = 0
        for (const ui of list) {
          let ok = false
          for (const t of unitTeachers[ui]) if (!teacherDayFullyBlocked[t][d]) { ok = true; break }
          if (ok) placeable++
        }
        if (placeable < minNeeded) {
          notes.push(
            `⚠ ${classes[ci].grade}-${classes[ci].letter}: ${['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'][d]} ` +
              `kuni kamida ${minNeeded} soat dars kerak, lekin faqat ${placeable} ta dars uchun bo‘sh o‘qituvchi bor.`,
          )
        }
      }
    }
  }

  /* ─── Mavjud jadval (baseline) ──────────────────────────────────────── */
  const baseDay = new Int32Array(U).fill(-1)
  const basePeriod = new Int32Array(U).fill(-1)
  let baseCount = 0
  if (baseline) {
    for (const pl of baseline) {
      const ui = unitIdx.get(pl.unitId)
      if (ui === undefined || pl.day < 0 || pl.period < 0) continue
      baseDay[ui] = pl.day
      basePeriod[ui] = pl.period
      baseCount++
    }
  }
  const useBaseline = baseCount > 0
  const stabW = useBaseline ? Math.min(MAX_STABILITY, Math.max(0, settings.stabilityWeight ?? 0)) : 0

  const locked = new Uint8Array(U)
  if (lockedUnitIds) {
    for (const id of lockedUnitIds) {
      const ui = unitIdx.get(id)
      if (ui !== undefined && baseDay[ui] >= 0) locked[ui] = 1
    }
  }

  const uDay = new Int32Array(U).fill(-1)
  const uPeriod = new Int32Array(U).fill(-1)
  /** grid[classIdx][day] = period tartibidagi unit indekslari */
  const grid: number[][][] = Array.from({ length: C }, () => Array.from({ length: D }, () => [] as number[]))
  const slot = new Int16Array(T * D * P)
  const sIdx = (t: number, d: number, p: number) => (t * D + d) * P + p

  if (useBaseline) seedFromBaseline()
  else {
    distributeDays()
    greedyPeriods()
  }

  /* ─── 1-BOSQICH (yangidan): darslarni kunlarga taqsimlash ───────────── */
  function distributeDays() {
    for (let ci = 0; ci < C; ci++) {
      const list = unitsOfClass[ci]
      const dc = clsDays[ci]
      const n = list.length
      if (n === 0) continue

      const target = new Int32Array(dc)
      const base = Math.floor(n / dc)
      const rem = n % dc
      for (let d = 0; d < dc; d++) target[d] = base + (d < rem ? 1 : 0)

      const groups = new Map<string, number[]>()
      for (const ui of list) {
        const k = unitKey[ui]
        if (!groups.has(k)) groups.set(k, [])
        groups.get(k)!.push(ui)
      }
      const ordered = [...groups.entries()].sort((a, b) => b[1].length - a[1].length)

      const dayCount = new Int32Array(dc)
      const dayKeys: Map<string, number>[] = Array.from({ length: dc }, () => new Map())

      for (const [key, arr] of ordered) {
        const usedDays: number[] = []
        for (const ui of arr) {
          /*
           * Ikki bosqichli tanlov:
           *   1-urinish — faqat o'qituvchisi bo'sh bo'lgan kunlar (qattiq filtr),
           *   2-urinish — iloji bo'lmasa, sig'imi bor istalgan kun.
           * Metodik kun va bo'sh kun shartlari shu yerda hal bo'ladi — keyingi
           * bosqichlarda darsning kunini o'zgartirish ancha qimmatga tushadi.
           */
          let bestD = -1
          for (let strict = 1; strict >= 0 && bestD < 0; strict--) {
            let bestScore = -Infinity
            for (let d = 0; d < dc; d++) {
              if (dayCount[d] >= clsMaxPerDay[ci]) continue
              if (strict && !unitFitsDay(ui, d)) continue
              let score = 0
              score -= (dayKeys[d].get(key) ?? 0) * 300
              // Teng taqsimlash — lekin band kunni chetlab o'tish uchun buzilishi mumkin
              score -= Math.max(0, dayCount[d] - target[d] + 1) * 25
              score += (target[d] - dayCount[d]) * 4
              let minDist = 99
              for (const ud of usedDays) minDist = Math.min(minDist, Math.abs(ud - d))
              score += Math.min(minDist, 3) * 6
              if (!strict && !unitFitsDay(ui, d)) score -= 500
              score += rng() * 2
              if (score > bestScore) {
                bestScore = score
                bestD = d
              }
            }
          }
          if (bestD < 0) {
            for (let d = 0; d < dc; d++) if (dayCount[d] < clsMaxPerDay[ci]) { bestD = d; break }
            if (bestD < 0) bestD = 0
          }
          dayCount[bestD]++
          dayKeys[bestD].set(key, (dayKeys[bestD].get(key) ?? 0) + 1)
          usedDays.push(bestD)
          uDay[ui] = bestD
        }
      }
    }
  }

  /* ─── 2-BOSQICH (yangidan): soatlarga joylash ───────────────────────── */
  function greedyPeriods() {
    const pool: number[][][] = Array.from({ length: C }, () => Array.from({ length: D }, () => [] as number[]))
    for (let ui = 0; ui < U; ui++) pool[classIdx.get(units[ui].classId)!][uDay[ui]].push(ui)

    for (let d = 0; d < D; d++) {
      for (let p = 0; p < P; p++) {
        const order: number[] = []
        for (let ci = 0; ci < C; ci++) if (pool[ci][d].length > 0 && grid[ci][d].length === p) order.push(ci)
        order.sort((a, b) => pool[b][d].length - pool[a][d].length)

        for (const ci of order) {
          const cand = pool[ci][d]
          let bestI = -1
          let bestScore = -Infinity
          for (let i = 0; i < cand.length; i++) {
            const ui = cand[i]
            let free = true
            for (const t of unitTeachers[ui]) if (slot[sIdx(t, d, p)] > 0) { free = false; break }
            let score = free ? 1000 : 0
            for (const t of unitTeachers[ui]) if (blockedSlot[sIdx(t, d, p)]) score -= 400
            score += unitWeight[ui] * (P - p)
            if (unitIsPE[ui] && p === 0) score -= 300
            score += rng() * 5
            if (score > bestScore) { bestScore = score; bestI = i }
          }
          if (bestI < 0) continue
          const ui = cand.splice(bestI, 1)[0]
          uPeriod[ui] = p
          grid[ci][d].push(ui)
          for (const t of unitTeachers[ui]) slot[sIdx(t, d, p)]++
        }
      }
    }
  }

  /* ─── 1+2-BOSQICH (inkremental): mavjud jadvaldan boshlash ─────────── */
  function seedFromBaseline() {
    let movedByCapacity = 0
    let lostLocks = 0

    for (let ci = 0; ci < C; ci++) {
      const list = unitsOfClass[ci]
      const dc = clsDays[ci]
      const n = list.length
      if (n === 0) continue

      const target = new Int32Array(dc)
      const base = Math.floor(n / dc)
      const rem = n % dc
      for (let d = 0; d < dc; d++) target[d] = base + (d < rem ? 1 : 0)

      const dayCount = new Int32Array(dc)
      const dayKeys: Map<string, number>[] = Array.from({ length: dc }, () => new Map())
      const assignedDay = new Map<number, number>()

      const place = (ui: number, d: number) => {
        dayCount[d]++
        dayKeys[d].set(unitKey[ui], (dayKeys[d].get(unitKey[ui]) ?? 0) + 1)
        assignedDay.set(ui, d)
        uDay[ui] = d
      }

      // 1) Qulflangan darslar — kunini so'zsiz saqlaydi
      const lockedUnits = list.filter((ui) => locked[ui] && baseDay[ui] >= 0 && baseDay[ui] < dc)
      for (const ui of lockedUnits) place(ui, baseDay[ui])

      // 2) Eski jadvaldagi darslar — imkon bo'lsa o'sha kunda qoladi
      const withBase = list
        .filter((ui) => !locked[ui] && baseDay[ui] >= 0 && baseDay[ui] < dc)
        .sort((a, b) => baseDay[a] - baseDay[b] || basePeriod[a] - basePeriod[b])
      const deferred: number[] = []
      for (const ui of withBase) {
        const d = baseDay[ui]
        // Eski kun endi band bo'lib qolgan bo'lsa (yangi metodik kun/bo'sh kun) — ko'chiramiz
        if (dayCount[d] < target[d] && unitFitsDay(ui, d)) place(ui, d)
        else deferred.push(ui)
      }

      // 3) Yangi va siqib chiqarilgan darslar — sig'imi bor eng mos kunga
      const deferredSet = new Set(deferred)
      const rest = [...deferred, ...list.filter((ui) => !assignedDay.has(ui) && !deferredSet.has(ui))]
      for (const ui of rest) {
        if (assignedDay.has(ui)) continue
        let bestD = -1
        for (let strict = 1; strict >= 0 && bestD < 0; strict--) {
          let bestScore = -Infinity
          for (let d = 0; d < dc; d++) {
            if (dayCount[d] >= clsMaxPerDay[ci]) continue
            if (strict && !unitFitsDay(ui, d)) continue
            let score = (target[d] - dayCount[d]) * 4
            score -= Math.max(0, dayCount[d] - target[d] + 1) * 25
            score -= (dayKeys[d].get(unitKey[ui]) ?? 0) * 300
            if (baseDay[ui] === d) score += 60
            if (!strict && !unitFitsDay(ui, d)) score -= 500
            score += rng() * 2
            if (score > bestScore) { bestScore = score; bestD = d }
          }
        }
        if (bestD < 0) {
          for (let d = 0; d < dc; d++) if (dayCount[d] < clsMaxPerDay[ci]) { bestD = d; break }
          if (bestD < 0) bestD = 0
        }
        if (baseDay[ui] >= 0 && bestD !== baseDay[ui]) movedByCapacity++
        place(ui, bestD)
      }

      // 4) Har bir kun ichida soatlarni tartiblash
      for (let d = 0; d < dc; d++) {
        const dayUnits = list.filter((ui) => assignedDay.get(ui) === d)
        const cnt = dayUnits.length
        const row: (number | null)[] = Array.from({ length: cnt }, () => null)

        // Qulflanganlar avval — o'z soatiga
        for (const ui of dayUnits) {
          if (!locked[ui]) continue
          let p = basePeriod[ui]
          if (p < 0 || p >= cnt || row[p] !== null) {
            let alt = -1
            for (let q = 0; q < cnt; q++) if (row[q] === null) { alt = q; break }
            if (p !== alt) lostLocks++
            p = alt
          }
          if (p >= 0) row[p] = ui
        }
        // Qolganlar — eski tartibda bo'sh soatlarga
        const others = dayUnits
          .filter((ui) => !locked[ui])
          .sort((a, b) => {
            const pa = baseDay[a] === d ? basePeriod[a] : 999
            const pb = baseDay[b] === d ? basePeriod[b] : 999
            return pa - pb
          })
        let q = 0
        for (const ui of others) {
          while (q < cnt && row[q] !== null) q++
          if (q >= cnt) break
          row[q] = ui
        }

        grid[ci][d] = row.filter((x): x is number => x !== null)
        grid[ci][d].forEach((ui, p) => {
          uPeriod[ui] = p
          for (const t of unitTeachers[ui]) slot[sIdx(t, d, p)]++
        })
      }
    }

    if (movedByCapacity > 0)
      notes.push(`${movedByCapacity} ta dars kun sig‘imi o‘zgargani uchun boshqa kunga ko‘chirildi.`)
    if (lostLocks > 0)
      notes.push(`${lostLocks} ta qulflangan darsni asl soatida saqlab bo‘lmadi — sinf soatlari o‘zgargan.`)
  }

  /* ─── Narx funksiyalari ─────────────────────────────────────────────── */
  function teacherDayCost(t: number, d: number): number {
    let cost = 0
    let first = -1
    let last = -1
    let occupied = 0
    let total = 0
    for (let p = 0; p < P; p++) {
      const n = slot[sIdx(t, d, p)]
      if (n === 0) continue
      if (n > 1) cost += (n - 1) * W_CLASH
      if (blockedSlot[sIdx(t, d, p)]) cost += n * W_UNAVAIL
      if (first < 0) first = p
      last = p
      occupied++
      total += n
    }
    if (occupied === 0) return 0
    const gaps = last - first + 1 - occupied
    if (gaps > tMaxGap[t]) cost += (gaps - tMaxGap[t]) * W_GAP
    if (total > tMaxPerDay[t]) cost += (total - tMaxPerDay[t]) * W_TDAY_OVER
    return cost
  }

  /** Bitta darsning joylashuvi uchun narx: pedagogik + barqarorlik */
  function unitCost(ui: number, d: number, p: number): number {
    let c = unitWeight[ui] * p * 0.3
    if (unitIsPE[ui] && p === 0) c += 8
    if (stabW > 0 && baseDay[ui] >= 0) {
      if (baseDay[ui] !== d) c += stabW
      else if (basePeriod[ui] !== p) c += stabW * 0.4
    }
    return c
  }

  function classDayDupCost(ci: number, d: number): number {
    const arr = grid[ci][d]
    if (arr.length < 2) return 0
    let dup = 0
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) if (unitKey[arr[i]] === unitKey[arr[j]]) dup++
    }
    return dup * W_SUBJ_TWICE
  }

  /** Sinf darslarining kunlarga tekis taqsimlanishi (yumshoq) */
  const clsAvgPerDay = new Float32Array(C)
  for (let ci = 0; ci < C; ci++) clsAvgPerDay[ci] = unitsOfClass[ci].length / clsDays[ci]

  function classDayBalanceCost(ci: number, d: number): number {
    const diff = grid[ci][d].length - clsAvgPerDay[ci]
    return W_BALANCE * diff * diff
  }

  /** Sinf-kun uchun barcha narxlar (dup + balans + darslarning o'z narxi) */
  function classDayCost(ci: number, d: number): number {
    let c = classDayDupCost(ci, d) + classDayBalanceCost(ci, d)
    const arr = grid[ci][d]
    for (let p = 0; p < arr.length; p++) c += unitCost(arr[p], d, p)
    return c
  }

  function fullCost(): number {
    let cost = 0
    for (let t = 0; t < T; t++) for (let d = 0; d < D; d++) cost += teacherDayCost(t, d)
    for (let ui = 0; ui < U; ui++) cost += unitCost(ui, uDay[ui], uPeriod[ui])
    for (let ci = 0; ci < C; ci++) {
      for (let d = 0; d < D; d++) cost += classDayDupCost(ci, d) + classDayBalanceCost(ci, d)
    }
    return cost
  }

  let cost = fullCost()

  /* ─── 3-BOSQICH: lokal qidiruv ──────────────────────────────────────── */
  const iterations = Math.max(10000, settings.solverIterations)
  // Mavjud jadvaldan boshlaganda past haroratdan boshlaymiz — jadval "aralashib" ketmasin
  const Tstart = useBaseline ? 2.5 : 12
  const Tend = 0.04
  let temp = Tstart
  let decay = Math.pow(Tend / Tstart, 1 / iterations)
  let iterOffset = 0
  let iterTotal = iterations

  const pairs = new Set<number>()
  const affected = (t: number, d: number) => pairs.add(t * D + d)
  const pairsCost = () => {
    let c = 0
    for (const key of pairs) c += teacherDayCost(Math.floor(key / D), key % D)
    return c
  }

  /* ── Uchta amal: bajarish, o'lchash, orqaga qaytarish ─────────────── */

  function swapSameDay(ci: number, d: number, p1: number, p2: number) {
    const a = grid[ci][d][p1]
    const b = grid[ci][d][p2]
    for (const t of unitTeachers[a]) slot[sIdx(t, d, p1)]--
    for (const t of unitTeachers[b]) slot[sIdx(t, d, p2)]--
    grid[ci][d][p1] = b
    grid[ci][d][p2] = a
    uPeriod[a] = p2
    uPeriod[b] = p1
    for (const t of unitTeachers[a]) slot[sIdx(t, d, p2)]++
    for (const t of unitTeachers[b]) slot[sIdx(t, d, p1)]++
  }

  function swapCrossDay(ci: number, d1: number, p1: number, d2: number, p2: number) {
    const a = grid[ci][d1][p1]
    const b = grid[ci][d2][p2]
    for (const t of unitTeachers[a]) slot[sIdx(t, d1, p1)]--
    for (const t of unitTeachers[b]) slot[sIdx(t, d2, p2)]--
    grid[ci][d1][p1] = b
    grid[ci][d2][p2] = a
    uDay[a] = d2
    uPeriod[a] = p2
    uDay[b] = d1
    uPeriod[b] = p1
    for (const t of unitTeachers[a]) slot[sIdx(t, d2, p2)]++
    for (const t of unitTeachers[b]) slot[sIdx(t, d1, p1)]++
  }

  /**
   * Darsni bir kundan boshqa kunning oxiriga ko'chirish.
   * Sinf kunidagi darslar soni o'zgaradi — bu o'qituvchiga bo'sh kun berish uchun zarur.
   * Ketma-ketlik saqlanadi: chiqib ketgan joydan keyingilar bir soatga suriladi.
   */
  function moveUnitToDayEnd(ci: number, d1: number, p1: number, d2: number) {
    const A = grid[ci][d1]
    const B = grid[ci][d2]
    const u = A[p1]
    for (let k = p1; k < A.length; k++) for (const t of unitTeachers[A[k]]) slot[sIdx(t, d1, k)]--
    A.splice(p1, 1)
    for (let k = p1; k < A.length; k++) {
      uPeriod[A[k]] = k
      for (const t of unitTeachers[A[k]]) slot[sIdx(t, d1, k)]++
    }
    const p2 = B.length
    B.push(u)
    uDay[u] = d2
    uPeriod[u] = p2
    for (const t of unitTeachers[u]) slot[sIdx(t, d2, p2)]++
  }

  /**
   * Darsni boshqa kunning ANIQ bir soatiga ko'chirish (d1 !== d2).
   * Ikkala kunda ham ketma-ketlik saqlanadi.
   * Teskarisi: moveUnit(ci, d2, p2, d1, p1).
   */
  function moveUnit(ci: number, d1: number, p1: number, d2: number, p2: number) {
    const A = grid[ci][d1]
    const B = grid[ci][d2]
    const u = A[p1]
    for (let k = p1; k < A.length; k++) for (const t of unitTeachers[A[k]]) slot[sIdx(t, d1, k)]--
    A.splice(p1, 1)
    for (let k = p1; k < A.length; k++) {
      uPeriod[A[k]] = k
      for (const t of unitTeachers[A[k]]) slot[sIdx(t, d1, k)]++
    }
    for (let k = p2; k < B.length; k++) for (const t of unitTeachers[B[k]]) slot[sIdx(t, d2, k)]--
    B.splice(p2, 0, u)
    uDay[u] = d2
    for (let k = p2; k < B.length; k++) {
      uPeriod[B[k]] = k
      for (const t of unitTeachers[B[k]]) slot[sIdx(t, d2, k)]++
    }
  }

  /** Ko'chirish amalining narx o'zgarishi */
  function deltaMove(ci: number, d1: number, p1: number, d2: number, p2: number, keep: boolean): number {
    const A = grid[ci][d1]
    const B = grid[ci][d2]
    pairs.clear()
    for (let k = p1; k < A.length; k++) for (const t of unitTeachers[A[k]]) affected(t, d1)
    for (let k = p2; k < B.length; k++) for (const t of unitTeachers[B[k]]) affected(t, d2)
    for (const t of unitTeachers[A[p1]]) {
      affected(t, d1)
      affected(t, d2)
    }
    const c0 = pairsCost() + classDayCost(ci, d1) + classDayCost(ci, d2)
    moveUnit(ci, d1, p1, d2, p2)
    const c1 = pairsCost() + classDayCost(ci, d1) + classDayCost(ci, d2)
    if (!keep) moveUnit(ci, d2, p2, d1, p1)
    return c1 - c0
  }

  /** Ko'chirishga qulflangan darslar to'sqinlik qilmaydimi */
  function moveAllowed(ci: number, d1: number, p1: number, d2: number, p2: number): boolean {
    if (d1 === d2 || grid[ci][d2].length >= clsMaxPerDay[ci] || grid[ci][d1].length <= 1) return false
    const A = grid[ci][d1]
    const B = grid[ci][d2]
    if (locked[A[p1]]) return false
    for (let k = p1 + 1; k < A.length; k++) if (locked[A[k]]) return false
    for (let k = p2; k < B.length; k++) if (locked[B[k]]) return false
    return true
  }

  /** Yuqoridagi amalning teskarisi */
  function moveUnitBack(ci: number, d2: number, d1: number, p1: number) {
    const A = grid[ci][d1]
    const B = grid[ci][d2]
    const u = B[B.length - 1]
    for (const t of unitTeachers[u]) slot[sIdx(t, d2, B.length - 1)]--
    B.pop()
    for (let k = p1; k < A.length; k++) for (const t of unitTeachers[A[k]]) slot[sIdx(t, d1, k)]--
    A.splice(p1, 0, u)
    uDay[u] = d1
    for (let k = p1; k < A.length; k++) {
      uPeriod[A[k]] = k
      for (const t of unitTeachers[A[k]]) slot[sIdx(t, d1, k)]++
    }
  }

  /* ── Narx o'zgarishini hisoblash (amalni bajarib, keyin qaytarib) ─── */

  /** @returns narx o'zgarishi; `keep` bo'lsa amal joyida qoladi */
  function deltaSameDay(ci: number, d: number, p1: number, p2: number, keep: boolean): number {
    const a = grid[ci][d][p1]
    const b = grid[ci][d][p2]
    pairs.clear()
    for (const t of unitTeachers[a]) affected(t, d)
    for (const t of unitTeachers[b]) affected(t, d)
    const before = pairsCost() + unitCost(a, d, p1) + unitCost(b, d, p2)
    swapSameDay(ci, d, p1, p2)
    const after = pairsCost() + unitCost(a, d, p2) + unitCost(b, d, p1)
    if (!keep) swapSameDay(ci, d, p1, p2)
    return after - before
  }

  function deltaCrossDay(ci: number, d1: number, p1: number, d2: number, p2: number, keep: boolean): number {
    const a = grid[ci][d1][p1]
    const b = grid[ci][d2][p2]
    pairs.clear()
    for (const t of unitTeachers[a]) {
      affected(t, d1)
      affected(t, d2)
    }
    for (const t of unitTeachers[b]) {
      affected(t, d1)
      affected(t, d2)
    }
    const before =
      pairsCost() + unitCost(a, d1, p1) + unitCost(b, d2, p2) + classDayDupCost(ci, d1) + classDayDupCost(ci, d2)
    swapCrossDay(ci, d1, p1, d2, p2)
    const after =
      pairsCost() + unitCost(a, d2, p2) + unitCost(b, d1, p1) + classDayDupCost(ci, d1) + classDayDupCost(ci, d2)
    if (!keep) swapCrossDay(ci, d2, p2, d1, p1)
    return after - before
  }

  function deltaRelocate(ci: number, d1: number, p1: number, d2: number, keep: boolean): number {
    const A = grid[ci][d1]
    pairs.clear()
    for (let k = p1; k < A.length; k++) for (const t of unitTeachers[A[k]]) affected(t, d1)
    for (const t of unitTeachers[A[p1]]) affected(t, d2)
    const before = pairsCost() + classDayCost(ci, d1) + classDayCost(ci, d2)
    moveUnitToDayEnd(ci, d1, p1, d2)
    const after = pairsCost() + classDayCost(ci, d1) + classDayCost(ci, d2)
    if (!keep) moveUnitBack(ci, d2, d1, p1)
    return after - before
  }

  /* ── Muammoli darslar ro'yxati ────────────────────────────────────── */
  let hot: number[] = []
  const badTD = new Uint8Array(T * D)
  function refreshHot() {
    hot = []
    badTD.fill(0)
    for (let t = 0; t < T; t++) {
      for (let d = 0; d < D; d++) if (teacherDayCost(t, d) > 0) badTD[t * D + d] = 1
    }
    for (let ui = 0; ui < U; ui++) {
      if (locked[ui]) continue
      const d = uDay[ui]
      for (const t of unitTeachers[ui]) {
        if (badTD[t * D + d]) {
          hot.push(ui)
          break
        }
      }
    }
  }
  refreshHot()

  /** Qattiq cheklov buzilishlari soni */
  function countHard(): number {
    let n = 0
    for (let t = 0; t < T; t++) {
      for (let d = 0; d < D; d++) {
        let first = -1
        let last = -1
        let occupied = 0
        for (let p = 0; p < P; p++) {
          const k = slot[sIdx(t, d, p)]
          if (k === 0) continue
          if (k > 1) n += k - 1
          if (blockedSlot[sIdx(t, d, p)]) n += k
          if (first < 0) first = p
          last = p
          occupied++
        }
        if (occupied === 0) continue
        const gaps = last - first + 1 - occupied
        if (gaps > tMaxGap[t]) n += gaps - tMaxGap[t]
      }
    }
    return n
  }

  const progressStep = Math.floor(iterations / 100) || 1

  /* ── Tasodifiy qidiruv (simulated annealing) ──────────────────────── */
  function anneal(iters: number, t0: number) {
    temp = t0
    decay = Math.pow(Tend / t0, 1 / iters)

    for (let it = 0; it < iters; it++) {
      temp *= decay
      if (it % progressStep === 0) onProgress?.(Math.min(0.98, (iterOffset + it) / iterTotal), cost)
      if (it % 4000 === 0 && it > 0) refreshHot()

      let ci: number
      let d1: number
      if (hot.length > 0 && rng() < 0.75) {
        const ui = hot[Math.floor(rng() * hot.length)]
        ci = classIdx.get(units[ui].classId)!
        d1 = uDay[ui]
      } else {
        ci = Math.floor(rng() * C)
        d1 = Math.floor(rng() * clsDays[ci])
      }
      if (grid[ci][d1].length === 0) continue

      const roll = rng()
      const accept = (delta: number) => delta <= 0 || rng() < Math.exp(-delta / temp)

      if (roll < 0.18 && clsDays[ci] > 1) {
        // Boshqa kunga ko'chirish
        const d2 = Math.floor(rng() * clsDays[ci])
        if (d2 === d1) continue
        const A = grid[ci][d1]
        if (A.length <= 1 || grid[ci][d2].length >= clsMaxPerDay[ci]) continue
        const p1 = Math.floor(rng() * A.length)
        if (locked[A[p1]]) continue
        let blocked = false
        for (let k = p1 + 1; k < A.length; k++) if (locked[A[k]]) { blocked = true; break }
        if (blocked) continue

        const delta = deltaRelocate(ci, d1, p1, d2, true)
        if (accept(delta)) cost += delta
        else moveUnitBack(ci, d2, d1, p1)
      } else if (roll < 0.5 && clsDays[ci] > 1) {
        // Ikki kundagi darslarni almashtirish
        const d2 = Math.floor(rng() * clsDays[ci])
        if (d2 === d1 || grid[ci][d2].length === 0) continue
        const p1 = Math.floor(rng() * grid[ci][d1].length)
        const p2 = Math.floor(rng() * grid[ci][d2].length)
        const a = grid[ci][d1][p1]
        const b = grid[ci][d2][p2]
        if (locked[a] || locked[b] || unitKey[a] === unitKey[b]) continue

        const delta = deltaCrossDay(ci, d1, p1, d2, p2, true)
        if (accept(delta)) cost += delta
        else swapCrossDay(ci, d2, p2, d1, p1)
      } else {
        // Bir kun ichida soatlarni almashtirish
        const len = grid[ci][d1].length
        if (len < 2) continue
        const p1 = Math.floor(rng() * len)
        const p2 = Math.floor(rng() * len)
        if (p1 === p2) continue
        if (locked[grid[ci][d1][p1]] || locked[grid[ci][d1][p2]]) continue

        const delta = deltaSameDay(ci, d1, p1, p2, true)
        if (accept(delta)) cost += delta
        else swapSameDay(ci, d1, p1, p2)
      }
    }
    iterOffset += iters
  }

  /*
   * ── Tuzatish bosqichi ────────────────────────────────────────────────
   * Tasodifiy qidiruvdan farqli o'laroq bu yerda har bir muammoli dars uchun
   * BARCHA mumkin bo'lgan ko'chirishlar to'liq ko'rib chiqiladi va eng yaxshisi
   * tanlanadi. Shu sababli lokal minimumda qolib ketgan buzilishlar ham tuzatiladi.
   */
  interface Move {
    kind: 'same' | 'cross' | 'move'
    d1: number
    p1: number
    d2: number
    p2: number
    delta: number
  }

  /** Bitta dars uchun barcha mumkin bo'lgan ko'chirishlarni narxi bilan sanab chiqadi */
  function scanMoves(ui: number): Move[] {
    const out: Move[] = []
    if (locked[ui]) return out
    const ci = classIdx.get(units[ui].classId)!
    const d1 = uDay[ui]
    const p1 = uPeriod[ui]
    const A = grid[ci][d1]

    // Shu kun ichida almashtirish
    for (let p2 = 0; p2 < A.length; p2++) {
      if (p2 === p1 || locked[A[p2]]) continue
      out.push({ kind: 'same', d1, p1, d2: d1, p2, delta: deltaSameDay(ci, d1, p1, p2, false) })
    }

    for (let d2 = 0; d2 < clsDays[ci]; d2++) {
      if (d2 === d1) continue
      const B = grid[ci][d2]
      // Boshqa kundagi dars bilan almashtirish
      for (let p2 = 0; p2 < B.length; p2++) {
        if (locked[B[p2]] || unitKey[B[p2]] === unitKey[ui]) continue
        out.push({ kind: 'cross', d1, p1, d2, p2, delta: deltaCrossDay(ci, d1, p1, d2, p2, false) })
      }
      // Boshqa kunning istalgan soatiga ko'chirish
      for (let p2 = 0; p2 <= B.length; p2++) {
        if (!moveAllowed(ci, d1, p1, d2, p2)) continue
        out.push({ kind: 'move', d1, p1, d2, p2, delta: deltaMove(ci, d1, p1, d2, p2, false) })
      }
    }
    return out
  }

  function applyMove(ci: number, m: Move) {
    if (m.kind === 'same') deltaSameDay(ci, m.d1, m.p1, m.p2, true)
    else if (m.kind === 'cross') deltaCrossDay(ci, m.d1, m.p1, m.d2, m.p2, true)
    else deltaMove(ci, m.d1, m.p1, m.d2, m.p2, true)
  }

  function undoMove(ci: number, m: Move) {
    if (m.kind === 'same') swapSameDay(ci, m.d1, m.p1, m.p2)
    else if (m.kind === 'cross') swapCrossDay(ci, m.d2, m.p2, m.d1, m.p1)
    else moveUnit(ci, m.d2, m.p2, m.d1, m.p1)
  }

  /*
   * ── Tuzatish bosqichi ────────────────────────────────────────────────
   * Tasodifiy qidiruvdan farqli o'laroq bu yerda har bir muammoli dars uchun
   * BARCHA mumkin bo'lgan ko'chirishlar to'liq ko'rib chiqiladi.
   *
   * Bir qadamda yechilmaydigan holatlar ham bor. Masalan o'qituvchiga dushanba
   * 1-soatni bo'shatish uchun avval sinfning dushanbadagi bitta darsini boshqa
   * kunga surib joy ochish, keyin boshqa o'qituvchining darsini o'sha 1-soatga
   * olib kelish kerak. Shuning uchun bir qadam yordam bermasa, ikki qadamli
   * zanjir ham sinab ko'riladi.
   */
  function repair(maxPasses = 30, deep = true): void {
    for (let pass = 0; pass < maxPasses; pass++) {
      refreshHot()
      if (hot.length === 0) return
      let improved = false

      for (const ui of hot) {
        if (locked[ui]) continue
        const ci = classIdx.get(units[ui].classId)!
        const moves = scanMoves(ui)
        if (moves.length === 0) continue

        moves.sort((a, b) => a.delta - b.delta)
        const best = moves[0]

        if (best.delta < -1e-6) {
          applyMove(ci, best)
          cost += best.delta
          improved = true
          continue
        }
        if (!deep) continue

        /*
         * Ikki qadamli zanjir: birinchi qadam yomonlashtirsa ham, ikkinchisi qoplasa — qabul.
         * Ikkinchi qadam faqat shu dars uchun emas, birinchi qadam tekkan kunlardagi
         * boshqa darslar uchun ham qidiriladi — ko'pincha muammo "qo'shni" darsda hal bo'ladi.
         */
        for (const m1 of moves.slice(0, 12)) {
          if (m1.delta > 1500) break // juda qimmat boshlanish — foydasi yo'q
          applyMove(ci, m1)

          const touched = new Set<number>([ui])
          for (const d of [m1.d1, m1.d2]) for (const x of grid[ci][d]) touched.add(x)

          let best2: Move | null = null
          let best2Ci = ci
          for (const uj of touched) {
            if (locked[uj]) continue
            const cj = classIdx.get(units[uj].classId)!
            for (const m2 of scanMoves(uj)) {
              if (!best2 || m2.delta < best2.delta) {
                best2 = m2
                best2Ci = cj
              }
            }
          }

          if (best2 && m1.delta + best2.delta < -1e-6) {
            applyMove(best2Ci, best2)
            cost += m1.delta + best2.delta
            improved = true
            break
          }
          undoMove(ci, m1)
        }
      }

      if (!improved) return
    }
  }

  anneal(iterations, Tstart)
  repair()

  /*
   * Buzilish qolgan bo'lsa — jadvalni "qayta qizdirib" qisqaroq bosqichlarni
   * takrorlaymiz, so'ng yana to'liq tuzatish bosqichini o'tkazamiz.
   */
  for (let round = 0; round < 5 && countHard() > 0; round++) {
    const extra = Math.max(20000, Math.floor(iterations / 3))
    iterTotal += extra
    // Har bosqichda harorat biroz o'zgaradi — bir xil lokal minimumga qaytib qolmaslik uchun
    anneal(extra, 1.2 + round * 0.6)
    repair()
  }

  cost = fullCost()

  /* ─── Natija ────────────────────────────────────────────────────────── */
  const placements: Placement[] = []
  for (let ui = 0; ui < U; ui++) {
    placements.push({ unitId: units[ui].id, day: uDay[ui], period: uPeriod[ui] })
  }

  let hard = 0
  for (let t = 0; t < T; t++) {
    for (let d = 0; d < D; d++) {
      for (let p = 0; p < P; p++) {
        const n = slot[sIdx(t, d, p)]
        if (n > 1) hard += n - 1
        else if (n === 1 && blockedSlot[sIdx(t, d, p)]) hard++
      }
    }
  }

  let moved = 0
  if (useBaseline) {
    for (let ui = 0; ui < U; ui++) {
      if (baseDay[ui] < 0) continue
      if (baseDay[ui] !== uDay[ui] || basePeriod[ui] !== uPeriod[ui]) moved++
    }
    notes.push(
      `Eski jadvaldagi ${baseCount} ta darsdan ${moved} tasi ko‘chdi (${((moved / baseCount) * 100).toFixed(1)}%).`,
    )
  }

  onProgress?.(1, cost)

  return {
    placements,
    stats: {
      cost: Math.round(cost),
      iterations,
      durationMs: Date.now() - t0,
      hardViolations: hard,
      softScore: Math.round(cost),
      message: hard === 0 ? 'Qattiq cheklovlar to‘liq bajarildi' : `${hard} ta buzilish qoldi`,
    },
    notes,
  }
}
