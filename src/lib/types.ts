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
  floor_pct: number
  min_points: number
  locked: boolean
  created_at: string | null
}

/** extra_rows() natijasi — chorak oxiridagi 10 ballik baho */
export interface ExtraRow {
  student_id: string
  full_name: string
  order_no: number
  points: number | null
  min_points: number
  locked: boolean
  /** 10 ballik bahosiz yig'ilgan ball va maksimal ball */
  q_points: number
  q_max: number
  pct_now: number | null
}

/** save_grade() / save_extra() javobi */
export interface SaveResult {
  ok: boolean
  points?: number
  error?: 'NOT_FOUND' | 'FORBIDDEN' | 'OVER_MAX' | 'LOCKED' | 'TOO_LOW'
  min_points?: number
  max_points?: number
  floor_pct?: number
  until?: string
}

export interface BulkResult {
  saved: number
  failed: (SaveResult & { student_id: string })[]
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
