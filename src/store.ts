import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  AdminUser, Alumnus, Assignments, NewsItem, RequestStatus, Rule, Schedule, SchoolClass,
  SchoolProfile, Settings, SiteContent, StaffMember, StudentHighlight, Teacher, TeacherRequest,
} from './types'
import { defaultClasses, defaultSettings, defaultTeachers } from './data/seed'
import { defaultSite, defaultUsers } from './data/site-seed'
import { emptyOverrides, type PlanOverrides, asgKey } from './lib/derive'
import { SUBJECTS, standardHours } from './data/curriculum'

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
  upsertStudent: (x: StudentHighlight) => void
  removeStudent: (id: string) => void
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
  }
}

/** Yangi yozuv uchun qisqa noyob kalit */
const uid = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`

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

      upsertStudent: (x) => set((st) => ({ site: { ...st.site, students: upsert(st.site.students, x) } })),
      removeStudent: (id) =>
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
          return { requests }
        }),

      removeRequest: (id) => set((st) => ({ requests: st.requests.filter((r) => r.id !== id) })),

      /* ── Ma'muriyat foydalanuvchilari ────────────────────────────── */
      upsertUser: (u) => set((st) => ({ users: upsert(st.users, u) })),
      removeUser: (id) => set((st) => ({ users: st.users.filter((u) => u.id !== id) })),

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
      version: 4,
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
        p.settings = { ...defaultSettings(), ...(p.settings ?? {}) }
        p.site = { ...defaultSite(), ...(p.site ?? {}) }
        return p
      },
    },
  ),
)
