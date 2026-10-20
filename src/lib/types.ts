/** Bazadagi jadval va ko'rinishlarning turlari (supabase/*.sql bilan bir xil) */

export type Role = 'admin' | 'manager' | 'teacher'
export type UserStatus = 'pending' | 'approved' | 'blocked'
export type AssessKind = 'bsb' | 'chsb'
export type Quarter = 1 | 2 | 3 | 4
export type Mark = 2 | 3 | 4 | 5

export interface GradingRules {
  id: number
  bsb_total: number
  chsb_total: number
  extra_total: number
  edit_days: number
  mark5: number
  mark4: number
  mark3: number
}

export interface Subject {
  id: number
  name: string
  is_split: boolean
}

export interface Profile {
  id: string
  login: string
  last_name: string
  first_name: string
  role: Role
  subject_id: number | null
  status: UserStatus
  created_at: string
}

export interface AcademicYear {
  id: number
  name: string
  is_active: boolean
}

export interface SchoolClass {
  id: string
  year_id: number
  grade: number
  letter: string
  created_at: string
}

export interface Student {
  id: string
  class_id: string
  full_name: string
  order_no: number
  is_active: boolean
}

export interface Group {
  id: string
  class_id: string
  subject_id: number
  name: string
}

export interface GroupStudent {
  group_id: string
  student_id: string
}

export interface Assignment {
  id: string
  class_id: string
  subject_id: number
  teacher_id: string
  group_id: string | null
  created_at: string
}

export interface Assessment {
  id: string
  assignment_id: string
  quarter: Quarter
  kind: AssessKind
  idx: number
  title: string | null
  max_points: number
  held_on: string
  created_at: string
}

/** journal_rows() natijasi — jurnal jadvalining bir satri */
export interface JournalRow {
  student_id: string
  full_name: string
  order_no: number
  points: number | null
  is_auto: boolean
  /** O'quvchining shu chorakdagi (yoki oldingi chorakdagi) o'z darajasi, %.
   *  Cheklov emas — avtomatik baho taklif qilish uchun asos. */
  base_pct: number | null
  locked: boolean
  created_at: string | null
}

/** class_progress() — sinfning o'sish qoidasi bo'yicha holati */
export interface ClassProgress {
  roster: number
  filled: number
  work_pct: number | null
  quarter_pct: number | null
  /** Pasaymasligi kerak bo'lgan daraja (null — birinchi ish, cheklov yo'q) */
  floor_pct: number | null
  complete: boolean
  ok: boolean
  /** Shart bajarilishi uchun sinfga yana shuncha ball kerak */
  need_points: number
}

/** extra_rows() natijasi — chorak oxiridagi 10 ballik baho */
export interface ExtraRow {
  student_id: string
  full_name: string
  order_no: number
  points: number | null
  locked: boolean
  /** 10 ballik bahosiz yig'ilgan ball va maksimal ball */
  q_points: number
  q_max: number
  /** O'quvchining 10 ballsiz chorak foizi */
  base_pct: number | null
}

/** save_grade() / save_extra() javobi */
export interface SaveResult {
  ok: boolean
  points?: number
  error?: 'NOT_FOUND' | 'FORBIDDEN' | 'OVER_MAX' | 'LOCKED' | 'CLASS_TOO_LOW'
  /** CLASS_TOO_LOW bo'lganda: sinf o'rtachasi va kerakli daraja */
  class_pct?: number
  floor_pct?: number
  /** Shu o'quvchiga kamida shuncha ball kerak (maksimaldan oshsa —
   *  boshqa o'quvchilarning ballarini ko'tarish kerak) */
  need_points?: number
  max_points?: number
  until?: string
}

/** save_grades() javobi. Sinf sharti buzilsa — hammasi bekor qilinadi. */
export interface BulkResult {
  saved: number
  failed: (SaveResult & { student_id: string })[]
  error?: 'CLASS_TOO_LOW' | 'NOT_FOUND' | 'FORBIDDEN'
  class_pct?: number
  floor_pct?: number
  need_points?: number
}

