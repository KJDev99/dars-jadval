/**
 * BSB va ChSB hisob-kitobini tekshirish.
 * Ishga tushirish:  npm run bench:grades
 *
 * Tekshiriladi:
 *   1. Bitta o'quvchining foizi va bahosi qo'lda hisoblangani bilan bir xilmi
 *   2. ChSB bo'lmaganda og'irliklar to'g'ri qayta taqsimlanadimi
 *   3. Kelmagan va ball qo'yilmagan o'quvchilar hisobdan chetda qoladimi
 *   4. Sinf, fan, o'qituvchi va maktab yig'indilari mos keladimi
 *   5. Sifat va o'zlashtirish foizlari to'g'rimi
 *   6. Excel jurnali: yuklab olish → qayta yuklash aynan bir xil natija beradimi
 *   7. Chorak hisoboti xatosiz yig'iladimi va tezligi qanday
 */
import * as XLSX from 'xlsx'
import { useStore } from '../src/store'
import { autoAssign } from '../src/scheduler/assign'
import { buildGradeBook, markOf, plannedBsbCount, studentResult, workLabel } from '../src/lib/grading'
import { buildJournalWorkbook, buildReportWorkbook, parseJournal } from '../src/lib/grades-excel'
import { SUBJECT_BY_ID } from '../src/data/curriculum'
import type { Assessment, Quarter, Student } from '../src/types'

let failures = 0
const ok = (cond: boolean, label: string, detail = '') => {
  console.log(`  ${cond ? '✓' : '✗'} ${label}${detail ? '  ' + detail : ''}`)
  if (!cond) failures++
}
const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps
const ms = () => Number(process.hrtime.bigint() / 1000n) / 1000

/* ───────────────────────────── Ma'lumot tayyorlash ───────────────────────── */

const st0 = useStore.getState()
const { assignments } = autoAssign(st0.classes, st0.teachers, st0.overrides, {}, false, 7)
useStore.setState({ assignments })

const QUARTER: Quarter = 1
const t0 = ms()
const made = st0.seedDemoGrades(QUARTER)
const seedMs = ms() - t0

const S = useStore.getState()
const g = S.settings.grading

console.log('=== MA’LUMOT ===')
console.log(`  sinflar: ${S.classes.length}, o'quvchilar: ${S.students.length}`)
console.log(`  tarifikatsiya: ${Object.keys(assignments).length} ta biriktirish`)
console.log(`  baholash ishlari: ${made} ta (${seedMs.toFixed(0)} ms)`)
console.log(`  og'irliklar: BSB ${g.bsbWeight} / ChSB ${g.chsbWeight}, chegaralar ${g.mark5}/${g.mark4}/${g.mark3}`)

const t1 = ms()
const book = buildGradeBook({
  classes: S.classes,
  students: S.students,
  teachers: S.teachers,
  assessments: S.assessments,
  assignments: S.assignments,
  overrides: S.overrides,
  settings: S.settings,
  quarter: QUARTER,
})
const buildMs = ms() - t1
console.log(`  jurnal yig'ildi: ${book.cells.size} ta sinf-fan, ${book.school.count} ta baho (${buildMs.toFixed(1)} ms)`)

const rosterOf = (classId: string): Student[] =>
  S.students.filter((s) => s.classId === classId && s.active).sort((a, b) => a.order - b.order)

/* ═══════════════ 1. Bitta o'quvchining natijasi qo'lda ═══════════════ */

console.log('\n=== 1. QO‘LDA HISOBLASH ===')
{
  const cell = [...book.cells.values()].find((c) => c.chsb && c.bsb.length >= 2 && c.summary.count > 5)
  if (!cell) {
    ok(false, 'sinov uchun mos sinf-fan topilmadi')
  } else {
    const roster = rosterOf(cell.classId)
    const student = roster.find((s) => {
      const r = cell.results.find((x) => x.studentId === s.id)
      return r?.percent !== null && r?.missed === 0 && r?.empty === 0
    })!
    const r = cell.results.find((x) => x.studentId === student.id)!

    let bsbScore = 0
    let bsbMax = 0
    for (const w of cell.bsb) {
      bsbScore += w.scores[student.id]
      bsbMax += w.maxScore
    }
    const bsbPct = (bsbScore / bsbMax) * 100
    const chsbPct = (cell.chsb!.scores[student.id] / cell.chsb!.maxScore) * 100
    const expected = (bsbPct * g.bsbWeight + chsbPct * g.chsbWeight) / (g.bsbWeight + g.chsbWeight)
    const expectedMark = expected >= g.mark5 ? 5 : expected >= g.mark4 ? 4 : expected >= g.mark3 ? 3 : 2

    console.log(
      `  ${cell.classId} · ${SUBJECT_BY_ID[cell.subjectId]?.name} · ${student.fullName}`,
    )
    console.log(
      `  BSB ${bsbScore}/${bsbMax} = ${bsbPct.toFixed(2)}% · ChSB ${cell.chsb!.scores[student.id]}/${cell.chsb!.maxScore} = ${chsbPct.toFixed(2)}%`,
    )
    ok(near(r.bsbPercent!, bsbPct), 'BSB foizi', `${r.bsbPercent!.toFixed(4)} = ${bsbPct.toFixed(4)}`)
    ok(near(r.chsbPercent!, chsbPct), 'ChSB foizi')
    ok(near(r.percent!, expected), 'yakuniy foiz', `${r.percent!.toFixed(4)} = ${expected.toFixed(4)}`)
    ok(r.mark === expectedMark, 'baho', `${r.mark} = ${expectedMark}`)
  }
}

