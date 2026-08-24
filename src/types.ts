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
  /** Faqat sinf rahbari o'z sinfida o'tadigan fan (masalan Ma'naviyat soati) */
  homeroomOnly?: boolean
  /** Tayanch o'quv rejadan tashqari fan — rasmiy soat bilan solishtirishda hisobga olinmaydi */
  outsidePlan?: boolean
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

/**
 * O'qituvchining malaka toifasi (darajasi).
 * Dars soatlari shu tartibda taqsimlanadi: avval har biriga 1 stavka, keyin qolgan soatlar.
 */
export type TeacherCategory = 'oliy' | 'birinchi' | 'ikkinchi' | 'yoq'

export const CATEGORY_LABELS: Record<TeacherCategory, string> = {
  oliy: 'Oliy toifa',
  birinchi: '1-toifa',
  ikkinchi: '2-toifa',
  yoq: 'Toifasiz',
}

export const CATEGORY_SHORT: Record<TeacherCategory, string> = {
  oliy: 'Oliy',
  birinchi: '1-t',
  ikkinchi: '2-t',
  yoq: '—',
}

/** Ustuvorlik tartibi: 0 eng yuqori */
export const CATEGORY_RANK: Record<TeacherCategory, number> = {
  oliy: 0,
  birinchi: 1,
  ikkinchi: 2,
  yoq: 3,
}

export const CATEGORY_ORDER: TeacherCategory[] = ['oliy', 'birinchi', 'ikkinchi', 'yoq']

export interface Teacher {
  id: string
  fullName: string
  /** Mutaxassislik nomi (ko'rsatish uchun) */
  speciality: string
  /** Malaka toifasi — dars taqsimotida ustuvorlikni belgilaydi */
  category: TeacherCategory
  /** O'qita oladigan fanlar */
  subjectIds: string[]
  /** Haftalik minimal yuklama (soat) */
  minHours: number
  /** Haftalik maksimal yuklama (soat) */
  maxHours: number
  /** Sinf rahbari bo'lgan sinf */
  homeroomClassId?: string
  /**
   * Faqat o'z sinfiga dars beradimi.
   * Boshlang'ich sinf o'qituvchilari uchun true, fan o'qituvchilari uchun false
   * (ular sinf rahbari bo'lsa ham boshqa sinflarga dars beradi).
   */
  restrictedToHomeroom?: boolean
  /** O'qituvchi band bo'lgan kunlar (0 = dushanba ... 5 = shanba) */
  unavailableDays: number[]

  /* ── Shaxsiy kabinet va rasmiy sayt uchun ma'lumotlar ── */

