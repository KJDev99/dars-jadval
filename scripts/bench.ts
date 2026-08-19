/**
 * Generatorni brauzersiz sinash uchun skript.
 * Ishga tushirish:  npm run bench
 */
import { defaultClasses, defaultSettings, defaultTeachers } from '../src/data/seed'
import { resolveTeacherConstraints } from '../src/lib/rules'
import { emptyOverrides, buildUnitsForClass, classTotalHours, classPlanHours, classExtraHours } from '../src/lib/derive'
import { autoAssign } from '../src/scheduler/assign'
import { solve } from '../src/scheduler/solver'
import { validateSchedule } from '../src/scheduler/validate'
import { OFFICIAL_TOTALS } from '../src/data/curriculum'

const classes = defaultClasses()
const teachers = defaultTeachers(classes)
const ov = emptyOverrides()
const settings = defaultSettings()

console.log('=== O‘QUV REJA TEKSHIRUVI ===')
for (const g of [...new Set(classes.map((c) => c.grade))]) {
  const c = classes.find((x) => x.grade === g)!
  const total = classPlanHours(c, ov)
  const extra = classExtraHours(c, ov)
  const official = OFFICIAL_TOTALS[g]
  console.log(`  ${g}-sinf: reja ${total} soat (rasmiy ${official}) ${total === official ? '✓' : '✗ FARQ!'}  + reja tashqarisi ${extra} soat`)
}

console.log('\n=== TARIFIKATSIYA ===')
const asg = autoAssign(classes, teachers, ov, {}, false, settings.seed, resolveTeacherConstraints(teachers, [], settings.pedagogicalDays), settings.stavkaHours)
console.log(`  Sinflar: ${classes.length}, o‘qituvchilar: ${teachers.length}`)
console.log(`  Biriktirishlar: ${Object.keys(asg.assignments).length}`)
console.log(`  Muammolar: ${asg.problems.length}`)
asg.problems.slice(0, 10).forEach((p) => console.log('    ! ' + p))
console.log(`  Ogohlantirishlar: ${asg.warnings.length}`)
asg.warnings.slice(0, 10).forEach((p) => console.log('    ~ ' + p))

const units = classes.flatMap((c) => buildUnitsForClass(c, ov, asg.assignments).units)
console.log(`  Jami dars birligi: ${units.length}`)

const loadMap = new Map<string, number>()
for (const u of units) for (const p of u.parts) loadMap.set(p.teacherId, (loadMap.get(p.teacherId) ?? 0) + (u.alternating ? 0.5 : 1))
const loads = [...loadMap.values()]
console.log(
  `  Yuklama: min ${Math.min(...loads)}, max ${Math.max(...loads)}, o‘rtacha ${(loads.reduce((a, b) => a + b, 0) / loads.length).toFixed(1)}`,
)

console.log('\n=== JADVAL GENERATSIYASI ===')
const t0 = Date.now()
const tc = resolveTeacherConstraints(teachers, [], settings.pedagogicalDays)
const res = solve({ classes, teachers, units, settings, teacherConstraints: tc }, (pct) => {
  if (Math.abs(pct * 100 - Math.round(pct * 100)) < 1e-9 && Math.round(pct * 100) % 25 === 0) {
    process.stdout.write(` ${Math.round(pct * 100)}%`)
  }
})
console.log('')
console.log(`  Vaqt: ${((Date.now() - t0) / 1000).toFixed(1)} s`)
console.log(`  Yakuniy jarima: ${res.stats.cost}`)
console.log(`  Xabar: ${res.stats.message}`)
res.notes.forEach((n) => console.log('    · ' + n))

console.log('\n=== TEKSHIRUV ===')
const rep = validateSchedule({ classes, teachers, units, placements: res.placements, settings, ov, teacherConstraints: tc })
console.log(`  Xatolar: ${rep.errors}`)
console.log(`  Ogohlantirishlar: ${rep.warnings}`)
console.log(`  O‘qituvchi to‘qnashuvi: ${rep.teacherClashes}`)
console.log(`  Sinf jadvalidagi bo‘shliqlar: ${rep.classGaps}`)
console.log(`  Ortiqcha o‘qituvchi oynalari: ${rep.teacherExtraGaps}`)

