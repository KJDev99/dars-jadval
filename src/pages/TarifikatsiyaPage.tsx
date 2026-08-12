import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { Field, Modal, Page, PageHeader } from '../components/ui'
import { SUBJECTS, SUBJECT_BY_ID } from '../data/curriculum'
import { asgKey, classSubjects, effectiveHours, teacherLoads } from '../lib/derive'
import { resolveTeacherConstraints } from '../lib/rules'
import { applyTransfer, autoAssign, checkTransfer, teacherWorkload } from '../scheduler/assign'
import { exportTarifikatsiyaCsv } from '../lib/export'

export default function TarifikatsiyaPage() {
  const {
    classes, teachers, overrides, assignments, settings, rules,
    setAssignment, setAssignments, updateTeacher,
  } = useStore()
  const [view, setView] = useState<'class' | 'teacher'>('class')
  const [keepManual, setKeepManual] = useState(true)
  const [result, setResult] = useState<{ problems: string[]; warnings: string[] } | null>(null)
  const [transferOpen, setTransferOpen] = useState(false)

  const constraints = useMemo(() => resolveTeacherConstraints(teachers, rules), [teachers, rules])

  const loads = useMemo(
    () => teacherLoads(teachers, classes, assignments, overrides),
    [teachers, classes, assignments, overrides],
  )

  const missing = useMemo(() => {
    let n = 0
    for (const c of classes) {
      for (const s of SUBJECTS) {
        if (effectiveHours(c, s.id, overrides) > 0 && !assignments[asgKey(c.id, s.id)]) n++
      }
    }
    return n
  }, [classes, overrides, assignments])

  const run = () => {
    const r = autoAssign(classes, teachers, overrides, assignments, keepManual, settings.seed, constraints)
    setAssignments(r.assignments)
    setResult({ problems: r.problems, warnings: r.warnings })
  }

  const teacherRows = useMemo(() => {
    return teachers
      .map((t) => {
        const items: string[] = []
        for (const c of classes) {
          const subs: string[] = []
          for (const s of SUBJECTS) {
            if (assignments[asgKey(c.id, s.id)] === t.id) {
              subs.push(`${s.short} ${effectiveHours(c, s.id, overrides)}s`)
            }
          }
          if (subs.length) items.push(`${c.grade}-${c.letter}: ${subs.join(', ')}`)
        }
        return { teacher: t, items, hours: loads[t.id] ?? 0 }
      })
      .sort((a, b) => b.hours - a.hours)
  }, [teachers, classes, assignments, overrides, loads])

  return (
    <Page>
      <PageHeader
        title="Tarifikatsiya — dars taqsimoti"
        subtitle="Har bir sinfning har bir faniga o'qituvchi biriktiriladi. Avtomatik taqsimlashda yuklama teng bo'linadi va parallel sinflar bir o'qituvchiga berilishi ustuvor hisoblanadi."
        actions={
          <>
            <label className="flex items-center gap-1.5 text-xs text-slate-600">
              <input type="checkbox" checked={keepManual} onChange={(e) => setKeepManual(e.target.checked)} />
              Qo'lda kiritilganlarni saqlash
            </label>
            <button className="btn-primary" onClick={run}>
              ⚙ Avtomatik taqsimlash
            </button>
            <button className="btn-ghost" onClick={() => setTransferOpen(true)}>
              ⇄ Darslarni o'tkazish
            </button>
            <button
              className="btn-ghost"
              onClick={() =>
                exportTarifikatsiyaCsv(
                  teacherRows.map((r) => ({
                    teacher: r.teacher.fullName,
                    speciality: r.teacher.speciality,
                    items: r.items.join('; '),
                    hours: r.hours,
                  })),
                  settings.schoolName,
                )
              }
            >
              ⤓ CSV
            </button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <div className="inline-flex overflow-hidden rounded-lg border border-slate-300">
          <button
            className={`px-3 py-1.5 text-sm ${view === 'class' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600'}`}
            onClick={() => setView('class')}
          >
            Sinflar kesimida
          </button>
          <button
            className={`px-3 py-1.5 text-sm ${view === 'teacher' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600'}`}
            onClick={() => setView('teacher')}
          >
            O'qituvchilar kesimida
          </button>
        </div>
        <span className={missing > 0 ? 'text-rose-600' : 'text-emerald-600'}>
          {missing > 0 ? `${missing} ta fan biriktirilmagan` : 'Barcha fanlar biriktirilgan ✓'}
        </span>
      </div>

      {result && (result.problems.length > 0 || result.warnings.length > 0) && (
        <div className="mb-4 space-y-2">
          {result.problems.length > 0 && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              <b>Muammolar ({result.problems.length}):</b>
              <ul className="mt-1 max-h-40 list-disc overflow-y-auto pl-5">
                {result.problems.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
          )}
          {result.warnings.length > 0 && (
            <details className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <summary className="cursor-pointer font-semibold">
                Ogohlantirishlar ({result.warnings.length})
              </summary>
              <ul className="mt-1 max-h-40 list-disc overflow-y-auto pl-5">
                {result.warnings.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {view === 'class' ? (
        <div className="space-y-3">
          {classes.map((c) => (
            <div key={c.id} className="card p-4">
              <div className="mb-2 flex items-baseline gap-2">
                <h3 className="font-semibold text-slate-900">
                  {c.grade}-{c.letter}
                </h3>
                <span className="text-xs text-slate-500">
                  {classSubjects(c, overrides).length} fan ·{' '}
                  {classSubjects(c, overrides).reduce((s, x) => s + x.hours, 0)} soat
                </span>
              </div>
              <div className="grid gap-1.5 md:grid-cols-2 xl:grid-cols-3">
                {classSubjects(c, overrides).map(({ subject, hours }) => {
                  const cur = assignments[asgKey(c.id, subject.id)] ?? ''
                  const cands = teachers.filter(
                    (t) => t.subjectIds.includes(subject.id) && (!t.homeroomClassId || t.homeroomClassId === c.id),
                  )
                  return (
                    <div key={subject.id} className="flex items-center gap-1.5">
                      <span
                        className="w-32 shrink-0 truncate text-xs text-slate-600"
                        title={`${subject.name} — ${hours} soat`}
                      >
                        <span
                          className="mr-1 inline-block h-2 w-2 rounded-sm align-middle"
                          style={{ background: subject.color }}
                        />
                        {subject.short} <span className="text-slate-400">{hours}s</span>
                      </span>
                      <select
                        className={`input py-1 text-xs ${!cur ? 'border-rose-300 bg-rose-50' : ''}`}
                        value={cur}
                        onChange={(e) => setAssignment(c.id, subject.id, e.target.value || null)}
                      >
                        <option value="">— tanlanmagan —</option>
                        {cands.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.fullName} ({loads[t.id] ?? 0}s)
                          </option>
                        ))}
                      </select>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="th">№</th>
                <th className="th">O'qituvchi</th>
                <th className="th">Mutaxassislik</th>
                <th className="th">Sinf va fanlar</th>
                <th className="th text-center">Soat</th>
              </tr>
            </thead>
            <tbody>
              {teacherRows.map((r, i) => (
                <tr key={r.teacher.id} className="border-b border-slate-50 align-top hover:bg-slate-50/60">
                  <td className="td text-slate-400">{i + 1}</td>
                  <td className="td font-medium">{r.teacher.fullName}</td>
                  <td className="td text-xs text-slate-500">{r.teacher.speciality}</td>
                  <td className="td text-xs text-slate-600">{r.items.join(' · ') || '—'}</td>
                  <td
                    className={`td text-center font-semibold ${
                      r.hours > r.teacher.maxHours
                        ? 'text-rose-600'
                        : r.hours > 0 && r.hours < r.teacher.minHours
                          ? 'text-amber-600'
                          : 'text-slate-700'
                    }`}
                  >
                    {r.hours}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <TransferModal
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        onApply={(next, addSubjectsTo) => {
          if (addSubjectsTo) updateTeacher(addSubjectsTo.id, { subjectIds: addSubjectsTo.subjectIds })
          setAssignments(next)
          setTransferOpen(false)
        }}
      />
    </Page>
  )
}

/* ───────────────────── Darslarni o'tkazish oynasi ───────────────────── */
function TransferModal({
  open,
  onClose,
  onApply,
}: {
  open: boolean
  onClose: () => void
  onApply: (next: Record<string, string>, addSubjectsTo?: { id: string; subjectIds: string[] }) => void
}) {
  const { classes, teachers, overrides, assignments, rules } = useStore()
  const [fromId, setFromId] = useState('')
  const [toId, setToId] = useState('')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [grantSubjects, setGrantSubjects] = useState(true)

  const constraints = useMemo(() => resolveTeacherConstraints(teachers, rules), [teachers, rules])
  const loads = useMemo(
    () => teacherLoads(teachers, classes, assignments, overrides),
    [teachers, classes, assignments, overrides],
  )

  const items = useMemo(
    () => (fromId ? teacherWorkload(fromId, classes, assignments, overrides) : []),
    [fromId, classes, assignments, overrides],
  )

  const selected = useMemo(
    () => items.filter((i) => picked.has(`${i.classId}|${i.subjectId}`)),
    [items, picked],
  )

  const to = teachers.find((t) => t.id === toId)
  const check = useMemo(
    () => (to ? checkTransfer(to, selected, loads[to.id] ?? 0, constraints) : null),
    [to, selected, loads, constraints],
  )

  const reset = () => {
    setPicked(new Set())
  }

  return (
    <Modal open={open} onClose={onClose} wide title="Darslarni boshqa o'qituvchiga o'tkazish">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Kimdan">
          <select
            className="input"
            value={fromId}
            onChange={(e) => {
              setFromId(e.target.value)
              reset()
            }}
          >
            <option value="">— tanlang —</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.fullName} ({loads[t.id] ?? 0} soat)
              </option>
            ))}
          </select>
        </Field>
        <Field label="Kimga">
          <select className="input" value={toId} onChange={(e) => setToId(e.target.value)}>
            <option value="">— tanlang —</option>
            {teachers
              .filter((t) => t.id !== fromId)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.fullName} ({loads[t.id] ?? 0} soat) — {t.speciality}
                </option>
              ))}
          </select>
        </Field>
      </div>

      {fromId && (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600">
              O'tkaziladigan darslar ({selected.length}/{items.length} tanlandi,{' '}
              {selected.reduce((s, i) => s + i.hours, 0)} soat)
            </span>
            <div className="flex gap-2">
              <button
                className="btn-ghost px-2 py-0.5 text-xs"
                onClick={() => setPicked(new Set(items.map((i) => `${i.classId}|${i.subjectId}`)))}
              >
                Hammasi
              </button>
              <button className="btn-ghost px-2 py-0.5 text-xs" onClick={reset}>
                Tozalash
              </button>
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200">
            {items.length === 0 && <p className="p-3 text-sm text-slate-400">Bu o'qituvchida dars yo'q.</p>}
            {items.map((i) => {
              const key = `${i.classId}|${i.subjectId}`
              const cls = classes.find((c) => c.id === i.classId)
              const on = picked.has(key)
              return (
                <label
                  key={key}
                  className="flex cursor-pointer items-center gap-2 border-b border-slate-50 px-3 py-1.5 text-sm last:border-0 hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => {
                      const next = new Set(picked)
                      if (on) next.delete(key)
                      else next.add(key)
                      setPicked(next)
                    }}
                  />
                  <span className="w-14 font-medium text-slate-700">
                    {cls ? `${cls.grade}-${cls.letter}` : i.classId}
                  </span>
                  <span
                    className="mr-1 inline-block h-2 w-2 rounded-sm"
                    style={{ background: SUBJECT_BY_ID[i.subjectId]?.color }}
                  />
                  <span className="flex-1 text-slate-600">{SUBJECT_BY_ID[i.subjectId]?.name ?? i.subjectId}</span>
                  <span className="text-xs text-slate-400">{i.hours} soat</span>
                </label>
              )
            })}
          </div>
        </div>
      )}

      {check && selected.length > 0 && (
        <div
          className={`mt-4 rounded-lg border p-3 text-sm ${
            check.ok || (grantSubjects && !check.overload)
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-amber-200 bg-amber-50 text-amber-800'
          }`}
        >
          <div>
            Yangi yuklama: <b>{check.newLoad}</b> soat (chegara {check.limit})
            {check.overload && <span className="font-semibold"> — chegaradan oshadi!</span>}
          </div>
          {check.missingSubjects.length > 0 && (
            <div className="mt-1">
              Qabul qiluvchi bu fanlar bo'yicha mutaxassis emas:{' '}
              <b>{check.missingSubjects.map((s) => SUBJECT_BY_ID[s]?.name ?? s).join(', ')}</b>
              <label className="mt-1 flex items-center gap-1.5">
                <input type="checkbox" checked={grantSubjects} onChange={(e) => setGrantSubjects(e.target.checked)} />
                <span className="text-xs">Bu fanlarni uning mutaxassisliklariga qo'shish</span>
              </label>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 flex justify-end gap-2 border-t border-slate-200 pt-3">
        <button className="btn-ghost" onClick={onClose}>
          Bekor qilish
        </button>
        <button
          className="btn-primary"
          disabled={!to || selected.length === 0 || (!!check?.missingSubjects.length && !grantSubjects)}
          onClick={() => {
            if (!to) return
            const next = applyTransfer(assignments, selected, to.id)
            const addSubjects =
              grantSubjects && check && check.missingSubjects.length > 0
                ? { id: to.id, subjectIds: [...new Set([...to.subjectIds, ...check.missingSubjects])] }
                : undefined
            onApply(next, addSubjects)
            reset()
          }}
        >
          O'tkazish
        </button>
      </div>

      <p className="mt-3 text-xs text-slate-500">
        O'tkazgandan keyin «Jadval yaratish» bo'limida <b>Qayta hisoblash</b> tugmasini bosing — jadval to'liq
        qayta tuzilmaydi, faqat yangi o'qituvchining to'qnashuv va oynalari to'g'rilanadi.
      </p>
    </Modal>
  )
}
