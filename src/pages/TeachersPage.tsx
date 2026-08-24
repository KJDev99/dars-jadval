import { useMemo, useState } from 'react'
import Select from '../components/Select'
import { useStore } from '../store'
import { Field, Modal, Page, PageHeader } from '../components/ui'
import { SUBJECTS, SUBJECT_BY_ID, YONALISHLAR } from '../data/curriculum'
import { teacherLoads } from '../lib/derive'
import { CATEGORY_LABELS, CATEGORY_ORDER, CATEGORY_RANK, CATEGORY_SHORT, DAY_NAMES } from '../types'
import type { Teacher, TeacherCategory } from '../types'
import { formatStavka } from '../lib/derive'
import { useIsDark, tintOf } from '../lib/theme'
import { IcoPlus, IcoSearch, IcoEdit, IcoTrash, IcoCategory, IcoExcel } from '../components/icons'
import { SPECIALITY_SPEC } from '../data/seed'
import { exportExcel } from '../lib/excel'

/** Toifa nishoni rangi */
const CAT_TINT: Record<TeacherCategory, string> = {
  oliy: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300',
  birinchi: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  ikkinchi: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  yoq: 'bg-line-soft text-muted',
}

const blank = (): Omit<Teacher, 'id'> => ({
  fullName: '',
  speciality: '',
  category: 'yoq',
  subjectIds: [],
  minHours: 4,
  maxHours: 24,
  unavailableDays: [],
})

