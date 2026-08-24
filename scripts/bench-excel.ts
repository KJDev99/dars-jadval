/**
 * Excel eksport → import → jadval tuzish zanjirini sinash.
 * Ishga tushirish:  npm run bench:excel
 *
 * Tekshiriladi:
 *   1. Yozilgan kitob qayta o'qilganda o'qituvchilar, toifalar va tarifikatsiya bir xilmi
 *   2. Ustunlar tartibi o'zgartirilgan va nomlari boshqacha yozilgan fayl ham o'qiladimi
 *   3. Import qilingan ma'lumot bilan tuzilgan jadval qoidalarga mos keladimi
 */
import * as XLSX from 'xlsx'
import { defaultClasses, defaultSettings, defaultTeachers } from '../src/data/seed'
import { resolveTeacherConstraints } from '../src/lib/rules'
import { emptyOverrides, buildUnitsForClass, effectiveHours, asgKey } from '../src/lib/derive'
import type { PlanOverrides } from '../src/lib/derive'
import { autoAssign } from '../src/scheduler/assign'
import { solve } from '../src/scheduler/solver'
import { validateSchedule } from '../src/scheduler/validate'
import { buildWorkbook, parseWorkbook } from '../src/lib/excel'
import { SUBJECTS } from '../src/data/curriculum'
import { CATEGORY_LABELS } from '../src/types'
import type { Assignments, SchoolClass, Teacher } from '../src/types'

let failures = 0
const check = (ok: boolean, text: string) => {
  console.log(`  ${ok ? '✓' : '✗'} ${text}`)
  if (!ok) failures++
}

/* ─────────────────────────── 1. Boshlang'ich holat ─────────────────────── */

const classes = defaultClasses()
const teachers = defaultTeachers(classes)
const ov = emptyOverrides()
const settings = defaultSettings()
const tc0 = resolveTeacherConstraints(teachers, [], settings.pedagogicalDays)
const asg = autoAssign(classes, teachers, ov, {}, false, settings.seed, tc0, settings.stavkaHours)
const assignments = asg.assignments

console.log('=== BOSHLANG‘ICH HOLAT ===')
console.log(`  Sinflar: ${classes.length}, o‘qituvchilar: ${teachers.length}`)
console.log(`  Biriktirishlar: ${Object.keys(assignments).length}`)

/* ─────────────────────────── 2. Excelga yozish ─────────────────────────── */

const wb = await buildWorkbook({ classes, teachers, assignments, overrides: ov, settings })
const buf: ArrayBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })

console.log('\n=== EKSPORT ===')
console.log(`  Varaqlar: ${wb.SheetNames.join(', ')}`)
console.log(`  Hajmi: ${(buf.byteLength / 1024).toFixed(1)} KB`)
check(wb.SheetNames.length === 4, '4 ta varaq yozildi')

/* ─────────────────────────── 3. Qayta o'qish ───────────────────────────── */

console.log('\n=== IMPORT (bir xil fayl) ===')
// Bo'sh bazaga o'qiymiz — fayl o'zi yetarli bo'lishi kerak
const fresh = await parseWorkbook(buf, { classes, teachers: [], overrides: emptyOverrides() })
console.log(`  O‘qildi: ${fresh.imported.length} o‘qituvchi, ${fresh.rowsRead} dars qatori, ${fresh.totalHours} soat`)
fresh.errors.forEach((e) => console.log('    ! ' + e))
fresh.warnings.slice(0, 8).forEach((w) => console.log('    ~ ' + w))
if (fresh.warnings.length > 8) console.log(`    ~ ... yana ${fresh.warnings.length - 8} ta`)

check(fresh.errors.length === 0, 'xatosiz o‘qildi')
check(fresh.imported.length === teachers.length, `o‘qituvchilar soni bir xil (${fresh.imported.length}/${teachers.length})`)

// Toifalar
const catBefore = new Map(teachers.map((t) => [t.fullName, t.category]))
const catBad = fresh.imported.filter((r) => catBefore.get(r.teacher.fullName) !== r.teacher.category)
check(catBad.length === 0, `toifalar saqlandi (farq: ${catBad.length})`)
catBad.slice(0, 3).forEach((r) =>
  console.log(`    ! ${r.teacher.fullName}: ${CATEGORY_LABELS[catBefore.get(r.teacher.fullName)!]} → ${CATEGORY_LABELS[r.teacher.category]}`),
)

// Sinf rahbarlari
const hrBefore = teachers.filter((t) => t.homeroomClassId).length
const hrAfter = fresh.imported.filter((r) => r.teacher.homeroomClassId).length
check(hrBefore === hrAfter, `sinf rahbarlari saqlandi (${hrAfter}/${hrBefore})`)

// Tarifikatsiya — nomlar orqali solishtiramiz (id lar yangi)
const nameById = new Map(teachers.map((t) => [t.id, t.fullName]))
const nameByNewId = new Map(fresh.imported.map((r) => [r.teacher.id, r.teacher.fullName]))
let asgDiff = 0
for (const [key, tid] of Object.entries(assignments)) {
  const got = fresh.assignments[key]
  if (!got || nameByNewId.get(got) !== nameById.get(tid)) asgDiff++
}
check(asgDiff === 0, `tarifikatsiya bir xil (farq: ${asgDiff} ta)`)
check(
  Object.keys(fresh.assignments).length === Object.keys(assignments).length,
  `qatorlar soni bir xil (${Object.keys(fresh.assignments).length}/${Object.keys(assignments).length})`,
)

