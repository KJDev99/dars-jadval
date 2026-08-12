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
          let bestD = -1
          let bestScore = -Infinity
          for (let d = 0; d < dc; d++) {
            if (dayCount[d] >= clsMaxPerDay[ci]) continue
            let score = 0
            score -= (dayKeys[d].get(key) ?? 0) * 300
            // Teng taqsimlash — lekin band kunni chetlab o'tish uchun buzilishi mumkin
            score -= Math.max(0, dayCount[d] - target[d] + 1) * 25
            score += (target[d] - dayCount[d]) * 4
            let minDist = 99
            for (const ud of usedDays) minDist = Math.min(minDist, Math.abs(ud - d))
            score += Math.min(minDist, 3) * 6
            for (const t of unitTeachers[ui]) if (teacherDayFullyBlocked[t][d]) score -= 500
            score += rng() * 2
            if (score > bestScore) {
              bestScore = score
              bestD = d
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
        if (dayCount[d] < target[d]) place(ui, d)
        else deferred.push(ui)
      }

      // 3) Yangi va siqib chiqarilgan darslar — sig'imi bor eng mos kunga
      const deferredSet = new Set(deferred)
      const rest = [...deferred, ...list.filter((ui) => !assignedDay.has(ui) && !deferredSet.has(ui))]
      for (const ui of rest) {
        if (assignedDay.has(ui)) continue
        let bestD = -1
        let bestScore = -Infinity
        for (let d = 0; d < dc; d++) {
          if (dayCount[d] >= clsMaxPerDay[ci]) continue
          let score = (target[d] - dayCount[d]) * 4
          score -= Math.max(0, dayCount[d] - target[d] + 1) * 25
          score -= (dayKeys[d].get(unitKey[ui]) ?? 0) * 300
          if (baseDay[ui] === d) score += 60
          for (const t of unitTeachers[ui]) if (teacherDayFullyBlocked[t][d]) score -= 500
          score += rng() * 2
          if (score > bestScore) { bestScore = score; bestD = d }
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

  /* ─── 3-BOSQICH: lokal qidiruv (simulated annealing) ────────────────── */
  const iterations = Math.max(10000, settings.solverIterations)
  // Mavjud jadvaldan boshlaganda past haroratdan boshlaymiz — jadval "aralashib" ketmasin
  const Tstart = useBaseline ? 2.5 : 12
  const Tend = 0.04
  const decay = Math.pow(Tend / Tstart, 1 / iterations)
  let temp = Tstart

  const pairs = new Set<number>()
  const affected = (t: number, d: number) => pairs.add(t * D + d)

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
        if (badTD[t * D + d]) { hot.push(ui); break }
      }
    }
  }
  refreshHot()

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
    uDay[a] = d2; uPeriod[a] = p2
    uDay[b] = d1; uPeriod[b] = p1
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

  const progressStep = Math.floor(iterations / 100) || 1

  for (let it = 0; it < iterations; it++) {
    temp *= decay
    if (it % progressStep === 0) onProgress?.(it / iterations, cost)
    if (it % 4000 === 0 && it > 0) refreshHot()

    let ci: number, d1: number
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
    const relocate = roll < 0.18 && clsDays[ci] > 1
    const crossDay = !relocate && roll < 0.5 && clsDays[ci] > 1
    pairs.clear()

    if (relocate) {
      /* ── Darsni boshqa kunga ko'chirish (kun yuklamasi o'zgaradi) ── */
      const d2 = Math.floor(rng() * clsDays[ci])
      if (d2 === d1) continue
      const A = grid[ci][d1]
      const B = grid[ci][d2]
      if (A.length <= 1 || B.length >= clsMaxPerDay[ci]) continue
      const p1 = Math.floor(rng() * A.length)
      const u = A[p1]
      if (locked[u]) continue
      // Suriladigan darslar orasida qulflangani bo'lmasin
      let blocked = false
      for (let k = p1 + 1; k < A.length; k++) if (locked[A[k]]) { blocked = true; break }
      if (blocked) continue

      for (let k = p1; k < A.length; k++) for (const t of unitTeachers[A[k]]) affected(t, d1)
      for (const t of unitTeachers[u]) affected(t, d2)

      let before = 0
      for (const key of pairs) before += teacherDayCost(Math.floor(key / D), key % D)
      before += classDayCost(ci, d1) + classDayCost(ci, d2)

      moveUnitToDayEnd(ci, d1, p1, d2)

      let after = 0
      for (const key of pairs) after += teacherDayCost(Math.floor(key / D), key % D)
      after += classDayCost(ci, d1) + classDayCost(ci, d2)

      const delta = after - before
      if (delta <= 0 || rng() < Math.exp(-delta / temp)) cost += delta
      else moveUnitBack(ci, d2, d1, p1)
    } else if (!crossDay) {
      const len = grid[ci][d1].length
      if (len < 2) continue
      const p1 = Math.floor(rng() * len)
      const p2 = Math.floor(rng() * len)
      if (p1 === p2) continue
      const a = grid[ci][d1][p1]
      const b = grid[ci][d1][p2]
      if (locked[a] || locked[b]) continue

      for (const t of unitTeachers[a]) affected(t, d1)
      for (const t of unitTeachers[b]) affected(t, d1)

      let before = 0
      for (const key of pairs) before += teacherDayCost(Math.floor(key / D), key % D)
      before += unitCost(a, d1, p1) + unitCost(b, d1, p2)

      swapSameDay(ci, d1, p1, p2)

      let after = 0
      for (const key of pairs) after += teacherDayCost(Math.floor(key / D), key % D)
      after += unitCost(a, d1, p2) + unitCost(b, d1, p1)

      const delta = after - before
      if (delta <= 0 || rng() < Math.exp(-delta / temp)) cost += delta
      else swapSameDay(ci, d1, p1, p2)
    } else {
      const d2 = Math.floor(rng() * clsDays[ci])
      if (d2 === d1 || grid[ci][d2].length === 0) continue
      const p1 = Math.floor(rng() * grid[ci][d1].length)
      const p2 = Math.floor(rng() * grid[ci][d2].length)
      const a = grid[ci][d1][p1]
      const b = grid[ci][d2][p2]
      if (locked[a] || locked[b]) continue
      if (unitKey[a] === unitKey[b]) continue

      for (const t of unitTeachers[a]) { affected(t, d1); affected(t, d2) }
      for (const t of unitTeachers[b]) { affected(t, d1); affected(t, d2) }

      let before = 0
      for (const key of pairs) before += teacherDayCost(Math.floor(key / D), key % D)
      before += unitCost(a, d1, p1) + unitCost(b, d2, p2)
      before += classDayDupCost(ci, d1) + classDayDupCost(ci, d2)

      swapCrossDay(ci, d1, p1, d2, p2)

      let after = 0
      for (const key of pairs) after += teacherDayCost(Math.floor(key / D), key % D)
      after += unitCost(a, d2, p2) + unitCost(b, d1, p1)
      after += classDayDupCost(ci, d1) + classDayDupCost(ci, d2)

      const delta = after - before
      if (delta <= 0 || rng() < Math.exp(-delta / temp)) cost += delta
      else swapCrossDay(ci, d2, p2, d1, p1)
    }
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
