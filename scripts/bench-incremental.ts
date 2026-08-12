/**
 * "Minimal o'zgarish" rejimini sinash.
 * Ishga tushirish:  npm run bench:inc
 */
import { defaultClasses, defaultSettings, defaultTeachers } from '../src/data/seed'
import { emptyOverrides, buildUnitsForClass } from '../src/lib/derive'
import { resolveTeacherConstraints } from '../src/lib/rules'
import { applyTransfer, autoAssign, teacherWorkload } from '../src/scheduler/assign'
import { solve } from '../src/scheduler/solver'
import { validateSchedule } from '../src/scheduler/validate'
import type { Placement, Rule, Teacher } from '../src/types'

const classes = defaultClasses()
const teachers = defaultTeachers(classes)
const ov = emptyOverrides()
const settings = defaultSettings()

const build = (asg: Record<string, string>) => classes.flatMap((c) => buildUnitsForClass(c, ov, asg).units)

function report(label: string, units: any[], placements: Placement[], rules: Rule[], base?: Placement[]) {
  const constraints = resolveTeacherConstraints(teachers, rules)
  const rep = validateSchedule({ classes, teachers, units, placements, settings, ov, teacherConstraints: constraints })
  let moved = 0
  let kept = 0
  if (base) {
    const bm = new Map(base.map((p) => [p.unitId, p]))
    for (const p of placements) {
      const b = bm.get(p.unitId)
      if (!b) continue
      if (b.day === p.day && b.period === p.period) kept++
      else moved++
    }
  }
  const pct = base ? ((moved / (moved + kept)) * 100).toFixed(1) : '—'
  console.log(
    `  ${label.padEnd(34)} xato:${String(rep.errors).padStart(3)}  ogoh:${String(rep.warnings).padStart(3)}` +
      `  to'qnashuv:${String(rep.teacherClashes).padStart(2)}  sinf-oyna:${String(rep.classGaps).padStart(2)}` +
      `  oyna+:${String(rep.teacherExtraGaps).padStart(2)}` +
      (base ? `  ko'chdi: ${moved}/${moved + kept} (${pct}%)` : ''),
  )
  if (rep.errors > 0) {
    rep.violations.filter((v) => v.level === 'error').slice(0, 5).forEach((v) => console.log('      ✗ ' + v.message))
  }
  return rep
}

/* ─── 1. Asosiy jadval ─────────────────────────────────────────────── */
console.log('=== 1. ASOSIY JADVAL ===')
const asg0 = autoAssign(classes, teachers, ov, {}, false, settings.seed).assignments
const units0 = build(asg0)
const base = solve({ classes, teachers, units: units0, settings, teacherConstraints: resolveTeacherConstraints(teachers, []) })
report('boshlang‘ich', units0, base.placements, [])

const mkRule = (r: Partial<Rule> & { kind: Rule['kind'] }): Rule => ({
  id: 'r' + Math.round(performance.now() * 1000),
  active: true,
  note: '',
  createdAt: 0,
  ...r,
} as Rule)

/* ─── 2. Ssenariy: o'qituvchiga bo'sh kun ──────────────────────────── */
console.log('\n=== 2. SSENARIY: 3 ta o‘qituvchiga bo‘sh kun + 1 ta bo‘sh soat ===')
const loadOf = (t: Teacher) => units0.filter((u) => u.parts.some((p) => p.teacherId === t.id)).length
const busy = teachers.filter((t) => loadOf(t) >= 14).slice(0, 3)
const rules1: Rule[] = [
  mkRule({ kind: 'teacher-day-off', teacherId: busy[0].id, day: 2, note: 'malaka oshirish kursi' }),
  mkRule({ kind: 'teacher-day-off', teacherId: busy[1].id, day: 5, note: 'metodik kun' }),
  mkRule({ kind: 'teacher-day-off', teacherId: busy[2].id, day: 1 }),
  mkRule({ kind: 'teacher-slot-off', teacherId: busy[0].id, day: 0, period: 0, note: 'kengash yig‘ilishi' }),
  mkRule({ kind: 'teacher-max-gap', teacherId: busy[1].id, value: 0, note: 'oynasiz ishlaydi' }),
]
busy.forEach((t, i) => console.log(`  · ${t.fullName} (${loadOf(t)} soat) — ${['Chorshanba', 'Shanba', 'Seshanba'][i]} bo‘sh`))

