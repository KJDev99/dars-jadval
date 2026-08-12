import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { Field, Modal, Page, PageHeader } from '../components/ui'
import { SUBJECTS, SUBJECT_BY_ID, YONALISHLAR } from '../data/curriculum'
import { teacherLoads } from '../lib/derive'
import { DAY_NAMES } from '../types'
import type { Teacher } from '../types'
import { SPECIALITY_SPEC } from '../data/seed'

const blank = (): Omit<Teacher, 'id'> => ({
  fullName: '',
  speciality: '',
  subjectIds: [],
  minHours: 4,
  maxHours: 24,
  unavailableDays: [],
})

export default function TeachersPage() {
  const { teachers, classes, assignments, overrides, addTeacher, updateTeacher, removeTeacher } = useStore()
  const [editing, setEditing] = useState<Teacher | null>(null)
  const [creating, setCreating] = useState<Omit<Teacher, 'id'> | null>(null)
  const [q, setQ] = useState('')
  const [filterSubject, setFilterSubject] = useState('')

  const loads = useMemo(
    () => teacherLoads(teachers, classes, assignments, overrides),
    [teachers, classes, assignments, overrides],
  )

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return teachers.filter(
      (t) =>
        (!s || t.fullName.toLowerCase().includes(s) || t.speciality.toLowerCase().includes(s)) &&
        (!filterSubject || t.subjectIds.includes(filterSubject)),
    )
  }, [teachers, q, filterSubject])

  const grouped = useMemo(() => {
    const m = new Map<string, Teacher[]>()
    for (const t of filtered) {
      const k = t.speciality || 'Boshqa'
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(t)
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [filtered])

  const form = editing ?? creating
  const setForm = (patch: Partial<Teacher>) => {
    if (editing) setEditing({ ...editing, ...patch })
    else if (creating) setCreating({ ...creating, ...patch })
  }

  const save = () => {
    if (!form || !form.fullName.trim()) return
    if (editing) updateTeacher(editing.id, editing)
    else if (creating) addTeacher(creating)
    setEditing(null)
    setCreating(null)
  }

  return (
    <Page>
      <PageHeader
        title="O'qituvchilar"
        subtitle="Har bir o'qituvchi ma'lum fan bo'yicha mutaxassis. Haftalik yuklama chegarasi: minimal 4, maksimal 24 soat."
        actions={
          <>
            <input
              className="input w-52"
              placeholder="Qidirish..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select className="input w-52" value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)}>
              <option value="">Barcha fanlar</option>
              {SUBJECTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <button className="btn-primary" onClick={() => setCreating(blank())}>
              + O'qituvchi
            </button>
          </>
        }
      />

      <div className="mb-3 flex flex-wrap gap-3 text-sm text-slate-500">
        <span>
          Jami: <b className="text-slate-800">{teachers.length}</b>
        </span>
        <span>
          Ko'rsatilmoqda: <b className="text-slate-800">{filtered.length}</b>
        </span>
        <span>
          Umumiy yuklama:{' '}
          <b className="text-slate-800">{Object.values(loads).reduce((a, b) => a + b, 0)}</b> soat
        </span>
      </div>

      <div className="space-y-4">
        {grouped.map(([spec, list]) => (
          <div key={spec} className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2">
              <h2 className="text-sm font-semibold text-slate-700">{spec}</h2>
              <span className="text-xs text-slate-500">{list.length} ta</span>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="th">F.I.Sh.</th>
                  <th className="th">Fanlari</th>
                  <th className="th">Band kunlar</th>
                  <th className="th text-center">Yuklama</th>
                  <th className="th text-center">Chegara</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody>
                {list.map((t) => {
                  const load = loads[t.id] ?? 0
                  const bad = load > t.maxHours
                  const low = load > 0 && load < t.minHours
                  return (
                    <tr key={t.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                      <td className="td">
                        <button className="font-medium text-slate-800 hover:text-indigo-600" onClick={() => setEditing(t)}>
                          {t.fullName}
                        </button>
                        {t.homeroomClassId && (
                          <span className="badge ml-2 bg-indigo-50 text-indigo-700">
                            {t.homeroomClassId} sinf rahbari
                          </span>
                        )}
                      </td>
                      <td className="td">
                        <div className="flex flex-wrap gap-1">
                          {t.subjectIds.slice(0, 5).map((sid) => (
                            <span
                              key={sid}
                              className="badge"
                              style={{
                                background: (SUBJECT_BY_ID[sid]?.color ?? '#94a3b8') + '22',
                                color: SUBJECT_BY_ID[sid]?.color ?? '#475569',
                              }}
                            >
                              {SUBJECT_BY_ID[sid]?.short ?? sid}
                            </span>
                          ))}
                          {t.subjectIds.length > 5 && (
                            <span className="badge bg-slate-100 text-slate-500">+{t.subjectIds.length - 5}</span>
                          )}
                        </div>
                      </td>
                      <td className="td text-xs text-slate-500">
                        {t.unavailableDays.length
                          ? t.unavailableDays.map((d) => DAY_NAMES[d]?.slice(0, 3)).join(', ')
                          : '—'}
                      </td>
                      <td
                        className={`td text-center font-semibold ${
                          bad ? 'text-rose-600' : low ? 'text-amber-600' : 'text-slate-700'
                        }`}
                      >
                        {load}
                      </td>
                      <td className="td text-center text-xs text-slate-400">
                        {t.minHours}–{t.maxHours}
                      </td>
                      <td className="td text-right">
                        <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setEditing(t)}>
                          Tahrirlash
                        </button>
                        <button
                          className="ml-1 rounded px-1.5 py-1 text-slate-300 hover:bg-rose-50 hover:text-rose-600"
                          onClick={() => {
                            if (confirm(`${t.fullName} o'chirilsinmi?`)) removeTeacher(t.id)
                          }}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      <Modal
        open={!!form}
        onClose={() => {
          setEditing(null)
          setCreating(null)
        }}
        wide
        title={editing ? "O'qituvchini tahrirlash" : "Yangi o'qituvchi"}
      >
        {form && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="F.I.Sh.">
                <input
                  className="input"
                  value={form.fullName}
                  onChange={(e) => setForm({ fullName: e.target.value })}
                  placeholder="Karimova Nigora Alisher qizi"
                />
              </Field>
              <Field label="Mutaxassislik">
                <input
                  className="input"
                  list="spec-list"
                  value={form.speciality}
                  onChange={(e) => {
                    const spec = SPECIALITY_SPEC.find((s) => s.speciality === e.target.value)
                    setForm({
                      speciality: e.target.value,
                      ...(spec && form.subjectIds.length === 0 ? { subjectIds: [...spec.subjectIds] } : {}),
                    })
                  }}
                />
                <datalist id="spec-list">
                  {SPECIALITY_SPEC.map((s) => (
                    <option key={s.speciality} value={s.speciality} />
                  ))}
                  <option value="Boshlang'ich ta'lim" />
                </datalist>
              </Field>
              <Field label="Minimal haftalik soat">
                <input
                  type="number"
                  min={0}
                  max={40}
                  className="input"
                  value={form.minHours}
                  onChange={(e) => setForm({ minHours: +e.target.value })}
                />
              </Field>
              <Field label="Maksimal haftalik soat">
                <input
                  type="number"
                  min={1}
                  max={40}
                  className="input"
                  value={form.maxHours}
                  onChange={(e) => setForm({ maxHours: +e.target.value })}
                />
              </Field>
              <Field label="Sinf rahbari (boshlang'ich sinf uchun)" hint="Belgilansa, faqat shu sinfga dars beradi">
                <select
                  className="input"
                  value={form.homeroomClassId ?? ''}
                  onChange={(e) => setForm({ homeroomClassId: e.target.value || undefined })}
                >
                  <option value="">— yo'q —</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.grade}-{c.letter}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Band kunlar" hint="Bu kunlarda dars qo'yilmaydi">
                <div className="flex flex-wrap gap-1 pt-1">
                  {DAY_NAMES.map((d, i) => {
                    const on = form.unavailableDays.includes(i)
                    return (
                      <button
                        key={d}
                        type="button"
                        className={`rounded-md border px-2 py-1 text-xs ${
                          on ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-slate-200 text-slate-500'
                        }`}
                        onClick={() =>
                          setForm({
                            unavailableDays: on
                              ? form.unavailableDays.filter((x) => x !== i)
                              : [...form.unavailableDays, i].sort(),
                          })
                        }
                      >
                        {d.slice(0, 3)}
                      </button>
                    )
                  })}
                </div>
              </Field>
            </div>

            <div>
              <div className="mb-2 text-xs font-medium text-slate-600">
                O'qita oladigan fanlar ({form.subjectIds.length})
              </div>
              <div className="max-h-72 space-y-3 overflow-y-auto rounded-lg border border-slate-200 p-3">
                {YONALISHLAR.map((y) => (
                  <div key={y}>
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{y}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {SUBJECTS.filter((s) => s.yonalish === y).map((s) => {
                        const on = form.subjectIds.includes(s.id)
                        return (
                          <button
                            key={s.id}
                            type="button"
                            className={`rounded-md border px-2 py-1 text-xs transition ${
                              on
                                ? 'border-transparent text-white'
                                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                            }`}
                            style={on ? { background: s.color } : undefined}
                            onClick={() =>
                              setForm({
                                subjectIds: on
                                  ? form.subjectIds.filter((x) => x !== s.id)
                                  : [...form.subjectIds, s.id],
                              })
                            }
                          >
                            {s.name}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
              <button
                className="btn-ghost"
                onClick={() => {
                  setEditing(null)
                  setCreating(null)
                }}
              >
                Bekor qilish
              </button>
              <button className="btn-primary" onClick={save}>
                Saqlash
              </button>
            </div>
          </div>
        )}
      </Modal>
    </Page>
  )
}
