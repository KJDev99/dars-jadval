import type { LessonUnit, Placement, Schedule, SchoolClass, Settings, Teacher } from '../types'
import { SUBJECT_BY_ID } from '../data/curriculum'

export interface CellPart {
  subjectId: string
  subjectName: string
  subjectShort: string
  color: string
  teacherId: string
  teacherName: string
  week: 'all' | 'odd' | 'even'
}

export interface Cell {
  unitId: string
  classId: string
  parts: CellPart[]
  alternating: boolean
}

export interface TimetableIndex {
  /** classId -> day -> period -> Cell | null */
  byClass: Map<string, (Cell | null)[][]>
  /** teacherId -> day -> period -> Cell[] */
  byTeacher: Map<string, Cell[][][]>
  days: number
  periods: number
}

export function buildIndex(
  schedule: Schedule | null,
  classes: SchoolClass[],
  teachers: Teacher[],
  settings: Settings,
): TimetableIndex {
  const D = Math.max(settings.daysPrimary, settings.daysSenior)
  let P = Math.max(...Object.values(settings.maxPerDayByGrade), 1)

  const byClass = new Map<string, (Cell | null)[][]>()
  const byTeacher = new Map<string, Cell[][][]>()

  if (!schedule) {
    for (const c of classes) byClass.set(c.id, grid2(D, P, null))
    for (const t of teachers) byTeacher.set(t.id, grid3(D, P))
    return { byClass, byTeacher, days: D, periods: P }
  }

  for (const pl of schedule.placements) P = Math.max(P, pl.period + 1)

  for (const c of classes) byClass.set(c.id, grid2(D, P, null))
  for (const t of teachers) byTeacher.set(t.id, grid3(D, P))

  const tName = new Map(teachers.map((t) => [t.id, t.fullName]))
  const unitById = new Map(schedule.units.map((u) => [u.id, u]))

  for (const pl of schedule.placements) {
    const u = unitById.get(pl.unitId)
    if (!u || pl.day < 0 || pl.period < 0) continue
    const cell = toCell(u, tName)
    const cg = byClass.get(u.classId)
    if (cg) cg[pl.day][pl.period] = cell
    for (const part of u.parts) {
      const tg = byTeacher.get(part.teacherId)
      if (tg) tg[pl.day][pl.period].push(cell)
    }
  }

  return { byClass, byTeacher, days: D, periods: P }
}

function toCell(u: LessonUnit, tName: Map<string, string>): Cell {
  return {
    unitId: u.id,
    classId: u.classId,
    alternating: u.alternating,
    parts: u.parts.map((p) => {
      const s = SUBJECT_BY_ID[p.subjectId]
      return {
        subjectId: p.subjectId,
        subjectName: s?.name ?? p.subjectId,
        subjectShort: s?.short ?? p.subjectId,
        color: s?.color ?? '#94a3b8',
        teacherId: p.teacherId,
        teacherName: tName.get(p.teacherId) ?? '—',
        week: p.week,
      }
    }),
  }
}

function grid2<T>(d: number, p: number, fill: T): T[][] {
  return Array.from({ length: d }, () => Array.from({ length: p }, () => fill))
}
function grid3(d: number, p: number): Cell[][][] {
  return Array.from({ length: d }, () => Array.from({ length: p }, () => [] as Cell[]))
}

export const weekLabel = (w: 'all' | 'odd' | 'even') =>
  w === 'odd' ? 'toq hafta' : w === 'even' ? 'juft hafta' : ''

/** O'qituvchining jadval bo'yicha haftalik soati */
export function teacherWeekHours(schedule: Schedule | null, teacherId: string): number {
  if (!schedule) return 0
  let sum = 0
  for (const u of schedule.units) {
    for (const p of u.parts) {
      if (p.teacherId === teacherId) sum += p.week === 'all' ? 1 : 0.5
    }
  }
  return sum
}

/** O'qituvchining kun bo'yicha oynalari */
export function gapsOfDay(grid: Cell[][][], day: number): number {
  const filled: number[] = []
  grid[day].forEach((c, p) => {
    if (c.length > 0) filled.push(p)
  })
  if (filled.length === 0) return 0
  return filled[filled.length - 1] - filled[0] + 1 - filled.length
}
