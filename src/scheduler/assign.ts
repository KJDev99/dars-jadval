import type { Assignments, SchoolClass, Teacher } from '../types'
import { SUBJECTS, SUBJECT_BY_ID } from '../data/curriculum'
import { asgKey, effectiveHours, type PlanOverrides } from '../lib/derive'
import { effectiveLoadLimits, type TeacherConstraintMap } from '../lib/rules'
import { makeRng } from '../lib/rng'

export interface AssignResult {
  assignments: Assignments
  problems: string[]
  warnings: string[]
}

/**
 * Tarifikatsiya — har bir (sinf, fan) juftligiga o'qituvchi biriktirish.
 *
 * Qoidalar:
 *  • Boshlang'ich sinflarda (1–4) sinf rahbari o'qitadigan fanlar o'sha sinf rahbariga beriladi.
 *  • O'qituvchi faqat o'zi mutaxassis bo'lgan fanni o'qitadi.
 *  • Haftalik yuklama maxHours dan oshmaydi (default 24 soat).
 *  • Iloji boricha bir sinfda kam o'qituvchi, bir o'qituvchida parallel sinflar bo'ladi.
 */
export function autoAssign(
  classes: SchoolClass[],
  teachers: Teacher[],
  ov: PlanOverrides,
  existing: Assignments,
  keepManual: boolean,
  seed = 7,
  constraints?: TeacherConstraintMap,
): AssignResult {
  const rng = makeRng(seed)
  const limits = (t: Teacher) => effectiveLoadLimits(t, constraints?.[t.id])
  const assignments: Assignments = keepManual ? { ...existing } : {}
  const problems: string[] = []
  const warnings: string[] = []

  const load: Record<string, number> = {}
  for (const t of teachers) load[t.id] = 0

  const byId = new Map(teachers.map((t) => [t.id, t]))
  const classById = new Map(classes.map((c) => [c.id, c]))

  // Saqlangan biriktirishlarning yuklamasini hisobga olamiz
  for (const [key, tid] of Object.entries(assignments)) {
    const [classId, subjectId] = key.split('|')
    const cls = classById.get(classId)
    if (!cls || !byId.has(tid)) {
      delete assignments[key]
      continue
    }
    load[tid] += effectiveHours(cls, subjectId, ov)
  }

  // 1) Boshlang'ich sinflar — sinf rahbariga biriktirish
  const homeroomByClass = new Map<string, Teacher>()
  for (const t of teachers) if (t.homeroomClassId) homeroomByClass.set(t.homeroomClassId, t)

  type Task = { cls: SchoolClass; subjectId: string; hours: number }
  const tasks: Task[] = []

  for (const cls of classes) {
    for (const s of SUBJECTS) {
      const hours = effectiveHours(cls, s.id, ov)
      if (hours <= 0) continue
      const key = asgKey(cls.id, s.id)
      if (assignments[key]) continue

      const homeroom = homeroomByClass.get(cls.id)
      if (cls.grade <= 4 && s.primaryHomeroom && homeroom?.subjectIds.includes(s.id)) {
        assignments[key] = homeroom.id
        load[homeroom.id] += hours
        continue
      }
      tasks.push({ cls, subjectId: s.id, hours })
    }
  }

  // 2) Qolgan fanlar — kamyob mutaxassislikdan boshlab taqsimlaymiz
  const candidatesOf = (t: Task): Teacher[] =>
    teachers.filter(
      (te) =>
        te.subjectIds.includes(t.subjectId) &&
        (!te.homeroomClassId || te.homeroomClassId === t.cls.id),
    )

  const candCount = new Map<string, number>()
  for (const t of tasks) {
    const k = t.subjectId
    if (!candCount.has(k)) candCount.set(k, candidatesOf(t).length)
  }

  tasks.sort((a, b) => {
    const ca = candCount.get(a.subjectId)!
    const cb = candCount.get(b.subjectId)!
    if (ca !== cb) return ca - cb // kamyob mutaxassislar birinchi
    if (b.hours !== a.hours) return b.hours - a.hours
    return a.cls.grade - b.cls.grade || a.cls.letter.localeCompare(b.cls.letter)
  })

  // Yordamchi: o'qituvchi shu sinfda / shu darajada nechta soat o'qitadi
  const teacherClassHours = new Map<string, number>() // `${tid}|${classId}`
  const teacherGradeSubject = new Map<string, number>() // `${tid}|${grade}|${subjectId}`

  for (const task of tasks) {
    const cands = candidatesOf(task)
    if (cands.length === 0) {
      problems.push(
        `${task.cls.grade}-${task.cls.letter} — ${SUBJECT_BY_ID[task.subjectId]?.name}: mos mutaxassis o'qituvchi topilmadi.`,
      )
      continue
    }

    let best: Teacher | null = null
    let bestScore = Infinity
    for (const te of cands) {
      const lim = limits(te)
      const newLoad = load[te.id] + task.hours
      if (newLoad > lim.max) continue

      // Kam yuklangan o'qituvchi afzal
      let score = newLoad / Math.max(1, lim.max)

      // Aniq soat belgilangan bo'lsa — o'sha soatga to'ldirish ustuvor
      if (lim.target !== undefined) score -= 0.5

      // Parallel sinflarda bir xil o'qituvchi bo'lgani yaxshi (metodik jihatdan)
      const gk = `${te.id}|${task.cls.grade}|${task.subjectId}`
      if (teacherGradeSubject.has(gk)) score -= 0.18

      // Shu sinfda allaqachon dars beradigan o'qituvchi afzal (kam o'qituvchi = kam to'qnashuv)
      const ck = `${te.id}|${task.cls.id}`
      if (teacherClassHours.has(ck)) score -= 0.06

      // Mutaxassisligi tor bo'lgan o'qituvchi afzal (universal o'qituvchi zaxirada qolsin)
      score += te.subjectIds.length * 0.004
      score += rng() * 0.02

      if (score < bestScore) {
        bestScore = score
        best = te
      }
    }

    if (!best) {
      problems.push(
        `${task.cls.grade}-${task.cls.letter} — ${SUBJECT_BY_ID[task.subjectId]?.name}: barcha mos o'qituvchilarning yuklamasi to'lgan (maks. soat oshib ketadi).`,
      )
      continue
    }

    assignments[asgKey(task.cls.id, task.subjectId)] = best.id
    load[best.id] += task.hours
    teacherClassHours.set(`${best.id}|${task.cls.id}`, (teacherClassHours.get(`${best.id}|${task.cls.id}`) ?? 0) + task.hours)
    teacherGradeSubject.set(`${best.id}|${task.cls.grade}|${task.subjectId}`, 1)
  }

  // 3) Yuklama tekshiruvi
  for (const t of teachers) {
    const lim = limits(t)
    if (lim.target !== undefined) {
      if (Math.abs(load[t.id] - lim.target) > 0.01) {
        problems.push(
          `${t.fullName} — qoidada ${lim.target} soat belgilangan, lekin ${load[t.id]} soat to‘ldi. ` +
            `Mos fanlar yetarli emas yoki boshqa qoidalar to‘sqinlik qilmoqda.`,
        )
      }
      continue
    }
    if (load[t.id] === 0) {
      warnings.push(`${t.fullName} (${t.speciality}) — dars berilmadi (0 soat).`)
    } else if (load[t.id] < t.minHours) {
      warnings.push(`${t.fullName} — ${load[t.id]} soat, minimal ${t.minHours} soatdan kam.`)
    }
  }

  return { assignments, problems, warnings }
}

