/**
 * BSB va ChSB — summativ baholash hisob-kitobi.
 *
 * Tartib:
 *   1. Har bo'lim tugagach BSB o'tkaziladi. Chorakdagi BSB soni fanning
 *      haftalik soatiga bog'liq (`settings.grading.bsbPlan`).
 *   2. Chorak oxirida bir marta ChSB o'tkaziladi.
 *   3. Chorak natijasi:
 *        foiz = BSB foizi × bsbWeight + ChSB foizi × chsbWeight
 *      Agar ish turlaridan biri hali o'tkazilmagan bo'lsa, og'irliklar
 *      mavjud qismga qayta taqsimlanadi — chala ma'lumot ham ko'rsatiladi.
 *   4. Foizdan 5 ballik bahoga `mark5 / mark4 / mark3` chegaralari bo'yicha o'tiladi.
 *
 * Barcha chegaralar va og'irliklar sozlamalarda — nizom o'zgarsa kodni
 * o'zgartirish shart emas.
 */
import type {
  Assessment, Assignments, GradingSettings, Mark, Quarter, SchoolClass, Settings, Student,
  Teacher,
} from '../types'
import { SUBJECTS, SUBJECT_BY_ID } from '../data/curriculum'
import { asgKey, effectiveHours, type PlanOverrides } from './derive'

/* ─────────────────────────── Asosiy hisoblar ─────────────────────────── */

export const MARK_VALUES: Mark[] = [5, 4, 3, 2]

/** Bo'sh baho taqsimoti */
export const emptyDist = (): Record<Mark, number> => ({ 5: 0, 4: 0, 3: 0, 2: 0 })

/** Foizdan 5 ballik bahoga */
export function markOf(percent: number, g: GradingSettings): Mark {
  if (percent >= g.mark5) return 5
  if (percent >= g.mark4) return 4
  if (percent >= g.mark3) return 3
  return 2
}

/** Fanning haftalik soatiga qarab chorakda nechta BSB rejalashtiriladi */
export function plannedBsbCount(weeklyHours: number, g: GradingSettings): number {
  if (weeklyHours <= 0) return 0
  if (weeklyHours <= 1) return g.bsbPlan[0]
  if (weeklyHours <= 2) return g.bsbPlan[1]
  return g.bsbPlan[2]
}

/** Sinf darajasi umuman baholanadimi (1-sinf odatda baholanmaydi) */
export function isGradedGrade(grade: number, g: GradingSettings): boolean {
  return !g.ungradedGrades.includes(grade)
}

/** Baho rangi — jadvallarda bir xil ishlatiladi */
export const MARK_TINT: Record<Mark, string> = {
  5: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  4: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  3: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  2: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
}

/** Foizni chiroyli matnga: 87,5% */
export const pct = (v: number | null): string =>
  v === null ? '—' : `${v.toFixed(1).replace(/[.,]0$/, '').replace('.', ',')}%`

/** O'rtacha ballni matnga: 4,32 */
export const ball = (v: number | null): string =>
  v === null || !Number.isFinite(v) ? '—' : v.toFixed(2).replace('.', ',')

/* ──────────────────── Bitta o'quvchining bitta fani ──────────────────── */

export interface StudentSubjectResult {
  studentId: string
  /** BSB lardan yig'ilgan ball va maksimal ball */
  bsbScore: number
  bsbMax: number
  bsbPercent: number | null
  chsbScore: number | null
  chsbMax: number | null
  chsbPercent: number | null
  /** Og'irliklar bilan hisoblangan yakuniy foiz */
  percent: number | null
  mark: Mark | null
  /** Qatnashmagan ishlar soni */
  missed: number
  /** Ball qo'yilmagan (jurnal bo'sh) ishlar soni */
  empty: number
}

/**
 * Bitta o'quvchining bitta fandan chorakdagi natijasi.
 * Faqat topshirilgan (yoki `includeDrafts` bo'lsa barcha) ishlar hisobga olinadi.
 */
