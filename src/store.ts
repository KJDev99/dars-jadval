import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Assignments, Rule, Schedule, SchoolClass, Settings, Teacher } from './types'
import { defaultClasses, defaultSettings, defaultTeachers } from './data/seed'
import { emptyOverrides, type PlanOverrides, asgKey } from './lib/derive'
import { standardHours } from './data/curriculum'

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
  }
}

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
          ...stale(),
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

      /* ── Sozlamalar / jadval ─────────────────────────────────────── */
      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      setSchedule: (schedule) => set({ schedule, scheduleStale: false }),
      resetAll: () => set({ ...seed() }),
    }),
    {
      name: 'dars-jadval-v1',
      version: 2,
      migrate: (persisted: any, version) => {
        if (version < 2) {
          return {
            ...persisted,
            rules: persisted?.rules ?? [],
            lockedUnitIds: persisted?.lockedUnitIds ?? [],
            scheduleStale: false,
            settings: { ...defaultSettings(), ...(persisted?.settings ?? {}) },
          }
        }
        return persisted
      },
    },
  ),
)