/* ═══════════════ 2. ChSB yo'q — og'irliklar qayta taqsimlanadi ═══════════════ */

console.log('\n=== 2. CHALA MA’LUMOT ===')
{
  const w: Assessment = {
    id: 'x1', classId: '7A', subjectId: 'matematika', teacherId: 't', quarter: 1, kind: 'bsb',
    order: 1, title: '1', maxScore: 10, date: '', scores: { s1: 8, s2: 5 }, absent: [],
    createdAt: 0, updatedAt: 0,
  }
  const onlyBsb = studentResult('s1', [w], undefined, g)
  ok(near(onlyBsb.percent!, 80), 'faqat BSB bo‘lsa — BSB foizi olinadi', `${onlyBsb.percent}%`)
  ok(onlyBsb.mark === markOf(80, g), 'baho chegaraga mos')

  const chsb: Assessment = { ...w, id: 'x2', kind: 'chsb', order: 0, maxScore: 20, scores: { s1: 12 } }
  const onlyChsb = studentResult('s1', [], chsb, g)
  ok(near(onlyChsb.percent!, 60), 'faqat ChSB bo‘lsa — ChSB foizi olinadi', `${onlyChsb.percent}%`)

  const both = studentResult('s1', [w], chsb, g)
  const exp = (80 * g.bsbWeight + 60 * g.chsbWeight) / (g.bsbWeight + g.chsbWeight)
  ok(near(both.percent!, exp), 'ikkalasi bo‘lsa — og‘irliklar qo‘llanadi', `${both.percent!.toFixed(2)}%`)

  const none = studentResult('s9', [w], chsb, g)
  ok(none.percent === null && none.mark === null, 'ball qo‘yilmagan o‘quvchi bahosiz qoladi')
  ok(none.empty === 2, 'bo‘sh kataklar sanaladi', `${none.empty}`)

  const absent = studentResult('s3', [{ ...w, absent: ['s3'] }], undefined, g)
  ok(absent.percent === null && absent.missed === 1, 'kelmagan o‘quvchi o‘rtachaga qo‘shilmaydi')

  // Kelmagan ish qolganlarning maksimal balliga qo'shilmasligi kerak
  const mixed = studentResult(
    's1',
    [w, { ...w, id: 'x3', order: 2, absent: ['s1'] }],
    undefined,
    g,
  )
  ok(near(mixed.percent!, 80), 'kelmagan ish maksimal ballga qo‘shilmaydi', `${mixed.percent}%`)
}

/* ═══════════════ 3. Yig'indilar mos keladimi ═══════════════ */

console.log('\n=== 3. YIG‘INDILAR ===')
{
  let cellCount = 0
  let distSum = 0
  for (const c of book.cells.values()) {
    cellCount += c.summary.count
    distSum += c.summary.dist[5] + c.summary.dist[4] + c.summary.dist[3] + c.summary.dist[2]
  }
  ok(cellCount === book.school.count, 'maktab yig‘indisi = kataklar yig‘indisi', `${book.school.count}`)
  ok(distSum === book.school.count, 'baho taqsimoti yig‘indisi = baholar soni')

  const classSum = book.byClass.reduce((n, c) => n + c.summary.count, 0)
  ok(classSum === book.school.count, 'sinflar yig‘indisi mos', `${classSum}`)

  const subjSum = book.bySubject.reduce((n, c) => n + c.summary.count, 0)
  ok(subjSum === book.school.count, 'fanlar yig‘indisi mos', `${subjSum}`)

  const teacherSum = book.byTeacher.reduce((n, c) => n + c.summary.count, 0)
  ok(teacherSum === book.school.count, 'o‘qituvchilar yig‘indisi mos', `${teacherSum}`)

  // O'rtacha ball taqsimotdan chiqarilgan qiymatga teng bo'lishi kerak
  const d = book.school.dist
  const manualAvg = (d[5] * 5 + d[4] * 4 + d[3] * 3 + d[2] * 2) / book.school.count
  ok(near(book.school.avgMark!, manualAvg, 1e-9), 'o‘rtacha ball taqsimotga mos', book.school.avgMark!.toFixed(4))

  const quality = ((d[5] + d[4]) / book.school.count) * 100
  const progress = ((d[5] + d[4] + d[3]) / book.school.count) * 100
  ok(near(book.school.quality!, quality, 1e-9), 'sifat foizi', `${quality.toFixed(2)}%`)
  ok(near(book.school.progress!, progress, 1e-9), 'o‘zlashtirish foizi', `${progress.toFixed(2)}%`)
  ok(book.school.quality! <= book.school.progress! + 1e-9, 'sifat ≤ o‘zlashtirish')
}

