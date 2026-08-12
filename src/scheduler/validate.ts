import type {
  LessonUnit,
  Placement,
  SchoolClass,
  Settings,
  Teacher,
  Violation,
} from '../types'
import { DAY_NAMES } from '../types'
import { SUBJECTS as ALL_SUBJECTS, SUBJECT_BY_ID } from '../data/curriculum'
import { effectiveHours, type PlanOverrides } from '../lib/derive'
import { effectiveDayLimits, type TeacherConstraintMap } from '../lib/rules'

export interface ValidateInput {
  classes: SchoolClass[]
  teachers: Teacher[]
  units: LessonUnit[]
  placements: Placement[]
  settings: Settings
  ov: PlanOverrides
  /** Qoidalardan yig'ilgan o'qituvchi cheklovlari */
  teacherConstraints?: TeacherConstraintMap
}

export interface ValidationReport {
  violations: Violation[]
  errors: number
  warnings: number
  /** Sinf bo'yicha oyna soni */
  classGaps: number
  /** O'qituvchi bo'yicha ruxsatdan ortiq oynalar */
  teacherExtraGaps: number
  teacherClashes: number
}

export function validateSchedule(input: ValidateInput): ValidationReport {
  const { classes, teachers, units, placements, settings, ov, teacherConstraints } = input
  const v: Violation[] = []

  const unitById = new Map(units.map((u) => [u.id, u]))
  const clsById = new Map(classes.map((c) => [c.id, c]))
  const tById = new Map(teachers.map((t) => [t.id, t]))

  const D = Math.max(settings.daysPrimary, settings.daysSenior)
  const P = Math.max(...Object.values(settings.maxPerDayByGrade), 1) + 4

  // classId -> day -> period -> unitId
  const classGrid = new Map<string, (string | null)[][]>()
  for (const c of classes) {
    classGrid.set(
      c.id,
      Array.from({ length: D }, () => Array.from({ length: P }, () => null as string | null)),
    )
  }
  // teacherId -> day -> period -> unitIds
  const teacherGrid = new Map<string, string[][][]>()
  for (const t of teachers) {
    teacherGrid.set(
      t.id,
      Array.from({ length: D }, () => Array.from({ length: P }, () => [] as string[])),
    )
  }

  for (const pl of placements) {
    const u = unitById.get(pl.unitId)
    if (!u) continue
    if (pl.day < 0 || pl.period < 0) {
      v.push({ level: 'error', rule: 'joylashmagan', message: `${u.classId}: dars joylashtirilmadi.` })
      continue
    }
    const cg = classGrid.get(u.classId)
    if (cg) cg[pl.day][pl.period] = u.id
    // Bitta almashinuvli dars (juft/toq hafta) ikkala qismi ham bir xil o'qituvchida
    // bo'lishi mumkin — bu to'qnashuv emas, shuning uchun dars birligi bo'yicha takrorlanmaydi.
    for (const tid of new Set(u.parts.map((p) => p.teacherId))) {
      const tg = teacherGrid.get(tid)
      if (tg) tg[pl.day][pl.period].push(u.id)
    }
  }

  /* ── 1. O'qituvchi to'qnashuvlari ──────────────────────────────────── */
  let teacherClashes = 0
  for (const t of teachers) {
    const tg = teacherGrid.get(t.id)!
    for (let d = 0; d < D; d++) {
      for (let p = 0; p < P; p++) {
        const arr = tg[d][p]
        // Juft/toq hafta darslari bir vaqtda bo'lishi mumkin emas — har biri alohida sinf
        if (arr.length > 1) {
          teacherClashes += arr.length - 1
          const clsNames = arr
            .map((uid) => unitById.get(uid)?.classId)
            .map((cid) => {
              const c = cid ? clsById.get(cid) : undefined
              return c ? `${c.grade}-${c.letter}` : cid
            })
            .join(', ')
          v.push({
            level: 'error',
            rule: 'oqituvchi-toqnashuv',
            message: `${t.fullName}: ${DAY_NAMES[d]} ${p + 1}-soatda bir vaqtda ${arr.length} ta sinf (${clsNames}).`,
            refs: { teacherId: t.id, day: d, period: p },
          })
        }
      }
    }
  }

  /* ── 2. Sinf jadvalidagi bo'shliqlar (bo'lmasligi shart) ───────────── */
  let classGaps = 0
  for (const c of classes) {
    const cg = classGrid.get(c.id)!
    const days = c.grade <= 4 ? settings.daysPrimary : settings.daysSenior
    for (let d = 0; d < D; d++) {
      const filled: number[] = []
      for (let p = 0; p < P; p++) if (cg[d][p]) filled.push(p)
      if (filled.length === 0) continue
      if (d >= days) {
        v.push({
          level: 'error',
          rule: 'oquv-kuni',
          message: `${c.grade}-${c.letter}: ${DAY_NAMES[d]} kuni dars bor, lekin bu sinf ${days} kunlik o‘qishda.`,
          refs: { classId: c.id, day: d },
        })
      }
      const first = filled[0]
      const last = filled[filled.length - 1]
      const gaps = last - first + 1 - filled.length
      if (first !== 0) {
        classGaps += first
        v.push({
          level: 'error',
          rule: 'sinf-boshliq',
          message: `${c.grade}-${c.letter}: ${DAY_NAMES[d]} kuni dars 1-soatdan boshlanmayapti.`,
          refs: { classId: c.id, day: d },
        })
      }
      if (gaps > 0) {
        classGaps += gaps
        v.push({
          level: 'error',
          rule: 'sinf-boshliq',
          message: `${c.grade}-${c.letter}: ${DAY_NAMES[d]} kuni jadvalda ${gaps} ta bo‘shliq (oyna) bor.`,
          refs: { classId: c.id, day: d },
        })
      }
      const maxDay = settings.maxPerDayByGrade[c.grade] ?? 6
      if (filled.length > maxDay) {
        v.push({
          level: 'warning',
          rule: 'kunlik-chegara',
          message: `${c.grade}-${c.letter}: ${DAY_NAMES[d]} kuni ${filled.length} soat dars (chegara ${maxDay}).`,
          refs: { classId: c.id, day: d },
        })
      }
    }
  }

  /* ── 3. O'qituvchidagi oynalar ─────────────────────────────────────── */
  let teacherExtraGaps = 0
  for (const t of teachers) {
    const tg = teacherGrid.get(t.id)!
    const tc = teacherConstraints?.[t.id]
    const lim = effectiveDayLimits(settings, tc)
    const blockedDays = tc?.blockedDays ?? t.unavailableDays
    const blockedSlots = new Set((tc?.blockedSlots ?? []).map(([d, p]) => `${d}|${p}`))

    for (let d = 0; d < D; d++) {
      const filled: number[] = []
      for (let p = 0; p < P; p++) if (tg[d][p].length > 0) filled.push(p)
      if (filled.length === 0) continue
      const gaps = filled[filled.length - 1] - filled[0] + 1 - filled.length
      if (gaps > lim.maxGap) {
        teacherExtraGaps += gaps - lim.maxGap
        v.push({
          level: 'error',
          rule: 'oqituvchi-oyna',
          message: `${t.fullName}: ${DAY_NAMES[d]} kuni ${gaps} ta oyna (ruxsat ${lim.maxGap}). Soatlar: ${filled.map((p) => p + 1).join(', ')}.`,
          refs: { teacherId: t.id, day: d },
        })
      }
      if (filled.length > lim.maxPerDay) {
        v.push({
          level: 'warning',
          rule: 'oqituvchi-kunlik',
          message: `${t.fullName}: ${DAY_NAMES[d]} kuni ${filled.length} soat dars (chegara ${lim.maxPerDay}).`,
          refs: { teacherId: t.id, day: d },
        })
      }
      if (blockedDays.includes(d)) {
        v.push({
          level: 'error',
          rule: 'band-kun',
          message: `${t.fullName}: ${DAY_NAMES[d]} bo‘sh kun bo‘lishi kerak edi, lekin ${filled.length} soat dars qo‘yilgan.`,
          refs: { teacherId: t.id, day: d },
        })
      }
      for (const p of filled) {
        if (blockedSlots.has(`${d}|${p}`)) {
          v.push({
            level: 'error',
            rule: 'band-soat',
            message: `${t.fullName}: ${DAY_NAMES[d]} ${p + 1}-soat bo‘sh bo‘lishi kerak edi, lekin dars qo‘yilgan.`,
            refs: { teacherId: t.id, day: d, period: p },
          })
        }
      }
    }
  }

  /* ── 4. Bir fan bir kunda ikki marta ───────────────────────────────── */
  for (const c of classes) {
    const cg = classGrid.get(c.id)!
    for (let d = 0; d < D; d++) {
      const count = new Map<string, number>()
      for (let p = 0; p < P; p++) {
        const uid = cg[d][p]
        if (!uid) continue
        const u = unitById.get(uid)!
        for (const part of u.parts) count.set(part.subjectId, (count.get(part.subjectId) ?? 0) + 1)
      }
      for (const [sid, n] of count) {
        if (n > 1) {
          const hours = effectiveHours(c, sid, ov)
          const days = c.grade <= 4 ? settings.daysPrimary : settings.daysSenior
          const inevitable = hours > days
          v.push({
            level: inevitable ? 'info' : 'warning',
            rule: 'fan-takror',
            message:
              `${c.grade}-${c.letter}: ${DAY_NAMES[d]} kuni "${SUBJECT_BY_ID[sid]?.name ?? sid}" ${n} marta` +
              (inevitable ? ' (haftalik soat kunlar sonidan ko‘p — muqarrar).' : '.'),
            refs: { classId: c.id, day: d },
          })
        }
      }
    }
  }

  /* ── 5. O'qituvchi yuklamasi ───────────────────────────────────────── */
  const loadByTeacher = new Map<string, number>()
  for (const t of teachers) loadByTeacher.set(t.id, 0)
  for (const u of units) {
    for (const part of u.parts) {
      const add = u.alternating ? 0.5 : 1
      loadByTeacher.set(part.teacherId, (loadByTeacher.get(part.teacherId) ?? 0) + add)
    }
  }
  for (const t of teachers) {
    const l = loadByTeacher.get(t.id) ?? 0
    const target = teacherConstraints?.[t.id]?.targetHours
    if (target !== undefined && Math.abs(l - target) > 0.01) {
      v.push({
        level: 'error',
        rule: 'maqsadli-soat',
        message: `${t.fullName}: qoidada ${target} soat belgilangan, jadvalda ${l} soat.`,
        refs: { teacherId: t.id },
      })
      continue
    }
    if (l === 0) {
      v.push({ level: 'warning', rule: 'yuklama', message: `${t.fullName}: dars berilmagan (0 soat).`, refs: { teacherId: t.id } })
    } else if (l < t.minHours) {
      v.push({
        level: 'warning',
        rule: 'yuklama',
        message: `${t.fullName}: ${l} soat — minimal ${t.minHours} soatdan kam.`,
        refs: { teacherId: t.id },
      })
    } else if (l > t.maxHours) {
      v.push({
        level: 'error',
        rule: 'yuklama',
        message: `${t.fullName}: ${l} soat — maksimal ${t.maxHours} soatdan ko‘p.`,
        refs: { teacherId: t.id },
      })
    }
  }

  /* ── 6. Haftalik soat o'quv rejaga mosligi ─────────────────────────── */
  for (const c of classes) {
    for (const s of ALL_SUBJECTS) {
      const need = effectiveHours(c, s.id, ov)
      if (need <= 0) continue
      let got = 0
      const cg = classGrid.get(c.id)!
      for (let d = 0; d < D; d++) {
        for (let p = 0; p < P; p++) {
          const uid = cg[d][p]
          if (!uid) continue
          const u = unitById.get(uid)!
          for (const part of u.parts) if (part.subjectId === s.id) got += part.week === 'all' ? 1 : 0.5
        }
      }
      if (Math.abs(got - need) > 0.01) {
        v.push({
          level: 'error',
          rule: 'soat-mos-emas',
          message: `${c.grade}-${c.letter} — ${s.name}: rejada ${need} soat, jadvalda ${got} soat.`,
          refs: { classId: c.id },
        })
      }
    }
  }

  const order: Record<string, number> = { error: 0, warning: 1, info: 2 }
  v.sort((a, b) => order[a.level] - order[b.level] || a.rule.localeCompare(b.rule))

  return {
    violations: v,
    errors: v.filter((x) => x.level === 'error').length,
    warnings: v.filter((x) => x.level === 'warning').length,
    classGaps,
    teacherExtraGaps,
    teacherClashes,
  }
}
