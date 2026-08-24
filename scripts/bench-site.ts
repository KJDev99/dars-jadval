/**
 * Rasmiy sayt, kirish tizimi va kabinet ma'lumotlarini tekshirish.
 * Ishga tushirish:  npm run bench:site
 */
import { defaultClasses, defaultTeachers } from '../src/data/seed'
import { defaultSite, defaultUsers } from '../src/data/site-seed'
import type { Teacher, TeacherRequest } from '../src/types'

let failures = 0
const check = (ok: boolean, text: string) => {
  console.log(`  ${ok ? '✓' : '✗'} ${text}`)
  if (!ok) failures++
}

const classes = defaultClasses()
const teachers = defaultTeachers(classes)
const site = defaultSite()
const users = defaultUsers()

/* ────────────────── 1. O'qituvchilarning kirish ma'lumoti ────────────────── */

console.log('=== KABINETGA KIRISH ===')
const withPassport = teachers.filter((t) => t.passportSeries && t.passportNumber)
check(withPassport.length === teachers.length, `barcha o‘qituvchida pasport bor (${withPassport.length}/${teachers.length})`)

const badSeries = teachers.filter((t) => !/^[A-Z]{2}$/.test(t.passportSeries ?? ''))
check(badSeries.length === 0, `seriyalar 2 harfdan iborat (xato: ${badSeries.length})`)

const badNumber = teachers.filter((t) => !/^\d{7}$/.test(t.passportNumber ?? ''))
check(badNumber.length === 0, `raqamlar 7 xonali (xato: ${badNumber.length})`)

const keys = new Set(teachers.map((t) => `${t.passportSeries}${t.passportNumber}`))
check(keys.size === teachers.length, `pasport ma'lumotlari takrorlanmaydi (${keys.size}/${teachers.length})`)

/** Kirish tekshiruvi — authStore dagi mantiqning aynan o'zi */
const findByPassport = (series: string, number: string) =>
  teachers.find(
    (t) => (t.passportSeries ?? '').toUpperCase() === series.toUpperCase() && t.passportNumber === number,
  )

const sample = teachers[7]
check(
  findByPassport(sample.passportSeries!, sample.passportNumber!)?.id === sample.id,
  'pasport bo‘yicha o‘qituvchi topiladi',
)
check(
  findByPassport(sample.passportSeries!.toLowerCase(), sample.passportNumber!)?.id === sample.id,
  'kichik harfda yozilsa ham topiladi',
)
check(findByPassport('ZZ', '0000000') === undefined, 'noto‘g‘ri pasport rad etiladi')

/* ────────────────── 2. Ma'muriyat hisoblari ────────────────── */

console.log('\n=== MA’MURIYAT HISOBLARI ===')
check(users.length >= 2, `${users.length} ta hisob mavjud`)
check(users.some((u) => u.role === 'director'), 'direktor hisobi bor')
check(users.some((u) => u.role === 'zavuch'), 'zavuch hisobi bor')
check(new Set(users.map((u) => u.login)).size === users.length, 'loginlar takrorlanmaydi')
check(users.every((u) => u.password.length >= 6), 'parollar kamida 6 belgidan iborat')
users.forEach((u) => console.log(`    · ${u.role.padEnd(9)} ${u.login} / ${u.password}`))

/* ────────────────── 3. Sayt kontenti ────────────────── */

console.log('\n=== SAYT KONTENTI ===')
const p = site.profile
check(p.name.length > 10 && p.shortName.length > 0, 'maktab nomi to‘ldirilgan')
check(p.foundedYear > 1900 && p.foundedYear <= new Date().getFullYear(), `tashkil etilgan yil: ${p.foundedYear}`)
check(p.about.split('\n\n').length >= 3, `«maktab haqida» ${p.about.split('\n\n').length} ta paragraf`)
check(!!p.phone && !!p.email && !!p.address, 'aloqa ma’lumotlari to‘liq')

check(site.staff.length >= 3, `rahbariyat: ${site.staff.length} ta`)
const orders = site.staff.map((s) => s.order)
check(new Set(orders).size === orders.length, 'rahbariyat tartib raqamlari takrorlanmaydi')
check(site.staff.every((s) => s.fullName && s.position), 'har bir a’zoda ism va lavozim bor')
check(site.staff.some((s) => s.bio && s.experienceYears > 0), 'ish tajribasi va faoliyati ko‘rsatilgan')