/* ─────────────────────── Statistika ko'rinishlari ─────────────────────── */

export interface StudentQuarter {
  assignment_id: string
  class_id: string
  grade: number
  letter: string
  class_name: string
  year_id: number
  subject_id: number
  subject_name: string
  teacher_id: string
  quarter: Quarter
  student_id: string
  student_name: string
  points: number
  max_points: number
  pct: number
  mark: Mark
  bsb_points: number
  chsb_points: number
  extra_points: number
  bsb_count: number
}

/** Barcha kesimlar uchun umumiy ko'rsatkichlar */
export interface QuarterStat {
  quarter: Quarter
  year_id: number
  avg_pct: number | null
  avg_mark: number | null
  quality: number | null
  progress: number | null
  students: number
}

export interface TeacherQuarter extends QuarterStat {
  teacher_id: string
  rows_cnt: number
  classes: number
}

export interface ClassQuarter extends QuarterStat {
  class_id: string
  class_name: string
  grade: number
  subjects: number
}

export interface SubjectQuarter extends QuarterStat {
  subject_id: number
  subject_name: string
  teachers: number
}

export interface SchoolQuarter extends QuarterStat {
  teachers: number
  classes: number
}

/** Parallel: barcha 7-sinflar kabi */
export interface GradeQuarter extends QuarterStat {
  grade: number
  classes: number
}

export interface StudentQuarterAvg {
  student_id: string
  student_name: string
  class_id: string
  class_name: string
  year_id: number
  quarter: Quarter
  subjects: number
  avg_pct: number
  avg_mark: number
}

export interface TeacherActivity {
  teacher_id: string
  quarter: Quarter
  changes: number
  auto_changes: number
  manual_changes: number
  edits: number
  extra_changes: number
  first_at: string
  last_at: string
}

export interface TeacherBlocked {
  teacher_id: string
  quarter: Quarter
  blocked: number
  last_at: string
}

export interface GradeLogRow {
  id: number
  assignment_id: string
  student_id: string
  target: 'grade' | 'extra'
  quarter: Quarter
  old_points: number | null
  new_points: number
  is_auto: boolean
  actor_id: string
  at: string
}

/* ───────────── Dars jadvali va BSB/ChSB rejasi ───────────── */

export interface Lesson {
  id: string
  year_id: number
  class_id: string
  subject_id: number
  weekday: number // 1 = dushanba
  lesson_no: number
  teacher_id: string | null
  room: string | null
}

/** v_timetable — nomlar bilan */
export interface TimetableRow {
  id: string
  year_id: number
  class_id: string
  grade: number
  letter: string
  class_name: string
  subject_id: number
  subject_name: string
  weekday: number
  lesson_no: number
  teacher_id: string | null
  teacher_name: string | null
  room: string | null
}

export interface AssessmentPlan {
  id: string
  year_id: number
  quarter: Quarter
  class_id: string
  subject_id: number
  kind: AssessKind
  idx: number
  planned_on: string
  max_points: number | null
  note: string | null
}

/** Reja satrining bajarilish holati */
export type PlanState = 'none' | 'partial' | 'done'

/** v_plan_status */
export interface PlanStatusRow {
  plan_id: string
  year_id: number
  quarter: Quarter
  class_id: string
  grade: number
  letter: string
  class_name: string
  subject_id: number
  subject_name: string
  kind: AssessKind
  idx: number
  planned_on: string
  max_points: number | null
  note: string | null
  days: number
  state: PlanState
}

export type Urgency = 'late' | 'today' | 'soon'

/** plan_feed() — eslatmalar */
export interface FeedItem {
  plan_id: string
  quarter: Quarter
  class_id: string
  class_name: string
  subject_id: number
  subject_name: string
  kind: AssessKind
  idx: number
  planned_on: string
  max_points: number | null
  days: number
  state: PlanState
  urgency: Urgency
  teacher_id: string | null
  teacher_name: string
  is_read: boolean
}
