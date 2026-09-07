/**
 * BSB va ChSB natijalari bilan Excel orqali ishlash.
 *
 *  · Jurnal shabloni — o'qituvchi bitta sinf-fan uchun yuklab oladi,
 *    ballarni to'ldiradi va qaytarib yuklaydi.
 *  · Rahbariyat hisoboti — chorak natijalari bir necha varaqda.
 *
 * Fayl qo'lda tuzilgan bo'lsa ham o'qiladi: ustunlar sarlavha nomi bo'yicha
 * topiladi, o'quvchilar esa ID yoki F.I.Sh. bo'yicha solishtiriladi.
 */
import type * as XLSX from 'xlsx'
import { loadXlsx } from './excel'
import { SUBJECT_BY_ID } from '../data/curriculum'
import { CATEGORY_LABELS, MARKS, QUARTER_LABELS } from '../types'
import type { Assessment, Quarter, SchoolClass, Student, Teacher } from '../types'
import type { GradeBook, Summary } from './grading'
import { STATUS_LABELS, workLabel } from './grading'

/* ────────────────────────────── Yordamchilar ─────────────────────────────── */

/** Solishtirish uchun matnni soddalashtirish */
function norm(v: unknown): string {
  return String(v ?? '')
    .replace(/[’‘`´ʻʼ']/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, '')
}

const txt = (v: unknown) => String(v ?? '').trim()

function num(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const t = txt(v).replace(',', '.').replace(/[^0-9.]/g, '')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

/** «Kelmadi» deb belgilangan katak */
const ABSENT_WORDS = ['', 'yoq', 'kelmadi', 'nb', 'n', 'yq', 'b']
function isAbsentMark(v: unknown): boolean {
  const raw = txt(v)
  if (raw === '-' || raw === '—' || raw === '–') return true
  const n = norm(v)
  return n !== '' && ABSENT_WORDS.includes(n)
}

const classLabel = (id: string) => id.replace(/^(\d{1,2})/, '$1-')

/** Sonni foizga aylantirmasdan, o'nlik vergul bilan yozish */
const dec = (v: number | null, digits = 2): number | string =>
  v === null || !Number.isFinite(v) ? '' : Number(v.toFixed(digits))

/* ═══════════════════════════ 1. Jurnal shabloni ═══════════════════════════ */

export interface JournalContext {
  classId: string
  subjectId: string
  quarter: Quarter
  teacherName: string
  schoolName: string
  works: Assessment[]
  students: Student[]
}

const JOURNAL_SHEET = 'Jurnal'

/** Sarlavha qatoridagi ustun nomlari */
const ID_HEADERS = ['id', 'kod', 'identifikator']
const NAME_HEADERS = ['fish', 'fio', 'oquvchi', 'oquvchifish', 'ismfamiliya', 'familiyaismi', 'fishi']

function journalRows(ctx: JournalContext): unknown[][] {
  const subject = SUBJECT_BY_ID[ctx.subjectId]?.name ?? ctx.subjectId
  const rows: unknown[][] = [
    [ctx.schoolName],
    ['Summativ baholash jurnali'],
    [''],
    ['Sinf', classLabel(ctx.classId)],
    ['Fan', subject],
    ['Chorak', QUARTER_LABELS[ctx.quarter]],
    ["O'qituvchi", ctx.teacherName],
    [
      'Maksimal ball',
      ctx.works.map((w) => `${workLabel(w)} — ${w.maxScore}`).join(';  '),
    ],
    [''],
    ["Ballarni faqat rangli ustunlarga yozing. Kelmagan o'quvchi katagiga «-» qo'ying."],
    [''],
    ['ID', '№', 'F.I.Sh.', ...ctx.works.map((w) => workLabel(w))],
  ]
  for (const st of ctx.students) {
    rows.push([
      st.id,
      st.order,
      st.fullName,
      ...ctx.works.map((w) => (w.absent.includes(st.id) ? '-' : (w.scores[st.id] ?? ''))),
    ])
  }
  return rows
}

/** Jurnal kitobini yig'ish (sinovlarda ham ishlatiladi) */
export async function buildJournalWorkbook(ctx: JournalContext): Promise<XLSX.WorkBook> {
  const X = await loadXlsx()
  const wb = X.utils.book_new()
  const ws = X.utils.aoa_to_sheet(journalRows(ctx))
  ws['!cols'] = [
    { wch: 16 },
    { wch: 5 },
    { wch: 32 },
    ...ctx.works.map(() => ({ wch: 11 })),
  ]
  X.utils.book_append_sheet(wb, ws, JOURNAL_SHEET)
  return wb
}

/** Jurnal shablonini (yoki to'ldirilgan jurnalni) yuklab berish */
export async function exportJournal(ctx: JournalContext): Promise<void> {
  const X = await loadXlsx()
  const wb = await buildJournalWorkbook(ctx)

  const subject = SUBJECT_BY_ID[ctx.subjectId]?.short ?? ctx.subjectId
  const name = `${classLabel(ctx.classId)}-${subject}-${ctx.quarter}-chorak.xlsx`
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '-')
  X.writeFile(wb, name, { compression: true })
}

/* ═══════════════════════════ 2. Jurnalni o'qish ═══════════════════════════ */

export interface JournalImport {
  /** workId -> studentId -> ball */
  scores: Record<string, Record<string, number>>
  /** workId -> kelmagan o'quvchilar */
  absent: Record<string, string[]>
  /** Nechta o'quvchi topildi */
  matched: number
  /** Nechta ball o'qildi */
  values: number
  /** Faylda bor, ro'yxatda yo'q ismlar */
  unknown: string[]
  /** Faylda ustuni topilmagan ishlar */
  missingColumns: string[]
  /** Maksimal balldan oshib ketgan kataklar */
  overMax: number
  warnings: string[]
  errors: string[]
}

/** To'ldirilgan jurnal faylini o'qish */
export async function parseJournal(
  data: ArrayBuffer,
  ctx: JournalContext,
): Promise<JournalImport> {
  const X = await loadXlsx()
  const out: JournalImport = {
    scores: {},
    absent: {},
    matched: 0,
    values: 0,
    unknown: [],
    missingColumns: [],
    overMax: 0,
    warnings: [],
    errors: [],
  }
  for (const w of ctx.works) {
    out.scores[w.id] = {}
    out.absent[w.id] = []
  }

  let wb: XLSX.WorkBook
  try {
    wb = X.read(data, { type: 'array' })
  } catch {
    out.errors.push("Faylni o'qib bo'lmadi. U .xlsx yoki .xls formatida ekanini tekshiring.")
    return out
  }

  // Varaqni topamiz: «Jurnal» yoki birinchi varaq
  const sheetName =
    wb.SheetNames.find((n) => norm(n).includes('jurnal')) ?? wb.SheetNames[0]
  const ws = sheetName ? wb.Sheets[sheetName] : undefined
  if (!ws) {
    out.errors.push('Faylda varaq topilmadi.')
    return out
  }
  const rows = X.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false, defval: '' })

  // Sarlavha qatorini qidiramiz — F.I.Sh. ustuni bor qator
  let header = -1
  let idCol = -1
  let nameCol = -1
  const workCol = new Map<string, number>()
  const byLabel = new Map(ctx.works.map((w) => [norm(workLabel(w)), w]))

  for (let r = 0; r < Math.min(rows.length, 20); r++) {
    const row = rows[r]
    let nc = -1
    let ic = -1
    row.forEach((cell, c) => {
      const n = norm(cell)
      if (!n) return
      if (nc < 0 && NAME_HEADERS.includes(n)) nc = c
      if (ic < 0 && ID_HEADERS.includes(n)) ic = c
    })
    if (nc < 0) continue
    header = r
    nameCol = nc
    idCol = ic
    row.forEach((cell, c) => {
      const n = norm(cell)
      if (!n || c === nc || c === ic) return
      const w = byLabel.get(n)
      if (w && !workCol.has(w.id)) workCol.set(w.id, c)
    })
    break
  }

  if (header < 0) {
    out.errors.push("«F.I.Sh.» ustuni topilmadi. Shablonni yuklab olib, o'sha faylni to'ldiring.")
    return out
  }

  for (const w of ctx.works) {
    if (!workCol.has(w.id)) out.missingColumns.push(workLabel(w))
  }
  if (workCol.size === 0) {
    out.errors.push(
      "Faylda birorta ham baholash ustuni topilmadi (1-BSB, 2-BSB, ChSB). Sarlavhalarni o'zgartirmang.",
    )
    return out
  }

  const byId = new Map(ctx.students.map((s) => [s.id, s]))
  const byName = new Map<string, Student>()
  for (const s of ctx.students) {
    const k = norm(s.fullName)
    // Bir xil ismli ikki o'quvchi bo'lsa — ism bo'yicha moslashtirmaymiz
    if (byName.has(k)) byName.set(k, null as unknown as Student)
    else byName.set(k, s)
  }

  const seen = new Set<string>()
  for (let r = header + 1; r < rows.length; r++) {
    const row = rows[r]
    const rawName = txt(row[nameCol])
    const rawId = idCol >= 0 ? txt(row[idCol]) : ''
    if (!rawName && !rawId) continue

    let student = rawId ? byId.get(rawId) : undefined
    if (!student && rawName) student = byName.get(norm(rawName)) ?? undefined
    if (!student) {
      if (rawName) out.unknown.push(rawName)
      continue
    }
    if (seen.has(student.id)) {
      out.warnings.push(`${student.fullName} — faylda ikki marta uchradi, birinchisi olindi.`)
      continue
    }
    seen.add(student.id)
    out.matched++

    for (const w of ctx.works) {
      const c = workCol.get(w.id)
      if (c === undefined) continue
      const raw = row[c]
      if (txt(raw) === '') continue
      if (isAbsentMark(raw)) {
        out.absent[w.id].push(student.id)
        continue
      }
      const v = num(raw)
      if (v === null) {
        out.warnings.push(`${student.fullName} — «${workLabel(w)}» katagida son emas: «${txt(raw)}»`)
        continue
      }
      if (v > w.maxScore) out.overMax++
      out.scores[w.id][student.id] = Math.max(0, Math.min(w.maxScore, Math.round(v * 10) / 10))
      out.values++
    }
  }

  if (out.matched === 0) {
    out.errors.push(
      "Fayldagi birorta o'quvchi sinf ro'yxatiga mos kelmadi. Ismlarni o'zgartirmasdan shablondan foydalaning.",
    )
  }
  if (out.unknown.length > 0) {
    out.warnings.push(
      `Ro'yxatda yo'q ${out.unknown.length} ta ism o'tkazib yuborildi: ${out.unknown.slice(0, 5).join(', ')}${
        out.unknown.length > 5 ? ' …' : ''
      }`,
    )
  }
  if (out.overMax > 0) {
    out.warnings.push(`${out.overMax} ta ball maksimaldan oshgani uchun maksimalga tenglashtirildi.`)
  }
  return out
}

/* ═══════════════════════ 3. Rahbariyat uchun hisobot ══════════════════════ */

export interface ReportInput {
  book: GradeBook
  classes: SchoolClass[]
  teachers: Teacher[]
  students: Student[]
  schoolName: string
}

const SUMMARY_HEADERS = [
  "O'quvchi",
  "O'rtacha ball",
  "O'zlashtirish, %",
  'Sifat, %',
  "«5»",
  "«4»",
  "«3»",
  "«2»",
] as const

/** Umumlashma ustunlari — barcha varaqlarda bir xil tartibda */
function summaryCells(s: Summary): unknown[] {
  return [
    s.count,
    dec(s.avgMark),
    dec(s.progress, 1),
    dec(s.quality, 1),
    s.dist[5],
    s.dist[4],
    s.dist[3],
    s.dist[2],
  ]
}

export async function buildReportWorkbook(input: ReportInput): Promise<XLSX.WorkBook> {
  const X = await loadXlsx()
  const { book, classes, teachers, students, schoolName } = input
  const wb = X.utils.book_new()
  const clsById = new Map(classes.map((c) => [c.id, c]))
  const tById = new Map(teachers.map((t) => [t.id, t]))
  const q = QUARTER_LABELS[book.quarter]

  /* 1. Umumiy */
  const s = book.school
  const umumiy: unknown[][] = [
    [schoolName],
    ['Summativ baholash natijalari', q],
    [''],
    ['Baholangan o‘quvchi-fan', s.count],
    ["O'rtacha ball", dec(s.avgMark)],
    ["O'zlashtirish, %", dec(s.progress, 1)],
    ['Sifat, %', dec(s.quality, 1)],
    [''],
    ['Baholar taqsimoti'],
    ...MARKS.map((m) => [`«${m}»`, s.dist[m]]),
    [''],
    ['Sinf-fanlar', book.totals.cells],
    ['Shundan tayyor', book.totals.ready],
    ['Kiritilgan ishlar', book.totals.works],
    ['Topshirilgan ishlar', book.totals.submitted],
    ['Ro‘yxatdagi o‘quvchilar', book.totals.students],
  ]
  const wsU = X.utils.aoa_to_sheet(umumiy)
  wsU['!cols'] = [{ wch: 30 }, { wch: 22 }]
  X.utils.book_append_sheet(wb, wsU, 'Umumiy')

  /* 2. Sinflar */
  const cRows: unknown[][] = [['Sinf', 'Daraja', "O'quvchilar", 'Fanlar', 'Tayyor', ...SUMMARY_HEADERS]]
  for (const c of book.byClass) {
    cRows.push([
      classLabel(c.classId),
      c.grade,
      c.studentsCount,
      c.subjects,
      c.ready,
      ...summaryCells(c.summary),
    ])
  }
  const wsC = X.utils.aoa_to_sheet(cRows)
  wsC['!cols'] = [{ wch: 8 }, { wch: 8 }, { wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 10 }, { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 6 }]
  X.utils.book_append_sheet(wb, wsC, 'Sinflar')

  /* 3. Fanlar */
  const fRows: unknown[][] = [['Fan', 'Sinflar', 'Tayyor', ...SUMMARY_HEADERS]]
  for (const f of book.bySubject) {
    fRows.push([f.label, f.cells, f.ready, ...summaryCells(f.summary)])
  }
  const wsF = X.utils.aoa_to_sheet(fRows)
  wsF['!cols'] = [{ wch: 36 }, { wch: 9 }, { wch: 8 }, { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 10 }, { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 6 }]
  X.utils.book_append_sheet(wb, wsF, 'Fanlar')

  /* 4. O'qituvchilar */
  const tRows: unknown[][] = [
    [
      '№', 'F.I.Sh.', 'Toifa', 'Sinf-fan', 'Tayyor', 'Chala', 'Ishlar', 'Topshirilgan',
      "Baho qo'yilmagan", ...SUMMARY_HEADERS,
    ],
  ]
  book.byTeacher.forEach((t, i) => {
    const teacher = tById.get(t.teacherId)
    tRows.push([
      i + 1,
      t.label,
      teacher ? CATEGORY_LABELS[teacher.category ?? 'yoq'] : '',
      t.cells,
      t.ready,
      t.pending,
      t.works,
      t.submittedWorks,
      t.ungraded,
      ...summaryCells(t.summary),
    ])
  })
  const wsT = X.utils.aoa_to_sheet(tRows)
  wsT['!cols'] = [{ wch: 5 }, { wch: 30 }, { wch: 12 }, { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 13 }, { wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 10 }, { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 6 }]
  X.utils.book_append_sheet(wb, wsT, "O'qituvchilar")

  /* 5. Sinf-fan kesimi */
  const dRows: unknown[][] = [
    [
      'Sinf', 'Fan', "O'qituvchi", 'Soat', 'Reja BSB', 'Topshirilgan', 'Holat', ...SUMMARY_HEADERS,
      "Baho qo'yilmagan",
    ],
  ]
  for (const c of book.byClass) {
    for (const [, cell] of book.cells) {
      if (cell.classId !== c.classId) continue
      dRows.push([
        classLabel(cell.classId),
        SUBJECT_BY_ID[cell.subjectId]?.name ?? cell.subjectId,
        cell.teacherId ? (tById.get(cell.teacherId)?.fullName ?? '') : '',
        cell.hours,
        cell.plannedBsb,
        cell.submitted,
        STATUS_LABELS[cell.status],
        ...summaryCells(cell.summary),
        cell.ungraded,
      ])
    }
  }
  const wsD = X.utils.aoa_to_sheet(dRows)
  wsD['!cols'] = [{ wch: 8 }, { wch: 34 }, { wch: 28 }, { wch: 7 }, { wch: 10 }, { wch: 13 }, { wch: 13 }, { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 10 }, { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 16 }]
  X.utils.book_append_sheet(wb, wsD, 'Sinf-fan')

  /* 6. O'quvchilar */
  const sById = new Map(students.map((x) => [x.id, x]))
  const stRows: unknown[][] = [
    ['Sinf', '№', "O'quvchi", 'Fanlar', "O'rtacha ball", "«2» bor", "A'lochi"],
  ]
  for (const c of book.byClass) {
    const ordered = [...c.students].sort((a, b) => {
      const oa = sById.get(a.studentId)?.order ?? 0
      const ob = sById.get(b.studentId)?.order ?? 0
      return oa - ob
    })
    for (const st of ordered) {
      stRows.push([
        classLabel(c.classId),
        sById.get(st.studentId)?.order ?? '',
        st.fullName,
        st.subjects,
        dec(st.avgMark),
        st.failing > 0 ? st.failing : '',
        st.excellent ? 'ha' : '',
      ])
    }
  }
  const wsS = X.utils.aoa_to_sheet(stRows)
  wsS['!cols'] = [{ wch: 8 }, { wch: 5 }, { wch: 32 }, { wch: 9 }, { wch: 14 }, { wch: 9 }, { wch: 9 }]
  X.utils.book_append_sheet(wb, wsS, "O'quvchilar")

  /* 7. Topshirilmaganlar */
  const pRows: unknown[][] = [['Sinf', 'Fan', "O'qituvchi", 'Holat', 'Topshirilgan / reja', 'Izoh']]
  for (const [, cell] of book.cells) {
    if (cell.status === 'tayyor') continue
    const need = cell.plannedBsb + 1
    pRows.push([
      classLabel(cell.classId),
      SUBJECT_BY_ID[cell.subjectId]?.name ?? cell.subjectId,
      cell.teacherId ? (tById.get(cell.teacherId)?.fullName ?? '') : "biriktirilmagan",
      STATUS_LABELS[cell.status],
      `${cell.submitted} / ${need}`,
      cell.status === 'yoq' ? 'Ish kiritilmagan' : cell.chsb ? 'BSB lar to‘liq emas' : 'ChSB topshirilmagan',
    ])
  }
  const wsP = X.utils.aoa_to_sheet(pRows)
  wsP['!cols'] = [{ wch: 8 }, { wch: 34 }, { wch: 30 }, { wch: 13 }, { wch: 18 }, { wch: 26 }]
  X.utils.book_append_sheet(wb, wsP, 'Topshirilmagan')

  return wb
}

/** Chorak hisobotini yuklab berish */
export async function exportGradeReport(input: ReportInput): Promise<void> {
  const X = await loadXlsx()
  const wb = await buildReportWorkbook(input)
  X.writeFile(wb, `baholash-${input.book.quarter}-chorak.xlsx`, { compression: true })
}

/* ═══════════════════ 4. Bitta sinfning batafsil jadvali ═══════════════════ */

/** Sinf bo'yicha «o'quvchi × fan» baho jadvali */
export async function exportClassSheet(
  book: GradeBook,
  classId: string,
  students: Student[],
  schoolName: string,
): Promise<void> {
  const X = await loadXlsx()
  const summary = book.byClass.find((c) => c.classId === classId)
  if (!summary) return

  const subjects = [...book.cells.values()]
    .filter((c) => c.classId === classId)
    .sort((a, b) =>
      (SUBJECT_BY_ID[a.subjectId]?.name ?? '').localeCompare(SUBJECT_BY_ID[b.subjectId]?.name ?? ''),
    )

  const order = new Map(students.map((s) => [s.id, s.order]))
  const rows: unknown[][] = [
    [schoolName],
    [`${classLabel(classId)} sinf — ${QUARTER_LABELS[book.quarter]} natijalari`],
    [''],
    ['№', "O'quvchi", ...subjects.map((c) => SUBJECT_BY_ID[c.subjectId]?.short ?? c.subjectId), "O'rtacha"],
  ]
  const ordered = [...summary.students].sort(
    (a, b) => (order.get(a.studentId) ?? 0) - (order.get(b.studentId) ?? 0),
  )
  for (const st of ordered) {
    rows.push([
      order.get(st.studentId) ?? '',
      st.fullName,
      ...subjects.map((c) => st.marks[c.subjectId] ?? ''),
      dec(st.avgMark),
    ])
  }
  rows.push([])
  rows.push(['', "Fan o'rtachasi", ...subjects.map((c) => dec(c.summary.avgMark)), dec(summary.summary.avgMark)])
  rows.push(['', 'Sifat, %', ...subjects.map((c) => dec(c.summary.quality, 1)), dec(summary.summary.quality, 1)])
  rows.push([
    '',
    "O'zlashtirish, %",
    ...subjects.map((c) => dec(c.summary.progress, 1)),
    dec(summary.summary.progress, 1),
  ])

  const ws = X.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 5 }, { wch: 32 }, ...subjects.map(() => ({ wch: 9 })), { wch: 10 }]
  const wb = X.utils.book_new()
  X.utils.book_append_sheet(wb, ws, classLabel(classId))
  X.writeFile(wb, `${classLabel(classId)}-${book.quarter}-chorak.xlsx`, { compression: true })
}
