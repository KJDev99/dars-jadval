import type { Rule, Settings, Teacher } from '../types'

/** Bitta o'qituvchi uchun yig'ilgan cheklovlar */
export interface TeacherConstraints {
  /** To'liq band kunlar */
  blockedDays: number[]
  /** Aniq band soatlar: [kun, soat] */
  blockedSlots: [number, number][]
  /** Kunlik maksimal dars soati */
  maxPerDay?: number
  /** Kunlik maksimal oyna */
  maxGap?: number
  /** Aniq haftalik soat (tarifikatsiyada qo'llanadi) */
  targetHours?: number
  /** Metodbirlashmaning metodik kuni (agar belgilangan bo'lsa) */
  pedagogicalDay?: number
}

export type TeacherConstraintMap = Record<string, TeacherConstraints>

/**
 * O'qituvchi kartochkasidagi band kunlar + qoidalar ro'yxatini birlashtiradi.
 * Faqat `active: true` qoidalar hisobga olinadi.
 */
export function resolveTeacherConstraints(
  teachers: Teacher[],
  rules: Rule[],
  /** Mutaxassislik -> metodik kun */
  pedagogicalDays?: Record<string, number>,
): TeacherConstraintMap {
  const out: TeacherConstraintMap = {}
  for (const t of teachers) {
    const c: TeacherConstraints = {
      blockedDays: [...t.unavailableDays],
      blockedSlots: [],
    }
    // Metodbirlashmaning metodik kuni — shu guruhning hamma o'qituvchisiga tegishli
    const ped = pedagogicalDays?.[t.speciality]
    if (ped !== undefined && ped >= 0) {
      c.pedagogicalDay = ped
      if (!c.blockedDays.includes(ped)) c.blockedDays.push(ped)
    }
    out[t.id] = c
  }

  for (const r of rules) {
    if (!r.active || !r.teacherId) continue
    const c = out[r.teacherId]
    if (!c) continue
    switch (r.kind) {
      case 'teacher-day-off':
        if (r.day !== undefined && !c.blockedDays.includes(r.day)) c.blockedDays.push(r.day)
        break
      case 'teacher-slot-off':
        if (r.day !== undefined && r.period !== undefined) c.blockedSlots.push([r.day, r.period])
        break
      case 'teacher-max-per-day':
        if (r.value !== undefined) c.maxPerDay = Math.min(c.maxPerDay ?? 99, r.value)
        break
      case 'teacher-max-gap':
        if (r.value !== undefined) c.maxGap = Math.min(c.maxGap ?? 99, r.value)
        break
      case 'teacher-target-hours':
        if (r.value !== undefined) c.targetHours = r.value
        break
      case 'note':
        break
    }
  }

  for (const c of Object.values(out)) c.blockedDays.sort((a, b) => a - b)
  return out
}

/** Tarifikatsiya uchun amaldagi min/maks soat */
export function effectiveLoadLimits(t: Teacher, c?: TeacherConstraints) {
  if (c?.targetHours !== undefined) {
    return { min: c.targetHours, max: c.targetHours, target: c.targetHours }
  }
  return { min: t.minHours, max: t.maxHours, target: undefined as number | undefined }
}

/** Jadvalda qo'llanadigan amaldagi kunlik chegaralar */
export function effectiveDayLimits(settings: Settings, c?: TeacherConstraints) {
  return {
    maxPerDay: c?.maxPerDay ?? settings.maxTeacherLessonsPerDay,
    maxGap: c?.maxGap ?? settings.maxTeacherGapPerDay,
  }
}

export function describeRule(r: Rule, teacherName?: string, className?: string): string {
  const who = teacherName ?? className ?? ''
  const D = ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba']
  switch (r.kind) {
    case 'teacher-target-hours':
      return `${who}da aniq ${r.value} soat dars bo'lsin`
    case 'teacher-day-off':
      return `${who} — ${D[r.day ?? 0]} kuni dars bo'lmasin`
    case 'teacher-slot-off':
      return `${who} — ${D[r.day ?? 0]} kuni ${(r.period ?? 0) + 1}-soatda dars bo'lmasin`
    case 'teacher-max-per-day':
      return `${who} — kuniga ko'pi bilan ${r.value} soat`
    case 'teacher-max-gap':
      return `${who} — kuniga ko'pi bilan ${r.value} ta oyna`
    case 'note':
      return r.note || 'Izoh'
  }
}