/* ═══════════════ 4. Reja va holat ═══════════════ */

console.log('\n=== 4. REJA VA HOLAT ===')
{
  ok(plannedBsbCount(1, g) === g.bsbPlan[0], '1 soatli fan uchun BSB soni')
  ok(plannedBsbCount(2, g) === g.bsbPlan[1], '2 soatli fan uchun BSB soni')
  ok(plannedBsbCount(5, g) === g.bsbPlan[2], '5 soatli fan uchun BSB soni')
  ok(plannedBsbCount(0, g) === 0, 'o‘qitilmaydigan fan uchun BSB yo‘q')

  const ready = [...book.cells.values()].filter((c) => c.status === 'tayyor')
  const badReady = ready.filter(
    (c) =>
      c.works.filter((w) => w.kind === 'bsb' && w.submittedAt).length < c.plannedBsb ||
      !c.works.some((w) => w.kind === 'chsb' && w.submittedAt),
  )
  ok(badReady.length === 0, '«tayyor» holati faqat reja to‘lganda qo‘yiladi', `${ready.length} ta tayyor`)

  const drafts = [...book.cells.values()].filter((c) => c.works.length > 0 && c.submitted === 0)
  ok(
    drafts.every((c) => c.status === 'qoralama'),
    'topshirilmagan kataklar «qoralama» deb belgilanadi',
    `${drafts.length} ta`,
  )

  // Rahbariyat hisobotida qoralamalar hisobga olinmasligi kerak
  ok(
    drafts.every((c) => c.summary.count === 0),
    'qoralama kataklar hisobotga kirmaydi',
  )

  // 1-sinf baholanmaydi
  const first = [...book.cells.values()].filter((c) => c.classId.startsWith('1') && !c.classId.startsWith('10'))
  ok(first.length === 0, '1-sinflar baholanmaydi', `${first.length} ta katak`)
}

/* ═══════════════ 5. Qoralamalarni qo'shish ═══════════════ */

console.log('\n=== 5. QORALAMALAR BILAN ===')
{
  const draft = buildGradeBook({
    classes: S.classes, students: S.students, teachers: S.teachers, assessments: S.assessments,
    assignments: S.assignments, overrides: S.overrides, settings: S.settings, quarter: QUARTER,
    includeDrafts: true,
  })
  ok(
    draft.school.count >= book.school.count,
    'kabinet ko‘rinishida baholar kam bo‘lmaydi',
    `${draft.school.count} ≥ ${book.school.count}`,
  )
  ok(draft.totals.cells === book.totals.cells, 'kataklar soni bir xil')
}

/* ═══════════════ 6. Excel jurnali — borib-kelish ═══════════════ */

