/**
 * BSB/ChSB ish oqimini uchidan-uchiga tekshirish.
 * Ishga tushirish:  npm run bench:flow
 *
 * Bu yerda hisob-kitob emas (u `bench:grades` da), do'kondagi amallar zanjiri
 * tekshiriladi: o'qituvchi ish yaratadi → ball qo'yadi → topshiradi →
 * rahbariyat ko'radi → so'rov yuboradi → ish qayta ochiladi va h.k.
 */
// Brauzer saqlagichlari taqlidi — do'kondan oldin yuklanishi shart
import './smoke-env'
import { useStore } from '../src/store'
import { autoAssign } from '../src/scheduler/assign'
import { buildGradeBook, cellKey, teacherCells } from '../src/lib/grading'
import { asgKey, effectiveHours } from '../src/lib/derive'
import { SUBJECTS, SUBJECT_BY_ID } from '../src/data/curriculum'
import type { Quarter } from '../src/types'

let failures = 0
const ok = (cond: boolean, label: string, detail = '') => {
  console.log(`  ${cond ? '✓' : '✗'} ${label}${detail ? '  — ' + detail : ''}`)
  if (!cond) failures++
}
const S = () => useStore.getState()
const work = (id: string) => S().assessments.find((a) => a.id === id)!

const Q: Quarter = 2

/* ─────────────────────────── Boshlang'ich holat ──────────────────────── */

{
  const { assignments } = autoAssign(S().classes, S().teachers, S().overrides, {}, false, 7)
  useStore.setState({ assignments })
}

const g = S().settings.grading

/** Sinovga mos sinf-fan: o'qituvchisi bor, soati bor, sinfda ro'yxat bor */
function pickCell() {
  for (const cls of S().classes) {
    if (cls.grade < 5 || cls.grade > 9) continue
    const roster = S().students.filter((s) => s.classId === cls.id && s.active)
    if (roster.length < 10) continue
    // Yonida bir xil darajadagi boshqa sinf ham bo'lsin (7-bo'lim uchun)
    const sibling = S().classes.find((c) => c.grade === cls.grade && c.id !== cls.id)
    if (!sibling) continue
    for (const sub of SUBJECTS) {
      const teacherId = S().assignments[asgKey(cls.id, sub.id)]
      if (!teacherId) continue
      if (effectiveHours(cls, sub.id, S().overrides) < 3) continue
      return { classId: cls.id, subjectId: sub.id, teacherId, sibling: sibling.id }
    }
  }
  throw new Error('sinovga mos sinf-fan topilmadi')
}

const PICK = pickCell()
const CLASS = PICK.classId
const SUBJ = PICK.subjectId
const SIBLING = PICK.sibling
const TEACHER = PICK.teacherId
const roster = S().students.filter((s) => s.classId === CLASS && s.active).sort((a, b) => a.order - b.order)

console.log('=== BOSHLANG‘ICH HOLAT ===')
console.log(
  `  ${CLASS} · ${SUBJECT_BY_ID[SUBJ]?.name} · o'qituvchi: ${S().teachers.find((t) => t.id === TEACHER)?.fullName}`,
)
console.log(`  ro'yxatda ${roster.length} o'quvchi`)
ok(!!TEACHER, 'tarifikatsiyada o‘qituvchi bor')
ok(roster.length > 5, 'sinf jurnali to‘ldirilgan')

const bookFor = (drafts: boolean) =>
  buildGradeBook({
    classes: S().classes, students: S().students, teachers: S().teachers,
    assessments: S().assessments, assignments: S().assignments, overrides: S().overrides,
    settings: S().settings, quarter: Q, includeDrafts: drafts,
  })
const cellOf = (drafts = false) => bookFor(drafts).cells.get(cellKey(CLASS, SUBJ))!

/* ═══════════════ 1. O'qituvchining sinf-fanlari ═══════════════ */

console.log('\n=== 1. O‘QITUVCHINING RO‘YXATI ===')
{
  const mine = teacherCells(TEACHER, S().classes, S().assignments, S().overrides, g)
  ok(mine.some((c) => c.classId === CLASS && c.subjectId === SUBJ), 'o‘z sinf-fani ro‘yxatda bor')
  ok(
    mine.every((c) => S().assignments[asgKey(c.classId, c.subjectId)] === TEACHER),
    'begona sinf-fan tushmagan',
    `${mine.length} ta katak`,
  )
  ok(
    mine.every((c) => !g.ungradedGrades.includes(c.grade)),
    'baholanmaydigan sinflar chiqarib tashlangan',
  )
  ok(mine.every((c) => c.hours > 0), 'o‘qitilmaydigan fan yo‘q')
}

