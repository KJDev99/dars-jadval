import { useMemo, useState } from 'react'
import { useStore } from '../store'
import Select from '../components/Select'
import { Photo } from '../components/Photo'
import { Empty, Field, Modal, Page, PageHeader, Stat } from '../components/ui'
import { SUBJECT_BY_ID } from '../data/curriculum'
import { CATEGORY_SHORT, MARKS, QUARTERS, QUARTER_LABELS } from '../types'
import type { GradingSettings, Mark, Quarter } from '../types'
import {
  MARK_TINT, STATUS_LABELS, STATUS_TINT, ball, buildGradeBook, pct, sortWorks, workLabel,
} from '../lib/grading'
import type { Cell, ClassSummary, Summary } from '../lib/grading'
import { exportClassSheet, exportGradeReport } from '../lib/grades-excel'
import {
  IcoGrade, IcoExcel, IcoWarn, IcoInfo, IcoGenerate, IcoSearch, IcoNext, IcoTrash, IcoAuto,
  IcoCheck, IcoTeachers, IcoClasses, IcoCurriculum, IcoStudents, IcoTarif,
} from '../components/icons'
import type { IconType } from '../components/icons'

type View = 'teachers' | 'classes' | 'subjects' | 'cells' | 'students'

const VIEWS: { id: View; label: string; Icon: IconType }[] = [
  { id: 'teachers', label: "O'qituvchilar", Icon: IcoTeachers },
  { id: 'classes', label: 'Sinflar', Icon: IcoClasses },
  { id: 'subjects', label: 'Fanlar', Icon: IcoCurriculum },
  { id: 'cells', label: 'Sinf-fan kesimi', Icon: IcoTarif },
  { id: 'students', label: "O'quvchilar", Icon: IcoStudents },
]

/* ─────────────────────────── Kichik bo'laklar ─────────────────────────── */

