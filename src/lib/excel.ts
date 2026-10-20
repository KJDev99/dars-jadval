/**
 * Excel bilan ishlash: o'quvchilarni import qilish va statistikani eksport.
 * Hammasi brauzerda bajariladi — serverga fayl yuklanmaydi.
 */
// xlsx og'ir kutubxona — faqat import/eksport bosilganda yuklanadi
const loadXlsx = () => import('xlsx')

export interface ImportedStudent {
  class_name: string // «8a»
  full_name: string
  order_no: number
}

const CLASS_RE = /^\s*(\d{1,2})\s*[-\s]?\s*([a-zA-Zа-яА-ЯўқғҳЎҚҒҲ]{1,2})\s*$/

/** «8a», «8 A», «8-а» → {grade: 8, letter: 'a'} */
export function parseClassName(v: string): { grade: number; letter: string } | null {
  const m = CLASS_RE.exec(String(v ?? ''))
  if (!m) return null
  const grade = Number(m[1])
  if (grade < 1 || grade > 11) return null
  return { grade, letter: m[2].toLowerCase() }
}

const isClassHeader = (v: unknown) => /sinf|класс|class/i.test(String(v ?? ''))
const isNameHeader = (v: unknown) =>
  /f\.?i\.?sh|ism|familiya|o.?quvchi|учен|name|fio/i.test(String(v ?? ''))

/**
 * Excel/CSV faylini o'qiydi. Kutiladigan ustunlar: «Sinf» va «F.I.Sh.».
 * Sarlavha bo'lmasa — 1-ustun sinf, 2-ustun ism deb olinadi.
 */
export async function readStudentsFile(file: File): Promise<{
  rows: ImportedStudent[]
  skipped: number
}> {
  const XLSX = await loadXlsx()
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false })

  let classCol = 0
  let nameCol = 1
  let start = 0

  for (let i = 0; i < Math.min(matrix.length, 5); i++) {
    const row = matrix[i] ?? []
    const ci = row.findIndex(isClassHeader)
    const ni = row.findIndex(isNameHeader)
    if (ci >= 0 && ni >= 0) {
      classCol = ci
      nameCol = ni
      start = i + 1
      break
    }
  }

  const rows: ImportedStudent[] = []
  let skipped = 0
  const counters = new Map<string, number>()

  for (let i = start; i < matrix.length; i++) {
    const row = matrix[i] ?? []
    const cls = parseClassName(String(row[classCol] ?? ''))
    const name = String(row[nameCol] ?? '').trim().replace(/\s+/g, ' ')
    if (!cls || name.length < 3) {
      if (String(row[classCol] ?? '').trim() || name) skipped++
      continue
    }
    const key = `${cls.grade}${cls.letter}`
    const n = (counters.get(key) ?? 0) + 1
    counters.set(key, n)
    rows.push({ class_name: key, full_name: name, order_no: n })
  }

  return { rows, skipped }
}

/** Import uchun namuna fayl */
export async function downloadTemplate(): Promise<void> {
  const XLSX = await loadXlsx()
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([
    ['Sinf', 'F.I.Sh.'],
    ['8a', 'Aliyev Vali Alievich'],
    ['8a', 'Boboyeva Zuhra Baxtiyorovna'],
    ['8b', 'Davlatov Sardor Rustamovich'],
    ['9a', 'Eshonqulova Nilufar Ergashevna'],
  ])
  ws['!cols'] = [{ wch: 8 }, { wch: 36 }]
  XLSX.utils.book_append_sheet(wb, ws, "O'quvchilar")
  XLSX.writeFile(wb, 'oquvchilar-namuna.xlsx')
}

/* ───────────────────────────── Eksport ───────────────────────────── */

export interface Sheet {
  name: string
  /** Birinchi satr — sarlavha */
  rows: (string | number | null)[][]
  widths?: number[]
}

/** Bir nechta varaqli Excel fayl yuklab olish */
export async function exportSheets(fileName: string, sheets: Sheet[]): Promise<void> {
  const XLSX = await loadXlsx()
  const wb = XLSX.utils.book_new()
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(s.rows)
    ws['!cols'] =
      s.widths?.map((w) => ({ wch: w })) ??
      (s.rows[0] ?? []).map((_, i) => ({
        wch: Math.min(
          42,
          Math.max(10, ...s.rows.slice(0, 200).map((r) => String(r[i] ?? '').length + 2)),
        ),
      }))
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31))
  }
  XLSX.writeFile(wb, fileName)
}