/* ═══════════════ 2. Ish yaratish va tartib raqamlari ═══════════════ */

console.log('\n=== 2. ISH YARATISH ===')
const mk = (kind: 'bsb' | 'chsb') =>
  S().createAssessment({ classId: CLASS, subjectId: SUBJ, teacherId: TEACHER, quarter: Q, kind })

const b1 = mk('bsb')
const b2 = mk('bsb')
const b3 = mk('bsb')
const c1 = mk('chsb')
{
  ok(work(b1).order === 1 && work(b2).order === 2 && work(b3).order === 3, 'BSB tartib raqamlari 1,2,3')
  ok(work(c1).order === 0 && work(c1).kind === 'chsb', 'ChSB alohida turadi')
  ok(work(b1).maxScore === g.defaultBsbMax, 'BSB maksimal balli sozlamadan olindi', `${work(b1).maxScore}`)
  ok(work(c1).maxScore === g.defaultChsbMax, 'ChSB maksimal balli sozlamadan olindi', `${work(c1).maxScore}`)
  ok(work(b2).title.startsWith('2-'), 'ish nomi avtomatik qo‘yildi', work(b2).title)
  ok(!work(b1).submittedAt, 'yangi ish — qoralama')

  // O'rtadagi BSB o'chirilsa qolganlari qayta raqamlanadi
  S().removeAssessment(b2)
  ok(!S().assessments.some((a) => a.id === b2), 'o‘chirildi')
  ok(work(b3).order === 2, 'qolgan BSB qayta raqamlandi', `${work(b3).order}`)
  ok(work(b3).title.startsWith('2-'), 'nomi ham yangilandi', work(b3).title)

  // Yangisi qo'shilganda tartib davom etadi
  const b4 = mk('bsb')
  ok(work(b4).order === 3, 'yangi BSB 3-o‘rinni oldi', `${work(b4).order}`)
  S().removeAssessment(b4)
}

/* ═══════════════ 3. Ball qo'yish ═══════════════ */

console.log('\n=== 3. BALL QO‘YISH ===')
{
  const max = work(b1).maxScore
  for (const s of roster) S().setScore(b1, s.id, max)
  ok(Object.keys(work(b1).scores).length === roster.length, 'barcha ballar saqlandi')

  S().setScore(b1, roster[0].id, max + 100)
  ok(work(b1).scores[roster[0].id] === max, 'maksimaldan oshgan ball chegaraga tushdi')

  S().setScore(b1, roster[0].id, null)
  ok(work(b1).scores[roster[0].id] === undefined, 'null — ball o‘chirildi')

  S().toggleAbsent(b1, roster[1].id)
  ok(work(b1).absent.includes(roster[1].id), 'kelmadi deb belgilandi')
  ok(work(b1).scores[roster[1].id] === undefined, 'kelmagan o‘quvchining balli olib tashlandi')

  S().setScore(b1, roster[1].id, 5)
  ok(!work(b1).absent.includes(roster[1].id), 'ball qo‘yilganda «kelmadi» belgisi olindi')

  // Maksimal ball kamaytirilganda ballar ham tushirilishi kerak
  S().setScore(b1, roster[2].id, max)
  S().updateAssessment(b1, { maxScore: 5 })
  ok(work(b1).scores[roster[2].id] === 5, 'maksimal ball kamaysa, ballar chegaraga tushdi')
  ok(
    Object.values(work(b1).scores).every((v) => v <= 5),
    'birorta ball maksimaldan oshmadi',
  )
  S().updateAssessment(b1, { maxScore: max })

  // Excel yuklash yo'li
  const bulk: Record<string, number> = {}
  for (const s of roster) bulk[s.id] = Math.round(max * 0.8)
  S().setScores(b1, bulk, [roster[3].id])
  ok(Object.keys(work(b1).scores).length === roster.length, 'Excel jurnali to‘liq yozildi')
  ok(work(b1).absent[0] === roster[3].id, 'kelmaganlar ro‘yxati almashtirildi')
  S().setScores(b1, bulk, [])
}