const classIds = new Set(classes.map((c) => c.id))
const badClass = site.students.filter((s) => !classIds.has(s.classId))
check(badClass.length === 0, `a’lochilar sinflari mavjud (xato: ${badClass.length})`)
badClass.slice(0, 3).forEach((s) => console.log(`    ! ${s.fullName}: ${s.classId}`))

check(site.alumni.length > 0, `faxriy bitiruvchilar: ${site.alumni.length} ta`)
check(site.news.length > 0, `yangiliklar: ${site.news.length} ta`)
check(
  site.news.every((n) => /^\d{4}-\d{2}-\d{2}$/.test(n.date)),
  'yangiliklar sanasi to‘g‘ri formatda',
)

/* ────────────────── 4. O'qituvchi profili (sayt uchun) ────────────────── */

console.log('\n=== PEDAGOG SAHIFALARI ===')
const visible = teachers.filter((t) => t.publicVisible !== false)
check(visible.length === teachers.length, `saytda ko‘rinadigan pedagoglar: ${visible.length}`)
check(teachers.every((t) => (t.experienceYears ?? 0) > 0), 'barchasida pedagogik staj ko‘rsatilgan')
check(teachers.every((t) => !!t.education), 'barchasida ma’lumoti ko‘rsatilgan')
const withAwards = teachers.filter((t) => (t.achievements ?? []).length > 0)
check(withAwards.length > teachers.length / 2, `yutuqlari kiritilgan: ${withAwards.length}/${teachers.length}`)

const oliy = teachers.filter((t) => t.category === 'oliy')
const avgOliy = oliy.reduce((s, t) => s + (t.experienceYears ?? 0), 0) / Math.max(1, oliy.length)
const yoq = teachers.filter((t) => t.category === 'yoq')
const avgYoq = yoq.reduce((s, t) => s + (t.experienceYears ?? 0), 0) / Math.max(1, yoq.length)
console.log(`    Oliy toifa o‘rtacha staji: ${avgOliy.toFixed(1)} yil, toifasizlarniki: ${avgYoq.toFixed(1)} yil`)
check(avgOliy > avgYoq, 'yuqori toifadagilarning staji uzunroq')

/* ────────────────── 5. So'rovni qabul qilish mantig'i ────────────────── */

console.log('\n=== SO’ROVLAR ===')
const target = teachers[0]
const request: TeacherRequest = {
  id: 'r-1',
  teacherId: target.id,
  kind: 'profil',
  title: "Telefon raqamini yangilash",
  message: 'Telefon raqamim o‘zgardi.',
  proposed: { phone: '+998 90 111-22-33', bio: 'Yangilangan tarjimai hol.' },
  status: 'yangi',
  createdAt: 0,
}

/** store dagi reviewRequest mantig'ining aynan o'zi */
function applyRequest(list: Teacher[], req: TeacherRequest, status: 'qabul' | 'rad'): Teacher[] {
  if (status === 'qabul' && req.kind === 'profil' && req.proposed) {
    return list.map((t) => (t.id === req.teacherId ? { ...t, ...req.proposed } : t))
  }
  return list
}

const afterReject = applyRequest(teachers, request, 'rad')
check(afterReject[0].phone === target.phone, 'rad etilganda ma’lumot o‘zgarmaydi')

const afterAccept = applyRequest(teachers, request, 'qabul')
check(afterAccept[0].phone === '+998 90 111-22-33', 'qabul qilinganda telefon yangilanadi')
check(afterAccept[0].bio === 'Yangilangan tarjimai hol.', 'qabul qilinganda tarjimai hol yangilanadi')
check(afterAccept[0].fullName === target.fullName, 'boshqa maydonlar o‘zgarmaydi')
check(afterAccept[1].id === teachers[1].id && afterAccept[1].phone === teachers[1].phone, 'boshqa o‘qituvchilarga tegmaydi')

console.log(`\n${failures === 0 ? '✓ Barcha tekshiruvlar o‘tdi' : `✗ ${failures} ta tekshiruv o‘tmadi`}`)
process.exit(failures === 0 ? 0 : 1)