console.log('\n=== 6. EXCEL JURNALI ===')
{
  const cell = [...book.cells.values()].find((c) => c.works.length >= 3 && c.chsb)!
  const roster = rosterOf(cell.classId)
  const ctx = {
    classId: cell.classId,
    subjectId: cell.subjectId,
    quarter: QUARTER,
    teacherName: 'Sinov',
    schoolName: 'Sinov maktabi',
    works: cell.works,
    students: roster,
  }

  const te = ms()
  const wb = await buildJournalWorkbook(ctx)
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  const exportMs = ms() - te

  const res = await parseJournal(buf, ctx)
  console.log(
    `  ${cell.classId} · ${SUBJECT_BY_ID[cell.subjectId]?.name} · ${cell.works.length} ta ish · ${roster.length} o'quvchi (${exportMs.toFixed(0)} ms)`,
  )
  ok(res.errors.length === 0, 'fayl xatosiz o‘qildi', res.errors.join('; '))
  ok(res.matched === roster.length, 'barcha o‘quvchilar topildi', `${res.matched}/${roster.length}`)
  ok(res.missingColumns.length === 0, 'barcha ustunlar topildi')

  let diff = 0
  let absentDiff = 0
  for (const w of cell.works) {
    for (const s of roster) {
      const before = w.scores[s.id]
      const after = res.scores[w.id][s.id]
      if (before === undefined ? after !== undefined : before !== after) diff++
    }
    const a1 = [...w.absent].sort().join(',')
    const a2 = [...res.absent[w.id]].sort().join(',')
    if (a1 !== a2) absentDiff++
  }
  ok(diff === 0, 'ballar aynan qaytdi', `${diff} ta farq`)
  ok(absentDiff === 0, 'kelmaganlar aynan qaytdi', `${absentDiff} ta farq`)

  // Qo'lda tuzilgan fayl: ustun tartibi boshqa, ID ustuni yo'q, vergulli sonlar
  const hand: unknown[][] = [
    ['Sinf jurnali'],
    ['F.I.Sh.', ...cell.works.map((w) => workLabel(w))],
    ...roster.map((s) => [
      s.fullName,
      ...cell.works.map((w) => {
        const v = w.scores[s.id]
        return v === undefined ? '-' : String(v).replace('.', ',')
      }),
    ]),
  ]
  const wb2 = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb2, XLSX.utils.aoa_to_sheet(hand), 'Varaq1')
  const res2 = await parseJournal(XLSX.write(wb2, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer, ctx)
  ok(res2.errors.length === 0, 'qo‘lda tuzilgan fayl ham o‘qiladi', res2.errors.join('; '))
  ok(res2.matched === roster.length, 'ismlar bo‘yicha moslashtirildi', `${res2.matched}/${roster.length}`)

  // Maksimal balldan oshgan qiymat chegaraga tushiriladi
  const over: unknown[][] = [
    ['F.I.Sh.', workLabel(cell.works[0])],
    [roster[0].fullName, cell.works[0].maxScore + 50],
  ]
  const wb3 = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb3, XLSX.utils.aoa_to_sheet(over), 'Jurnal')
  const res3 = await parseJournal(XLSX.write(wb3, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer, ctx)
  ok(
    res3.scores[cell.works[0].id][roster[0].id] === cell.works[0].maxScore,
    'maksimaldan oshgan ball chegaraga tushiriladi',
  )
  ok(res3.overMax === 1, 'oshgan kataklar sanaladi')
}

/* ═══════════════ 7. Hisobot ═══════════════ */

console.log('\n=== 7. HISOBOT ===')
{
  const t = ms()
  const wb = await buildReportWorkbook({
    book,
    classes: S.classes,
    teachers: S.teachers,
    students: S.students,
    schoolName: 'Sinov maktabi',
  })
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  const dt = ms() - t
  const names = wb.SheetNames
  console.log(`  varaqlar: ${names.join(', ')}`)
  console.log(`  hajmi: ${(buf.byteLength / 1024).toFixed(0)} KB (${dt.toFixed(0)} ms)`)
  ok(names.length === 7, '7 ta varaq yig‘ildi', `${names.length}`)

  const back = XLSX.read(buf, { type: 'array' })
  const teachersSheet = XLSX.utils.sheet_to_json<unknown[]>(back.Sheets["O'qituvchilar"], { header: 1 })
  ok(
    teachersSheet.length - 1 === book.byTeacher.length,
    'o‘qituvchilar varag‘idagi qatorlar soni mos',
    `${teachersSheet.length - 1} = ${book.byTeacher.length}`,
  )
  const pendingSheet = XLSX.utils.sheet_to_json<unknown[]>(back.Sheets['Topshirilmagan'], { header: 1 })
  const notReady = [...book.cells.values()].filter((c) => c.status !== 'tayyor').length
  ok(pendingSheet.length - 1 === notReady, 'topshirilmaganlar soni mos', `${pendingSheet.length - 1} = ${notReady}`)
}

/* ═══════════════ 8. Tezlik ═══════════════ */

console.log('\n=== 8. TEZLIK ===')
{
  const runs = 20
  const t = ms()
  for (let i = 0; i < runs; i++) {
    buildGradeBook({
      classes: S.classes, students: S.students, teachers: S.teachers, assessments: S.assessments,
      assignments: S.assignments, overrides: S.overrides, settings: S.settings, quarter: QUARTER,
    })
  }
  const per = (ms() - t) / runs
  console.log(`  jurnal yig'ish: ${per.toFixed(1)} ms (${runs} marta o'rtacha)`)
  ok(per < 120, 'hisob-kitob 120 ms dan tez', `${per.toFixed(1)} ms`)

  const bytes = JSON.stringify(S.assessments).length + JSON.stringify(S.students).length
  console.log(`  saqlanadigan hajm: ${(bytes / 1024).toFixed(0)} KB`)
  ok(bytes < 4 * 1024 * 1024, 'localStorage chegarasiga sig‘adi')
}

console.log(failures === 0 ? '\n✓ Barcha tekshiruvlar o‘tdi' : `\n✗ ${failures} ta xato`)
process.exit(failures === 0 ? 0 : 1)