/* ─────────────────────── Darslarni o'tkazish ─────────────────────────── */

export interface TransferItem {
  classId: string
  subjectId: string
  hours: number
}

/** `fromTeacherId` ning barcha (sinf, fan) yuklamalari */
export function teacherWorkload(
  teacherId: string,
  classes: SchoolClass[],
  assignments: Assignments,
  ov: PlanOverrides,
): TransferItem[] {
  const out: TransferItem[] = []
  for (const c of classes) {
    for (const s of SUBJECTS) {
      if (assignments[asgKey(c.id, s.id)] !== teacherId) continue
      out.push({ classId: c.id, subjectId: s.id, hours: effectiveHours(c, s.id, ov) })
    }
  }
  return out
}

export interface TransferCheck {
  ok: boolean
  /** Qabul qiluvchi o'qituvchi mutaxassis bo'lmagan fanlar */
  missingSubjects: string[]
  newLoad: number
  limit: number
  overload: boolean
}

/** O'tkazishdan oldingi tekshiruv */
export function checkTransfer(
  to: Teacher,
  items: TransferItem[],
  currentLoad: number,
  constraints?: TeacherConstraintMap,
): TransferCheck {
  const missing = [...new Set(items.map((i) => i.subjectId))].filter((sid) => !to.subjectIds.includes(sid))
  const add = items.reduce((s, i) => s + i.hours, 0)
  const lim = effectiveLoadLimits(to, constraints?.[to.id])
  const newLoad = currentLoad + add
  return {
    ok: missing.length === 0 && newLoad <= lim.max,
    missingSubjects: missing,
    newLoad,
    limit: lim.max,
    overload: newLoad > lim.max,
  }
}

/** Tanlangan (sinf, fan) larni boshqa o'qituvchiga o'tkazish */
export function applyTransfer(
  assignments: Assignments,
  items: TransferItem[],
  toTeacherId: string,
): Assignments {
  const next = { ...assignments }
  for (const it of items) next[asgKey(it.classId, it.subjectId)] = toTeacherId
  return next
}
