import { useMemo, useState } from 'react'
import Select from '../components/Select'
import { IcoAuto, IcoTransfer, IcoDownload } from '../components/icons'
import { useStore } from '../store'
import { Field, Modal, Page, PageHeader } from '../components/ui'
import { SUBJECTS, SUBJECT_BY_ID } from '../data/curriculum'
import { CATEGORY_LABELS, CATEGORY_ORDER, CATEGORY_RANK, CATEGORY_SHORT } from '../types'
import type { TeacherCategory } from '../types'
import { formatStavka } from '../lib/derive'
import { asgKey, classSubjects, effectiveHours, teacherLoads } from '../lib/derive'
import { resolveTeacherConstraints } from '../lib/rules'
import { applyTransfer, autoAssign, checkTransfer, teacherWorkload } from '../scheduler/assign'
import { exportTarifikatsiyaCsv } from '../lib/export'

const CAT_TINT: Record<TeacherCategory, string> = {
  oliy: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300',
  birinchi: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  ikkinchi: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  yoq: 'bg-line-soft text-muted',
}

export default function TarifikatsiyaPage() {
  const {
    classes, teachers, overrides, assignments, settings, rules,
    setAssignment, setAssignments, updateTeacher,
  } = useStore()
  const [view, setView] = useState<'class' | 'teacher'>('class')
  const [keepManual, setKeepManual] = useState(true)
  const [result, setResult] = useState<{ problems: string[]; warnings: string[] } | null>(null)
  const [transferOpen, setTransferOpen] = useState(false)

  const constraints = useMemo(() => resolveTeacherConstraints(teachers, rules, settings.pedagogicalDays), [teachers, rules, settings.pedagogicalDays])

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

  /** Shtat balansi: jami dars soati necha stavkaga teng va nechta o'qituvchi bo'sh qoladi */
  const balance = useMemo(() => {
    const totalHours = Object.values(loads).reduce((a, b) => a + b, 0)
    const stavkas = totalHours / Math.max(1, settings.stavkaHours)
    const idle = teachers.filter((t) => (loads[t.id] ?? 0) === 0).length
    const belowMin = teachers.filter((t) => {
      const l = loads[t.id] ?? 0
      return l > 0 && l < t.minHours
    }).length
    return { totalHours, stavkas, idle, belowMin }
  }, [loads, teachers, settings.stavkaHours])

  const run = () => {
    const r = autoAssign(classes, teachers, overrides, assignments, keepManual, settings.seed,
      constraints,
      settings.stavkaHours,
    )
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
      .sort(
        (a, b) =>
          CATEGORY_RANK[a.teacher.category ?? 'yoq'] - CATEGORY_RANK[b.teacher.category ?? 'yoq'] ||
          b.hours - a.hours,
      )
  }, [teachers, classes, assignments, overrides, loads])

  return (
    <Page>
      <PageHeader
        title="Tarifikatsiya — dars taqsimoti"
        subtitle={
          <>
            Har bir sinfning har bir faniga o'qituvchi biriktiriladi. Avtomatik taqsimlashda soatlar{' '}
            <b>malaka toifasi bo'yicha</b> taqsimlanadi: avval har bir o'qituvchiga 1 stavka (
            {settings.stavkaHours} soat) — oliy toifadan boshlab, keyin qolgan soatlar yana o'sha tartibda.
          </>
        }
        actions={
          <>
            <label className="flex items-center gap-1.5 text-xs text-fg-2">
              <input type="checkbox" checked={keepManual} onChange={(e) => setKeepManual(e.target.checked)} />
              Qo'lda kiritilganlarni saqlash
            </label>
            <button className="btn-primary" onClick={run}>
              <IcoAuto className="h-4 w-4" /> Avtomatik taqsimlash
            </button>
            <button className="btn-ghost" onClick={() => setTransferOpen(true)}>
              <IcoTransfer className="h-4 w-4" /> Darslarni o'tkazish
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
              <IcoDownload className="h-4 w-4" /> CSV
            </button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <div className="seg">
          <button
            className={`seg-item ${view === 'class' ? 'seg-item-on' : ''}`}
            onClick={() => setView('class')}
          >
            Sinflar kesimida
          </button>
          <button
            className={`seg-item ${view === 'teacher' ? 'seg-item-on' : ''}`}
            onClick={() => setView('teacher')}
          >
            O'qituvchilar kesimida
          </button>
        </div>
        <span className="flex items-center gap-1.5">
          {CATEGORY_ORDER.map((c) => {
            const list = teachers.filter((t) => (t.category ?? 'yoq') === c)
            const full = list.filter((t) => (loads[t.id] ?? 0) >= settings.stavkaHours).length
            return (
              <span
                key={c}
                className={`badge ${CAT_TINT[c]}`}
                title={`${CATEGORY_LABELS[c]}: ${full} tasida 1 stavka to'lgan (jami ${list.length})`}
              >
                {CATEGORY_SHORT[c]} {full}/{list.length}
              </span>
            )
          })}
        </span>
        <span className={missing > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}>
          {missing > 0 ? `${missing} ta fan biriktirilmagan` : 'Barcha fanlar biriktirilgan ✓'}
        </span>
      </div>

      {(balance.idle > 0 || balance.belowMin > 0) && (
        <div className="mb-4 rounded-xl border p-3 text-sm tint-amber">
          <b>Shtat balansi.</b> Maktabda jami {balance.totalHours} soat dars bor — bu{' '}
          {balance.stavkas.toFixed(1)} stavka, {teachers.length} o'qituvchi uchun esa{' '}
          {(teachers.length * settings.stavkaHours).toLocaleString('uz-UZ')} soat (
          {teachers.length}.0 stavka) kerak bo'lardi. Soatlar toifa tartibida taqsimlangani uchun{' '}
          {balance.idle > 0 && <b>{balance.idle} ta o'qituvchiga dars tegmadi</b>}
          {balance.idle > 0 && balance.belowMin > 0 && ', '}
          {balance.belowMin > 0 && <>{balance.belowMin} tasining yuklamasi minimaldan kam</>}. Buni
          tuzatish uchun o'qituvchilar sonini kamaytiring yoki yuqori toifadagilarning maksimal
          soatini pasaytiring.
        </div>
      )}

      {result && (result.problems.length > 0 || result.warnings.length > 0) && (
        <div className="mb-4 space-y-2">
          {result.problems.length > 0 && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-700 dark:text-rose-300">
              <b>Muammolar ({result.problems.length}):</b>
              <ul className="mt-1 max-h-40 list-disc overflow-y-auto pl-5">
                {result.problems.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
          )}
          {result.warnings.length > 0 && (
            <details className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
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
                <h3 className="font-semibold text-fg">
                  {c.grade}-{c.letter}
                </h3>
                <span className="text-xs text-muted">
                  {classSubjects(c, overrides).length} fan ·{' '}
                  {classSubjects(c, overrides).reduce((s, x) => s + x.hours, 0)} soat
                </span>
              </div>
              <div className="grid gap-1.5 md:grid-cols-2 xl:grid-cols-3">
                {classSubjects(c, overrides).map(({ subject, hours }) => {
                  const cur = assignments[asgKey(c.id, subject.id)] ?? ''
                  // Ma'naviyat soatini faqat sinf rahbari o'tadi — tanlash qulflangan
                  const locked = !!subject.homeroomOnly
                  const cands = locked
                    ? teachers.filter((t) => t.homeroomClassId === c.id)
                    : teachers.filter(
                        (t) =>
                          t.subjectIds.includes(subject.id) &&
                          (!t.restrictedToHomeroom || t.homeroomClassId === c.id),
                      )
                  return (
                    <div key={subject.id} className="flex items-center gap-1.5">
                      <span
                        className="w-32 shrink-0 truncate text-xs text-fg-2"
                        title={`${subject.name} — ${hours} soat`}
                      >
                        <span
                          className="mr-1 inline-block h-2 w-2 rounded-sm align-middle"
                          style={{ background: subject.color }}
                        />
                        {subject.short} <span className="text-faint">{hours}s</span>
                      </span>
                      <Select
                        size="sm"
                        invalid={!cur}
                        disabled={locked}
                        title={locked ? "Ma'naviyat soatini faqat sinf rahbari o'tadi" : undefined}
                        value={cur}
                        onChange={(v) => setAssignment(c.id, subject.id, v || null)}
                        emptyLabel="— tanlanmagan —"
                        options={cands.map((t) => ({
                          value: t.id,
                          label: t.fullName,
                          hint: `${loads[t.id] ?? 0}s`,
                          badge: CATEGORY_SHORT[t.category ?? 'yoq'],
                        }))}
                      />
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
              <tr className="border-b border-line bg-raised">
                <th className="th">№</th>
                <th className="th">O'qituvchi</th>
                <th className="th">Toifa</th>
                <th className="th">Mutaxassislik</th>
                <th className="th">Sinf va fanlar</th>
                <th className="th text-center">Soat</th>
                <th className="th text-center">Stavka</th>
              </tr>
            </thead>
            <tbody>
              {teacherRows.map((r, i) => (
                <tr key={r.teacher.id} className="border-b border-line-soft align-top hover:bg-raised">
                  <td className="td text-faint">{i + 1}</td>
                  <td className="td font-medium">{r.teacher.fullName}</td>
                  <td className="td">
                    <span className={`badge ${CAT_TINT[r.teacher.category ?? 'yoq']}`}>
                      {CATEGORY_SHORT[r.teacher.category ?? 'yoq']}
                    </span>
                  </td>
                  <td className="td text-xs text-muted">{r.teacher.speciality}</td>
                  <td className="td text-xs text-fg-2">{r.items.join(' · ') || '—'}</td>
                  <td
                    className={`td text-center font-semibold ${
                      r.hours > r.teacher.maxHours
                        ? 'text-rose-600 dark:text-rose-400'
                        : r.hours > 0 && r.hours < r.teacher.minHours
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-fg-2'
                    }`}
                  >
                    {r.hours}
                  </td>
                  <td className="td text-center text-xs text-faint">
                    {r.hours > 0 ? formatStavka(r.hours, settings.stavkaHours) : '—'}
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
  const { classes, teachers, overrides, assignments, rules, settings } = useStore()
  const [fromId, setFromId] = useState('')
  const [toId, setToId] = useState('')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [grantSubjects, setGrantSubjects] = useState(true)

  const constraints = useMemo(() => resolveTeacherConstraints(teachers, rules, settings.pedagogicalDays), [teachers, rules, settings.pedagogicalDays])
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
          <Select
            value={fromId}
            onChange={(v) => {
              setFromId(v)
              reset()
            }}
            emptyLabel="— tanlang —"
            options={teachers.map((t) => ({
              value: t.id,
              label: t.fullName,
              hint: `${loads[t.id] ?? 0} soat`,
              group: t.speciality,
            }))}
          />
        </Field>
        <Field label="Kimga">
          <Select
            value={toId}
            onChange={setToId}
            emptyLabel="— tanlang —"
            options={teachers
              .filter((t) => t.id !== fromId)
              .map((t) => ({
                value: t.id,
                label: t.fullName,
                hint: `${loads[t.id] ?? 0} soat`,
                group: t.speciality,
              }))}
          />
        </Field>
      </div>

      {fromId && (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-fg-2">
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
          <div className="max-h-56 overflow-y-auto rounded-lg border border-line">
            {items.length === 0 && <p className="p-3 text-sm text-faint">Bu o'qituvchida dars yo'q.</p>}
            {items.map((i) => {
              const key = `${i.classId}|${i.subjectId}`
              const cls = classes.find((c) => c.id === i.classId)
              const on = picked.has(key)
              return (
                <label
                  key={key}
                  className="flex cursor-pointer items-center gap-2 border-b border-line-soft px-3 py-1.5 text-sm last:border-0 hover:bg-raised"
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
                  <span className="w-14 font-medium text-fg-2">
                    {cls ? `${cls.grade}-${cls.letter}` : i.classId}
                  </span>
                  <span
                    className="mr-1 inline-block h-2 w-2 rounded-sm"
                    style={{ background: SUBJECT_BY_ID[i.subjectId]?.color }}
                  />
                  <span className="flex-1 text-fg-2">{SUBJECT_BY_ID[i.subjectId]?.name ?? i.subjectId}</span>
                  <span className="text-xs text-faint">{i.hours} soat</span>
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
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
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

      <div className="mt-4 flex justify-end gap-2 border-t border-line pt-3">
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

      <p className="mt-3 text-xs text-muted">
        O'tkazgandan keyin «Jadval yaratish» bo'limida <b>Qayta hisoblash</b> tugmasini bosing — jadval to'liq
        qayta tuzilmaydi, faqat yangi o'qituvchining to'qnashuv va oynalari to'g'rilanadi.
      </p>
    </Modal>
  )
}