/** Fayl nomi uchun sana: 2026-10-18 */
export const today = (): string => new Date().toISOString().slice(0, 10)

/* ═══════════════ BSB/ChSB rejasi va dars jadvali ═══════════════ */

export const WEEKDAYS = [
  'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba',
] as const

/** Excel katakchasidan sanani olish: raqam (seriya) yoki matn */
export function parseDate(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null

  // Excel seriya raqami (1899-12-30 dan boshlab kunlar)
  if (typeof v === 'number' && v > 20000 && v < 60000) {
    const ms = Math.round((v - 25569) * 86400 * 1000)
    return new Date(ms).toISOString().slice(0, 10)
  }
  if (v instanceof Date) return v.toISOString().slice(0, 10)

  const t = String(v).trim()
  // 2026-10-15
  let m = /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/.exec(t)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  // 15.10.2026 yoki 15/10/2026
  m = /^(\d{1,2})[-./](\d{1,2})[-./](\d{4})$/.exec(t)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return null
}

/** «1-BSB», «BSB 2», «ChSB» → ish turi va raqami */
export function parseWork(v: unknown): { kind: 'bsb' | 'chsb'; idx: number } | null {
  const t = String(v ?? '').trim().toLowerCase()
  if (!t) return null
  if (/ch\s*s\s*b|чсб|chorak/.test(t)) return { kind: 'chsb', idx: 1 }
  if (/b\s*s\s*b|бсб/.test(t)) {
    const n = /(\d+)/.exec(t)
    return { kind: 'bsb', idx: n ? Math.max(1, Math.min(9, Number(n[1]))) : 1 }
  }
  return null
}

/** «Dushanba», «dush», «1» → 1..7 */
export function parseWeekday(v: unknown): number | null {
  const t = String(v ?? '').trim().toLowerCase()
  if (!t) return null
  const n = Number(t)
  if (Number.isInteger(n) && n >= 1 && n <= 7) return n
  // «yakshanba» «shanba» dan oldin tekshirilsin
  if (t.startsWith('yak')) return 7
  const list = ['dush', 'sesh', 'chor', 'pay', 'jum', 'shan']
  for (let i = 0; i < list.length; i++) if (t.startsWith(list[i])) return i + 1
  return null
}

export interface PlanRow {
  quarter: number
  /** «8a» yoki «8» — butun parallel */
  class_name: string
  subject: string
  kind: 'bsb' | 'chsb'
  idx: number
  planned_on: string
  max_points: number | null
}

const findCol = (row: unknown[], re: RegExp) => row.findIndex((c) => re.test(String(c ?? '')))

/** Reja faylini o'qish. Ustunlar: Chorak | Sinf | Fan | Ish | Sana | Ball */
export async function readPlanFile(file: File): Promise<{ rows: PlanRow[]; skipped: number }> {
  const XLSX = await loadXlsx()
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const m = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false })

  let col = { q: 0, cls: 1, sub: 2, work: 3, date: 4, pts: 5 }
  let start = 0
  for (let i = 0; i < Math.min(m.length, 5); i++) {
    const r = m[i] ?? []
    const cls = findCol(r, /sinf|класс|class/i)
    const sub = findCol(r, /fan|предмет|subject/i)
    const date = findCol(r, /sana|дата|date/i)
    if (cls >= 0 && sub >= 0 && date >= 0) {
      const q = findCol(r, /chorak|четв/i)
      const work = findCol(r, /ish|bsb|chsb|вид/i)
      col = { q: q >= 0 ? q : 0, cls, sub, work: work >= 0 ? work : 3, date, pts: findCol(r, /ball|балл|point/i) }
      start = i + 1
      break
    }
  }

  const rows: PlanRow[] = []
  let skipped = 0
  for (let i = start; i < m.length; i++) {
    const r = m[i] ?? []
    const cls = String(r[col.cls] ?? '').trim()
    const sub = String(r[col.sub] ?? '').trim()
    const work = parseWork(r[col.work])
    const date = parseDate(r[col.date])
    const q = Number(String(r[col.q] ?? '').replace(/\D/g, '')) || 0
    if (!cls || !sub || !work || !date || q < 1 || q > 4) {
      if (cls || sub) skipped++
      continue
    }
    const pts = col.pts >= 0 ? Number(String(r[col.pts] ?? '').replace(',', '.')) : NaN
    rows.push({
      quarter: q,
      class_name: cls.toLowerCase().replace(/[\s-]/g, ''),
      subject: sub,
      kind: work.kind,
      idx: work.idx,
      planned_on: date,
      max_points: Number.isFinite(pts) && pts > 0 ? pts : null,
    })
  }
  return { rows, skipped }
}

