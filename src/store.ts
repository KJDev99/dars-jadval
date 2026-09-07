import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  AdminUser, Alumnus, Assessment, AssessmentKind, Assignments, GradingSettings, NewsItem, Quarter,
  RequestStatus, Rule, Schedule, SchoolClass, SchoolProfile, Settings, SiteContent, StaffMember,
  Student, StudentHighlight, Teacher, TeacherRequest,
} from './types'
import { defaultClasses, defaultGrading, defaultSettings, defaultStudents, defaultTeachers } from './data/seed'
import { defaultSite, defaultUsers } from './data/site-seed'
import { emptyOverrides, type PlanOverrides, asgKey, effectiveHours } from './lib/derive'
import { SUBJECTS, standardHours } from './data/curriculum'
import { isGradedGrade, plannedBsbCount } from './lib/grading'
import { makeRng } from './lib/rng'

/** Excel fayldan olingan va qo'llanadigan ma'lumot */
export interface ExcelImportPayload {
  /** Fayldagi o'qituvchilar (mavjudlari bilan birlashtirilgan) */
  teachers: Teacher[]
  /** `classId|subjectId` -> teacherId */
  assignments: Assignments
  /** classId -> subjectId -> haftalik soat */
  classHours: Record<string, Record<string, number>>
  /** Faylda uchragan yangi sinflar */
  newClasses: SchoolClass[]
  /** Faylda yo'q o'qituvchilar bazadan o'chirilsinmi */
  removeMissing: boolean
  /** Sinf o'quv rejasi fayl bo'yicha aniq belgilansinmi (qolgan fanlar 0 soat) */
  exactPlan: boolean
}

interface State {
  classes: SchoolClass[]
  teachers: Teacher[]
  overrides: PlanOverrides
  assignments: Assignments
  settings: Settings
  schedule: Schedule | null
  /** Jadval tuzilgandan keyin ma'lumot o'zgardimi — qayta hisoblash kerakligi belgisi */
  scheduleStale: boolean
  rules: Rule[]
  /** Qo'lda qulflangan darslar — qayta hisoblashda joyida qoladi */
  lockedUnitIds: string[]
  /** Rasmiy sayt kontenti */
  site: SiteContent
  /** O'qituvchilarning o'zgartirish so'rovlari */
  requests: TeacherRequest[]
  /** Ma'muriyat foydalanuvchilari */
  users: AdminUser[]
  /** Sinf jurnallaridagi o'quvchilar */
  students: Student[]
  /** BSB va ChSB ishlari */
  assessments: Assessment[]

  // Sinflar
  addClass: (grade: number, letter: string) => void
  updateClass: (id: string, patch: Partial<SchoolClass>) => void
  removeClass: (id: string) => void
  addGradeSet: (grade: number, count: number) => void
  removeGrade: (grade: number) => void

  // O'qituvchilar
  addTeacher: (t: Omit<Teacher, 'id'>) => void
  updateTeacher: (id: string, patch: Partial<Teacher>) => void
  removeTeacher: (id: string) => void

  // O'quv reja
  setGradeHours: (grade: number, subjectId: string, hours: number | null) => void
  setClassHours: (classId: string, subjectId: string, hours: number | null) => void
  resetGradePlan: (grade: number) => void
  resetAllPlan: () => void

  // Tarifikatsiya
  setAssignment: (classId: string, subjectId: string, teacherId: string | null) => void
  setAssignments: (a: Assignments) => void

  // Qoidalar (izohlar)
  addRule: (r: Omit<Rule, 'id' | 'createdAt'>) => void
  updateRule: (id: string, patch: Partial<Rule>) => void
  removeRule: (id: string) => void
  toggleRule: (id: string) => void

  // Qulflar va qo'lda tahrirlash
  toggleLock: (unitId: string) => void
  clearLocks: () => void
  swapPlacements: (unitIdA: string, unitIdB: string) => void

  // Excel import
  applyExcelImport: (p: ExcelImportPayload) => void

  // Rasmiy sayt
  setProfile: (patch: Partial<SchoolProfile>) => void
  upsertStaff: (m: StaffMember) => void
  removeStaff: (id: string) => void
  moveStaff: (id: string, dir: -1 | 1) => void
  upsertHighlight: (x: StudentHighlight) => void
  removeHighlight: (id: string) => void
  upsertAlumnus: (x: Alumnus) => void
  removeAlumnus: (id: string) => void
  upsertNews: (x: NewsItem) => void
  removeNews: (id: string) => void

