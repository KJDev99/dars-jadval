import type { Assignments, LessonUnit, SchoolClass, Settings, Subject, Teacher } from '../types'
import { SUBJECTS, standardHours } from '../data/curriculum'

export interface PlanOverrides {
  /** grade -> subjectId -> soat */
  byGrade: Record<number, Record<string, number>>
  /** classId -> subjectId -> soat (grade darajasidan ustun turadi) */
  byClass: Record<string, Record<string, number>>
}

export function emptyOverrides(): PlanOverrides {
  return { byGrade: {}, byClass: {} }
}

/** Sinf uchun amaldagi haftalik soat */
export function effectiveHours(
  cls: SchoolClass,
  subjectId: string,
  ov: PlanOverrides,
): number {
  const byClass = ov.byClass[cls.id]?.[subjectId]
  if (byClass !== undefined) return byClass
  const byGrade = ov.byGrade[cls.grade]?.[subjectId]
  if (byGrade !== undefined) return byGrade
  return standardHours(cls.grade, subjectId)
}

/** Sinf darajasi uchun amaldagi soat (o'quv reja jadvalida ko'rsatiladi) */
export function gradeHours(grade: number, subjectId: string, ov: PlanOverrides): number {
  const v = ov.byGrade[grade]?.[subjectId]
  return v !== undefined ? v : standardHours(grade, subjectId)
}

export function classSubjects(cls: SchoolClass, ov: PlanOverrides): { subject: Subject; hours: number }[] {
  return SUBJECTS.map((s) => ({ subject: s, hours: effectiveHours(cls, s.id, ov) })).filter(
    (x) => x.hours > 0,
  )
}

export function classTotalHours(cls: SchoolClass, ov: PlanOverrides): number {
  return SUBJECTS.reduce((sum, s) => sum + effectiveHours(cls, s.id, ov), 0)
}

/** Sinf uchun o'quv kunlari soni */
export function daysForClass(cls: SchoolClass, settings: Settings): number {
  return cls.grade <= 4 ? settings.daysPrimary : settings.daysSenior
}

export function maxPerDay(cls: SchoolClass, settings: Settings): number {
  return settings.maxPerDayByGrade[cls.grade] ?? 6
}

export const asgKey = (classId: string, subjectId: string) => `${classId}|${subjectId}`

/** O'qituvchining tarifikatsiya bo'yicha haftalik yuklamasi */
export function teacherLoad(
  teacherId: string,
  classes: SchoolClass[],
  assignments: Assignments,
  ov: PlanOverrides,
): number {
  let sum = 0
  for (const c of classes) {
    for (const s of SUBJECTS) {
      if (assignments[asgKey(c.id, s.id)] === teacherId) {
        sum += effectiveHours(c, s.id, ov)
      }
    }
  }
  return sum
}

export function teacherLoads(
  teachers: Teacher[],
  classes: SchoolClass[],
  assignments: Assignments,
  ov: PlanOverrides,
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const t of teachers) out[t.id] = 0
  for (const c of classes) {
    for (const s of SUBJECTS) {
      const tid = assignments[asgKey(c.id, s.id)]
      if (tid && out[tid] !== undefined) out[tid] += effectiveHours(c, s.id, ov)
    }
  }
  return out
}

/**
 * Sinf uchun dars birliklarini (LessonUnit) hosil qilish.
 * 0,5 soatlik fanlar juftlanib bitta "juft/toq hafta" almashinuvli darsga aylanadi.
 */
export function buildUnitsForClass(
  cls: SchoolClass,
  ov: PlanOverrides,
  assignments: Assignments,
): { units: LessonUnit[]; problems: string[] } {
  const units: LessonUnit[] = []
  const problems: string[] = []
  const halves: { subjectId: string; teacherId: string }[] = []
  let idx = 0

  for (const s of SUBJECTS) {
    const hours = effectiveHours(cls, s.id, ov)
    if (hours <= 0) continue
    const teacherId = assignments[asgKey(cls.id, s.id)]
    if (!teacherId) {
      problems.push(`${cls.id} — ${s.name}: o'qituvchi biriktirilmagan`)
      continue
    }
    const whole = Math.floor(hours)
    const frac = +(hours - whole).toFixed(2)
    for (let i = 0; i < whole; i++) {
      units.push({
        id: `${cls.id}#${s.id}#${idx++}`,
        classId: cls.id,
        parts: [{ subjectId: s.id, teacherId, week: 'all' }],
        alternating: false,
      })
    }
    if (frac > 0) {
      if (Math.abs(frac - 0.5) > 0.01) {
        problems.push(
          `${cls.id} — ${s.name}: ${hours} soat. Faqat 0,5 qadamli soatlar qo'llab-quvvatlanadi.`,
        )
      }
      halves.push({ subjectId: s.id, teacherId })
    }
  }

  // 0,5 soatliklarni juftlab, almashinuvli darsga aylantiramiz
  for (let i = 0; i < halves.length; i += 2) {
    const a = halves[i]
    const b = halves[i + 1]
    if (b) {
      units.push({
        id: `${cls.id}#alt#${idx++}`,
        classId: cls.id,
        parts: [
          { subjectId: a.subjectId, teacherId: a.teacherId, week: 'odd' },
          { subjectId: b.subjectId, teacherId: b.teacherId, week: 'even' },
        ],
        alternating: true,
      })
    } else {
      // Juftlanmagan yarim soat — butun darsga yaxlitlanadi
      units.push({
        id: `${cls.id}#${a.subjectId}#${idx++}`,
        classId: cls.id,
        parts: [{ subjectId: a.subjectId, teacherId: a.teacherId, week: 'all' }],
        alternating: false,
      })
      problems.push(
        `${cls.id}: juftlanmagan 0,5 soatlik fan butun darsga yaxlitlandi (${a.subjectId}).`,
      )
    }
  }

  return { units, problems }
}

/* ───────────────────────── Stavka hisob-kitobi ───────────────────────── */

/** Haftalik soat necha stavkaga teng */
export function stavkaOf(hours: number, stavkaHours: number): number {
  return stavkaHours > 0 ? hours / stavkaHours : 0
}

/** "1,06 stavka" ko'rinishidagi matn */
export function formatStavka(hours: number, stavkaHours: number): string {
  return stavkaOf(hours, stavkaHours).toFixed(2).replace('.', ',')
}

/* ─────────────── Reja va reja tashqarisidagi soatlar ─────────────── */

/** Tayanch o'quv rejaga kiruvchi soatlar (Ma'naviyat soatisiz) */
export function classPlanHours(cls: SchoolClass, ov: PlanOverrides): number {
  return SUBJECTS.filter((s) => !s.outsidePlan).reduce(
    (sum, s) => sum + effectiveHours(cls, s.id, ov),
    0,
  )
}

/** Reja tashqarisidagi soatlar (Ma'naviyat soati) */
export function classExtraHours(cls: SchoolClass, ov: PlanOverrides): number {
  return SUBJECTS.filter((s) => s.outsidePlan).reduce(
    (sum, s) => sum + effectiveHours(cls, s.id, ov),
    0,
  )
}