/* ═══════════════ 4. Topshirish va rahbariyat ko'rinishi ═══════════════ */

console.log('\n=== 4. TOPSHIRISH ===')
{
  const before = cellOf(false)
  ok(before.summary.count === 0, 'qoralama rahbariyat hisobotiga kirmaydi')
  ok(before.status === 'qoralama', 'holat «qoralama»', before.status)

  const draft = cellOf(true)
  ok(draft.summary.count > 0, 'kabinetda esa ko‘rinadi', `${draft.summary.count} ta baho`)

  S().submitAssessment(b1)
  const after = cellOf(false)
  ok(after.summary.count > 0, 'topshirilgach hisobotga tushdi', `${after.summary.count} ta baho`)
  ok(after.status === 'chala', 'reja to‘lmagani uchun holat «chala»', after.status)

  // Rejadagi BSB soniga yetguncha ish qo'shib, hammasini to'ldiramiz
  const plan = cellOf(true).plannedBsb
  while (cellOf(true).works.filter((w) => w.kind === 'bsb').length < plan) mk('bsb')

  for (const w of cellOf(true).works) {
    if (w.submittedAt) continue
    const share = w.kind === 'chsb' ? 0.9 : 0.7
    for (const s of roster) S().setScore(w.id, s.id, Math.round(w.maxScore * share))
    S().submitAssessment(w.id)
  }

  const done = cellOf(false)
  console.log(`  reja: ${done.plannedBsb} ta BSB + 1 ChSB · topshirilgan: ${done.submitted}`)
  ok(done.status === 'tayyor', 'barchasi topshirilgach holat «tayyor»', done.status)
  ok(done.chsb?.id === c1, 'ChSB hisobga olindi')
  ok(done.bsb.length === done.plannedBsb, 'rejadagi barcha BSB hisobga olindi', `${done.bsb.length}/${done.plannedBsb}`)
  ok(done.summary.avgMark !== null, 'o‘rtacha ball hisoblandi', done.summary.avgMark!.toFixed(2))

  const t = bookFor(false).byTeacher.find((x) => x.teacherId === TEACHER)!
  ok(t.ready >= 1, 'o‘qituvchi kesimida tayyor katak ko‘rindi', `${t.ready}/${t.cells}`)
  ok(t.submittedWorks === done.plannedBsb + 1, 'topshirilgan ishlar sanaldi', `${t.submittedWorks}`)
}

/* ═══════════════ 5. Qayta ochish so'rovi ═══════════════ */

console.log('\n=== 5. SO‘ROV ZANJIRI ===')
{
  const reqId = S().addRequest({
    teacherId: TEACHER,
    kind: 'baho',
    title: 'Sinov so‘rovi',
    message: 'Ikki o‘quvchi keyin topshirdi.',
    assessmentId: b1,
  })
  ok(S().requests.find((r) => r.id === reqId)?.status === 'yangi', 'so‘rov «yangi» holatda yaratildi')

  // Rad etilsa ish yopiq qoladi
  S().reviewRequest(reqId, 'rad', 'Sabab yetarli emas', 'Direktor')
  ok(!!work(b1).submittedAt, 'rad etilganda ish ochilmaydi')

  // Qabul qilinsa ochiladi
  S().reviewRequest(reqId, 'qabul', 'Ochildi', 'Direktor')
  ok(!work(b1).submittedAt, 'qabul qilinganda ish qayta ochildi')
  ok(cellOf(false).status !== 'tayyor', 'ochilgan ish hisobotdan chiqdi', cellOf(false).status)
  ok(
    cellOf(false).bsb.length === cellOf(false).plannedBsb - 1,
    'ochilgan BSB hisobdan chiqdi, qolganlari qoldi',
    `${cellOf(false).bsb.length}/${cellOf(false).plannedBsb}`,
  )

  // Ma'muriyat to'g'ridan-to'g'ri ham ocha oladi
  S().submitAssessment(b1)
  ok(cellOf(false).status === 'tayyor', 'qayta topshirildi')
  S().reopenAssessment(b3)
  ok(!work(b3).submittedAt, 'ma’muriyat ishni to‘g‘ridan-to‘g‘ri ochdi')
  S().submitAssessment(b3)

  // Profil so'rovi (eski yo'l) hamon ishlaydi
  const pid = S().addRequest({
    teacherId: TEACHER, kind: 'profil', title: 'Telefon', message: '', proposed: { phone: '+998 90 000-00-00' },
  })
  S().reviewRequest(pid, 'qabul', '', 'Direktor')
  ok(
    S().teachers.find((t) => t.id === TEACHER)?.phone === '+998 90 000-00-00',
    'profil so‘rovi hamon qo‘llanadi',
  )
}

