import { useMemo, useState } from 'react'
import { IcoPlus, IcoTrash, IcoSearch } from '../components/icons'
import { useStore } from '../store'
import { Empty, Field, Page, PageHeader, Stat } from '../components/ui'
import { DAY_NAMES, RULE_LABELS } from '../types'
import type { Rule, RuleKind } from '../types'
import { describeRule, resolveTeacherConstraints } from '../lib/rules'
import { teacherLoads } from '../lib/derive'
import Select from '../components/Select'
import { IcoCategory, IcoClock } from '../components/icons'

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
  const {
    rules, teachers, classes, assignments, overrides, settings, scheduleStale,
    addRule, removeRule, toggleRule, setPedagogicalDay,
  } = useStore()

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
  const constraints = useMemo(
    () => resolveTeacherConstraints(teachers, rules, settings.pedagogicalDays),
    [teachers, rules, settings.pedagogicalDays],
  )

  /** Mutaxassislik guruhlari (metodbirlashmalar) */
  const specialities = useMemo(
    () => [...new Set(teachers.map((t) => t.speciality))].sort((a, b) => a.localeCompare(b)),
    [teachers],
  )

  /** Kun bo'yicha metodik kun tufayli bo'sh qoladigan umumiy soat */
  const { dayLoad, totalHours } = useMemo(() => {
    const arr = new Array(6).fill(0)
    let total = 0
    for (const t of teachers) {
      const h = loads[t.id] ?? 0
      total += h
      const d = settings.pedagogicalDays[t.speciality]
      if (d !== undefined) arr[d] += h
    }
    return { dayLoad: arr, totalHours: total }
  }, [teachers, loads, settings.pedagogicalDays])
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

      {/* Metodbirlashmalarning metodik kunlari */}
      <div className="card mt-5 p-5">
        <div className="mb-1 flex items-center gap-2">
          <IcoCategory className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          <h2 className="font-semibold text-fg">Metodik (pedagogik) kunlar</h2>
        </div>
        <p className="mb-4 text-sm text-muted">
          Har bir metodbirlashma uchun bitta kun tanlanadi — o'sha kuni shu guruhning{' '}
          <b>barcha o'qituvchilariga</b> dars qo'yilmaydi. Kunlarni turli kunlarga taqsimlang: bir
          kunda juda ko'p guruh bo'sh bo'lsa, sinflarni dars bilan to'ldirib bo'lmaydi.
        </p>

        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {specialities.map((sp) => {
            const day = settings.pedagogicalDays[sp]
            const list = teachers.filter((t) => t.speciality === sp)
            const hours = list.reduce((sum, t) => sum + (loads[t.id] ?? 0), 0)
            return (
              <div key={sp} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-fg">{sp}</div>
                  <div className="text-[11px] text-faint">
                    {list.length} o'qituvchi · {hours} soat
                  </div>
                </div>
                <Select
                  size="sm"
                  className="w-32"
                  value={day === undefined ? '' : String(day)}
                  onChange={(v) => setPedagogicalDay(sp, v === '' ? null : +v)}
                  emptyLabel="— yo'q —"
                  options={DAY_NAMES.slice(0, settings.daysSenior).map((d, i) => ({
                    value: String(i),
                    label: d,
                  }))}
                />
              </div>
            )
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line-soft pt-3 text-xs">
          <span className="flex items-center gap-1.5 text-muted">
            <IcoClock className="h-3.5 w-3.5" /> Metodik kun tufayli bo'sh qoladigan soat:
          </span>
          {DAY_NAMES.slice(0, settings.daysSenior).map((d, i) => {
            const share = totalHours ? dayLoad[i] / totalHours : 0
            const heavy = share > 0.3
            const tone = heavy ? 'tint-rose' : dayLoad[i] ? 'tint-indigo' : 'tint-slate'
            return (
              <span
                key={d}
                className={'badge ' + tone}
                title={
                  heavy
                    ? "Bu kuni o'qituvchilarning uchdan biridan ko'pi bo'sh — jadval tuzish qiyinlashadi"
                    : undefined
                }
              >
                {d.slice(0, 3)} {dayLoad[i]} soat
              </span>
            )
          })}
        </div>
      </div>

      {/* Yangi shart qo'shish */}
      <div className="card mt-5 p-5">
        <h2 className="mb-3 font-semibold text-fg">Yangi shart qo'shish</h2>
        <div className="grid gap-3 md:grid-cols-4">
          <Field label="Shart turi">
            <Select
              value={kind}
              onChange={(v) => setKind(v as RuleKind)}
              options={KINDS.map((k) => ({ value: k, label: RULE_LABELS[k] }))}
            />
          </Field>

          {needsTeacher && (
            <Field label="O'qituvchi">
              <Select
                value={teacherId}
                onChange={setTeacherId}
                emptyLabel="— tanlang —"
                options={teachers.map((t) => ({
                  value: t.id,
                  label: t.fullName,
                  hint: `${loads[t.id] ?? 0} soat`,
                  group: t.speciality,
                }))}
              />
            </Field>
          )}

          {(kind === 'teacher-day-off' || kind === 'teacher-slot-off') && (
            <Field label="Kun">
              <Select
                value={String(day)}
                onChange={(v) => setDay(+v)}
                options={DAY_NAMES.slice(0, settings.daysSenior).map((d, i) => ({
                  value: String(i),
                  label: d,
                }))}
              />
            </Field>
          )}

          {kind === 'teacher-slot-off' && (
            <Field label="Soat">
              <Select
                value={String(period)}
                onChange={(v) => setPeriod(+v)}
                options={Array.from({ length: 8 }, (_, i) => ({
                  value: String(i),
                  label: `${i + 1}-soat`,
                }))}
              />
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
          <p className="text-xs text-muted">{KIND_HINT[kind]}</p>
          <button className="btn-primary shrink-0" onClick={submit} disabled={!canAdd}>
            <IcoPlus className="h-4 w-4" /> Shart qo'shish
          </button>
        </div>
      </div>

      {/* Ro'yxat */}
      <div className="mt-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-fg">Kiritilgan shartlar</h2>
          <div className="relative">
            <IcoSearch className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
            <input
              className="input w-56 pl-8"
              placeholder="Qidirish..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
        </div>

        {rules.length === 0 && <Empty text="Hali shart qo'shilmagan." />}

        <div className="space-y-3">
          {grouped.map(([tid, list]) => {
            const t = teachers.find((x) => x.id === tid)
            const c = t ? constraints[t.id] : undefined
            return (
              <div key={tid} className="card overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-raised px-4 py-2">
                  <h3 className="text-sm font-semibold text-fg-2">{t ? t.fullName : 'Umumiy izohlar'}</h3>
                  {t && (
                    <div className="flex gap-3 text-xs text-muted">
                      <span>
                        Yuklama: <b className="text-fg-2">{loads[t.id] ?? 0}</b> soat
                        {c?.targetHours !== undefined && (
                          <span className={loads[t.id] === c.targetHours ? ' text-emerald-600 dark:text-emerald-400' : ' text-amber-600 dark:text-amber-400'}>
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
                <ul className="divide-y divide-line-soft">
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
                          r.kind === 'note' ? 'bg-line-soft text-fg-2' : 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300'
                        }`}
                      >
                        {RULE_LABELS[r.kind]}
                      </span>
                      <span className={`flex-1 text-sm ${r.active ? 'text-fg-2' : 'text-faint line-through'}`}>
                        {describeRule(r, tName.get(r.teacherId ?? ''))}
                        {r.note && r.kind !== 'note' && (
                          <span className="ml-2 text-xs text-faint">— {r.note}</span>
                        )}
                      </span>
                      <button
                        className="grid h-6 w-6 shrink-0 place-items-center rounded text-faint transition-colors hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400"
                        onClick={() => removeRule(r.id)}
                        title="O'chirish"
                      >
                        <IcoTrash className="h-3.5 w-3.5" />
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