  /** Pasport seriyasi (2 harf, masalan AA) — kabinetga kirish uchun */
  passportSeries?: string
  /** Pasport raqami (7 raqam) — kabinetga kirish uchun */
  passportNumber?: string
  /** Rasm — data URL yoki havola */
  photo?: string
  birthDate?: string
  phone?: string
  email?: string
  /** Bitirgan oliy o'quv yurti va yo'nalishi */
  education?: string
  /** Ilmiy daraja yoki unvon */
  degree?: string
  /** Umumiy pedagogik staj (yil) */
  experienceYears?: number
  /** Shu maktabda ishlay boshlagan yil */
  startYear?: number
  /** Qisqacha tarjimai hol */
  bio?: string
  /** Faoliyati, yutuqlari va mukofotlari */
  achievements?: string[]
  /** Rasmiy saytda ko'rsatilsinmi */
  publicVisible?: boolean
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
  /** Bir stavka necha soat (O'zbekiston maktablarida odatda 18 soat) */
  stavkaHours: number
  /** Interfeys mavzusi */
  theme: 'light' | 'dark' | 'system'
  /**
   * Mutaxassislik (metodbirlashma) bo'yicha metodik kun: speciality -> kun raqami.
   * Shu kuni o'sha guruhning barcha o'qituvchilariga dars qo'yilmaydi.
   */
  pedagogicalDays: Record<string, number>
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

/* ══════════════════════════════════════════════════════════════════════════
   Rasmiy sayt, kabinet va kirish tizimi
   ══════════════════════════════════════════════════════════════════════════ */

/** Foydalanuvchi roli */
export type Role = 'director' | 'zavuch' | 'teacher'

export const ROLE_LABELS: Record<Role, string> = {
  director: 'Direktor',
  zavuch: "O'quv ishlari bo'yicha direktor o'rinbosari",
  teacher: "O'qituvchi",
}

export const ROLE_SHORT: Record<Role, string> = {
  director: 'Direktor',
  zavuch: 'Zavuch',
  teacher: "O'qituvchi",
}

/** Ma'muriyat foydalanuvchisi (login + parol bilan kiradi) */
export interface AdminUser {
  id: string
  login: string
  password: string
  fullName: string
  role: 'director' | 'zavuch'
  active: boolean
  /** Rahbariyat ro'yxatidagi yozuv bilan bog'lanish */
  staffId?: string
  createdAt: number
}

/** Kirgan foydalanuvchi seansi */
export interface Session {
  role: Role
  /** AdminUser.id yoki Teacher.id */
  userId: string
  fullName: string
  startedAt: number
}

/* ─────────────────────────── Sayt kontenti ─────────────────────────── */

/** Rasm — data URL yoki tashqi havola. Bo'sh bo'lsa chiroyli o'rin egallagich chiziladi */
export type Photo = string | undefined

export interface SchoolProfile {
  /** Rasmiy to'liq nom */
  name: string
  /** Qisqa nom (sarlavhalarda) */
  shortName: string
  foundedYear: number
  motto: string
  /** Bosh sahifadagi qisqa tanishtiruv */
  intro: string
  /** «Maktab haqida» sahifasidagi to'liq matn (paragraflar \n\n bilan) */
  about: string
  region: string
  district: string
  address: string
  phone: string
  email: string
  website: string
  telegram: string
  instagram: string
  youtube: string
  /** Bosh sahifadagi katta rasm */
  heroPhoto: Photo
  /** Maktab binosi / «Biz haqimizda» rasmi */
  aboutPhoto: Photo
  logo: Photo
  /** Qo'lda kiritiladigan ko'rsatkichlar (qolganlari bazadan hisoblanadi) */
  graduatesCount: number
  awardsCount: number
}

/** Rahbariyat a'zosi */
export interface StaffMember {
  id: string
  fullName: string
  position: string
  photo: Photo
  phone: string
  email: string
  /** Qabul kunlari va soatlari */
  receptionHours: string
  /** Ma'lumoti (bitirgan OTM, yo'nalish) */
  education: string
  /** Umumiy pedagogik staj (yil) */
  experienceYears: number
  /** Shu maktabda ishlay boshlagan yil */
  startYear: number
  /** Qisqacha tarjimai hol va faoliyati */
  bio: string
  /** Mukofot va yutuqlar */
  awards: string[]
  /** O'qituvchilar ro'yxatidagi yozuv bilan bog'lanish */
  teacherId?: string
  order: number
}

export type AchievementLevel = 'maktab' | 'tuman' | 'viloyat' | 'respublika' | 'xalqaro'

export const LEVEL_LABELS: Record<AchievementLevel, string> = {
  maktab: 'Maktab',
  tuman: 'Tuman',
  viloyat: 'Viloyat',
  respublika: 'Respublika',
  xalqaro: 'Xalqaro',
}

/** A'lochi / iqtidorli o'quvchi */
export interface StudentHighlight {
  id: string
  fullName: string
  classId: string
  photo: Photo
  /** Yutuq matni: «Matematika fanidan viloyat olimpiadasi g'olibi» */
  achievement: string
  subjectId?: string
  level: AchievementLevel
  year: number
}

/** Faxriy bitiruvchi */
export interface Alumnus {
  id: string
  fullName: string
  graduationYear: number
  photo: Photo
  /** Hozirgi kasbi / lavozimi */
  occupation: string
  description: string
}

export interface NewsItem {
  id: string
  title: string
  date: string
  summary: string
  body: string
  photo: Photo
}

export interface SiteContent {
  profile: SchoolProfile
  staff: StaffMember[]
  students: StudentHighlight[]
  alumni: Alumnus[]
  news: NewsItem[]
}

/* ───────────────────── O'qituvchi so'rovlari (arizalar) ───────────────── */

export type RequestKind = 'jadval' | 'profil' | 'yuklama' | 'boshqa'

export const REQUEST_KIND_LABELS: Record<RequestKind, string> = {
  jadval: "Dars jadvalini o'zgartirish",
  profil: "Shaxsiy ma'lumotni o'zgartirish",
  yuklama: "Dars yuklamasini o'zgartirish",
  boshqa: 'Boshqa murojaat',
}

export type RequestStatus = 'yangi' | 'korilmoqda' | 'qabul' | 'rad'

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  yangi: 'Yangi',
  korilmoqda: "Ko'rib chiqilmoqda",
  qabul: 'Qabul qilindi',
  rad: 'Rad etildi',
}

/** O'qituvchining o'zgartirish so'rovi */
export interface TeacherRequest {
  id: string
  teacherId: string
  kind: RequestKind
  title: string
  message: string
  /**
   * «Profil» turidagi so'rov uchun taklif qilinayotgan qiymatlar.
   * Qabul qilinganda o'qituvchi kartochkasiga ko'chiriladi.
   */
  proposed?: Partial<Teacher>
  status: RequestStatus
  createdAt: number
  reviewedAt?: number
  /** Ko'rib chiqqan ma'muriyat xodimining ismi */
  reviewedBy?: string
  /** Ma'muriyat javobi */
  response?: string
}
