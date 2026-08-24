/**
 * Excel (.xlsx) bilan ishlash.
 *
 * Yuklab olish: o'qituvchilar ro'yxati, ularning toifasi (darajasi) va
 * «qaysi o'qituvchi — qaysi sinfda — qaysi fandan — necha soat» tarifikatsiyasi.
 *
 * Yuklash: tayyorlangan fayl o'qiladi, tekshiriladi va shu asosda
 * o'qituvchilar, tarifikatsiya hamda sinf o'quv rejasi to'ldiriladi —
 * so'ng jadval to'g'ridan-to'g'ri shu fayl bo'yicha tuziladi.
 */
import type * as XLSX from 'xlsx'
import { SUBJECTS, SUBJECT_BY_ID } from '../data/curriculum'
import { CATEGORY_LABELS, DAY_NAMES, DAY_SHORT } from '../types'
import type { Assignments, SchoolClass, Settings, Teacher, TeacherCategory } from '../types'
import { asgKey, effectiveHours, teacherLoads, type PlanOverrides } from './derive'

/**
 * SheetJS kutubxonasi ~450 KB. U faqat Excel bilan ishlaganda kerak,
 * shuning uchun alohida bo'lakka ajratilib, talab bo'lgandagina yuklanadi.
 */
let xlsxPromise: Promise<typeof XLSX> | null = null
const loadXlsx = () => (xlsxPromise ??= import('xlsx'))

/* ────────────────────────────── Varaq nomlari ────────────────────────────── */

export const SHEETS = {
  teachers: "O'qituvchilar",
  tarif: 'Tarifikatsiya',
  classes: 'Sinflar',
  ref: "Ma'lumotnoma",
} as const

export const TEACHER_HEADERS = [
  '№',
  'F.I.Sh.',
  'Toifa',
  'Mutaxassislik',
  "O'qitadigan fanlar",
  'Min soat',
  'Max soat',
  'Sinf rahbari',
  "Bo'sh kunlar",
  'Haftalik soat',
] as const

export const TARIF_HEADERS = ['№', 'F.I.Sh.', 'Toifa', 'Sinf', 'Fan', 'Haftalik soat'] as const

export const CLASS_HEADERS = [
  'Sinf',
  'Daraja',
  'Harf',
  "O'quvchilar",
  'Sinf rahbari',
  "O'quv kunlari",
  'Haftalik soat',
] as const

/* ────────────────────────────── Normalizatsiya ───────────────────────────── */

