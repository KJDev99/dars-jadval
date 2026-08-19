/**
 * O'qituvchi toifasi bo'yicha dars taqsimotini sinash.
 * Ishga tushirish:  npm run bench:cat
 */
import { defaultClasses, defaultSettings, defaultTeachers } from '../src/data/seed'
import { emptyOverrides, teacherLoads } from '../src/lib/derive'
import { resolveTeacherConstraints } from '../src/lib/rules'
import { autoAssign } from '../src/scheduler/assign'
import { CATEGORY_LABELS, CATEGORY_ORDER } from '../src/types'
import type { TeacherCategory } from '../src/types'

const classes = defaultClasses()
const teachers = defaultTeachers(classes)
const ov = emptyOverrides()
const settings = defaultSettings()
const S = settings.stavkaHours

const r = autoAssign(classes, teachers, ov, {}, false, settings.seed, undefined, S)
const loads = teacherLoads(teachers, classes, r.assignments, ov)

console.log(`=== TOIFA BO'YICHA TAQSIMOT (1 stavka = ${S} soat) ===\n`)
console.log('  Toifa      Soni   O‘rtacha   Min   Max   1 stavka to‘lgan   O‘rtacha stavka')
console.log('  ' + '─'.repeat(76))

const rows: Record<TeacherCategory, number[]> = { oliy: [], birinchi: [], ikkinchi: [], yoq: [] }
for (const t of teachers) rows[t.category].push(loads[t.id] ?? 0)

for (const c of CATEGORY_ORDER) {
  const v = rows[c]
  if (!v.length) continue
  const avg = v.reduce((a, b) => a + b, 0) / v.length
  const full = v.filter((x) => x >= S).length
  console.log(
    '  ' +
      CATEGORY_LABELS[c].padEnd(11) +
      String(v.length).padStart(4) +
      avg.toFixed(1).padStart(10) +
      String(Math.min(...v)).padStart(6) +
      String(Math.max(...v)).padStart(6) +
      `${full}/${v.length}`.padStart(18) +
      (avg / S).toFixed(2).padStart(18),
  )
}

console.log(`\n  Muammolar: ${r.problems.length}`)
r.problems.slice(0, 5).forEach((p) => console.log('    ! ' + p))
console.log(`  Ogohlantirishlar: ${r.warnings.length}`)
r.warnings.slice(0, 5).forEach((p) => console.log('    ~ ' + p))

const under = teachers.filter((t) => (loads[t.id] ?? 0) < S)
console.log(`\n  1 stavkaga yetmaganlar: ${under.length} ta`)
const byCat: Record<string, number> = {}
for (const t of under) byCat[t.category] = (byCat[t.category] ?? 0) + 1
console.log(
  '    ' +
    CATEGORY_ORDER.filter((c) => byCat[c])
      .map((c) => `${CATEGORY_LABELS[c]}: ${byCat[c]}`)
      .join(', '),
)

const total = Object.values(loads).reduce((a, b) => a + b, 0)
console.log(`\n  Jami soat: ${total}, o‘rtacha stavka: ${(total / teachers.length / S).toFixed(2)}`)