const c1 = resolveTeacherConstraints(teachers, rules1)
const inc1 = solve({ classes, teachers, units: units0, settings, baseline: base.placements, teacherConstraints: c1 })
report('inkremental (barqarorlik 60)', units0, inc1.placements, rules1, base.placements)

const full1 = solve({ classes, teachers, units: units0, settings, teacherConstraints: c1 })
report('yangidan (taqqoslash uchun)', units0, full1.placements, rules1, base.placements)

/* ─── 3. Ssenariy: darslarni boshqa o'qituvchiga o'tkazish ─────────── */
console.log('\n=== 3. SSENARIY: bitta o‘qituvchining barcha darsini boshqasiga o‘tkazish ===')
const from = teachers.find((t) => t.speciality === 'Kimyo')!
const to = teachers.find((t) => t.speciality === 'Kimyo' && t.id !== from.id)!
const all = teacherWorkload(from.id, classes, asg0, ov)
const toLoad = units0.filter((u) => u.parts.some((p) => p.teacherId === to.id)).length
// Chegaradan oshmaydigan qismini o'tkazamiz (UI dagi checkTransfer shu tekshiruvni qiladi)
const items: typeof all = []
let acc = toLoad
for (const i of all) {
  if (acc + i.hours > to.maxHours) continue
  items.push(i)
  acc += i.hours
}
console.log(
  `  ${from.fullName} → ${to.fullName}: ${items.length}/${all.length} biriktirish, ` +
    `${items.reduce((s, i) => s + i.hours, 0)} soat (qabul qiluvchi ${toLoad} → ${acc}, chegara ${to.maxHours})`,
)
const asg2 = applyTransfer(asg0, items, to.id)
const units2 = build(asg2)
const c2 = resolveTeacherConstraints(teachers, rules1)
const inc2 = solve({ classes, teachers, units: units2, settings, baseline: inc1.placements, teacherConstraints: c2 })
report('o‘tkazishdan keyin (inkremental)', units2, inc2.placements, rules1, inc1.placements)

/* ─── 4. Ssenariy: qo'lda almashtirish + qulf ──────────────────────── */
console.log('\n=== 4. SSENARIY: qo‘lda 2 ta darsni almashtirish va qulflash ===')
const cls = '7A'
const inClass = inc2.placements.filter((p) => units2.find((u) => u.id === p.unitId)?.classId === cls)
const a = inClass.find((p) => p.day === 0 && p.period === 0)!
const b = inClass.find((p) => p.day === 3 && p.period === 4)!
const swapped: Placement[] = inc2.placements.map((p) => {
  if (p.unitId === a.unitId) return { ...p, day: b.day, period: b.period }
  if (p.unitId === b.unitId) return { ...p, day: a.day, period: a.period }
  return p
})
const nameOf = (id: string) => units2.find((u) => u.id === id)!.parts.map((x) => x.subjectId).join('/')
console.log(`  ${cls}: ${nameOf(a.unitId)} (Du 1-soat) ⇄ ${nameOf(b.unitId)} (Pa 5-soat)`)
const inc3 = solve({
  classes, teachers, units: units2, settings,
  baseline: swapped,
  lockedUnitIds: [a.unitId, b.unitId],
  teacherConstraints: c2,
})
report('qulf bilan qayta hisoblash', units2, inc3.placements, rules1, swapped)

const pa = inc3.placements.find((p) => p.unitId === a.unitId)!
const pb = inc3.placements.find((p) => p.unitId === b.unitId)!
console.log(
  `  Qulflangan darslar joyida qoldimi: ${pa.day === b.day && pa.period === b.period ? 'HA' : 'YO‘Q'} / ` +
    `${pb.day === a.day && pb.period === a.period ? 'HA' : 'YO‘Q'}`,
)

/* ─── 5. Barqarorlik og'irligining ta'siri ─────────────────────────── */
console.log('\n=== 5. BARQARORLIK OG‘IRLIGINING TA’SIRI (2-ssenariy uchun) ===')
for (const w of [0, 20, 60, 120, 200]) {
  const r = solve({ classes, teachers, units: units0, settings: { ...settings, stabilityWeight: w }, baseline: base.placements, teacherConstraints: c1 })
  report(`stabilityWeight = ${String(w).padStart(3)}`, units0, r.placements, rules1, base.placements)
}