/** Foiz ustuni — son va uning ostidagi ingichka chiziq */
function Bar({ value, tone = 'indigo' }: { value: number | null; tone?: 'indigo' | 'emerald' }) {
  if (value === null) return <span className="text-faint">—</span>
  const color = tone === 'emerald' ? 'bg-emerald-500' : 'bg-indigo-500'
  return (
    <div className="min-w-[68px]">
      <div className="tabular-nums text-fg-2">{pct(value)}</div>
      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-line">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  )
}

/** «5 / 4 / 3 / 2» ustunlari */
function DistCells({ s }: { s: Summary }) {
  return (
    <>
      {MARKS.map((m) => (
        <td key={m} className="td text-center tabular-nums">
          {s.dist[m] > 0 ? (
            <span className={`badge ${MARK_TINT[m]} px-1.5`}>{s.dist[m]}</span>
          ) : (
            <span className="text-faint">·</span>
          )}
        </td>
      ))}
    </>
  )
}

const DIST_HEADERS = (
  <>
    {MARKS.map((m) => (
      <th key={m} className="th w-12 text-center">
        «{m}»
      </th>
    ))}
  </>
)

/* ═══════════════════════════════ Sahifa ═══════════════════════════════ */

export default function GradesPage() {
  const {
    classes, teachers, students, assessments, assignments, overrides, settings, site,
    reopenAssessment, setGrading, seedDemoGrades, clearGrades,
  } = useStore()

  const g = settings.grading
  const [quarter, setQuarter] = useState<Quarter>(g.currentQuarter)
  const [view, setView] = useState<View>('teachers')
  const [q, setQ] = useState('')
  const [classFilter, setClassFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [detail, setDetail] = useState<ClassSummary | null>(null)
  const [detailTab, setDetailTab] = useState<'subjects' | 'students'>('subjects')
  const [tune, setTune] = useState<GradingSettings | null>(null)

  // Rahbariyat faqat topshirilgan ishlarni ko'radi — qoralama hisobotga kirmaydi
  const book = useMemo(
    () =>
      buildGradeBook({
        classes, students, teachers, assessments, assignments, overrides, settings, quarter,
        includeDrafts: false,
      }),
    [classes, students, teachers, assessments, assignments, overrides, settings, quarter],
  )

  const tById = useMemo(() => new Map(teachers.map((t) => [t.id, t])), [teachers])
  const sById = useMemo(() => new Map(students.map((s) => [s.id, s])), [students])
  const match = (s: string) => !q.trim() || s.toLowerCase().includes(q.trim().toLowerCase())

  /* ── Topshirilmagan ishlar ────────────────────────────────────────── */
  const pending = useMemo(() => {
    const m = new Map<string, { name: string; cells: Cell[] }>()
    for (const cell of book.cells.values()) {
      if (cell.status === 'tayyor') continue
      const key = cell.teacherId ?? '—'
      const name = cell.teacherId
        ? (tById.get(cell.teacherId)?.fullName ?? "O'chirilgan o'qituvchi")
        : 'Biriktirilmagan'
      const row = m.get(key) ?? { name, cells: [] }
      row.cells.push(cell)
      m.set(key, row)
    }
    return [...m.entries()]
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.cells.length - a.cells.length || a.name.localeCompare(b.name))
  }, [book, tById])

  const cellList = useMemo(() => {
    const arr = [...book.cells.values()]
    arr.sort(
      (a, b) =>
        a.classId.localeCompare(b.classId, undefined, { numeric: true }) ||
        (SUBJECT_BY_ID[a.subjectId]?.name ?? '').localeCompare(SUBJECT_BY_ID[b.subjectId]?.name ?? ''),
    )
    return arr.filter((c) => {
      if (classFilter && c.classId !== classFilter) return false
      if (statusFilter && c.status !== statusFilter) return false
      const name = `${c.classId} ${SUBJECT_BY_ID[c.subjectId]?.name ?? ''} ${
        c.teacherId ? (tById.get(c.teacherId)?.fullName ?? '') : ''
      }`
      return match(name)
    })
  }, [book, classFilter, statusFilter, q, tById])

  const studentRows = useMemo(() => {
    const rows = book.byClass.flatMap((c) => c.students.map((s) => ({ ...s, grade: c.grade })))
    return rows
      .filter((s) => (!classFilter || s.classId === classFilter) && match(s.fullName))
      .sort((a, b) => (b.avgMark ?? -1) - (a.avgMark ?? -1) || a.fullName.localeCompare(b.fullName))
  }, [book, classFilter, q])

  /* ── Amallar ──────────────────────────────────────────────────────── */
  const exportAll = () =>
    void exportGradeReport({ book, classes, teachers, students, schoolName: site.profile.name })

  const demo = () => {
    const ok = confirm(
      `${QUARTER_LABELS[quarter]} uchun namunaviy natijalar yaratilsinmi?\n\n` +
        `5–9-sinflar bo'yicha BSB va ChSB ishlari to'ldiriladi.\n` +
        `Bu chorakdagi mavjud natijalar o'chib ketadi.`,
    )
    if (!ok) return
    const n = seedDemoGrades(quarter)
    alert(n === 0 ? "Ish yaratilmadi — avval tarifikatsiyani to'ldiring." : `${n} ta ish yaratildi.`)
  }

  const hasData = book.totals.works > 0

  return (
    <Page>
      <PageHeader
        title="BSB va ChSB natijalari"
        subtitle="O'qituvchilar kabinetdan kiritgan summativ baholash natijalari. Faqat topshirilgan ishlar hisobga olinadi."
        actions={
          <>
            <Select
              className="w-36"
              value={String(quarter)}
              onChange={(v) => setQuarter(Number(v) as Quarter)}
              options={QUARTERS.map((x) => ({
                value: String(x),
                label: QUARTER_LABELS[x],
                hint: x === g.currentQuarter ? 'joriy' : undefined,
              }))}
            />
            <button className="btn-ghost" onClick={() => setTune({ ...g })} title="Baholash tartibi">
              <IcoGenerate className="h-4 w-4" />
              <span className="hidden lg:inline">Tartib</span>
            </button>
            <button className="btn-primary" onClick={exportAll} disabled={!hasData}>
              <IcoExcel className="h-4 w-4" /> Excel hisobot
            </button>
          </>
        }
      />

      {/* ── Umumiy ko'rsatkichlar ───────────────────────────────────── */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat
          label="O'rtacha ball"
          value={ball(book.school.avgMark)}
          hint={`${book.school.count} ta baho`}
          tone="indigo"
        />
        <Stat label="Sifat" value={pct(book.school.quality)} hint="«4» va «5» ulushi" tone="emerald" />
        <Stat label="O'zlashtirish" value={pct(book.school.progress)} hint="«3» va undan yuqori" />
        <Stat
          label="Tayyor sinf-fan"
          value={`${book.totals.ready} / ${book.totals.cells}`}
          hint="reja bo'yicha to'liq"
          tone={book.totals.ready === book.totals.cells && book.totals.cells > 0 ? 'emerald' : 'amber'}
        />
        <Stat
          label="Topshirilgan ish"
          value={book.totals.submitted}
          hint={`${book.totals.works} tadan`}
          tone={book.totals.submitted < book.totals.works ? 'amber' : 'slate'}
        />
      </div>

      {!hasData && (
        <div className="card mb-5 flex flex-wrap items-center gap-3 p-4">
          <IcoInfo className="h-5 w-5 shrink-0 text-faint" />
          <p className="min-w-0 flex-1 text-sm text-muted">
            {QUARTER_LABELS[quarter]} uchun hali natija kiritilmagan. O'qituvchilar shaxsiy
            kabinetdagi «BSB va ChSB» bo'limidan ball kiritadi va ishni topshiradi.
          </p>
          <button className="btn-ghost shrink-0" onClick={demo}>
            <IcoAuto className="h-4 w-4" /> Namunaviy ma'lumot
          </button>
        </div>
      )}

      {/* ── Topshirilmaganlar ───────────────────────────────────────── */}
      {pending.length > 0 && (
        <div className="card mb-5 overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-line bg-amber-500/10 px-4 py-2.5">
            <IcoWarn className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <h2 className="text-sm font-semibold text-amber-700 dark:text-amber-300">
              Topshirilmagan sinf-fanlar
            </h2>
            <span className="badge tint-amber">{pending.reduce((n, p) => n + p.cells.length, 0)}</span>
            <span className="ml-auto flex flex-wrap gap-1.5 text-xs text-muted">
              {(['yoq', 'qoralama', 'chala'] as const).map((s) => {
                const n = [...book.cells.values()].filter((c) => c.status === s).length
                return n === 0 ? null : (
                  <span key={s} className={`badge ${STATUS_TINT[s]}`}>
                    {STATUS_LABELS[s]} {n}
                  </span>
                )
              })}
            </span>
          </div>
          <div className="max-h-56 divide-y divide-line-soft overflow-y-auto">
            {pending.slice(0, 40).map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-2 px-4 py-2 text-sm">
                <span className="min-w-[200px] flex-1 truncate font-medium text-fg-2">{p.name}</span>
                <span className="flex flex-wrap gap-1">
                  {p.cells.slice(0, 8).map((c) => (
                    <span key={`${c.classId}|${c.subjectId}`} className={`badge ${STATUS_TINT[c.status]}`}>
                      {c.classId} · {SUBJECT_BY_ID[c.subjectId]?.short ?? c.subjectId}
                    </span>
                  ))}
                  {p.cells.length > 8 && <span className="badge tint-slate">+{p.cells.length - 8}</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Ko'rinish tanlash ───────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="seg">
          {VIEWS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setView(id)}
              className={`seg-item ${view === id ? 'seg-item-on' : ''}`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        <div className="relative ml-auto">
          <IcoSearch className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
          <input
            className="input w-52 pl-8"
            placeholder="Qidirish…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        {(view === 'cells' || view === 'students') && (
          <Select
            className="w-36"
            value={classFilter}
            onChange={setClassFilter}
            emptyLabel="Barcha sinflar"
            options={classes.map((c) => ({ value: c.id, label: `${c.grade}-${c.letter}` }))}
          />
        )}
        {view === 'cells' && (
          <Select
            className="w-40"
            value={statusFilter}
            onChange={setStatusFilter}
            emptyLabel="Barcha holatlar"
            options={(Object.keys(STATUS_LABELS) as (keyof typeof STATUS_LABELS)[]).map((s) => ({
              value: s,
              label: STATUS_LABELS[s],
            }))}
          />
        )}
      </div>

      {/* ══════════════════ 1. O'qituvchilar kesimi ══════════════════ */}
      {view === 'teachers' &&
        (book.byTeacher.length === 0 ? (
          <Empty text="Bu chorakda topshirilgan ish yo'q." />
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse">
              <thead>
                <tr className="border-b border-line bg-raised">
                  <th className="th w-10 text-center">№</th>
                  <th className="th min-w-[220px]">O'qituvchi</th>
                  <th className="th w-16 text-center">Toifa</th>
                  <th className="th w-24 text-center">Sinf-fan</th>
                  <th className="th w-24 text-center">Tayyor</th>
                  <th className="th w-28 text-center">Ishlar</th>
                  <th className="th w-28">O'rtacha ball</th>
                  <th className="th w-28">Sifat</th>
                  <th className="th w-28">O'zlashtirish</th>
                  {DIST_HEADERS}
                </tr>
              </thead>
              <tbody>
                {book.byTeacher
                  .filter((t) => match(t.label))
                  .map((t, i) => {
                    const teacher = tById.get(t.teacherId)
                    return (
                      <tr key={t.id} className="border-b border-line-soft last:border-0 hover:bg-raised/50">
                        <td className="td text-center text-xs text-faint">{i + 1}</td>
                        <td className="td">
                          <div className="flex items-center gap-2">
                            <Photo src={teacher?.photo} name={t.label} className="h-7 w-7 shrink-0" />
                            <div className="min-w-0">
                              <div className="truncate font-medium text-fg">{t.label}</div>
                              <div className="truncate text-[11px] text-faint">{teacher?.speciality}</div>
                            </div>
                          </div>
                        </td>
                        <td className="td text-center text-xs">
                          {teacher ? CATEGORY_SHORT[teacher.category ?? 'yoq'] : '—'}
                        </td>
                        <td className="td text-center tabular-nums">{t.cells}</td>
                        <td className="td text-center">
                          <span
                            className={`badge ${
                              t.pending === 0
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                            }`}
                          >
                            {t.ready} / {t.cells}
                          </span>
                        </td>
                        <td className="td text-center tabular-nums text-muted">
                          {t.submittedWorks} / {t.works}
                        </td>
                        <td className="td font-semibold tabular-nums text-fg">{ball(t.summary.avgMark)}</td>
                        <td className="td">
                          <Bar value={t.summary.quality} />
                        </td>
                        <td className="td">
                          <Bar value={t.summary.progress} tone="emerald" />
                        </td>
                        <DistCells s={t.summary} />
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        ))}

      {/* ══════════════════ 2. Sinflar kesimi ══════════════════ */}
      {view === 'classes' && (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse">
            <thead>
              <tr className="border-b border-line bg-raised">
                <th className="th w-20">Sinf</th>
                <th className="th w-24 text-center">O'quvchi</th>
                <th className="th w-24 text-center">Fanlar</th>
                <th className="th w-24 text-center">Tayyor</th>
                <th className="th w-28">O'rtacha ball</th>
                <th className="th w-28">Sifat</th>
                <th className="th w-28">O'zlashtirish</th>
                {DIST_HEADERS}
                <th className="th w-24 text-center">Batafsil</th>
              </tr>
            </thead>
            <tbody>
              {book.byClass
                .filter((c) => match(c.classId))
                .map((c) => (
                  <tr key={c.classId} className="border-b border-line-soft last:border-0 hover:bg-raised/50">
                    <td className="td font-semibold text-fg">{c.classId}</td>
                    <td className="td text-center tabular-nums">{c.studentsCount}</td>
                    <td className="td text-center tabular-nums">{c.subjects}</td>
                    <td className="td text-center">
                      {c.subjects === 0 ? (
                        <span className="badge tint-slate">baholanmaydi</span>
                      ) : (
                        <span
                          className={`badge ${
                            c.ready === c.subjects
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                              : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                          }`}
                        >
                          {c.ready} / {c.subjects}
                        </span>
                      )}
                    </td>
                    <td className="td font-semibold tabular-nums text-fg">{ball(c.summary.avgMark)}</td>
                    <td className="td">
                      <Bar value={c.summary.quality} />
                    </td>
                    <td className="td">
                      <Bar value={c.summary.progress} tone="emerald" />
                    </td>
                    <DistCells s={c.summary} />
                    <td className="td text-center">
                      <button
                        className="btn-ghost h-7 px-2"
                        onClick={() => {
                          setDetail(c)
                          setDetailTab('subjects')
                        }}
                      >
                        Ochish <IcoNext className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ══════════════════ 3. Fanlar kesimi ══════════════════ */}
      {view === 'subjects' &&
        (book.bySubject.length === 0 ? (
          <Empty text="Bu chorakda topshirilgan ish yo'q." />
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse">
              <thead>
                <tr className="border-b border-line bg-raised">
                  <th className="th min-w-[240px]">Fan</th>
                  <th className="th w-24 text-center">Sinflar</th>
                  <th className="th w-24 text-center">Tayyor</th>
                  <th className="th w-28">O'rtacha ball</th>
                  <th className="th w-28">Sifat</th>
                  <th className="th w-28">O'zlashtirish</th>
                  {DIST_HEADERS}
                </tr>
              </thead>
              <tbody>
                {book.bySubject
                  .filter((s) => match(s.label))
                  .map((s) => (
                    <tr key={s.id} className="border-b border-line-soft last:border-0 hover:bg-raised/50">
                      <td className="td">
                        <span className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-sm"
                            style={{ background: SUBJECT_BY_ID[s.id]?.color ?? '#94a3b8' }}
                          />
                          <span className="font-medium text-fg">{s.label}</span>
                        </span>
                      </td>
                      <td className="td text-center tabular-nums">{s.cells}</td>
                      <td className="td text-center tabular-nums text-muted">
                        {s.ready} / {s.cells}
                      </td>
                      <td className="td font-semibold tabular-nums text-fg">{ball(s.summary.avgMark)}</td>
                      <td className="td">
                        <Bar value={s.summary.quality} />
                      </td>
                      <td className="td">
                        <Bar value={s.summary.progress} tone="emerald" />
                      </td>
                      <DistCells s={s.summary} />
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ))}

      {/* ══════════════════ 4. Sinf-fan kesimi ══════════════════ */}
      {view === 'cells' &&
        (cellList.length === 0 ? (
          <Empty text="Bu shartlarga mos yozuv topilmadi." />
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[1040px] border-collapse">
              <thead>
                <tr className="border-b border-line bg-raised">
                  <th className="th w-16">Sinf</th>
                  <th className="th min-w-[190px]">Fan</th>
                  <th className="th min-w-[180px]">O'qituvchi</th>
                  <th className="th w-16 text-center">Soat</th>
                  <th className="th w-28 text-center">Holat</th>
                  <th className="th min-w-[150px]">Ishlar</th>
                  <th className="th w-24">O'rtacha</th>
                  <th className="th w-28">Sifat</th>
                  <th className="th w-28">O'zlashtirish</th>
                  <th className="th w-24 text-center">Baholanmagan</th>
                </tr>
              </thead>
              <tbody>
                {cellList.map((c) => (
                  <tr
                    key={`${c.classId}|${c.subjectId}`}
                    className="border-b border-line-soft last:border-0 hover:bg-raised/50"
                  >
                    <td className="td font-semibold text-fg">{c.classId}</td>
                    <td className="td truncate">{SUBJECT_BY_ID[c.subjectId]?.name ?? c.subjectId}</td>
                    <td className="td truncate text-muted">
                      {c.teacherId ? (tById.get(c.teacherId)?.fullName ?? '—') : (
                        <span className="text-rose-600 dark:text-rose-400">biriktirilmagan</span>
                      )}
                    </td>
                    <td className="td text-center tabular-nums">{c.hours}</td>
                    <td className="td text-center">
                      <span className={`badge ${STATUS_TINT[c.status]}`}>{STATUS_LABELS[c.status]}</span>
                    </td>
                    <td className="td">
                      <span className="flex flex-wrap gap-1">
                        {[...c.works].sort(sortWorks).map((w) => (
                          <button
                            key={w.id}
                            title={
                              w.submittedAt
                                ? `${w.title} · topshirilgan · qayta ochish uchun bosing`
                                : `${w.title} · qoralama`
                            }
                            onClick={() => {
                              if (!w.submittedAt) return
                              if (confirm(`${c.classId} — ${workLabel(w)} qayta tahrirlash uchun ochilsinmi?`))
                                reopenAssessment(w.id)
                            }}
                            className={`badge ${
                              w.submittedAt
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                : 'border border-dashed border-line bg-transparent text-faint'
                            }`}
                          >
                            {workLabel(w)}
                          </button>
                        ))}
                        {c.works.length === 0 && <span className="text-faint">—</span>}
                      </span>
                    </td>
                    <td className="td font-semibold tabular-nums text-fg">{ball(c.summary.avgMark)}</td>
                    <td className="td">
                      <Bar value={c.summary.quality} />
                    </td>
                    <td className="td">
                      <Bar value={c.summary.progress} tone="emerald" />
                    </td>
                    <td className="td text-center tabular-nums">
                      {c.ungraded > 0 ? (
                        <span className="badge tint-amber">{c.ungraded}</span>
                      ) : (
                        <span className="text-faint">·</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

      {/* ══════════════════ 5. O'quvchilar kesimi ══════════════════ */}
      {view === 'students' &&
        (studentRows.length === 0 ? (
          <Empty text="O'quvchi topilmadi." />
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr className="border-b border-line bg-raised">
                  <th className="th w-12 text-center">№</th>
                  <th className="th min-w-[220px]">O'quvchi</th>
                  <th className="th w-20">Sinf</th>
                  <th className="th w-24 text-center">Fanlar</th>
                  <th className="th w-28">O'rtacha ball</th>
                  <th className="th min-w-[160px]">Holati</th>
                </tr>
              </thead>
              <tbody>
                {studentRows.slice(0, 300).map((s, i) => (
                  <tr key={s.studentId} className="border-b border-line-soft last:border-0 hover:bg-raised/50">
                    <td className="td text-center text-xs text-faint">{i + 1}</td>
                    <td className="td truncate font-medium text-fg">{s.fullName}</td>
                    <td className="td">{s.classId}</td>
                    <td className="td text-center tabular-nums">{s.subjects}</td>
                    <td className="td font-semibold tabular-nums text-fg">{ball(s.avgMark)}</td>
                    <td className="td">
                      {s.excellent ? (
                        <span className="badge bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                          A'lochi
                        </span>
                      ) : s.failing > 0 ? (
                        <span className="badge bg-rose-500/15 text-rose-700 dark:text-rose-300">
                          {s.failing} fandan «2»
                        </span>
                      ) : s.avgMark !== null && s.avgMark >= 4 ? (
                        <span className="badge bg-sky-500/15 text-sky-700 dark:text-sky-300">Yaxshi</span>
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {studentRows.length > 300 && (
              <p className="border-t border-line px-4 py-2 text-xs text-faint">
                {studentRows.length} tadan birinchi 300 tasi ko'rsatildi — sinf bo'yicha filtrlang yoki
                Excel hisobotni yuklab oling.
              </p>
            )}
          </div>
        ))}

      {/* ── Namunaviy ma'lumot / tozalash ───────────────────────────── */}
      {hasData && (
        <div className="mt-5 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-xs text-muted">
          <IcoInfo className="h-4 w-4 shrink-0 text-faint" />
          <span className="min-w-0 flex-1">
            Sinov ma'lumoti: {QUARTER_LABELS[quarter]} uchun namunaviy natijalarni qayta yaratish yoki
            tozalash mumkin. Haqiqiy natijalar o'qituvchilar kabinetidan kiritiladi.
          </span>
          <button className="btn-ghost shrink-0" onClick={demo}>
            <IcoAuto className="h-3.5 w-3.5" /> Qayta yaratish
          </button>
          <button
            className="btn-danger shrink-0"
            onClick={() => {
              if (confirm(`${QUARTER_LABELS[quarter]} natijalari butunlay o'chirilsinmi?`))
                clearGrades(quarter)
            }}
          >
            <IcoTrash className="h-3.5 w-3.5" /> Tozalash
          </button>
        </div>
      )}

      {/* ══════════════ Sinf batafsil ══════════════ */}
      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        wide
        title={detail ? `${detail.classId} sinf — ${QUARTER_LABELS[quarter]}` : ''}
      >
        {detail && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="seg">
                <button
                  className={`seg-item ${detailTab === 'subjects' ? 'seg-item-on' : ''}`}
                  onClick={() => setDetailTab('subjects')}
                >
                  Fanlar bo'yicha
                </button>
                <button
                  className={`seg-item ${detailTab === 'students' ? 'seg-item-on' : ''}`}
                  onClick={() => setDetailTab('students')}
                >
                  O'quvchilar bo'yicha
                </button>
              </div>
              <button
                className="btn-ghost ml-auto"
                onClick={() => void exportClassSheet(book, detail.classId, students, site.profile.name)}
              >
                <IcoExcel className="h-4 w-4" /> Excel
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              <Stat label="O'rtacha ball" value={ball(detail.summary.avgMark)} tone="indigo" />
              <Stat label="Sifat" value={pct(detail.summary.quality)} tone="emerald" />
              <Stat label="O'zlashtirish" value={pct(detail.summary.progress)} />
              <Stat label="Tayyor fanlar" value={`${detail.ready} / ${detail.subjects}`} tone="amber" />
            </div>

            <div className="max-h-[50vh] overflow-auto rounded-xl border border-line">
              {detailTab === 'subjects' ? (
                <table className="w-full min-w-[680px] border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b border-line bg-raised">
                      <th className="th min-w-[200px]">Fan</th>
                      <th className="th min-w-[160px]">O'qituvchi</th>
                      <th className="th w-24 text-center">Holat</th>
                      <th className="th w-24">O'rtacha</th>
                      <th className="th w-24">Sifat</th>
                      {DIST_HEADERS}
                    </tr>
                  </thead>
                  <tbody>
                    {[...book.cells.values()]
                      .filter((c) => c.classId === detail.classId)
                      .sort((a, b) =>
                        (SUBJECT_BY_ID[a.subjectId]?.name ?? '').localeCompare(
                          SUBJECT_BY_ID[b.subjectId]?.name ?? '',
                        ),
                      )
                      .map((c) => (
                        <tr key={c.subjectId} className="border-b border-line-soft last:border-0">
                          <td className="td truncate">{SUBJECT_BY_ID[c.subjectId]?.name ?? c.subjectId}</td>
                          <td className="td truncate text-muted">
                            {c.teacherId ? (tById.get(c.teacherId)?.fullName ?? '—') : '—'}
                          </td>
                          <td className="td text-center">
                            <span className={`badge ${STATUS_TINT[c.status]}`}>{STATUS_LABELS[c.status]}</span>
                          </td>
                          <td className="td font-semibold tabular-nums text-fg">{ball(c.summary.avgMark)}</td>
                          <td className="td tabular-nums text-muted">{pct(c.summary.quality)}</td>
                          <DistCells s={c.summary} />
                        </tr>
                      ))}
                  </tbody>
                </table>
              ) : (
                <table className="w-full min-w-[560px] border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b border-line bg-raised">
                      <th className="th w-12 text-center">№</th>
                      <th className="th min-w-[220px]">O'quvchi</th>
                      <th className="th w-24 text-center">Fanlar</th>
                      <th className="th w-28">O'rtacha</th>
                      <th className="th min-w-[150px]">Baholar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.students.map((s, i) => {
                      const counts = { 5: 0, 4: 0, 3: 0, 2: 0 } as Record<Mark, number>
                      for (const m of Object.values(s.marks)) counts[m]++
                      return (
                        <tr key={s.studentId} className="border-b border-line-soft last:border-0">
                          <td className="td text-center text-xs text-faint">
                            {sById.get(s.studentId)?.order ?? i + 1}
                          </td>
                          <td className="td truncate font-medium text-fg">{s.fullName}</td>
                          <td className="td text-center tabular-nums">{s.subjects}</td>
                          <td className="td font-semibold tabular-nums text-fg">{ball(s.avgMark)}</td>
                          <td className="td">
                            <span className="flex gap-1">
                              {MARKS.map((m) =>
                                counts[m] > 0 ? (
                                  <span key={m} className={`badge ${MARK_TINT[m]} px-1.5`}>
                                    {m}×{counts[m]}
                                  </span>
                                ) : null,
                              )}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ══════════════ Baholash tartibi ══════════════ */}
      <Modal open={!!tune} onClose={() => setTune(null)} title="Baholash tartibi">
        {tune && (
          <div className="space-y-4">
            <p className="flex gap-2 rounded-lg border border-line bg-raised px-3 py-2 text-xs leading-relaxed text-muted">
              <IcoInfo className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Bu qiymatlar Vazirlik nizomiga muvofiq belgilanadi. O'zgartirilsa, barcha choraklar
              natijalari darhol qayta hisoblanadi.
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="BSB ulushi" hint="0 dan 1 gacha">
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={1}
                  step="0.05"
                  value={tune.bsbWeight}
                  onChange={(e) => setTune({ ...tune, bsbWeight: Number(e.target.value) || 0 })}
                />
              </Field>
              <Field label="ChSB ulushi" hint={`Yig'indi: ${(tune.bsbWeight + tune.chsbWeight).toFixed(2)}`}>
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={1}
                  step="0.05"
                  value={tune.chsbWeight}
                  onChange={(e) => setTune({ ...tune, chsbWeight: Number(e.target.value) || 0 })}
                />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="«5» — eng kam %">
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={100}
                  value={tune.mark5}
                  onChange={(e) => setTune({ ...tune, mark5: Number(e.target.value) || 0 })}
                />
              </Field>
              <Field label="«4» — eng kam %">
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={100}
                  value={tune.mark4}
                  onChange={(e) => setTune({ ...tune, mark4: Number(e.target.value) || 0 })}
                />
              </Field>
              <Field label="«3» — eng kam %">
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={100}
                  value={tune.mark3}
                  onChange={(e) => setTune({ ...tune, mark3: Number(e.target.value) || 0 })}
                />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {([0, 1, 2] as const).map((i) => (
                <Field
                  key={i}
                  label={`${i === 2 ? '3+' : i + 1} soatli fan`}
                  hint="chorakdagi BSB soni"
                >
                  <input
                    className="input"
                    type="number"
                    min={0}
                    max={6}
                    value={tune.bsbPlan[i]}
                    onChange={(e) => {
                      const plan = [...tune.bsbPlan] as [number, number, number]
                      plan[i] = Math.max(0, Number(e.target.value) || 0)
                      setTune({ ...tune, bsbPlan: plan })
                    }}
                  />
                </Field>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="BSB maksimal ball">
                <input
                  className="input"
                  type="number"
                  min={1}
                  value={tune.defaultBsbMax}
                  onChange={(e) => setTune({ ...tune, defaultBsbMax: Math.max(1, Number(e.target.value) || 1) })}
                />
              </Field>
              <Field label="ChSB maksimal ball">
                <input
                  className="input"
                  type="number"
                  min={1}
                  value={tune.defaultChsbMax}
                  onChange={(e) => setTune({ ...tune, defaultChsbMax: Math.max(1, Number(e.target.value) || 1) })}
                />
              </Field>
              <Field label="Joriy chorak" hint="Kabinet shu chorakdan ochiladi">
                <Select
                  value={String(tune.currentQuarter)}
                  onChange={(v) => setTune({ ...tune, currentQuarter: Number(v) as Quarter })}
                  options={QUARTERS.map((x) => ({ value: String(x), label: QUARTER_LABELS[x] }))}
                />
              </Field>
            </div>

            {tune.mark5 <= tune.mark4 || tune.mark4 <= tune.mark3 ? (
              <p className="flex gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
                <IcoWarn className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Chegaralar kamayib borishi kerak: «5» &gt; «4» &gt; «3».
              </p>
            ) : null}

            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setTune(null)}>
                Bekor qilish
              </button>
              <button
                className="btn-primary"
                disabled={tune.mark5 <= tune.mark4 || tune.mark4 <= tune.mark3}
                onClick={() => {
                  setGrading(tune)
                  setQuarter(tune.currentQuarter)
                  setTune(null)
                }}
              >
                <IcoCheck className="h-4 w-4" /> Saqlash
              </button>
            </div>
          </div>
        )}
      </Modal>

      <p className="mt-4 flex items-center justify-center gap-2 text-xs text-faint">
        <IcoGrade className="h-3.5 w-3.5" />
        Chorak natijasi = BSB foizi × {g.bsbWeight.toFixed(2).replace('.', ',')} + ChSB foizi ×{' '}
        {g.chsbWeight.toFixed(2).replace('.', ',')} · «5» — {g.mark5}%, «4» — {g.mark4}%, «3» — {g.mark3}%
      </p>
    </Page>
  )
}
