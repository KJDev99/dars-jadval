/**
 * Generatorni brauzersiz sinash uchun skript.
 * Ishga tushirish:  npm run bench
 */
import { defaultClasses, defaultSettings, defaultTeachers } from '../src/data/seed'
import { emptyOverrides, buildUnitsForClass, classTotalHours } from '../src/lib/derive'
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
  const total = classTotalHours(c, ov)
  const official = OFFICIAL_TOTALS[g]
  console.log(`  ${g}-sinf: ${total} soat (rasmiy ${official}) ${total === official ? '✓' : '✗ FARQ!'}`)
}

console.log('\n=== TARIFIKATSIYA ===')
const asg = autoAssign(classes, teachers, ov, {}, false, settings.seed)
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
const res = solve({ classes, teachers, units, settings }, (pct) => {
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
const rep = validateSchedule({ classes, teachers, units, placements: res.placements, settings, ov })
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