  // So'rovlar
  addRequest: (r: Omit<TeacherRequest, 'id' | 'createdAt' | 'status'>) => string
  reviewRequest: (id: string, status: RequestStatus, response: string, reviewer: string) => void
  removeRequest: (id: string) => void

  // Foydalanuvchilar
  upsertUser: (u: AdminUser) => void
  removeUser: (id: string) => void

  // O'quvchilar
  addStudent: (classId: string, fullName: string) => void
  updateStudent: (id: string, patch: Partial<Student>) => void
  removeStudent: (id: string) => void
  /** Sinf ro'yxatini to'liq almashtirish (ismlar ro'yxati bo'yicha) */
  setRoster: (classId: string, names: string[]) => void
  /** Ro'yxati yo'q sinflarga namunaviy o'quvchilarni yaratish */
  fillMissingRosters: () => void

  // BSB va ChSB
  createAssessment: (a: {
    classId: string
    subjectId: string
    teacherId: string
    quarter: Quarter
    kind: AssessmentKind
    title?: string
    maxScore?: number
    date?: string
  }) => string
  updateAssessment: (id: string, patch: Partial<Assessment>) => void
  removeAssessment: (id: string) => void
  /** Bitta o'quvchining ballini qo'yish (null — o'chirish) */
  setScore: (id: string, studentId: string, value: number | null) => void
  /** Butun jurnalni almashtirish (Excel yuklashda) */
  setScores: (id: string, scores: Record<string, number>, absent?: string[]) => void
  toggleAbsent: (id: string, studentId: string) => void
  /** Rahbariyatga topshirish — shundan keyin o'qituvchi tahrirlay olmaydi */
  submitAssessment: (id: string) => void
  /** Ma'muriyat ishni qayta tahrirlash uchun ochadi */
  reopenAssessment: (id: string) => void
  setGrading: (patch: Partial<GradingSettings>) => void
  /** Namunaviy natijalar (5–9-sinflar) — tizimni sinab ko'rish uchun */
  seedDemoGrades: (quarter: Quarter) => number
  /** Chorak natijalarini tozalash */
  clearGrades: (quarter: Quarter | null) => void

  // Sinf rahbari va metodik kun
  setHomeroom: (classId: string, teacherId: string | null) => void
  setPedagogicalDay: (speciality: string, day: number | null) => void

  // Sozlamalar / jadval
  setSettings: (patch: Partial<Settings>) => void
  setSchedule: (s: Schedule | null) => void
  resetAll: () => void
}

function seed() {
  const classes = defaultClasses()
  return {
    classes,
    teachers: defaultTeachers(classes),
    overrides: emptyOverrides(),
    assignments: {} as Assignments,
    settings: defaultSettings(),
    schedule: null as Schedule | null,
    scheduleStale: false,
    rules: [] as Rule[],
    lockedUnitIds: [] as string[],
    site: defaultSite(),
    requests: [] as TeacherRequest[],
    users: defaultUsers(),
    students: defaultStudents(classes),
    assessments: [] as Assessment[],
  }
}

