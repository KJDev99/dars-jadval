/**
 * Turli tasodifiy urug'lar (seed) bilan generator barqarorligini sinash.
 * Ishga tushirish:  npm run bench:seeds
 */
import { defaultClasses, defaultSettings, defaultTeachers } from '../src/data/seed'
import { emptyOverrides, buildUnitsForClass } from '../src/lib/derive'
import { resolveTeacherConstraints } from '../src/lib/rules'
import { autoAssign } from '../src/scheduler/assign'
import { solve } from '../src/scheduler/solver'
import { validateSchedule } from '../src/scheduler/validate'
import type { Rule, Teacher } from '../src/types'

const classes = defaultClasses()
const teachers = defaultTeachers(classes)
const ov = emptyOverrides()
const base = defaultSettings()

const mk = (r: Partial<Rule> & { kind: Rule['kind'] }, i: number): Rule =>
  ({ id: 'r' + i, active: true, note: '', createdAt: 0, ...r }) as Rule

console.log('=== KO‘P URUG‘LI SINOV ===\n')
console.log('  seed   holat            xato  to‘qn.  sinf-oyna  oyna+   vaqt')
console.log('  ' + '─'.repeat(64))

let fails = 0
for (const seed of [1, 7, 42, 12345, 99991, 20262027, 555, 8080]) {
  const settings = { ...base, seed }
  const asg = autoAssign(classes, teachers, ov, {}, false, seed, resolveTeacherConstraints(teachers, [], settings.pedagogicalDays), settings.stavkaHours).assignments
  const units = classes.flatMap((c) => buildUnitsForClass(c, ov, asg).units)

  // Boshlang'ich jadval
  const t0 = Date.now()
  const r0 = solve({ classes, teachers, units, settings, teacherConstraints: resolveTeacherConstraints(teachers, [], settings.pedagogicalDays) })
  const tc0 = resolveTeacherConstraints(teachers, [], settings.pedagogicalDays)
  const v0 = validateSchedule({ classes, teachers, units, placements: r0.placements, settings, ov, teacherConstraints: tc0 })
  const ms0 = Date.now() - t0

  // Og'ir shartlar bilan qayta hisoblash
  const heavy = teachers.filter((t: Teacher) => units.filter((u) => u.parts.some((p) => p.teacherId === t.id)).length >= 14)
  const rules: Rule[] = [
    mk({ kind: 'teacher-day-off', teacherId: heavy[0]?.id, day: 2 }, 1),
    mk({ kind: 'teacher-day-off', teacherId: heavy[1]?.id, day: 4 }, 2),
    mk({ kind: 'teacher-slot-off', teacherId: heavy[0]?.id, day: 0, period: 0 }, 3),
    mk({ kind: 'teacher-max-gap', teacherId: heavy[2]?.id, value: 0 }, 4),
  ].filter((r) => r.teacherId)
  const tc = resolveTeacherConstraints(teachers, rules, settings.pedagogicalDays)

  const t1 = Date.now()
  const r1 = solve({ classes, teachers, units, settings, baseline: r0.placements, teacherConstraints: tc })
  const v1 = validateSchedule({
    classes, teachers, units, placements: r1.placements, settings, ov, teacherConstraints: tc,
  })
  const ms1 = Date.now() - t1

  const bm = new Map(r0.placements.map((p) => [p.unitId, p]))
  const moved = r1.placements.filter((p) => {
    const b = bm.get(p.unitId)
    return b && (b.day !== p.day || b.period !== p.period)
  }).length

  const row = (label: string, v: typeof v0, ms: number, extra = '') =>
    `  ${String(seed).padEnd(7)}${label.padEnd(17)}${String(v.errors).padStart(4)}${String(v.teacherClashes).padStart(7)}` +
    `${String(v.classGaps).padStart(10)}${String(v.teacherExtraGaps).padStart(7)}${(ms / 1000).toFixed(1).padStart(7)}s ${extra}`

  console.log(row('boshlang‘ich', v0, ms0))
  console.log(row('+ shartlar', v1, ms1, `ko‘chdi ${moved} (${((moved / units.length) * 100).toFixed(1)}%)`))
  if (v0.errors || v1.errors) {
    fails++
    ;[...v0.violations, ...v1.violations]
      .filter((x) => x.level === 'error')
      .slice(0, 3)
      .forEach((x) => console.log('        ✗ ' + x.message))
  }
}

console.log('\n  ' + (fails === 0 ? '✓ Barcha urug‘larda 0 xato' : `✗ ${fails} ta urug‘da xato qoldi`))
