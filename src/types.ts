/** Domen modeli — maktab dars jadvali tizimi */

/** Fan yo'nalishlari (tayanch o'quv rejadagi bo'limlar) */
export type FanYonalishi =
  | 'Filologiya fanlari'
  | 'Ijtimoiy fanlar'
  | 'Aniq fanlar'
  | 'Tabiiy va iqtisodiy fanlar'
  | 'Amaliy fanlar'

export interface Subject {
  id: string
  name: string
  short: string
  yonalish: FanYonalishi
  /**
   * Fanning qiyinlik darajasi (1–10). Sivkov shkalasiga yaqinlashtirilgan.
   * Jadval tuzishda og'ir fanlarni kunning o'rtasiga joylashtirish uchun ishlatiladi.
   */
  weight: number
  /** Boshlang'ich sinflarda (1–4) sinf rahbari o'qitadigan fanmi */
  primaryHomeroom: boolean
  color: string
}

/** Bir sinf (masalan 7-B) */
export interface SchoolClass {
  id: string
  grade: number
  letter: string
  /** Nechta o'quvchi — faqat ma'lumot uchun, jadvalga ta'sir qilmaydi */
  studentsCount?: number
}

export interface Teacher {
  id: string
  fullName: string
  /** Mutaxassislik nomi (ko'rsatish uchun) */
  speciality: string
  /** O'qita oladigan fanlar */
  subjectIds: string[]
  /** Haftalik minimal yuklama (soat) */
  minHours: number
  /** Haftalik maksimal yuklama (soat) */
  maxHours: number
  /** Sinf rahbari bo'lgan sinf (boshlang'ich sinflar uchun majburiy biriktirish) */
  homeroomClassId?: string
  /** O'qituvchi band bo'lgan kunlar (0 = dushanba ... 5 = shanba) */
  unavailableDays: number[]
}

/** classId -> subjectId -> haftalik soat (0.5 qadam bilan) */
export type CurriculumPlan = Record<string, Record<string, number>>

/** `${classId}|${subjectId}` -> teacherId */
export type Assignments = Record<string, string>

export interface Settings {
  schoolName: string
  /** Kunlik maksimal dars soati — sinf darajasi bo'yicha */
  maxPerDayByGrade: Record<number, number>
  /** 1–4 sinflar uchun o'quv kunlari soni */
  daysPrimary: number
  /** 5-sinf va undan yuqori uchun o'quv kunlari soni */
  daysSenior: number
  /** Bir o'qituvchining bir kunidagi ruxsat etilgan "oyna" (bo'shliq) soni */
  maxTeacherGapPerDay: number
  /** Bir o'qituvchining bir kundagi maksimal dars soati */
  maxTeacherLessonsPerDay: number
  /** Bir fan bir kunda 2 marta bo'lishi mumkin bo'lgan sinf-kunlar ulushi (%) */
  doubleLessonTolerance: number
  /** Solver iteratsiyalari soni */
  solverIterations: number
  /** Tasodifiy urug' — bir xil natijani qayta olish uchun */
  seed: number
  /**
   * Barqarorlik og'irligi — qayta hisoblashda mavjud jadvalni saqlashga intilish kuchi.
   * 0 = eski jadval hisobga olinmaydi, 200 = faqat juda zarur o'zgarishlar qilinadi.
   */
  stabilityWeight: number
}

/* ─────────────────── Qo'shimcha shartlar (izohlar) ──────────────────── */

export type RuleKind =
  /** O'qituvchida aniq shuncha soat dars bo'lsin */
  | 'teacher-target-hours'
  /** O'qituvchida shu kunda dars bo'lmasin */
  | 'teacher-day-off'
  /** O'qituvchida shu kunning shu soatida dars bo'lmasin */
  | 'teacher-slot-off'
  /** O'qituvchining kunlik maksimal dars soati */
  | 'teacher-max-per-day'
  /** O'qituvchining kunlik maksimal oynasi */
  | 'teacher-max-gap'
  /** Faqat izoh — jadvalga ta'sir qilmaydi */
  | 'note'

export interface Rule {
  id: string
  kind: RuleKind
  teacherId?: string
  classId?: string
  subjectId?: string
  /** 0 = dushanba ... 5 = shanba */
  day?: number
  /** 0 = 1-soat */
  period?: number
  value?: number
  note: string
  active: boolean
  createdAt: number
}

export const RULE_LABELS: Record<RuleKind, string> = {
  'teacher-target-hours': "O'qituvchida aniq soat",
  'teacher-day-off': "O'qituvchining bo'sh kuni",
  'teacher-slot-off': "O'qituvchining bo'sh soati",
  'teacher-max-per-day': 'Kunlik dars chegarasi',
  'teacher-max-gap': 'Kunlik oyna chegarasi',
  note: 'Izoh',
}

/** Dars birligi — jadvaldagi bitta katak (bitta soat) */
export interface LessonPart {
  subjectId: string
  teacherId: string
  /** 'all' — har hafta, 'odd' — toq hafta, 'even' — juft hafta */
  week: 'all' | 'odd' | 'even'
}

export interface LessonUnit {
  id: string
  classId: string
  parts: LessonPart[]
  /** Juft/toq hafta almashinuvli darsmi (0,5 soatlik fanlar) */
  alternating: boolean
}

/** Yakuniy jadval: unitId -> joylashuv */
export interface Placement {
  unitId: string
  day: number
  period: number
}

export interface Schedule {
  units: LessonUnit[]
  placements: Placement[]
  createdAt: number
  /** Solver hisoboti */
  stats: SolveStats
}

export interface SolveStats {
  cost: number
  iterations: number
  durationMs: number
  hardViolations: number
  softScore: number
  message: string
}

export type ViolationLevel = 'error' | 'warning' | 'info'

export interface Violation {
  level: ViolationLevel
  rule: string
  message: string
  refs?: { classId?: string; teacherId?: string; day?: number; period?: number }
}

export const DAY_NAMES = [
  'Dushanba',
  'Seshanba',
  'Chorshanba',
  'Payshanba',
  'Juma',
  'Shanba',
] as const

export const DAY_SHORT = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'] as const