/* ═══════════════ 6. O'quvchilar ro'yxati o'zgarsa ═══════════════ */

console.log('\n=== 6. RO‘YXAT O‘ZGARISHI ===')
{
  const beforeCount = cellOf(false).summary.count

  // Chiqib ketgan deb belgilash — ball saqlanadi, hisobdan chiqadi
  S().updateStudent(roster[0].id, { active: false })
  ok(cellOf(false).summary.count === beforeCount - 1, 'chiqib ketgan o‘quvchi hisobdan chiqdi')
  ok(work(b1).scores[roster[0].id] !== undefined, 'lekin balli saqlanib qoldi')
  S().updateStudent(roster[0].id, { active: true })
  ok(cellOf(false).summary.count === beforeCount, 'qaytarilganda hisobga qo‘shildi')

  // O'chirish — ballari ham tozalanadi
  const victim = roster[roster.length - 1]
  S().removeStudent(victim.id)
  ok(!S().students.some((s) => s.id === victim.id), 'o‘quvchi o‘chirildi')
  ok(work(b1).scores[victim.id] === undefined, 'balli ham o‘chdi')
  ok(!work(b1).absent.includes(victim.id), '«kelmadi» ro‘yxatidan ham chiqdi')
  const orders = S().students.filter((s) => s.classId === CLASS).map((s) => s.order)
  ok(
    orders.every((o, i) => o === i + 1),
    'tartib raqamlari qayta joylandi',
    `1..${orders.length}`,
  )

  // Ro'yxatni bir yo'la almashtirish — mos ismlarning ballari saqlanadi
  const live = S().students.filter((s) => s.classId === CLASS).sort((a, b) => a.order - b.order)
  const keep = live.slice(0, 5).map((s) => s.fullName)
  const scoreOfKeeper = work(b1).scores[live[0].id]
  S().setRoster(CLASS, [...keep, 'Yangi O‘quvchi'])
  const after = S().students.filter((s) => s.classId === CLASS).sort((a, b) => a.order - b.order)
  ok(after.length === 6, 'ro‘yxat almashtirildi', `${after.length} ta`)
  ok(after[0].id === live[0].id, 'mos ismning kaliti saqlandi')
  ok(work(b1).scores[after[0].id] === scoreOfKeeper, 'uning balli ham saqlandi')
  ok(after[5].fullName === 'Yangi O‘quvchi' && after[5].order === 6, 'yangi o‘quvchi qo‘shildi')
  ok(cellOf(false).summary.count <= 6, 'hisob yangi ro‘yxatga moslashdi', `${cellOf(false).summary.count}`)
}

/* ═══════════════ 7. Sinf o'chirilsa ═══════════════ */

console.log('\n=== 7. SINF O‘CHIRILISHI ===')
{
  const other = SIBLING
  const cntBefore = S().assessments.length
  S().createAssessment({
    classId: other, subjectId: SUBJ, teacherId: S().assignments[asgKey(other, SUBJ)] ?? TEACHER,
    quarter: Q, kind: 'bsb',
  })
  ok(S().assessments.length === cntBefore + 1, 'boshqa sinfga ish yaratildi')

  S().removeClass(other)
  ok(!S().classes.some((c) => c.id === other), 'sinf o‘chirildi')
  ok(!S().students.some((s) => s.classId === other), 'uning o‘quvchilari o‘chdi')
  ok(!S().assessments.some((a) => a.classId === other), 'uning baholash ishlari o‘chdi')
  ok(S().assessments.some((a) => a.classId === CLASS), 'boshqa sinflarga tegilmadi')
}

/* ═══════════════ 8. Chorak ajratilishi ═══════════════ */

