import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { Empty, Field, Page, PageHeader, Stat } from '../components/ui'
import { DAY_NAMES, RULE_LABELS } from '../types'
import type { Rule, RuleKind } from '../types'
import { describeRule, resolveTeacherConstraints } from '../lib/rules'
import { teacherLoads } from '../lib/derive'

const KIND_HINT: Record<RuleKind, string> = {
  'teacher-target-hours':
    "Tarifikatsiyada shu o'qituvchiga aniq shuncha soat beriladi. Yetmasa yoki oshsa — ogohlantirish chiqadi.",
  'teacher-day-off': "Shu kunda o'qituvchiga umuman dars qo'yilmaydi.",
  'teacher-slot-off': "Shu kunning shu soatida o'qituvchi bo'sh bo'ladi.",
  'teacher-max-per-day': "O'qituvchining bir kundagi dars soati shu qiymatdan oshmaydi.",
  'teacher-max-gap': "O'qituvchining bir kundagi oynalari soni shu qiymatdan oshmaydi.",
  note: "Faqat eslatma — jadvalga ta'sir qilmaydi.",
}

const KINDS: RuleKind[] = [
  'teacher-day-off',
  'teacher-slot-off',
  'teacher-target-hours',
  'teacher-max-per-day',
  'teacher-max-gap',
  'note',
]