/** Yangi yozuv uchun qisqa noyob kalit */
const uid = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`

/** Bugungi sana ISO ko'rinishida (YYYY-MM-DD) */
const todayISO = () => new Date().toISOString().slice(0, 10)

const clamp = (v: number, lo: number, hi: number) =>
  Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo

/** Sinf ichidagi tartib raqamlarini qayta joylash */
function renumber(list: Student[]): Student[] {
  const counters = new Map<string, number>()
  return [...list]
    .sort((a, b) => a.classId.localeCompare(b.classId) || a.order - b.order)
    .map((s) => {
      const n = (counters.get(s.classId) ?? 0) + 1
      counters.set(s.classId, n)
      return s.order === n ? s : { ...s, order: n }
    })
}

/** BSB tartib raqamlarini qayta joylash (o'rtadagisi o'chirilganda) */
function renumberWorks(list: Assessment[]): Assessment[] {
  const counters = new Map<string, number>()
  return list.map((a) => {
    if (a.kind !== 'bsb') return a
    const k = `${a.classId}|${a.subjectId}|${a.quarter}`
    const n = (counters.get(k) ?? 0) + 1
    counters.set(k, n)
    return a.order === n ? a : { ...a, order: n, title: a.title.replace(/^\d+-bo/, `${n}-bo`) }
  })
}

/** Ro'yxatga qo'shish yoki mavjudini almashtirish */
function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  const i = list.findIndex((x) => x.id === item.id)
  if (i < 0) return [...list, item]
  const next = [...list]
  next[i] = item
  return next
}

/**
 * O'qituvchi kartochkasidagi — o'zgarsa jadvalni qayta hisoblashni talab qiladigan maydonlar.
 * Qolganlari (rasm, telefon, tarjimai hol, pasport) faqat ko'rsatish uchun.
 */
const SCHEDULE_FIELDS: (keyof Teacher)[] = [
  'subjectIds',
  'minHours',
  'maxHours',
  'unavailableDays',
  'homeroomClassId',
  'restrictedToHomeroom',
  'category',
  'speciality',
]

/** Ma'lumot o'zgardi — jadval eskirdi, lekin o'chirilmaydi (asos sifatida kerak) */
const stale = () => ({ scheduleStale: true })

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      ...seed(),

      /* ── Sinflar ─────────────────────────────────────────────────── */
      addClass: (grade, letter) =>
        set((s) => {
          const id = `${grade}${letter}`
          if (s.classes.some((c) => c.id === id)) return s
          const next = [...s.classes, { id, grade, letter, studentsCount: 25 }]
          next.sort((a, b) => a.grade - b.grade || a.letter.localeCompare(b.letter))
          return { classes: next, ...stale() }
        }),

      updateClass: (id, patch) =>
        set((s) => ({
          classes: s.classes.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        })),

      removeClass: (id) =>
        set((s) => {
          const assignments = { ...s.assignments }
          for (const k of Object.keys(assignments)) if (k.startsWith(`${id}|`)) delete assignments[k]
          const byClass = { ...s.overrides.byClass }
          delete byClass[id]
          const teachers = s.teachers.map((t) =>
            t.homeroomClassId === id ? { ...t, homeroomClassId: undefined } : t,
          )
          return {
            classes: s.classes.filter((c) => c.id !== id),
            assignments,
            teachers,
            overrides: { ...s.overrides, byClass },
            lockedUnitIds: s.lockedUnitIds.filter((u) => !u.startsWith(`${id}#`)),
            students: s.students.filter((st) => st.classId !== id),
            assessments: s.assessments.filter((a) => a.classId !== id),
            ...stale(),
          }
        }),

      addGradeSet: (grade, count) =>
        set((s) => {
          const letters = ['A', 'B', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K']
          const existing = new Set(s.classes.filter((c) => c.grade === grade).map((c) => c.letter))
          const next = [...s.classes]
          let added = 0
          for (const l of letters) {
            if (added >= count) break
            if (existing.has(l)) continue
            next.push({ id: `${grade}${l}`, grade, letter: l, studentsCount: 25 })
            added++
          }
          next.sort((a, b) => a.grade - b.grade || a.letter.localeCompare(b.letter))
          return { classes: next, ...stale() }
        }),

      removeGrade: (grade) =>
        set((s) => {
          const ids = new Set(s.classes.filter((c) => c.grade === grade).map((c) => c.id))
          const assignments = { ...s.assignments }
          for (const k of Object.keys(assignments)) if (ids.has(k.split('|')[0])) delete assignments[k]
          return {
            classes: s.classes.filter((c) => c.grade !== grade),
            assignments,
            teachers: s.teachers.map((t) =>
              t.homeroomClassId && ids.has(t.homeroomClassId) ? { ...t, homeroomClassId: undefined } : t,
            ),
            lockedUnitIds: s.lockedUnitIds.filter((u) => !ids.has(u.split('#')[0])),
            students: s.students.filter((st) => !ids.has(st.classId)),
            assessments: s.assessments.filter((a) => !ids.has(a.classId)),
            ...stale(),
          }
        }),

      /* ── O'qituvchilar ───────────────────────────────────────────── */
      addTeacher: (t) =>
        set((s) => ({
          teachers: [
            ...s.teachers,
            { ...t, id: `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}` },
          ],
          ...stale(),
        })),

      updateTeacher: (id, patch) =>
        set((s) => ({
          teachers: s.teachers.map((t) => (t.id === id ? { ...t, ...patch } : t)),
          // Jadvalga ta'sir qilmaydigan maydonlar (rasm, telefon, pasport, tarjimai hol)
          // o'zgarganda jadval eskirgan deb belgilanmaydi
          ...(SCHEDULE_FIELDS.some((k) => k in patch) ? stale() : {}),
        })),

      removeTeacher: (id) =>
        set((s) => {
          const assignments = { ...s.assignments }
          for (const [k, v] of Object.entries(assignments)) if (v === id) delete assignments[k]
          return {
            teachers: s.teachers.filter((t) => t.id !== id),
            assignments,
            rules: s.rules.filter((r) => r.teacherId !== id),
            ...stale(),
          }
        }),

      /* ── O'quv reja ──────────────────────────────────────────────── */
      setGradeHours: (grade, subjectId, hours) =>
        set((s) => {
          const byGrade = { ...s.overrides.byGrade }
          const row = { ...(byGrade[grade] ?? {}) }
          if (hours === null || hours === standardHours(grade, subjectId)) delete row[subjectId]
          else row[subjectId] = hours
          if (Object.keys(row).length === 0) delete byGrade[grade]
          else byGrade[grade] = row
          return { overrides: { ...s.overrides, byGrade }, ...stale() }
        }),

      setClassHours: (classId, subjectId, hours) =>
        set((s) => {
          const byClass = { ...s.overrides.byClass }
          const row = { ...(byClass[classId] ?? {}) }
          if (hours === null) delete row[subjectId]
          else row[subjectId] = hours
          if (Object.keys(row).length === 0) delete byClass[classId]
          else byClass[classId] = row
          return { overrides: { ...s.overrides, byClass }, ...stale() }
        }),

      resetGradePlan: (grade) =>
        set((s) => {
          const byGrade = { ...s.overrides.byGrade }
          delete byGrade[grade]
          return { overrides: { ...s.overrides, byGrade }, ...stale() }
        }),

      resetAllPlan: () => set(() => ({ overrides: emptyOverrides(), ...stale() })),

      /* ── Tarifikatsiya ───────────────────────────────────────────── */
      setAssignment: (classId, subjectId, teacherId) =>
        set((s) => {
          const assignments = { ...s.assignments }
          const k = asgKey(classId, subjectId)
          if (teacherId) assignments[k] = teacherId
          else delete assignments[k]
          return { assignments, ...stale() }
        }),

      setAssignments: (a) => set(() => ({ assignments: a, ...stale() })),

      /* ── Qoidalar ────────────────────────────────────────────────── */
      addRule: (r) =>
        set((s) => ({
          rules: [
            ...s.rules,
            { ...r, id: `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, createdAt: Date.now() },
          ],
          ...(r.kind === 'note' ? {} : stale()),
        })),

      updateRule: (id, patch) =>
        set((s) => ({
          rules: s.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)),
          ...stale(),
        })),

      removeRule: (id) =>
        set((s) => ({ rules: s.rules.filter((r) => r.id !== id), ...stale() })),

      toggleRule: (id) =>
        set((s) => ({
          rules: s.rules.map((r) => (r.id === id ? { ...r, active: !r.active } : r)),
          ...stale(),
        })),

      /* ── Qulflar va qo'lda tahrirlash ────────────────────────────── */
      toggleLock: (unitId) =>
        set((s) => ({
          lockedUnitIds: s.lockedUnitIds.includes(unitId)
            ? s.lockedUnitIds.filter((x) => x !== unitId)
            : [...s.lockedUnitIds, unitId],
        })),

      clearLocks: () => set({ lockedUnitIds: [] }),

      swapPlacements: (unitIdA, unitIdB) =>
        set((s) => {
          if (!s.schedule || unitIdA === unitIdB) return s
          const a = s.schedule.placements.find((p) => p.unitId === unitIdA)
          const b = s.schedule.placements.find((p) => p.unitId === unitIdB)
          if (!a || !b) return s
          const placements = s.schedule.placements.map((p) => {
            if (p.unitId === unitIdA) return { ...p, day: b.day, period: b.period }
            if (p.unitId === unitIdB) return { ...p, day: a.day, period: a.period }
            return p
          })
          // Qo'lda ko'chirilgan darslar avtomatik qulflanadi
          const locks = new Set(s.lockedUnitIds)
          locks.add(unitIdA)
          locks.add(unitIdB)
          return {
            schedule: { ...s.schedule, placements },
            lockedUnitIds: [...locks],
          }
        }),

      /* ── Excel import ────────────────────────────────────────────── */
      applyExcelImport: (p) =>
        set((st) => {
          // 1. Yangi sinflar
          const classes = [...st.classes]
          for (const nc of p.newClasses) if (!classes.some((c) => c.id === nc.id)) classes.push(nc)
          classes.sort((a, b) => a.grade - b.grade || a.letter.localeCompare(b.letter))

          // 2. O'qituvchilar
          const importedIds = new Set(p.teachers.map((t) => t.id))
          const teachers = p.removeMissing
            ? [...p.teachers]
            : [...p.teachers, ...st.teachers.filter((t) => !importedIds.has(t.id))]

          // Bitta sinfda bitta rahbar
          const hrSeen = new Set<string>()
          const clean = teachers.map((t) => {
            if (!t.homeroomClassId) return t
            if (hrSeen.has(t.homeroomClassId)) return { ...t, homeroomClassId: undefined }
            hrSeen.add(t.homeroomClassId)
            return t
          })
          const liveIds = new Set(clean.map((t) => t.id))

          // 3. Tarifikatsiya
          const assignments: Assignments = p.removeMissing
            ? { ...p.assignments }
            : { ...st.assignments, ...p.assignments }
          for (const [k, v] of Object.entries(assignments)) {
            if (!liveIds.has(v)) delete assignments[k]
          }

          // 4. Sinf o'quv rejasi
          const byClass = { ...st.overrides.byClass }
          for (const [cid, row] of Object.entries(p.classHours)) {
            if (p.exactPlan) {
              const full: Record<string, number> = {}
              for (const sub of SUBJECTS) full[sub.id] = row[sub.id] ?? 0
              byClass[cid] = full
            } else {
              byClass[cid] = { ...(byClass[cid] ?? {}), ...row }
            }
          }

          return {
            classes,
            teachers: clean,
            assignments,
            overrides: { ...st.overrides, byClass },
            rules: st.rules.filter((r) => !r.teacherId || liveIds.has(r.teacherId)),
            lockedUnitIds: [],
            ...stale(),
          }
        }),

      /* ── Rasmiy sayt kontenti ────────────────────────────────────── */
      setProfile: (patch) =>
        set((st) => ({ site: { ...st.site, profile: { ...st.site.profile, ...patch } } })),

      upsertStaff: (m) =>
        set((st) => ({ site: { ...st.site, staff: upsert(st.site.staff, m).sort((a, b) => a.order - b.order) } })),

      removeStaff: (id) =>
        set((st) => ({ site: { ...st.site, staff: st.site.staff.filter((x) => x.id !== id) } })),

      moveStaff: (id, dir) =>
        set((st) => {
          const list = [...st.site.staff].sort((a, b) => a.order - b.order)
          const i = list.findIndex((x) => x.id === id)
          const j = i + dir
          if (i < 0 || j < 0 || j >= list.length) return st
          const tmp = list[i]
          list[i] = list[j]
          list[j] = tmp
          return { site: { ...st.site, staff: list.map((x, k) => ({ ...x, order: k + 1 })) } }
        }),

      upsertHighlight: (x) => set((st) => ({ site: { ...st.site, students: upsert(st.site.students, x) } })),
      removeHighlight: (id) =>
        set((st) => ({ site: { ...st.site, students: st.site.students.filter((s) => s.id !== id) } })),

      upsertAlumnus: (x) => set((st) => ({ site: { ...st.site, alumni: upsert(st.site.alumni, x) } })),
      removeAlumnus: (id) =>
        set((st) => ({ site: { ...st.site, alumni: st.site.alumni.filter((s) => s.id !== id) } })),

      upsertNews: (x) => set((st) => ({ site: { ...st.site, news: upsert(st.site.news, x) } })),
      removeNews: (id) =>
        set((st) => ({ site: { ...st.site, news: st.site.news.filter((s) => s.id !== id) } })),

      /* ── O'qituvchi so'rovlari ───────────────────────────────────── */
      addRequest: (r) => {
        const id = uid('req')
        set((st) => ({
          requests: [{ ...r, id, status: 'yangi' as RequestStatus, createdAt: Date.now() }, ...st.requests],
        }))
        return id
      },

      reviewRequest: (id, status, response, reviewer) =>
        set((st) => {
          const req = st.requests.find((r) => r.id === id)
          if (!req) return st
          const requests = st.requests.map((r) =>
            r.id === id
              ? { ...r, status, response, reviewedBy: reviewer, reviewedAt: Date.now() }
              : r,
          )
          // Profil so'rovi qabul qilinsa — taklif qilingan qiymatlar kartochkaga ko'chiriladi
          if (status === 'qabul' && req.kind === 'profil' && req.proposed) {
            return {
              requests,
              teachers: st.teachers.map((t) => (t.id === req.teacherId ? { ...t, ...req.proposed } : t)),
            }
          }
          // Baholash so'rovi qabul qilinsa — ish qayta tahrirlash uchun ochiladi
          if (status === 'qabul' && req.kind === 'baho' && req.assessmentId) {
            return {
              requests,
              assessments: st.assessments.map((a) =>
                a.id === req.assessmentId ? { ...a, submittedAt: undefined, updatedAt: Date.now() } : a,
              ),
            }
          }
          return { requests }
        }),

      removeRequest: (id) => set((st) => ({ requests: st.requests.filter((r) => r.id !== id) })),

      /* ── Ma'muriyat foydalanuvchilari ────────────────────────────── */
      upsertUser: (u) => set((st) => ({ users: upsert(st.users, u) })),
      removeUser: (id) => set((st) => ({ users: st.users.filter((u) => u.id !== id) })),

      /* ── O'quvchilar ─────────────────────────────────────────────── */
      addStudent: (classId, fullName) =>
        set((st) => {
          const name = fullName.trim()
          if (!name) return st
          const order = st.students.filter((s) => s.classId === classId).length + 1
          return {
            students: [...st.students, { id: uid(`st-${classId}`), classId, fullName: name, order, active: true }],
          }
        }),

      updateStudent: (id, patch) =>
        set((st) => ({ students: st.students.map((s) => (s.id === id ? { ...s, ...patch } : s)) })),

      removeStudent: (id) =>
        set((st) => ({
          students: renumber(st.students.filter((s) => s.id !== id)),
          // Ballari ham o'chadi — o'rtachani buzmasligi uchun
          assessments: st.assessments.map((a) => {
            if (a.scores[id] === undefined && !a.absent.includes(id)) return a
            const scores = { ...a.scores }
            delete scores[id]
            return { ...a, scores, absent: a.absent.filter((x) => x !== id) }
          }),
        })),

      setRoster: (classId, names) =>
        set((st) => {
          const clean = names.map((n) => n.trim()).filter(Boolean)
          const old = st.students.filter((s) => s.classId === classId)
          // Bir xil ismli o'quvchining ballari saqlanib qolishi uchun id ni qayta ishlatamiz
          const byName = new Map(old.map((s) => [s.fullName.toLowerCase(), s]))
          const next: Student[] = clean.map((fullName, i) => {
            const prev = byName.get(fullName.toLowerCase())
            byName.delete(fullName.toLowerCase())
            return prev
              ? { ...prev, fullName, order: i + 1, active: true }
              : { id: uid(`st-${classId}`), classId, fullName, order: i + 1, active: true }
          })
          return { students: [...st.students.filter((s) => s.classId !== classId), ...next] }
        }),

      fillMissingRosters: () =>
        set((st) => {
          const has = new Set(st.students.map((s) => s.classId))
          const missing = st.classes.filter((c) => !has.has(c.id))
          if (missing.length === 0) return st
          return { students: [...st.students, ...defaultStudents(missing)] }
        }),

      /* ── BSB va ChSB ─────────────────────────────────────────────── */
      createAssessment: (a) => {
        const id = uid('sb')
        set((st) => {
          const g = st.settings.grading
          const same = st.assessments.filter(
            (x) =>
              x.classId === a.classId &&
              x.subjectId === a.subjectId &&
              x.quarter === a.quarter &&
              x.kind === a.kind,
          )
          const order = a.kind === 'chsb' ? 0 : same.length + 1
          const work: Assessment = {
            id,
            classId: a.classId,
            subjectId: a.subjectId,
            teacherId: a.teacherId,
            quarter: a.quarter,
            kind: a.kind,
            order,
            title: a.title ?? (a.kind === 'chsb' ? `${a.quarter}-chorak yakuniy ishi` : `${order}-bo'lim`),
            maxScore: a.maxScore ?? (a.kind === 'chsb' ? g.defaultChsbMax : g.defaultBsbMax),
            date: a.date ?? todayISO(),
            scores: {},
            absent: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }
          return { assessments: [...st.assessments, work] }
        })
        return id
      },

      updateAssessment: (id, patch) =>
        set((st) => ({
          assessments: st.assessments.map((a) => {
            if (a.id !== id) return a
            const next = { ...a, ...patch, updatedAt: Date.now() }
            // Maksimal ball kamaytirilsa, undan katta ballar chegaraga tushiriladi —
            // aks holda o'zlashtirish 100% dan oshib ketadi
            if (next.maxScore !== a.maxScore) {
              const scores: Record<string, number> = {}
              for (const [k, v] of Object.entries(next.scores)) scores[k] = Math.min(v, next.maxScore)
              next.scores = scores
            }
            return next
          }),
        })),

      removeAssessment: (id) =>
        set((st) => ({ assessments: renumberWorks(st.assessments.filter((a) => a.id !== id)) })),

      setScore: (id, studentId, value) =>
        set((st) => ({
          assessments: st.assessments.map((a) => {
            if (a.id !== id) return a
            const scores = { ...a.scores }
            if (value === null) delete scores[studentId]
            else scores[studentId] = clamp(value, 0, a.maxScore)
            return {
              ...a,
              scores,
              // Ball qo'yilsa — «kelmadi» belgisi olib tashlanadi
              absent: value === null ? a.absent : a.absent.filter((x) => x !== studentId),
              updatedAt: Date.now(),
            }
          }),
        })),

      setScores: (id, scores, absent) =>
        set((st) => ({
          assessments: st.assessments.map((a) => {
            if (a.id !== id) return a
            const clean: Record<string, number> = {}
            for (const [k, v] of Object.entries(scores)) clean[k] = clamp(v, 0, a.maxScore)
            return { ...a, scores: clean, absent: absent ?? a.absent, updatedAt: Date.now() }
          }),
        })),

      toggleAbsent: (id, studentId) =>
        set((st) => ({
          assessments: st.assessments.map((a) => {
            if (a.id !== id) return a
            const on = a.absent.includes(studentId)
            const scores = { ...a.scores }
            if (!on) delete scores[studentId]
            return {
              ...a,
              scores,
              absent: on ? a.absent.filter((x) => x !== studentId) : [...a.absent, studentId],
              updatedAt: Date.now(),
            }
          }),
        })),

      submitAssessment: (id) =>
        set((st) => ({
          assessments: st.assessments.map((a) =>
            a.id === id ? { ...a, submittedAt: Date.now(), updatedAt: Date.now() } : a,
          ),
        })),

      reopenAssessment: (id) =>
        set((st) => ({
          assessments: st.assessments.map((a) =>
            a.id === id ? { ...a, submittedAt: undefined, updatedAt: Date.now() } : a,
          ),
        })),

      setGrading: (patch) =>
        set((st) => ({ settings: { ...st.settings, grading: { ...st.settings.grading, ...patch } } })),

      seedDemoGrades: (quarter) => {
        let made = 0
        set((st) => {
          const g = st.settings.grading
          const rng = makeRng(4000 + quarter)
          const rest = st.assessments.filter((a) => a.quarter !== quarter)
          const fresh: Assessment[] = []
          const now = Date.now()

          for (const cls of st.classes) {
            // Namuna 5–9-sinflar uchun — barcha sinflar juda katta hajm beradi
            if (cls.grade < 5 || cls.grade > 9 || !isGradedGrade(cls.grade, g)) continue
            const roster = st.students.filter((s) => s.classId === cls.id && s.active)
            if (roster.length === 0) continue
            // Har bir o'quvchining «kuchi» — natijalar tabiiy tarqalishi uchun
            const ability = new Map(roster.map((s) => [s.id, 0.55 + rng() * 0.42]))

            for (const sub of SUBJECTS) {
              const hours = effectiveHours(cls, sub.id, st.overrides)
              if (hours < 1) continue
              const teacherId = st.assignments[asgKey(cls.id, sub.id)]
              if (!teacherId) continue

              const plan = plannedBsbCount(hours, g)
              // Har beshinchi sinf-fan ataylab chala qoldiriladi — rahbariyat
              // «topshirilmaganlar» ro'yxatini ko'rib turishi uchun
              const lag = rng() < 0.2
              const bsbCount = lag ? Math.max(1, plan - 1) : plan
              const withChsb = !lag && rng() > 0.12

              const build = (kind: AssessmentKind, order: number) => {
                const maxScore = kind === 'chsb' ? g.defaultChsbMax : g.defaultBsbMax
                const scores: Record<string, number> = {}
                const absent: string[] = []
                for (const s of roster) {
                  if (rng() < 0.02) {
                    absent.push(s.id)
                    continue
                  }
                  const base = (ability.get(s.id) ?? 0.7) + (rng() - 0.5) * 0.16
                  scores[s.id] = clamp(Math.round(base * maxScore), 0, maxScore)
                }
                fresh.push({
                  id: `sb-${quarter}-${cls.id}-${sub.id}-${kind}${order}`,
                  classId: cls.id,
                  subjectId: sub.id,
                  teacherId,
                  quarter,
                  kind,
                  order,
                  title: kind === 'chsb' ? `${quarter}-chorak yakuniy ishi` : `${order}-bo'lim`,
                  maxScore,
                  date: todayISO(),
                  scores,
                  absent,
                  submittedAt: rng() < 0.9 ? now : undefined,
                  createdAt: now,
                  updatedAt: now,
                })
                made++
              }

              for (let i = 1; i <= bsbCount; i++) build('bsb', i)
              if (withChsb) build('chsb', 0)
            }
          }
          return { assessments: [...rest, ...fresh] }
        })
        return made
      },

      clearGrades: (quarter) =>
        set((st) => ({
          assessments: quarter === null ? [] : st.assessments.filter((a) => a.quarter !== quarter),
        })),

      /* ── Sinf rahbari va metodik kun ─────────────────────────────── */
      setHomeroom: (classId, teacherId) =>
        set((s) => {
          const teachers = s.teachers.map((t) => {
            if (t.homeroomClassId === classId && t.id !== teacherId) {
              return { ...t, homeroomClassId: undefined }
            }
            if (t.id === teacherId) return { ...t, homeroomClassId: classId }
            return t
          })
          // Sinf rahbari o'zgarsa Ma'naviyat soati ham yangi rahbarga o'tadi
          const assignments = { ...s.assignments }
          const key = asgKey(classId, 'manaviyat')
          if (teacherId) assignments[key] = teacherId
          else delete assignments[key]
          return { teachers, assignments, ...stale() }
        }),

      setPedagogicalDay: (speciality, day) =>
        set((s) => {
          const pedagogicalDays = { ...s.settings.pedagogicalDays }
          if (day === null) delete pedagogicalDays[speciality]
          else pedagogicalDays[speciality] = day
          return { settings: { ...s.settings, pedagogicalDays }, ...stale() }
        }),

      /* ── Sozlamalar / jadval ─────────────────────────────────────── */
      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      setSchedule: (schedule) => set({ schedule, scheduleStale: false }),
      resetAll: () => set({ ...seed() }),
    }),
    {
      name: 'dars-jadval-v1',
      version: 5,
      migrate: (persisted: any, version) => {
        const p = { ...(persisted ?? {}) }
        if (version < 2) {
          p.rules = p.rules ?? []
          p.lockedUnitIds = p.lockedUnitIds ?? []
          p.scheduleStale = false
        }
        if (version < 3) {
          // Toifa, sinf rahbari cheklovi va metodik kunlar qo'shildi
          p.teachers = (p.teachers ?? []).map((t: any) => ({
            category: 'yoq',
            restrictedToHomeroom: t.speciality === "Boshlang'ich ta'lim" && !!t.homeroomClassId,
            ...t,
          }))
          p.schedule = null
          p.scheduleStale = false
        }
        if (version < 4) {
          // Rasmiy sayt, so'rovlar va foydalanuvchilar qo'shildi.
          // O'qituvchilarga pasport va shaxsiy ma'lumot maydonlari kerak —
          // ular yo'q bo'lsa, urug'dagi qiymatlar bilan to'ldiriladi.
          p.site = p.site ?? defaultSite()
          p.requests = p.requests ?? []
          p.users = p.users ?? defaultUsers()
          const fresh = defaultTeachers(p.classes ?? defaultClasses())
          const byId = new Map(fresh.map((t: Teacher) => [t.id, t]))
          p.teachers = (p.teachers ?? []).map((t: Teacher) => {
            if (t.passportNumber) return t
            const f = byId.get(t.id)
            return f ? { ...f, ...t, passportSeries: f.passportSeries, passportNumber: f.passportNumber } : t
          })
        }
        if (version < 5) {
          // BSB va ChSB baholash tizimi qo'shildi
          p.students = p.students ?? defaultStudents(p.classes ?? defaultClasses())
          p.assessments = p.assessments ?? []
        }
        p.settings = { ...defaultSettings(), ...(p.settings ?? {}) }
        p.settings.grading = { ...defaultGrading(), ...(p.settings.grading ?? {}) }
        p.site = { ...defaultSite(), ...(p.site ?? {}) }
        return p
      },
    },
  ),
)