export default function TeachersPage() {
  const { teachers, classes, assignments, overrides, settings, addTeacher, updateTeacher, removeTeacher } =
    useStore()
  const [editing, setEditing] = useState<Teacher | null>(null)
  const [creating, setCreating] = useState<Omit<Teacher, 'id'> | null>(null)
  const [q, setQ] = useState('')
  const [filterSubject, setFilterSubject] = useState('')
  const [filterCat, setFilterCat] = useState<TeacherCategory | ''>('')
  const dark = useIsDark(useStore((s) => s.settings.theme) ?? 'system')

  const loads = useMemo(
    () => teacherLoads(teachers, classes, assignments, overrides),
    [teachers, classes, assignments, overrides],
  )

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return teachers.filter(
      (t) =>
        (!s || t.fullName.toLowerCase().includes(s) || t.speciality.toLowerCase().includes(s)) &&
        (!filterSubject || t.subjectIds.includes(filterSubject)) &&
        (!filterCat || t.category === filterCat),
    )
  }, [teachers, q, filterSubject, filterCat])

  const grouped = useMemo(() => {
    const m = new Map<string, Teacher[]>()
    for (const t of filtered) {
      const k = t.speciality || 'Boshqa'
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(t)
    }
    for (const list of m.values()) {
      list.sort(
        (x, y) =>
          CATEGORY_RANK[x.category ?? 'yoq'] - CATEGORY_RANK[y.category ?? 'yoq'] ||
          x.fullName.localeCompare(y.fullName),
      )
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
            <div className="relative">
              <IcoSearch className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
              <input
                className="input w-48 pl-8"
                placeholder="Qidirish..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <Select
              className="w-40"
              value={filterCat}
              onChange={(v) => setFilterCat(v as TeacherCategory | '')}
              emptyLabel="Barcha toifalar"
              options={CATEGORY_ORDER.map((c) => ({
                value: c,
                label: CATEGORY_LABELS[c],
                hint: String(teachers.filter((t) => (t.category ?? 'yoq') === c).length),
              }))}
            />
            <Select
              className="w-48"
              value={filterSubject}
              onChange={setFilterSubject}
              emptyLabel="Barcha fanlar"
              options={SUBJECTS.map((s) => ({
                value: s.id,
                label: s.name,
                color: s.color,
                group: s.yonalish,
              }))}
            />
            <button
              className="btn-ghost"
              title="O'qituvchilar ro'yxati, toifasi va tarifikatsiyasini Excelga chiqarish"
              onClick={() => void exportExcel({ classes, teachers, assignments, overrides, settings })}
            >
              <IcoExcel className="h-4 w-4" /> Excel
            </button>
            <button className="btn-primary" onClick={() => setCreating(blank())}>
              <IcoPlus className="h-4 w-4" /> O'qituvchi
            </button>
          </>
        }
      />

      <div className="mb-3 flex flex-wrap gap-3 text-sm text-muted">
        <span>
          Jami: <b className="text-fg">{teachers.length}</b>
        </span>
        <span>
          Ko'rsatilmoqda: <b className="text-fg">{filtered.length}</b>
        </span>
        <span>
          Umumiy yuklama:{' '}
          <b className="text-fg">{Object.values(loads).reduce((a, b) => a + b, 0)}</b> soat
        </span>
        <span className="flex items-center gap-1.5">
          <IcoCategory className="h-3.5 w-3.5 text-faint" />
          {CATEGORY_ORDER.map((c) => (
            <span key={c} className={`badge ${CAT_TINT[c]}`}>
              {CATEGORY_SHORT[c]} {teachers.filter((t) => (t.category ?? 'yoq') === c).length}
            </span>
          ))}
        </span>
      </div>

      <div className="space-y-4">
        {grouped.map(([spec, list]) => (
          <div key={spec} className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-line bg-raised px-4 py-2">
              <h2 className="text-sm font-semibold text-fg-2">{spec}</h2>
              <span className="text-xs text-muted">{list.length} ta</span>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-line-soft">
                  <th className="th">F.I.Sh.</th>
                  <th className="th">Toifa</th>
                  <th className="th">Fanlari</th>
                  <th className="th">Bo‘sh kunlar</th>
                  <th className="th text-center">Yuklama</th>
                  <th className="th text-center">Stavka</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody>
                {list.map((t) => {
                  const load = loads[t.id] ?? 0
                  const bad = load > t.maxHours
                  const low = load > 0 && load < t.minHours
                  return (
                    <tr key={t.id} className="border-b border-line-soft last:border-0 hover:bg-raised">
                      <td className="td">
                        <button className="font-medium text-fg hover:text-indigo-600 dark:hover:text-indigo-400" onClick={() => setEditing(t)}>
                          {t.fullName}
                        </button>
                        {t.homeroomClassId && (
                          <span className="badge ml-2 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300">
                            {t.homeroomClassId} sinf rahbari
                          </span>
                        )}
                      </td>
                      <td className="td">
                        <span className={`badge ${CAT_TINT[t.category ?? 'yoq']}`}>
                          {CATEGORY_LABELS[t.category ?? 'yoq']}
                        </span>
                      </td>
                      <td className="td">
                        <div className="flex flex-wrap gap-1">
                          {t.subjectIds.slice(0, 5).map((sid) => (
                            <span
                              key={sid}
                              className="badge"
                              style={{
                                background: tintOf(SUBJECT_BY_ID[sid]?.color ?? '#94a3b8', dark),
                                color: SUBJECT_BY_ID[sid]?.color ?? '#475569',
                              }}
                            >
                              {SUBJECT_BY_ID[sid]?.short ?? sid}
                            </span>
                          ))}
                          {t.subjectIds.length > 5 && (
                            <span className="badge bg-line-soft text-muted">+{t.subjectIds.length - 5}</span>
                          )}
                        </div>
                      </td>
                      <td className="td text-xs text-muted">
                        <div className="flex flex-wrap items-center gap-1">
                          {settings.pedagogicalDays[t.speciality] !== undefined && (
                            <span
                              className="badge tint-indigo"
                              title="Metodbirlashmaning metodik kuni"
                            >
                              {DAY_NAMES[settings.pedagogicalDays[t.speciality]].slice(0, 3)} metodik
                            </span>
                          )}
                          {t.unavailableDays.map((d) => (
                            <span key={d} className="badge tint-rose">
                              {DAY_NAMES[d]?.slice(0, 3)}
                            </span>
                          ))}
                          {settings.pedagogicalDays[t.speciality] === undefined &&
                            t.unavailableDays.length === 0 && <span>—</span>}
                        </div>
                      </td>
                      <td
                        className={`td text-center font-semibold ${
                          bad ? 'text-rose-600 dark:text-rose-400' : low ? 'text-amber-600 dark:text-amber-400' : 'text-fg-2'
                        }`}
                      >
                        {load}
                      </td>
                      <td className="td text-center text-xs text-faint" title={`Chegara: ${t.minHours}–${t.maxHours} soat`}>
                        {load > 0 ? formatStavka(load, settings.stavkaHours) : '—'}
                      </td>
                      <td className="td text-right">
                        <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setEditing(t)}>
                          <IcoEdit className="h-3 w-3" /> Tahrirlash
                        </button>
                        <button
                          className="ml-1 rounded px-1.5 py-1 text-faint hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400"
                          title="O'chirish"
                          onClick={() => {
                            if (confirm(`${t.fullName} o'chirilsinmi?`)) removeTeacher(t.id)
                          }}
                        >
                          <IcoTrash className="h-3.5 w-3.5" />
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
              <Field label="Malaka toifasi" hint="Dars taqsimotida ustuvorlikni belgilaydi">
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {CATEGORY_ORDER.map((c) => {
                    const on = (form.category ?? 'yoq') === c
                    return (
                      <button
                        key={c}
                        type="button"
                        className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                          on
                            ? 'border-indigo-500/60 bg-indigo-500/15 text-indigo-700 dark:text-indigo-300'
                            : 'border-line text-muted hover:border-line-strong hover:text-fg-2'
                        }`}
                        onClick={() => setForm({ category: c })}
                      >
                        {CATEGORY_LABELS[c]}
                      </button>
                    )
                  })}
                </div>
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
              <Field
                label="Sinf rahbari"
                hint="Sinf rahbari o'z sinfida haftada 1 soat Ma'naviyat soatini o'tadi"
              >
                <Select
                  value={form.homeroomClassId ?? ''}
                  onChange={(v) => setForm({ homeroomClassId: v || undefined })}
                  emptyLabel="— yo'q —"
                  options={classes.map((c) => {
                    const busy = teachers.find(
                      (t) => t.homeroomClassId === c.id && t.id !== (editing?.id ?? ''),
                    )
                    return {
                      value: c.id,
                      label: `${c.grade}-${c.letter}`,
                      hint: busy ? 'band' : undefined,
                      disabled: !!busy,
                    }
                  })}
                />
              </Field>
              <Field
                label="Dars berish doirasi"
                hint="Boshlang'ich sinf o'qituvchilari faqat o'z sinfiga dars beradi"
              >
                <label className="mt-1.5 flex cursor-pointer items-center gap-2 text-sm text-fg-2">
                  <input
                    type="checkbox"
                    checked={!!form.restrictedToHomeroom}
                    disabled={!form.homeroomClassId}
                    onChange={(e) => setForm({ restrictedToHomeroom: e.target.checked })}
                  />
                  Faqat o'z sinfiga dars beradi
                </label>
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
                          on ? 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300' : 'border-line text-muted'
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
              <div className="mb-2 text-xs font-medium text-fg-2">
                O'qita oladigan fanlar ({form.subjectIds.length})
              </div>
              <div className="max-h-72 space-y-3 overflow-y-auto rounded-lg border border-line p-3">
                {YONALISHLAR.map((y) => (
                  <div key={y}>
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-faint">{y}</div>
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
                                : 'border-line bg-surface text-fg-2 hover:border-line-strong'
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

            <div className="flex justify-end gap-2 border-t border-line pt-3">
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