export function studentResult(
  studentId: string,
  bsb: Assessment[],
  chsb: Assessment | undefined,
  g: GradingSettings,
): StudentSubjectResult {
  let bsbScore = 0
  let bsbMax = 0
  let missed = 0
  let empty = 0

  for (const a of bsb) {
    if (a.absent.includes(studentId)) {
      missed++
      continue
    }
    const v = a.scores[studentId]
    if (v === undefined) {
      empty++
      continue
    }
    bsbScore += v
    bsbMax += a.maxScore
  }

  let chsbScore: number | null = null
  let chsbMax: number | null = null
  if (chsb) {
    if (chsb.absent.includes(studentId)) missed++
    else {
      const v = chsb.scores[studentId]
      if (v === undefined) empty++
      else {
        chsbScore = v
        chsbMax = chsb.maxScore
      }
    }
  }

  const bsbPercent = bsbMax > 0 ? (bsbScore / bsbMax) * 100 : null
  const chsbPercent = chsbMax && chsbMax > 0 ? ((chsbScore ?? 0) / chsbMax) * 100 : null

  // Og'irliklarni mavjud qismga qayta taqsimlaymiz
  let percent: number | null = null
  if (bsbPercent !== null && chsbPercent !== null) {
    const w = g.bsbWeight + g.chsbWeight || 1
    percent = (bsbPercent * g.bsbWeight + chsbPercent * g.chsbWeight) / w
  } else if (bsbPercent !== null) percent = bsbPercent
  else if (chsbPercent !== null) percent = chsbPercent

  return {
    studentId,
    bsbScore,
    bsbMax,
    bsbPercent,
    chsbScore,
    chsbMax,
    chsbPercent,
    percent,
    mark: percent === null ? null : markOf(percent, g),
    missed,
    empty,
  }
}

/* ───────────────────────── Umumlashtirilgan ko'rsatkichlar ───────────── */

export interface Summary {
  /** Baho olgan o'quvchilar soni */
  count: number
  dist: Record<Mark, number>
  /** O'rtacha ball (2–5) */
  avgMark: number | null
  /** O'rtacha o'zlashtirish foizi */
  avgPercent: number | null
  /** Sifat ko'rsatkichi — «4» va «5» baholilar ulushi, % */
  quality: number | null
  /** O'zlashtirish — «3», «4», «5» baholilar ulushi, % */
  progress: number | null
}

export function emptySummary(): Summary {
  return { count: 0, dist: emptyDist(), avgMark: null, avgPercent: null, quality: null, progress: null }
}

/** Baho va foizlarni yig'ib boruvchi hisoblagich */
export class SummaryBuilder {
  private dist = emptyDist()
  private percentSum = 0
  private count = 0

  add(mark: Mark | null, percent: number | null): void {
    if (mark === null || percent === null) return
    this.dist[mark]++
    this.percentSum += percent
    this.count++
  }

  merge(other: Summary): void {
    for (const m of MARK_VALUES) this.dist[m] += other.dist[m]
    if (other.avgPercent !== null) this.percentSum += other.avgPercent * other.count
    this.count += other.count
  }

  build(): Summary {
    const n = this.count
    if (n === 0) return emptySummary()
    const good = this.dist[5] + this.dist[4]
    const passed = good + this.dist[3]
    return {
      count: n,
      dist: { ...this.dist },
      avgMark: (this.dist[5] * 5 + this.dist[4] * 4 + this.dist[3] * 3 + this.dist[2] * 2) / n,
      avgPercent: this.percentSum / n,
      quality: (good / n) * 100,
      progress: (passed / n) * 100,
    }
  }
}

/* ─────────────────────────── Sinf-fan katagi ─────────────────────────── */

/** Bitta sinf-fan bo'yicha chorakning holati */
export type CellStatus =
  /** Hech qanday ish kiritilmagan */
  | 'yoq'
  /** Ish bor, lekin biror ish topshirilmagan (qoralama) */
  | 'qoralama'
  /** Bir qismi topshirilgan, reja to'lmagan */
  | 'chala'
  /** Barcha rejadagi BSB va ChSB topshirilgan */
  | 'tayyor'

export const STATUS_LABELS: Record<CellStatus, string> = {
  yoq: 'Boshlanmagan',
  qoralama: 'Qoralama',
  chala: 'Chala',
  tayyor: 'Tayyor',
}