const byRule = new Map<string, number>()
for (const v of rep.violations) byRule.set(`${v.level}/${v.rule}`, (byRule.get(`${v.level}/${v.rule}`) ?? 0) + 1)
console.log('\n  Qoidalar kesimida:')
for (const [k, n] of [...byRule.entries()].sort((a, b) => b[1] - a[1])) console.log(`    ${k}: ${n}`)

console.log('\n  Namuna xatolar:')
rep.violations
  .filter((v) => v.level === 'error')
  .slice(0, 15)
  .forEach((v) => console.log('    ✗ ' + v.message))

// Namuna jadval — 7-A sinf
console.log('\n=== NAMUNA: 7-A SINF JADVALI ===')
const unitById = new Map(units.map((u) => [u.id, u]))
const tName = new Map(teachers.map((t) => [t.id, t.fullName]))
const grid: string[][] = Array.from({ length: 6 }, () => Array.from({ length: 8 }, () => ''))
for (const p of res.placements) {
  const u = unitById.get(p.unitId)!
  if (u.classId !== '7A') continue
  grid[p.day][p.period] = u.parts.map((x) => x.subjectId).join('/')
}
const DAYS = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh']
for (let d = 0; d < 6; d++) {
  console.log(`  ${DAYS[d]}: ` + grid[d].filter(Boolean).map((s, i) => `${i + 1}.${s}`).join('  '))
}

/* ─── Sinf rahbari va Ma'naviyat soati ─────────────────────────────── */
console.log('\n=== SINF RAHBARI VA MA’NAVIYAT SOATI ===')
{
  const hrOf = new Map(teachers.filter((t) => t.homeroomClassId).map((t) => [t.homeroomClassId!, t]))
  console.log(`  Sinf rahbari biriktirilgan: ${hrOf.size}/${classes.length}`)

  let ok = 0
  const bad: string[] = []
  for (const c of classes) {
    const tid = asg.assignments[`${c.id}|manaviyat`]
    const hr = hrOf.get(c.id)
    if (tid && hr && tid === hr.id) ok++
    else bad.push(`${c.grade}-${c.letter}`)
  }
  console.log(`  Ma'naviyat soatini sinf rahbari o'tadi: ${ok}/${classes.length}`)
  if (bad.length) console.log('    ✗ ' + bad.join(', '))

  const dup = [...hrOf.values()].length !== new Set([...hrOf.values()].map((t) => t.id)).size
  console.log(`  Bir o'qituvchi bir nechta sinfga rahbarmi: ${dup ? '✗ HA' : 'yo‘q ✓'}`)

  const sample = classes.filter((c) => [1, 5, 9].includes(c.grade) && c.letter === 'A')
  for (const c of sample) {
    const hr = hrOf.get(c.id)
    const pl = res.placements.find((p) => p.unitId.startsWith(`${c.id}#manaviyat#`))
    const DAYS = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh']
    console.log(
      `    ${c.grade}-${c.letter}: rahbar ${hr?.fullName ?? '—'} (${hr?.speciality ?? '—'}), ` +
        `ma'naviyat ${pl ? DAYS[pl.day] + ' ' + (pl.period + 1) + '-soat' : 'joylashmagan'}`,
    )
  }
}

/* ─── Metodik kunlar ────────────────────────────────────────────────── */
console.log('\n=== METODIK KUNLAR ===')
{
  const DAYS = ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba']
  const byDay = new Map<number, string[]>()
  for (const [spec, d] of Object.entries(settings.pedagogicalDays)) {
    if (!byDay.has(d)) byDay.set(d, [])
    byDay.get(d)!.push(spec)
  }
  for (const [d, list] of [...byDay.entries()].sort((a, b) => a[0] - b[0])) {
    console.log(`  ${DAYS[d]}: ${list.join(', ')}`)
  }
  const noDay = [...new Set(teachers.map((t) => t.speciality))].filter(
    (sp) => settings.pedagogicalDays[sp] === undefined,
  )
  console.log(`  Metodik kunsiz guruhlar: ${noDay.join(', ') || 'yo‘q'}`)
}
