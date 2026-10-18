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