export interface LessonRow {
  class_name: string
  weekday: number
  lesson_no: number
  subject: string
  teacher: string | null
  room: string | null
}

/** Dars jadvalini o'qish. Ustunlar: Sinf | Kun | Dars | Fan | O'qituvchi | Xona */
export async function readLessonsFile(file: File): Promise<{ rows: LessonRow[]; skipped: number }> {
  const XLSX = await loadXlsx()
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const m = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false })

  let col = { cls: 0, day: 1, no: 2, sub: 3, teacher: 4, room: 5 }
  let start = 0
  for (let i = 0; i < Math.min(m.length, 5); i++) {
    const r = m[i] ?? []
    const cls = findCol(r, /sinf|класс|class/i)
    const day = findCol(r, /kun|hafta|день|day/i)
    const sub = findCol(r, /fan|предмет|subject/i)
    if (cls >= 0 && day >= 0 && sub >= 0) {
      const no = findCol(r, /dars|soat|para|урок/i)
      col = {
        cls,
        day,
        no: no >= 0 ? no : 2,
        sub,
        teacher: findCol(r, /qituvchi|учител|teacher/i),
        room: findCol(r, /xona|kabinet|room/i),
      }
      start = i + 1
      break
    }
  }

  const rows: LessonRow[] = []
  let skipped = 0
  for (let i = start; i < m.length; i++) {
    const r = m[i] ?? []
    const cls = String(r[col.cls] ?? '').trim()
    const sub = String(r[col.sub] ?? '').trim()
    const wd = parseWeekday(r[col.day])
    const no = Number(String(r[col.no] ?? '').replace(/\D/g, ''))
    if (!cls || !sub || !wd || !no || no < 1 || no > 12) {
      if (cls || sub) skipped++
      continue
    }
    rows.push({
      class_name: cls.toLowerCase().replace(/[\s-]/g, ''),
      weekday: wd,
      lesson_no: no,
      subject: sub,
      teacher: col.teacher >= 0 ? String(r[col.teacher] ?? '').trim() || null : null,
      room: col.room >= 0 ? String(r[col.room] ?? '').trim() || null : null,
    })
  }
  return { rows, skipped }
}

/** Reja uchun namuna fayl */
export async function downloadPlanTemplate(): Promise<void> {
  await exportSheets('bsb-reja-namuna.xlsx', [
    {
      name: 'Reja',
      rows: [
        ['Chorak', 'Sinf', 'Fan', 'Ish', 'Sana', 'Ball'],
        [1, '8a', 'Matematika', '1-BSB', '15.11.2026', 10],
        [1, '8a', 'Matematika', '2-BSB', '02.12.2026', 20],
        [1, '8a', 'Matematika', 'ChSB', '20.12.2026', 40],
        [1, '8', 'Ingliz tili', '1-BSB', '18.11.2026', 15],
      ],
      widths: [8, 8, 22, 10, 14, 7],
    },
  ])
}

/** Dars jadvali uchun namuna fayl */
export async function downloadLessonsTemplate(): Promise<void> {
  await exportSheets('dars-jadval-namuna.xlsx', [
    {
      name: 'Jadval',
      rows: [
        ['Sinf', 'Kun', 'Dars', 'Fan', "O'qituvchi", 'Xona'],
        ['8a', 'Dushanba', 1, 'Matematika', 'Aliyev Vali', '203'],
        ['8a', 'Dushanba', 2, 'Ona tili va adabiyot', 'Boboyeva Zuhra', '105'],
        ['8a', 'Seshanba', 1, 'Fizika', '', '301'],
        ['8b', 'Dushanba', 1, 'Ingliz tili', '', '208'],
      ],
      widths: [8, 12, 7, 24, 22, 7],
    },
  ])
}