export const STATUS_TINT: Record<CellStatus, string> = {
  yoq: 'bg-raised text-muted',
  qoralama: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
  chala: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  tayyor: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
}

export interface Cell {
  classId: string
  subjectId: string
  quarter: Quarter
  teacherId?: string
  /** Haftalik soat */
  hours: number
  /** Rejadagi BSB soni */
  plannedBsb: number
  /** Hisobga olingan BSB ishlari (topshirilganlar) */
  bsb: Assessment[]
  chsb?: Assessment
  /** Chorakdagi barcha ishlar — qoralamalar bilan birga */
  works: Assessment[]
  submitted: number
  status: CellStatus
  /** O'quvchilar bo'yicha natijalar */
  results: StudentSubjectResult[]
  summary: Summary
  /** Baho qo'yilmay qolgan o'quvchilar soni */
  ungraded: number
}

export const cellKey = (classId: string, subjectId: string) => `${classId}|${subjectId}`

function statusOf(works: Assessment[], plannedBsb: number): CellStatus {
  if (works.length === 0) return 'yoq'
  const done = works.filter((w) => w.submittedAt)
  if (done.length === 0) return 'qoralama'
  const bsbDone = done.filter((w) => w.kind === 'bsb').length
  const chsbDone = done.some((w) => w.kind === 'chsb')
  return bsbDone >= plannedBsb && chsbDone ? 'tayyor' : 'chala'
}

/* ─────────────────────────── Umumiy jurnal ───────────────────────────── */

export interface GradeBookInput {
  classes: SchoolClass[]
  students: Student[]
  teachers: Teacher[]
  assessments: Assessment[]
  assignments: Assignments
  overrides: PlanOverrides
  settings: Settings
  quarter: Quarter
  /**
   * Qoralamalar ham hisobga olinsinmi.
   * Kabinetda — ha (o'qituvchi o'z natijasini ko'radi),
   * rahbariyat hisobotida — yo'q (faqat topshirilganlar).
   */
  includeDrafts?: boolean
}

export interface ClassSummary {
  classId: string
  grade: number
  studentsCount: number
  /** Baholanadigan fanlar soni */
  subjects: number
  /** Tayyor sinf-fanlar soni */
  ready: number
  summary: Summary
  /** O'quvchilar bo'yicha chorak natijasi */
  students: StudentQuarter[]
}

export interface StudentQuarter {
  studentId: string
  fullName: string
  classId: string
  /** subjectId -> baho */
  marks: Record<string, Mark>
  /** subjectId -> foiz */
  percents: Record<string, number>
  avgMark: number | null
  /** Baholangan fanlar soni */
  subjects: number
  /** «2» baho olgan fanlar */
  failing: number
  /** Barcha fanlardan «5» */
  excellent: boolean
}

export interface GroupSummary {
  id: string
  label: string
  summary: Summary
  /** Tayyor / jami sinf-fanlar */
  ready: number
  cells: number
}

export interface TeacherSummary extends GroupSummary {
  teacherId: string
  /** Topshirilmagan (yoki chala) sinf-fanlar */
  pending: number
  /** Kiritilgan ishlar soni */
  works: number
  submittedWorks: number
  /** Baho qo'yilmagan o'quvchi-ish juftliklari */
  ungraded: number
}

export interface GradeBook {
  quarter: Quarter
  /** `classId|subjectId` -> katak */
  cells: Map<string, Cell>
  byClass: ClassSummary[]
  bySubject: GroupSummary[]
  byTeacher: TeacherSummary[]
  school: Summary
  /** Umumiy sinf-fanlar soni va tayyorlari */
  totals: { cells: number; ready: number; works: number; submitted: number; students: number }
}

/**
 * Chorak bo'yicha to'liq jurnalni yig'ish.
 * Og'ir amal emas — 30 sinf × 20 fan × 30 o'quvchi ≈ 18 000 hisob, ~5 ms.
 */