export default function RulesPage() {
  const { rules, teachers, classes, assignments, overrides, settings, addRule, removeRule, toggleRule, scheduleStale } =
    useStore()

  const [kind, setKind] = useState<RuleKind>('teacher-day-off')
  const [teacherId, setTeacherId] = useState('')
  const [day, setDay] = useState(0)
  const [period, setPeriod] = useState(0)
  const [value, setValue] = useState(18)
  const [note, setNote] = useState('')
  const [filter, setFilter] = useState('')

  const loads = useMemo(
    () => teacherLoads(teachers, classes, assignments, overrides),
    [teachers, classes, assignments, overrides],
  )
  const constraints = useMemo(() => resolveTeacherConstraints(teachers, rules), [teachers, rules])
  const tName = useMemo(() => new Map(teachers.map((t) => [t.id, t.fullName])), [teachers])

  const needsTeacher = kind !== 'note'
  const canAdd = !needsTeacher || !!teacherId

  const submit = () => {
    if (!canAdd) return
    const r: Omit<Rule, 'id' | 'createdAt'> = {
      kind,
      active: true,
      note: note.trim(),
      ...(needsTeacher ? { teacherId } : {}),
      ...(kind === 'teacher-day-off' || kind === 'teacher-slot-off' ? { day } : {}),
      ...(kind === 'teacher-slot-off' ? { period } : {}),
      ...(kind === 'teacher-target-hours' || kind === 'teacher-max-per-day' || kind === 'teacher-max-gap'
        ? { value }
        : {}),
    }
    addRule(r)
    setNote('')
  }

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return rules
    return rules.filter(
      (r) =>
        (tName.get(r.teacherId ?? '') ?? '').toLowerCase().includes(q) ||
        r.note.toLowerCase().includes(q) ||
        RULE_LABELS[r.kind].toLowerCase().includes(q),
    )
  }, [rules, filter, tName])

  const grouped = useMemo(() => {
    const m = new Map<string, Rule[]>()
    for (const r of visible) {
      const k = r.teacherId ?? '__umumiy__'
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(r)
    }
    return [...m.entries()].sort((a, b) =>
      (tName.get(a[0]) ?? 'ЯЯ').localeCompare(tName.get(b[0]) ?? 'ЯЯ'),
    )
  }, [visible, tName])

  const activeCount = rules.filter((r) => r.active && r.kind !== 'note').length

  return (
    <Page>
      <PageHeader
        title="Qo'shimcha shartlar va izohlar"
        subtitle="Bu yerga kiritilgan har bir shart jadval tuzishda hisobga olinadi. Shart qo'shgandan keyin «Jadval yaratish» bo'limida «Qayta hisoblash» tugmasini bosing — jadval to'liq qayta tuzilmaydi, faqat shu shart uchun zarur o'zgarishlar qilinadi."
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Jami shartlar" value={rules.length} />
        <Stat label="Faol shartlar" value={activeCount} tone="indigo" />
        <Stat label="Izohlar" value={rules.filter((r) => r.kind === 'note').length} />
        <Stat
          label="Jadval holati"
          value={scheduleStale ? 'Eskirgan' : 'Dolzarb'}
          tone={scheduleStale ? 'amber' : 'emerald'}
          hint={scheduleStale ? 'Qayta hisoblash kerak' : undefined}
        />
      </div>

      {/* Yangi shart qo'shish */}
      <div className="card mt-5 p-5">
        <h2 className="mb-3 font-semibold text-slate-900">Yangi shart qo'shish</h2>
        <div className="grid gap-3 md:grid-cols-4">
          <Field label="Shart turi">
            <select className="input" value={kind} onChange={(e) => setKind(e.target.value as RuleKind)}>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {RULE_LABELS[k]}
                </option>
              ))}
            </select>
          </Field>

          {needsTeacher && (
            <Field label="O'qituvchi">
              <select className="input" value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
                <option value="">— tanlang —</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.fullName} ({loads[t.id] ?? 0} soat)
                  </option>
                ))}
              </select>
            </Field>
          )}

          {(kind === 'teacher-day-off' || kind === 'teacher-slot-off') && (
            <Field label="Kun">
              <select className="input" value={day} onChange={(e) => setDay(+e.target.value)}>
                {DAY_NAMES.slice(0, settings.daysSenior).map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {kind === 'teacher-slot-off' && (
            <Field label="Soat">
              <select className="input" value={period} onChange={(e) => setPeriod(+e.target.value)}>
                {Array.from({ length: 8 }, (_, i) => (
                  <option key={i} value={i}>
                    {i + 1}-soat
                  </option>
                ))}
              </select>
            </Field>
          )}

          {(kind === 'teacher-target-hours' || kind === 'teacher-max-per-day' || kind === 'teacher-max-gap') && (
            <Field
              label={
                kind === 'teacher-target-hours'
                  ? 'Haftalik soat'
                  : kind === 'teacher-max-per-day'
                    ? 'Kuniga maks. soat'
                    : 'Kuniga maks. oyna'
              }
            >
              <input
                type="number"
                min={0}
                max={kind === 'teacher-target-hours' ? 40 : 10}
                className="input"
                value={value}
                onChange={(e) => setValue(+e.target.value)}
              />
            </Field>
          )}

          <Field label="Izoh (ixtiyoriy)">
            <input
              className="input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Masalan: malaka oshirish kursida"
            />
          </Field>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500">{KIND_HINT[kind]}</p>
          <button className="btn-primary shrink-0" onClick={submit} disabled={!canAdd}>
            + Shart qo'shish
          </button>
        </div>
      </div>

      {/* Ro'yxat */}
      <div className="mt-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Kiritilgan shartlar</h2>
          <input
            className="input w-56"
            placeholder="Qidirish..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>

        {rules.length === 0 && <Empty text="Hali shart qo'shilmagan." />}

        <div className="space-y-3">
          {grouped.map(([tid, list]) => {
            const t = teachers.find((x) => x.id === tid)
            const c = t ? constraints[t.id] : undefined
            return (
              <div key={tid} className="card overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2">
                  <h3 className="text-sm font-semibold text-slate-700">{t ? t.fullName : 'Umumiy izohlar'}</h3>
                  {t && (
                    <div className="flex gap-3 text-xs text-slate-500">
                      <span>
                        Yuklama: <b className="text-slate-700">{loads[t.id] ?? 0}</b> soat
                        {c?.targetHours !== undefined && (
                          <span className={loads[t.id] === c.targetHours ? ' text-emerald-600' : ' text-amber-600'}>
                            {' '}
                            / maqsad {c.targetHours}
                          </span>
                        )}
                      </span>
                      {c && c.blockedDays.length > 0 && (
                        <span>Bo'sh kunlar: {c.blockedDays.map((d) => DAY_NAMES[d].slice(0, 3)).join(', ')}</span>
                      )}
                    </div>
                  )}
                </div>
                <ul className="divide-y divide-slate-50">
                  {list.map((r) => (
                    <li key={r.id} className="flex items-center gap-3 px-4 py-2">
                      <input
                        type="checkbox"
                        checked={r.active}
                        onChange={() => toggleRule(r.id)}
                        title="Faol / faol emas"
                      />
                      <span
                        className={`badge shrink-0 ${
                          r.kind === 'note' ? 'bg-slate-100 text-slate-600' : 'bg-indigo-50 text-indigo-700'
                        }`}
                      >
                        {RULE_LABELS[r.kind]}
                      </span>
                      <span className={`flex-1 text-sm ${r.active ? 'text-slate-700' : 'text-slate-400 line-through'}`}>
                        {describeRule(r, tName.get(r.teacherId ?? ''))}
                        {r.note && r.kind !== 'note' && (
                          <span className="ml-2 text-xs text-slate-400">— {r.note}</span>
                        )}
                      </span>
                      <button
                        className="rounded px-1.5 py-1 text-slate-300 hover:bg-rose-50 hover:text-rose-600"
                        onClick={() => removeRule(r.id)}
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </div>
    </Page>
  )
}