// Soatlar
let hourDiff = 0
for (const c of classes) {
  for (const sub of SUBJECTS) {
    const want = effectiveHours(c, sub.id, ov)
    if (want <= 0) continue
    const got = fresh.classHours[c.id]?.[sub.id] ?? 0
    if (Math.abs(got - want) > 0.001) hourDiff++
  }
}
check(hourDiff === 0, `fan soatlari bir xil (farq: ${hourDiff} ta)`)

/* ────────────────── 4. "Qo'lda tuzilgan" fayl — erkin ko'rinish ────────── */

console.log('\n=== IMPORT (qo‘lda tuzilgan fayl) ===')
// Sarlavhalari boshqacha, ustunlari boshqa tartibda, sinf/fan nomlari erkin yozilgan
const manual = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(
  manual,
  XLSX.utils.aoa_to_sheet([
    ['Maktab tarifikatsiyasi'],
    [],
    ['Daraja', 'Fan nomi', 'Sinf', 'Soat', 'O‘qituvchi'],
    ['Oliy', 'Matematika', '5-A', 5, 'Test Aliyev'],
    ['1-toifa', 'Ona tili', '5 A', 3, 'Test Valiyev'],
    ['2-toifa', 'ingliz tili', '5a', 3, 'Test G‘aniyev'],
    ['toifasiz', 'Jism.t.', '5-A', 3, 'Test Salimov'],
  ]),
  'Tarifikatsiya',
)
const manualBuf: ArrayBuffer = XLSX.write(manual, { type: 'array', bookType: 'xlsx' })
const m = await parseWorkbook(manualBuf, { classes, teachers, overrides: ov })
m.errors.forEach((e) => console.log('    ! ' + e))
console.log(`  O‘qildi: ${m.imported.length} o‘qituvchi, ${m.rowsRead} qator, ${m.totalHours} soat`)
check(m.errors.length === 0, 'sarlavhalar boshqacha bo‘lsa ham o‘qildi')
check(m.rowsRead === 4, `4 qator o‘qildi (${m.rowsRead})`)
check(m.imported.filter((r) => r.status === 'new').length === 4, '4 ta yangi o‘qituvchi aniqlandi')
check(m.assignments[asgKey('5A', 'matematika')] !== undefined, '«5-A» va «5 A» bir sinf deb tanildi')
check(m.assignments[asgKey('5A', 'chet_tili')] !== undefined, '«ingliz tili» → Chet tili')
check(m.assignments[asgKey('5A', 'jismoniy_tarbiya')] !== undefined, '«Jism.t.» qisqartmasi tanildi')
const cats = m.imported.map((r) => r.teacher.category).sort()
check(
  JSON.stringify(cats) === JSON.stringify(['birinchi', 'ikkinchi', 'oliy', 'yoq']),
  'toifalar to‘g‘ri o‘qildi: ' + cats.join(', '),
)

/* ─────────────── 5. Import qilingan ma'lumot bilan jadval tuzish ────────── */

console.log('\n=== IMPORTDAN JADVAL TUZISH ===')
// Store dagi applyExcelImport mantig'i (exactPlan = true)
const impTeachers: Teacher[] = fresh.imported.map((r) => r.teacher)
const impAssignments: Assignments = { ...fresh.assignments }
const impOv: PlanOverrides = { byGrade: {}, byClass: {} }
for (const [cid, row] of Object.entries(fresh.classHours)) {
  const full: Record<string, number> = {}
  for (const sub of SUBJECTS) full[sub.id] = row[sub.id] ?? 0
  impOv.byClass[cid] = full
}
const impClasses: SchoolClass[] = [...classes]

const units = impClasses.flatMap((c) => buildUnitsForClass(c, impOv, impAssignments).units)
const problems = impClasses.flatMap((c) => buildUnitsForClass(c, impOv, impAssignments).problems)
check(problems.length === 0, `biriktirilmagan fan yo‘q (${problems.length})`)
problems.slice(0, 5).forEach((p) => console.log('    ! ' + p))
console.log(`  Dars birliklari: ${units.length}`)

const tc = resolveTeacherConstraints(impTeachers, [], settings.pedagogicalDays)
const t0 = Date.now()
const res = solve({ classes: impClasses, teachers: impTeachers, units, settings, teacherConstraints: tc })
console.log(`  Vaqt: ${((Date.now() - t0) / 1000).toFixed(1)} s — ${res.stats.message}`)

const rep = validateSchedule({
  classes: impClasses,
  teachers: impTeachers,
  units,
  placements: res.placements,
  settings,
  ov: impOv,
  teacherConstraints: tc,
})
console.log(`  Xatolar: ${rep.errors}, ogohlantirishlar: ${rep.warnings}`)
const byRule = new Map<string, number>()
for (const v of rep.violations) if (v.level === 'error') byRule.set(v.rule, (byRule.get(v.rule) ?? 0) + 1)
for (const [r, n] of byRule) console.log(`    ! ${r}: ${n}`)
check(rep.errors === 0, 'jadvalda xato yo‘q')
check(rep.classGaps === 0, 'sinf jadvalida bo‘shliq yo‘q')
check(rep.teacherClashes === 0, 'o‘qituvchi to‘qnashuvi yo‘q')

// Ma'naviyat soatini har doim sinf rahbari o'tadi
let manaviyatBad = 0
for (const c of impClasses) {
  const hr = impTeachers.find((t) => t.homeroomClassId === c.id)
  const tid = impAssignments[asgKey(c.id, 'manaviyat')]
  if (!hr || !tid || tid !== hr.id) manaviyatBad++
}
check(manaviyatBad === 0, `Ma'naviyat soati sinf rahbarida (xato: ${manaviyatBad})`)

console.log(`\n${failures === 0 ? '✓ Barcha tekshiruvlar o‘tdi' : `✗ ${failures} ta tekshiruv o‘tmadi`}`)
process.exit(failures === 0 ? 0 : 1)