console.log('\n=== 8. CHORAKLAR ===')
{
  S().createAssessment({ classId: CLASS, subjectId: SUBJ, teacherId: TEACHER, quarter: 3, kind: 'bsb' })
  const q2 = S().assessments.filter((a) => a.quarter === Q).length
  const q3 = S().assessments.filter((a) => a.quarter === 3).length
  ok(q2 > 0 && q3 > 0, 'ikki chorakda ish bor', `II: ${q2}, III: ${q3}`)

  const b3rd = buildGradeBook({
    classes: S().classes, students: S().students, teachers: S().teachers,
    assessments: S().assessments, assignments: S().assignments, overrides: S().overrides,
    settings: S().settings, quarter: 3,
  })
  ok(
    [...b3rd.cells.values()].every((c) => c.works.every((w) => w.quarter === 3)),
    'jurnal faqat o‘z choragini oladi',
  )

  S().clearGrades(3)
  ok(S().assessments.filter((a) => a.quarter === 3).length === 0, 'III chorak tozalandi')
  ok(S().assessments.filter((a) => a.quarter === Q).length === q2, 'II chorakka tegilmadi')
}

/* ═══════════════ 9. Sozlamalar o'zgarsa qayta hisoblanadi ═══════════════ */

console.log('\n=== 9. SOZLAMALAR ===')
{
  const before = cellOf(false).summary.avgMark!
  S().setGrading({ mark5: 99, mark4: 98, mark3: 97 })
  const strict = cellOf(false).summary.avgMark!
  ok(strict < before, 'chegara qattiqlashsa o‘rtacha tushdi', `${before.toFixed(2)} → ${strict.toFixed(2)}`)

  S().setGrading({ mark5: 1, mark4: 1, mark3: 1 })
  ok(cellOf(false).summary.dist[5] === cellOf(false).summary.count, 'chegara nolga tushsa hammasi «5»')

  S().setGrading({ mark5: g.mark5, mark4: g.mark4, mark3: g.mark3 })
  ok(Math.abs(cellOf(false).summary.avgMark! - before) < 1e-9, 'asl chegaralar qaytarildi')

  // Og'irlik o'zgarsa foiz ham o'zgaradi
  const pctBefore = cellOf(false).summary.avgPercent!
  S().setGrading({ bsbWeight: 0.2, chsbWeight: 0.8 })
  const pctAfter = cellOf(false).summary.avgPercent!
  ok(Math.abs(pctAfter - pctBefore) > 0.5, 'og‘irlik o‘zgarishi natijaga ta’sir qildi',
     `${pctBefore.toFixed(1)}% → ${pctAfter.toFixed(1)}%`)
  S().setGrading({ bsbWeight: g.bsbWeight, chsbWeight: g.chsbWeight })
}

/* ═══════════════ 10. Migratsiya (eski baza) ═══════════════ */

console.log('\n=== 10. ESKI BAZADAN KO‘CHISH ===')
{
  const persist = (useStore as unknown as {
    persist: { getOptions: () => { migrate?: (s: unknown, v: number) => unknown } }
  }).persist
  const migrate = persist.getOptions().migrate!
  const old = { classes: S().classes, teachers: [], settings: { schoolName: 'Eski' } }
  const next = migrate(old, 4) as Record<string, unknown>
  ok(Array.isArray(next.students) && (next.students as unknown[]).length > 0, 'o‘quvchilar yaratildi',
     `${(next.students as unknown[]).length} ta`)
  ok(Array.isArray(next.assessments), 'baholash ro‘yxati qo‘shildi')
  const st = next.settings as { grading?: { mark5?: number }; schoolName?: string }
  ok(st.grading?.mark5 === 86, 'baholash sozlamalari to‘ldirildi')
  ok(st.schoolName === 'Eski', 'eski sozlamalar saqlandi')

  // Ikkinchi marta ko'chirish ma'lumotni buzmasligi kerak
  const again = migrate({ ...next, students: [{ id: 'x', classId: '7A', fullName: 'A', order: 1, active: true }] }, 4) as Record<string, unknown>
  ok((again.students as unknown[]).length === 1, 'mavjud ro‘yxat qayta yaratilmadi')
}

console.log(failures === 0 ? '\n✓ Barcha oqimlar to‘g‘ri ishladi' : `\n✗ ${failures} ta xato`)
process.exit(failures === 0 ? 0 : 1)