export function buildGradeBook(input: GradeBookInput): GradeBook {
  const {
    classes, students, teachers, assessments, assignments, overrides, settings, quarter,
    includeDrafts = false,
  } = input
  const g = settings.grading

  const studentsByClass = new Map<string, Student[]>()
  for (const st of students) {
    if (!st.active) continue
    const list = studentsByClass.get(st.classId)
    if (list) list.push(st)
    else studentsByClass.set(st.classId, [st])
  }
  for (const list of studentsByClass.values()) list.sort((a, b) => a.order - b.order)

  // Chorakdagi ishlarni sinf-fan bo'yicha guruhlaymiz
  const worksByCell = new Map<string, Assessment[]>()
  for (const a of assessments) {
    if (a.quarter !== quarter) continue
    const k = cellKey(a.classId, a.subjectId)
    const list = worksByCell.get(k)
    if (list) list.push(a)
    else worksByCell.set(k, [a])
  }

  const cells = new Map<string, Cell>()
  const byClass: ClassSummary[] = []
  const subjectAcc = new Map<string, { b: SummaryBuilder; ready: number; cells: number }>()
  const teacherAcc = new Map<string, {
    b: SummaryBuilder; ready: number; cells: number; pending: number
    works: number; submitted: number; ungraded: number
  }>()
  const schoolB = new SummaryBuilder()
  let totalCells = 0
  let totalReady = 0
  let totalWorks = 0
  let totalSubmitted = 0

  for (const cls of classes) {
    const graded = isGradedGrade(cls.grade, g)
    const roster = studentsByClass.get(cls.id) ?? []
    const classB = new SummaryBuilder()
    const perStudent = new Map<string, StudentQuarter>()
    for (const st of roster) {
      perStudent.set(st.id, {
        studentId: st.id,
        fullName: st.fullName,
        classId: cls.id,
        marks: {},
        percents: {},
        avgMark: null,
        subjects: 0,
        failing: 0,
        excellent: false,
      })
    }

    let subjectCount = 0
    let readyCount = 0

    for (const sub of SUBJECTS) {
      const hours = effectiveHours(cls, sub.id, overrides)
      if (hours <= 0 || !graded) continue
      subjectCount++
      totalCells++

      const k = cellKey(cls.id, sub.id)
      const works = (worksByCell.get(k) ?? []).slice().sort(sortWorks)
      const teacherId = assignments[asgKey(cls.id, sub.id)] || works[0]?.teacherId
      const plannedBsb = plannedBsbCount(hours, g)
      const status = statusOf(works, plannedBsb)
      const counted = includeDrafts ? works : works.filter((w) => w.submittedAt)
      const bsb = counted.filter((w) => w.kind === 'bsb')
      const chsb = counted.find((w) => w.kind === 'chsb')

      const cellB = new SummaryBuilder()
      const results: StudentSubjectResult[] = []
      let ungraded = 0
      for (const st of roster) {
        const r = studentResult(st.id, bsb, chsb, g)
        results.push(r)
        if (r.mark === null) ungraded++
        cellB.add(r.mark, r.percent)
        const sq = perStudent.get(st.id)
        if (sq && r.mark !== null && r.percent !== null) {
          sq.marks[sub.id] = r.mark
          sq.percents[sub.id] = r.percent
        }
      }

      const summary = cellB.build()
      const submitted = works.filter((w) => w.submittedAt).length
      totalWorks += works.length
      totalSubmitted += submitted
      if (status === 'tayyor') {
        readyCount++
        totalReady++
      }

      cells.set(k, {
        classId: cls.id,
        subjectId: sub.id,
        quarter,
        teacherId,
        hours,
        plannedBsb,
        bsb,
        chsb,
        works,
        submitted,
        status,
        results,
        summary,
        ungraded,
      })

      classB.merge(summary)
      schoolB.merge(summary)

      const sAcc = subjectAcc.get(sub.id) ?? { b: new SummaryBuilder(), ready: 0, cells: 0 }
      sAcc.b.merge(summary)
      sAcc.cells++
      if (status === 'tayyor') sAcc.ready++
      subjectAcc.set(sub.id, sAcc)

      if (teacherId) {
        const tAcc = teacherAcc.get(teacherId) ?? {
          b: new SummaryBuilder(), ready: 0, cells: 0, pending: 0, works: 0, submitted: 0, ungraded: 0,
        }
        tAcc.b.merge(summary)
        tAcc.cells++
        tAcc.works += works.length
        tAcc.submitted += submitted
        tAcc.ungraded += ungraded
        if (status === 'tayyor') tAcc.ready++
        else tAcc.pending++
        teacherAcc.set(teacherId, tAcc)
      }
    }

    // O'quvchilarning chorak yakuni
    const list = [...perStudent.values()]
    for (const sq of list) {
      const marks = Object.values(sq.marks)
      sq.subjects = marks.length
      sq.avgMark = marks.length ? marks.reduce((a, b) => a + b, 0) / marks.length : null
      sq.failing = marks.filter((m) => m === 2).length
      sq.excellent = marks.length > 0 && marks.every((m) => m === 5)
    }
    list.sort((a, b) => (b.avgMark ?? -1) - (a.avgMark ?? -1) || a.fullName.localeCompare(b.fullName))

    byClass.push({
      classId: cls.id,
      grade: cls.grade,
      studentsCount: roster.length,
      subjects: subjectCount,
      ready: readyCount,
      summary: classB.build(),
      students: list,
    })
  }

  const bySubject: GroupSummary[] = [...subjectAcc.entries()]
    .map(([id, v]) => ({
      id,
      label: SUBJECT_BY_ID[id]?.name ?? id,
      summary: v.b.build(),
      ready: v.ready,
      cells: v.cells,
    }))
    .sort((a, b) => a.label.localeCompare(b.label))

  const teacherById = new Map(teachers.map((t) => [t.id, t]))
  const byTeacher: TeacherSummary[] = [...teacherAcc.entries()]
    .map(([id, v]) => ({
      id,
      teacherId: id,
      label: teacherById.get(id)?.fullName ?? "O'chirilgan o'qituvchi",
      summary: v.b.build(),
      ready: v.ready,
      cells: v.cells,
      pending: v.pending,
      works: v.works,
      submittedWorks: v.submitted,
      ungraded: v.ungraded,
    }))
    .sort((a, b) => a.label.localeCompare(b.label))

  return {
    quarter,
    cells,
    byClass,
    bySubject,
    byTeacher,
    school: schoolB.build(),
    totals: {
      cells: totalCells,
      ready: totalReady,
      works: totalWorks,
      submitted: totalSubmitted,
      students: [...studentsByClass.values()].reduce((n, l) => n + l.length, 0),
    },
  }
}