/** Solishtirish uchun: apostroflar, tinish belgilari va bo'shliqlar olib tashlanadi */
function norm(v: unknown): string {
  return String(v ?? '')
    .replace(/[’‘`´ʻʼ']/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, '')
}

/** Kirill harflarini lotinga o'girish (sinf harfi uchun) */
const CYR_LETTER: Record<string, string> = { А: 'A', В: 'B', Б: 'B', Д: 'D', Е: 'E', Г: 'G', К: 'K' }

const s = (v: unknown) => String(v ?? '').trim()

function toNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const t = s(v).replace(',', '.').replace(/[^0-9.]/g, '')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

/* ───────────────────────────── Qiymat tahlilchilari ──────────────────────── */

export function parseCategory(v: unknown): TeacherCategory {
  const n = norm(v)
  if (!n || n === 'yoq' || n === 'toifasiz' || n === '0') return 'yoq'
  if (n.includes('oliy') || n.includes('vissh') || n.includes('высш')) return 'oliy'
  if (n.startsWith('1') || n.includes('birinchi')) return 'birinchi'
  if (n.startsWith('2') || n.includes('ikkinchi')) return 'ikkinchi'
  return 'yoq'
}

/** "7-A", "7a", "10 B", "7-A sinf" → "7A" */
export function parseClassId(v: unknown): string | null {
  const raw = s(v)
  if (!raw) return null
  const m = raw.match(/(\d{1,2})\s*[-–—.\s]?\s*([A-Za-zА-Яа-я])/)
  if (!m) return null
  const grade = Number(m[1])
  if (!(grade >= 1 && grade <= 11)) return null
  const up = m[2].toUpperCase()
  const letter = CYR_LETTER[up] ?? up
  if (!/^[A-Z]$/.test(letter)) return null
  return `${grade}${letter}`
}

/** "Dushanba, Juma" yoki "Du; Ju" yoki "1,5" → [0, 4] */
export function parseDays(v: unknown): number[] {
  const raw = s(v)
  if (!raw) return []
  const out = new Set<number>()
  for (const piece of raw.split(/[,;/|]+/)) {
    const n = norm(piece)
    if (!n) continue
    let idx = DAY_NAMES.findIndex((d) => norm(d) === n)
    if (idx < 0) idx = DAY_SHORT.findIndex((d) => norm(d) === n)
    if (idx < 0 && /^[1-6]$/.test(n)) idx = Number(n) - 1
    if (idx >= 0) out.add(idx)
  }
  return [...out].sort((a, b) => a - b)
}

/* ─────────────────────────────── Fan qidirish ────────────────────────────── */

const SUBJECT_ALIASES: Record<string, string[]> = {
  ona_tili: ['onatili', 'onatilivaadabiyot'],
  oqish_savodxonligi: ['oqishsavodxonligi', 'oqish'],
  chet_tili: ['chettili', 'ingliztili', 'ingliz', 'xorijiytil'],
  davlat_huquq: ['huquq', 'davlathuquq', 'davlatvahuquq'],
  ozbekiston_tarixi: ['ozbtarixi', 'ozbekistontarixi'],
  informatika: ['informatika', 'informatikavaat', 'informatikavaaxborottexnologiyalari', 'axborottexnologiyalari'],
  iqtisodiy_bilim: ['iqtisod', 'iqtisodiybilim', 'iqtisodiybilimasoslari'],
  tadbirkorlik: ['tadbirkorlik', 'tadbirkorlikasoslari'],
  tabiiy_fan: ['tabiiyfan', 'science', 'tabiiyfanlar'],
  tasviriy_sanat: ['tasviriysanat', 'tasviriy', 'rasm'],
  jismoniy_tarbiya: ['jismoniytarbiya', 'jismoniy'],
  chqbt: ['chqbt', 'chaqiruvgaqadarboshlangichtayyorgarlik'],
  manaviyat: ['manaviyat', 'manaviyatsoati'],
}

const SUBJECT_INDEX: Map<string, string> = (() => {
  const m = new Map<string, string>()
  const put = (key: string, id: string) => {
    const k = norm(key)
    if (k.length >= 2 && !m.has(k)) m.set(k, id)
  }
  for (const sub of SUBJECTS) {
    put(sub.id, sub.id)
    put(sub.name, sub.id)
    put(sub.short, sub.id)
  }
  for (const [id, list] of Object.entries(SUBJECT_ALIASES)) for (const a of list) put(a, id)
  return m
})()

/** Fan nomini (yoki qisqartmasini) fan kodiga aylantirish */
export function resolveSubject(v: unknown): string | null {
  const n = norm(v)
  if (!n) return null
  const direct = SUBJECT_INDEX.get(n)
  if (direct) return direct
  // Boshlanishi bo'yicha yagona moslik
  if (n.length >= 4) {
    const hits = SUBJECTS.filter((sub) => norm(sub.name).startsWith(n) || n.startsWith(norm(sub.name)))
    if (hits.length === 1) return hits[0].id
  }
  return null
}

/* ───────────────────────────── Sarlavha xaritasi ─────────────────────────── */

type ColKey =
  | 'name' | 'category' | 'speciality' | 'subjects' | 'min' | 'max' | 'homeroom' | 'offdays'
  | 'class' | 'subject' | 'hours' | 'students' | 'no'

const HEADER_ALIASES: Record<ColKey, string[]> = {
  no: ['№', 'n', 'no', 'tr', 'tartib'],
  name: ['fish', 'fio', 'fisho', 'oqituvchi', 'oqituvchifish', 'oqituvchining', 'ismsharif', 'familiya', 'ism'],
  category: ['toifa', 'daraja', 'malakatoifasi', 'malakadarajasi', 'kategoriya'],
  speciality: ['mutaxassislik', 'mutahassislik', 'yonalish', 'metodbirlashma', 'fanguruhi', 'guruh'],
  subjects: ['oqitadiganfanlar', 'fanlar', 'oqitadiganfan'],
  min: ['minsoat', 'min', 'minimalsoat', 'engkamsoat'],
  max: ['maxsoat', 'max', 'makssoat', 'maksimalsoat', 'engkopsoat'],
  homeroom: ['sinfrahbari', 'sinfraxbari', 'rahbarlikqiladigansinf', 'rahbarsinfi'],
  offdays: ['boshkunlar', 'boshkun', 'bandkunlar', 'darsyoqkunlar', 'dammolishkuni'],
  class: ['sinf', 'sinfnomi', 'sinflar'],
  subject: ['fan', 'fannomi', 'fani', 'darsnomi'],
  hours: ['haftaliksoat', 'soat', 'soatsoni', 'darssoati', 'haftasoat', 'soati'],
  students: ['oquvchilar', 'oquvchilarsoni', 'oquvchi'],
}

type Row = unknown[]

/** Sarlavha qatorini topib, ustun indekslarini qaytaradi */
function mapColumns(rows: Row[], want: ColKey[]): { header: number; cols: Partial<Record<ColKey, number>> } {
  let best = { header: -1, cols: {} as Partial<Record<ColKey, number>>, score: 0 }
  const limit = Math.min(rows.length, 12)
  for (let r = 0; r < limit; r++) {
    const cols: Partial<Record<ColKey, number>> = {}
    let score = 0
    rows[r].forEach((cell, c) => {
      const n = norm(cell)
      if (!n) return
      for (const key of want) {
        if (cols[key] !== undefined) continue
        if (HEADER_ALIASES[key].includes(n)) {
          cols[key] = c
          score++
          return
        }
      }
    })
    if (score > best.score) best = { header: r, cols, score }
  }
  return { header: best.header, cols: best.cols }
}

function sheetRows(X: typeof XLSX, wb: XLSX.WorkBook, name: string): Row[] {
  const ws = wb.Sheets[name]
  if (!ws) return []
  return X.utils.sheet_to_json<Row>(ws, { header: 1, blankrows: false, defval: '' })
}

/** Varaq nomini moslashtirib topish */
function findSheet(wb: XLSX.WorkBook, keys: string[]): string | null {
  for (const name of wb.SheetNames) {
    const n = norm(name)
    if (keys.some((k) => n.includes(k))) return name
  }
  return null
}

/* ─────────────────────────────── Yuklab olish ────────────────────────────── */

interface ExportInput {
  classes: SchoolClass[]
  teachers: Teacher[]
  assignments: Assignments
  overrides: PlanOverrides
  settings: Settings
}

const REF_TEXT: string[][] = [
  ["Faylni to'ldirish qoidalari"],
  [''],
  ["1. «O'qituvchilar» varag'ida har bir o'qituvchi bitta qatorda bo'ladi. F.I.Sh. — majburiy ustun."],
  ['2. «Toifa» ustuniga quyidagilardan biri yoziladi: Oliy toifa, 1-toifa, 2-toifa, Toifasiz.'],
  ["3. «O'qitadigan fanlar» — vergul bilan ajratiladi, masalan: Algebra, Geometriya."],
  ["4. «Sinf rahbari» — o'sha o'qituvchi rahbarlik qiladigan sinf, masalan: 7-A. Bo'sh qoldirilishi mumkin."],
  ["5. «Bo'sh kunlar» — dars qo'yilmaydigan kunlar, masalan: Dushanba, Juma."],
  [''],
  ["6. «Tarifikatsiya» varag'ida har bir qator — bitta o'qituvchining bitta sinfdagi bitta fani."],
  ['7. «Sinf» ustuni: 7-A, 7A yoki 7 A ko\'rinishida. «Fan» ustuni: fan nomi yoki qisqartmasi.'],
  ["8. «Haftalik soat» — 0,5 qadam bilan (0,5; 1; 1,5; 2 ...)."],
  [''],
  ["9. Faylda bo'lmagan o'qituvchi avtomatik yangi o'qituvchi sifatida qo'shiladi."],
  ['10. Ustunlar tartibini o\'zgartirsangiz ham bo\'ladi — sarlavha nomi bo\'yicha o\'qiladi.'],
  [''],
  ['Toifalar'],
  ...Object.values(CATEGORY_LABELS).map((v) => [v]),
  [''],
  ['Hafta kunlari'],
  ...DAY_NAMES.map((d) => [d]),
]

function refSheet(X: typeof XLSX, classes: SchoolClass[]): XLSX.WorkSheet {
  const aoa: unknown[][] = REF_TEXT.map((r) => [...r])
  aoa.push([''], ['Fanlar ro\'yxati'], ['Fan nomi', 'Qisqartma', "Yo'nalish"])
  for (const sub of SUBJECTS) aoa.push([sub.name, sub.short, sub.yonalish])
  aoa.push([''], ['Sinflar'], [classes.map((c) => `${c.grade}-${c.letter}`).join(', ')])
  const ws = X.utils.aoa_to_sheet(aoa)
  ws['!cols'] = [{ wch: 46 }, { wch: 14 }, { wch: 28 }]
  return ws
}

/**
 * Excel kitobini yig'ish.
 * `template = true` bo'lsa faqat sarlavhalar va sinflar qoladi (bo'sh shablon).
 */
export async function buildWorkbook(input: ExportInput, template = false): Promise<XLSX.WorkBook> {
  const X = await loadXlsx()
  const { classes, teachers, assignments, overrides, settings } = input
  const wb = X.utils.book_new()
  const loads = teacherLoads(teachers, classes, assignments, overrides)
  const clsById = new Map(classes.map((c) => [c.id, c]))
  const label = (id?: string) => {
    const c = id ? clsById.get(id) : undefined
    return c ? `${c.grade}-${c.letter}` : ''
  }

  /* 1. O'qituvchilar */
  const tRows: unknown[][] = [[...TEACHER_HEADERS]]
  if (!template) {
    teachers.forEach((t, i) => {
      tRows.push([
        i + 1,
        t.fullName,
        CATEGORY_LABELS[t.category ?? 'yoq'],
        t.speciality,
        t.subjectIds.map((id) => SUBJECT_BY_ID[id]?.name ?? id).join(', '),
        t.minHours,
        t.maxHours,
        label(t.homeroomClassId),
        (t.unavailableDays ?? []).map((d) => DAY_NAMES[d]).join(', '),
        loads[t.id] ?? 0,
      ])
    })
  }
  const wsT = X.utils.aoa_to_sheet(tRows)
  wsT['!cols'] = [{ wch: 5 }, { wch: 30 }, { wch: 12 }, { wch: 24 }, { wch: 40 }, { wch: 9 }, { wch: 9 }, { wch: 13 }, { wch: 20 }, { wch: 13 }]
  X.utils.book_append_sheet(wb, wsT, SHEETS.teachers)

  /* 2. Tarifikatsiya — o'qituvchi bo'yicha guruhlangan */
  const tarif: { teacher: Teacher | null; classId: string; subjectId: string; hours: number }[] = []
  for (const c of classes) {
    for (const sub of SUBJECTS) {
      const hours = effectiveHours(c, sub.id, overrides)
      if (hours <= 0) continue
      const tid = assignments[asgKey(c.id, sub.id)]
      tarif.push({
        teacher: teachers.find((t) => t.id === tid) ?? null,
        classId: c.id,
        subjectId: sub.id,
        hours,
      })
    }
  }
  tarif.sort((a, b) => {
    if (!a.teacher !== !b.teacher) return a.teacher ? -1 : 1
    const byName = (a.teacher?.fullName ?? '').localeCompare(b.teacher?.fullName ?? '')
    if (byName) return byName
    const ca = clsById.get(a.classId)
    const cb = clsById.get(b.classId)
    return (ca?.grade ?? 0) - (cb?.grade ?? 0) || a.classId.localeCompare(b.classId)
  })

  const aRows: unknown[][] = [[...TARIF_HEADERS]]
  if (!template) {
    tarif.forEach((r, i) => {
      aRows.push([
        i + 1,
        r.teacher?.fullName ?? '',
        r.teacher ? CATEGORY_LABELS[r.teacher.category ?? 'yoq'] : '',
        label(r.classId),
        SUBJECT_BY_ID[r.subjectId]?.name ?? r.subjectId,
        r.hours,
      ])
    })
  }
  const wsA = X.utils.aoa_to_sheet(aRows)
  wsA['!cols'] = [{ wch: 5 }, { wch: 30 }, { wch: 12 }, { wch: 9 }, { wch: 34 }, { wch: 13 }]
  X.utils.book_append_sheet(wb, wsA, SHEETS.tarif)

  /* 3. Sinflar */
  const cRows: unknown[][] = [[...CLASS_HEADERS]]
  for (const c of classes) {
    const hr = teachers.find((t) => t.homeroomClassId === c.id)
    const total = SUBJECTS.reduce((sum, sub) => sum + effectiveHours(c, sub.id, overrides), 0)
    cRows.push([
      `${c.grade}-${c.letter}`,
      c.grade,
      c.letter,
      c.studentsCount ?? '',
      hr?.fullName ?? '',
      c.grade <= 4 ? settings.daysPrimary : settings.daysSenior,
      total,
    ])
  }
  const wsC = X.utils.aoa_to_sheet(cRows)
  wsC['!cols'] = [{ wch: 9 }, { wch: 9 }, { wch: 7 }, { wch: 12 }, { wch: 30 }, { wch: 14 }, { wch: 14 }]
  X.utils.book_append_sheet(wb, wsC, SHEETS.classes)

  /* 4. Ma'lumotnoma */
  X.utils.book_append_sheet(wb, refSheet(X, classes), SHEETS.ref)
  return wb
}

export async function exportExcel(input: ExportInput, template = false) {
  const X = await loadXlsx()
  const wb = await buildWorkbook(input, template)
  const name = template ? 'tarifikatsiya-shablon.xlsx' : 'oqituvchilar-va-tarifikatsiya.xlsx'
  X.writeFile(wb, name, { compression: true })
}

/* ─────────────────────────────── Faylni o'qish ───────────────────────────── */

export interface ImportedTeacher {
  teacher: Teacher
  /** Mavjud o'qituvchi yangilandimi yoki yangi qo'shildimi */
  status: 'new' | 'updated'
  hours: number
}

export interface ImportPreview {
  /** Fayldagi o'qituvchilar (mavjudlari bilan birlashtirilgan) */
  imported: ImportedTeacher[]
  /** Faylda uchramagan, bazadagi o'qituvchilar */
  missing: Teacher[]
  assignments: Assignments
  /** classId -> subjectId -> soat (fayldan olingan) */
  classHours: Record<string, Record<string, number>>
  /** Faylda uchragan, lekin bazada yo'q sinflar */
  newClasses: SchoolClass[]
  totalHours: number
  rowsRead: number
  warnings: string[]
  errors: string[]
}

interface ParseCtx {
  classes: SchoolClass[]
  teachers: Teacher[]
  overrides: PlanOverrides
}

let uid = 0
const newId = () => `x-${Date.now().toString(36)}-${(uid++).toString(36)}`

/** Excel faylini o'qib, qo'llashdan oldingi ko'rinishni tayyorlash */
export async function parseWorkbook(data: ArrayBuffer, ctx: ParseCtx): Promise<ImportPreview> {
  const X = await loadXlsx()
  const warnings: string[] = []
  const errors: string[] = []

  let wb: XLSX.WorkBook
  try {
    wb = X.read(data, { type: 'array' })
  } catch (e) {
    return {
      imported: [], missing: [], assignments: {}, classHours: {}, newClasses: [],
      totalHours: 0, rowsRead: 0, warnings: [],
      errors: ['Faylni o\'qib bo\'lmadi: ' + (e as Error).message],
    }
  }

  const byNorm = new Map<string, Teacher>()
  for (const t of ctx.teachers) byNorm.set(norm(t.fullName), t)

  /** Toifasi «O'qituvchilar» varag'ida ko'rsatilganlar — tarifikatsiya uni bekor qilmaydi */
  const catFromSheet = new Set<string>()

  /** F.I.Sh. bo'yicha o'qituvchini olish yoki yaratish */
  const built = new Map<string, ImportedTeacher>()
  function teacherFor(name: string): ImportedTeacher | null {
    const key = norm(name)
    if (!key) return null
    const existing = built.get(key)
    if (existing) return existing
    const base = byNorm.get(key)
    const rec: ImportedTeacher = base
      ? { teacher: { ...base }, status: 'updated', hours: 0 }
      : {
          teacher: {
            id: newId(),
            fullName: s(name),
            speciality: '',
            category: 'yoq',
            subjectIds: [],
            minHours: 4,
            maxHours: 24,
            unavailableDays: [],
          },
          status: 'new',
          hours: 0,
        }
    built.set(key, rec)
    return rec
  }

  /* ── 1. O'qituvchilar varag'i ─────────────────────────────────────────── */
  const tName = findSheet(wb, ['qituvchi', 'kadr', 'pedagog'])
  if (tName) {
    const rows = sheetRows(X, wb, tName)
    const { header, cols } = mapColumns(rows, [
      'name', 'category', 'speciality', 'subjects', 'min', 'max', 'homeroom', 'offdays',
    ])
    if (header < 0 || cols.name === undefined) {
      errors.push(`«${tName}» varag'ida «F.I.Sh.» ustuni topilmadi.`)
    } else {
      for (let r = header + 1; r < rows.length; r++) {
        const row = rows[r]
        const name = s(row[cols.name])
        if (!name) continue
        const rec = teacherFor(name)
        if (!rec) continue
        const t = rec.teacher

        if (cols.category !== undefined && s(row[cols.category])) {
          t.category = parseCategory(row[cols.category])
          catFromSheet.add(norm(name))
        }
        if (cols.speciality !== undefined && s(row[cols.speciality])) t.speciality = s(row[cols.speciality])

        if (cols.subjects !== undefined) {
          const raw = s(row[cols.subjects])
          if (raw) {
            const ids: string[] = []
            for (const piece of raw.split(/[,;/|]+/)) {
              if (!s(piece)) continue
              const id = resolveSubject(piece)
              if (id) {
                if (!ids.includes(id)) ids.push(id)
              } else {
                warnings.push(`${name}: «${s(piece)}» fani tanilmadi (${r + 1}-qator).`)
              }
            }
            if (ids.length) t.subjectIds = ids
          }
        }

        const mn = cols.min !== undefined ? toNumber(row[cols.min]) : null
        const mx = cols.max !== undefined ? toNumber(row[cols.max]) : null
        if (mn !== null) t.minHours = mn
        if (mx !== null) t.maxHours = mx
        if (t.minHours > t.maxHours) {
          warnings.push(`${name}: min soat max soatdan katta — o'rni almashtirildi.`)
          const tmp = t.minHours
          t.minHours = t.maxHours
          t.maxHours = tmp
        }

        if (cols.homeroom !== undefined) {
          const raw = s(row[cols.homeroom])
          if (raw) {
            const cid = parseClassId(raw)
            if (cid) t.homeroomClassId = cid
            else warnings.push(`${name}: «${raw}» sinf nomi tanilmadi (${r + 1}-qator).`)
          } else t.homeroomClassId = undefined
        }

        if (cols.offdays !== undefined) t.unavailableDays = parseDays(row[cols.offdays])
      }
    }
  } else {
    warnings.push("«O'qituvchilar» varag'i topilmadi — o'qituvchilar tarifikatsiyadan olinadi.")
  }

  /* ── 2. Tarifikatsiya varag'i ─────────────────────────────────────────── */
  const assignments: Assignments = {}
  const classHours: Record<string, Record<string, number>> = {}
  const newClassIds = new Set<string>()
  const knownClasses = new Set(ctx.classes.map((c) => c.id))
  let rowsRead = 0
  let totalHours = 0

  const aName = findSheet(wb, ['tarif', 'yuklama', 'dars'])
  if (!aName) {
    errors.push("«Tarifikatsiya» varag'i topilmadi. Namuna faylni yuklab oling.")
  } else {
    const rows = sheetRows(X, wb, aName)
    const { header, cols } = mapColumns(rows, ['name', 'class', 'subject', 'hours', 'category'])
    if (header < 0 || cols.name === undefined || cols.class === undefined || cols.subject === undefined) {
      errors.push(`«${aName}» varag'ida «F.I.Sh.», «Sinf» va «Fan» ustunlari kerak.`)
    } else {
      for (let r = header + 1; r < rows.length; r++) {
        const row = rows[r]
        const name = s(row[cols.name])
        const rawClass = s(row[cols.class])
        const rawSubject = s(row[cols.subject])
        if (!name && !rawClass && !rawSubject) continue

        const line = r + 1
        const classId = parseClassId(rawClass)
        if (!classId) {
          warnings.push(`${line}-qator: «${rawClass}» sinf nomi tanilmadi — o'tkazib yuborildi.`)
          continue
        }
        const subjectId = resolveSubject(rawSubject)
        if (!subjectId) {
          warnings.push(`${line}-qator: «${rawSubject}» fani tanilmadi — o'tkazib yuborildi.`)
          continue
        }
        if (!name) {
          warnings.push(`${line}-qator (${classId}, ${rawSubject}): o'qituvchi ko'rsatilmagan.`)
          continue
        }

        if (!knownClasses.has(classId)) newClassIds.add(classId)

        const rec = teacherFor(name)
        if (!rec) continue
        if (!rec.teacher.speciality) {
          // Faqat tarifikatsiyada uchragan o'qituvchi — mutaxassisligi birinchi fanidan olinadi
          rec.teacher.speciality = SUBJECT_BY_ID[subjectId]?.name ?? ''
        }
        if (cols.category !== undefined && !catFromSheet.has(norm(name)) && s(row[cols.category])) {
          rec.teacher.category = parseCategory(row[cols.category])
        }
        if (!rec.teacher.subjectIds.includes(subjectId)) rec.teacher.subjectIds.push(subjectId)

        const cls = ctx.classes.find((c) => c.id === classId)
        const fallback = cls ? effectiveHours(cls, subjectId, ctx.overrides) : 0
        let hours = cols.hours !== undefined ? toNumber(row[cols.hours]) : null
        if (hours === null || hours <= 0) {
          hours = fallback
          if (!hours) {
            warnings.push(`${line}-qator (${classId} — ${rawSubject}): soat ko'rsatilmagan.`)
            continue
          }
        }
        const rounded = Math.round(hours * 2) / 2
        if (Math.abs(rounded - hours) > 0.001) {
          warnings.push(`${line}-qator: ${hours} soat 0,5 qadamga yaxlitlandi (${rounded}).`)
        }
        hours = rounded

        const key = asgKey(classId, subjectId)
        if (assignments[key] && assignments[key] !== rec.teacher.id) {
          warnings.push(
            `${classId} — ${SUBJECT_BY_ID[subjectId]?.name}: ikki o'qituvchi ko'rsatilgan, oxirgisi olindi (${line}-qator).`,
          )
          // Avvalgi o'qituvchining soati qaytariladi
          const prev = [...built.values()].find((x) => x.teacher.id === assignments[key])
          if (prev) prev.hours -= classHours[classId]?.[subjectId] ?? 0
        }
        assignments[key] = rec.teacher.id
        classHours[classId] = { ...(classHours[classId] ?? {}), [subjectId]: hours }
        rec.hours += hours
        totalHours += hours
        rowsRead++
      }
    }
  }

  /* ── 3. Sinflar varag'i (sinf rahbari) ───────────────────────────────── */
  const cName = findSheet(wb, ['sinf'])
  if (cName && cName !== aName) {
    const rows = sheetRows(X, wb, cName)
    const { header, cols } = mapColumns(rows, ['class', 'homeroom', 'students'])
    if (header >= 0 && cols.class !== undefined && cols.homeroom !== undefined) {
      for (let r = header + 1; r < rows.length; r++) {
        const classId = parseClassId(rows[r][cols.class])
        const name = s(rows[r][cols.homeroom!])
        if (!classId || !name) continue
        const rec = teacherFor(name)
        if (rec) rec.teacher.homeroomClassId = classId
        if (!knownClasses.has(classId)) newClassIds.add(classId)
      }
    }
  }

  /* ── 4. Yakuniy tekshiruvlar ─────────────────────────────────────────── */
  const imported = [...built.values()]

  // Bir sinfga bir nechta rahbar biriktirilgan bo'lsa — oxirgisi qoladi
  const hrSeen = new Map<string, ImportedTeacher>()
  for (const rec of imported) {
    const cid = rec.teacher.homeroomClassId
    if (!cid) continue
    const prev = hrSeen.get(cid)
    if (prev) {
      warnings.push(`${cid} sinfiga ikki rahbar ko'rsatilgan — ${rec.teacher.fullName} olindi.`)
      prev.teacher.homeroomClassId = undefined
    }
    hrSeen.set(cid, rec)
  }

  // Sinf rahbari o'z sinfida Ma'naviyat soatini o'tadi
  for (const [cid, rec] of hrSeen) {
    const key = asgKey(cid, 'manaviyat')
    if (assignments[key] !== rec.teacher.id) {
      assignments[key] = rec.teacher.id
      if (!rec.teacher.subjectIds.includes('manaviyat')) rec.teacher.subjectIds.push('manaviyat')
      const cls = ctx.classes.find((c) => c.id === cid)
      const h = cls ? effectiveHours(cls, 'manaviyat', ctx.overrides) || 1 : 1
      classHours[cid] = { ...(classHours[cid] ?? {}), manaviyat: h }
    }
  }

  // Yuklama chegaralari
  for (const rec of imported) {
    if (rec.hours > rec.teacher.maxHours) {
      warnings.push(
        `${rec.teacher.fullName}: ${rec.hours} soat — maksimal ${rec.teacher.maxHours} soatdan ko'p.`,
      )
    } else if (rec.hours > 0 && rec.hours < rec.teacher.minHours) {
      warnings.push(
        `${rec.teacher.fullName}: ${rec.hours} soat — minimal ${rec.teacher.minHours} soatdan kam.`,
      )
    }
  }

  const importedIds = new Set(imported.map((r) => r.teacher.id))
  const missing = ctx.teachers.filter((t) => !importedIds.has(t.id))

  const newClasses: SchoolClass[] = [...newClassIds]
    .map((id) => {
      const m = id.match(/^(\d{1,2})([A-Z])$/)!
      return { id, grade: Number(m[1]), letter: m[2], studentsCount: 25 }
    })
    .sort((a, b) => a.grade - b.grade || a.letter.localeCompare(b.letter))

  if (rowsRead === 0 && errors.length === 0) {
    errors.push("Tarifikatsiyada birorta ham yaroqli qator topilmadi.")
  }

  return { imported, missing, assignments, classHours, newClasses, totalHours, rowsRead, warnings, errors }
}
