import { DAY_NAMES } from '../types'
import type { SchoolClass, Teacher } from '../types'
import type { TimetableIndex } from './view'

function download(filename: string, content: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob(['﻿' + content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const esc = (s: string) => `"${String(s ?? '').replace(/"/g, '""')}"`

function cellText(idx: TimetableIndex, classId: string, d: number, p: number): string {
  const cell = idx.byClass.get(classId)?.[d]?.[p]
  if (!cell) return ''
  return cell.parts
    .map((pt) => `${pt.subjectName}${pt.week !== 'all' ? ` (${pt.week === 'odd' ? 'toq' : 'juft'} hafta)` : ''} — ${pt.teacherName}`)
    .join(' / ')
}

/** Barcha sinflar jadvalini CSV ga chiqarish */
export function exportClassesCsv(idx: TimetableIndex, classes: SchoolClass[], schoolName: string) {
  const rows: string[] = []
  rows.push(esc(schoolName + ' — sinflar dars jadvali'))
  rows.push('')
  for (const c of classes) {
    rows.push(esc(`${c.grade}-${c.letter} sinf`))
    rows.push(['Soat', ...DAY_NAMES.slice(0, idx.days)].map(esc).join(';'))
    for (let p = 0; p < idx.periods; p++) {
      const line = [String(p + 1)]
      let any = false
      for (let d = 0; d < idx.days; d++) {
        const t = cellText(idx, c.id, d, p)
        if (t) any = true
        line.push(t)
      }
      if (any) rows.push(line.map(esc).join(';'))
    }
    rows.push('')
  }
  download('sinflar-dars-jadvali.csv', rows.join('\r\n'))
}

/** O'qituvchilar jadvalini CSV ga chiqarish */
export function exportTeachersCsv(idx: TimetableIndex, teachers: Teacher[], schoolName: string) {
  const rows: string[] = []
  rows.push(esc(schoolName + " — o'qituvchilar dars jadvali"))
  rows.push('')
  for (const t of teachers) {
    const grid = idx.byTeacher.get(t.id)
    if (!grid) continue
    rows.push(esc(`${t.fullName} (${t.speciality})`))
    rows.push(['Soat', ...DAY_NAMES.slice(0, idx.days)].map(esc).join(';'))
    for (let p = 0; p < idx.periods; p++) {
      const line = [String(p + 1)]
      let any = false
      for (let d = 0; d < idx.days; d++) {
        const cells = grid[d][p]
        const txt = cells
          .map((c) => {
            const part = c.parts.find((x) => x.teacherId === t.id)
            return `${c.classId} — ${part?.subjectShort ?? ''}`
          })
          .join(' / ')
        if (txt) any = true
        line.push(txt)
      }
      if (any) rows.push(line.map(esc).join(';'))
    }
    rows.push('')
  }
  download('oqituvchilar-dars-jadvali.csv', rows.join('\r\n'))
}

/** Tarifikatsiya ro'yxati */
export function exportTarifikatsiyaCsv(
  rows: { teacher: string; speciality: string; items: string; hours: number }[],
  schoolName: string,
) {
  const out: string[] = []
  out.push(esc(schoolName + ' — tarifikatsiya'))
  out.push(['№', "O'qituvchi", 'Mutaxassislik', 'Sinf va fanlar', 'Haftalik soat'].map(esc).join(';'))
  rows.forEach((r, i) => {
    out.push([String(i + 1), r.teacher, r.speciality, r.items, String(r.hours)].map(esc).join(';'))
  })
  download('tarifikatsiya.csv', out.join('\r\n'))
}

export function exportJson(data: unknown, filename = 'dars-jadval-baza.json') {
  download(filename, JSON.stringify(data, null, 2), 'application/json;charset=utf-8')
}