/** Ishlarni tabiiy tartibda: avval BSB lar raqami bo'yicha, oxirida ChSB */
export function sortWorks(a: Assessment, b: Assessment): number {
  if (a.kind !== b.kind) return a.kind === 'bsb' ? -1 : 1
  return a.order - b.order || a.date.localeCompare(b.date) || a.createdAt - b.createdAt
}

/** Ish nomi: «2-BSB» yoki «ChSB» */
export function workLabel(a: Pick<Assessment, 'kind' | 'order'>): string {
  return a.kind === 'chsb' ? 'ChSB' : `${a.order}-BSB`
}

/* ──────────────── O'qituvchining o'z sinf-fanlari ro'yxati ───────────── */

export interface TeacherCell {
  classId: string
  subjectId: string
  hours: number
  grade: number
}

/** Tarifikatsiya bo'yicha o'qituvchiga biriktirilgan, baholanadigan sinf-fanlar */
export function teacherCells(
  teacherId: string,
  classes: SchoolClass[],
  assignments: Assignments,
  overrides: PlanOverrides,
  g: GradingSettings,
): TeacherCell[] {
  const out: TeacherCell[] = []
  for (const cls of classes) {
    if (!isGradedGrade(cls.grade, g)) continue
    for (const sub of SUBJECTS) {
      if (assignments[asgKey(cls.id, sub.id)] !== teacherId) continue
      const hours = effectiveHours(cls, sub.id, overrides)
      if (hours <= 0) continue
      out.push({ classId: cls.id, subjectId: sub.id, hours, grade: cls.grade })
    }
  }
  out.sort(
    (a, b) =>
      a.grade - b.grade ||
      a.classId.localeCompare(b.classId) ||
      (SUBJECT_BY_ID[a.subjectId]?.name ?? '').localeCompare(SUBJECT_BY_ID[b.subjectId]?.name ?? ''),
  )
  return out
}
