import { useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import { useAuth } from '../authStore'
import Select from '../components/Select'
import { Field, Modal, Stat } from '../components/ui'
import { SUBJECT_BY_ID } from '../data/curriculum'
import { QUARTERS, QUARTER_LABELS } from '../types'
import type { Assessment, AssessmentKind, Quarter, Student } from '../types'
import {
  MARK_TINT, STATUS_LABELS, STATUS_TINT, ball, buildGradeBook, cellKey, pct, sortWorks,
  teacherCells, workLabel,
} from '../lib/grading'
import type { Cell } from '../lib/grading'
import { exportJournal, parseJournal } from '../lib/grades-excel'
import type { JournalImport } from '../lib/grades-excel'
import {
  IcoGrade, IcoPlus, IcoTrash, IcoEdit, IcoCheck, IcoSend, IcoLock, IcoWarn, IcoInfo,
  IcoTemplate, IcoUpload, IcoOk, IcoClose, IcoJournal,
} from '../components/icons'

/** Ballar kiritiladigan katak — faqat son va bo'sh qiymat qabul qiladi */
function ScoreInput({
  value,
  max,
  disabled,
  absent,
  onChange,
}: {
  value: number | undefined
  max: number
  disabled?: boolean
  absent?: boolean
  onChange: (v: number | null) => void
}) {
  if (absent) {
    return (
      <div className="grid h-8 w-full place-items-center rounded-lg border border-dashed border-line text-xs text-faint">
        kelmadi
      </div>
    )
  }
  return (
    <input
      type="number"
      min={0}
      max={max}
      step="0.5"
      inputMode="decimal"
      disabled={disabled}
      value={value ?? ''}
      placeholder="—"
      onChange={(e) => {
        const raw = e.target.value.trim()
        if (raw === '') return onChange(null)
        const n = Number(raw.replace(',', '.'))
        if (Number.isFinite(n)) onChange(Math.max(0, Math.min(max, n)))
      }}
      className="input h-8 px-1 text-center tabular-nums disabled:cursor-not-allowed disabled:opacity-60"
    />
  )
}

export default function CabinetGrades() {
  const session = useAuth((s) => s.session)
  const {
    classes, teachers, students, assessments, assignments, overrides, settings, site,
    createAssessment, updateAssessment, removeAssessment, setScore, setScores, toggleAbsent,
    submitAssessment, addRequest,
  } = useStore()

  const teacher = teachers.find((t) => t.id === session?.userId)
  const g = settings.grading

  const [quarter, setQuarter] = useState<Quarter>(g.currentQuarter)
  const [picked, setPicked] = useState<string | null>(null)
  const [edit, setEdit] = useState<Assessment | null>(null)
  const [ask, setAsk] = useState<Assessment | null>(null)
  const [askText, setAskText] = useState('')
  const [report, setReport] = useState<JournalImport | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const mine = useMemo(
    () => (teacher ? teacherCells(teacher.id, classes, assignments, overrides, g) : []),
    [teacher, classes, assignments, overrides, g],
  )

  /*
   * Kabinetda qoralamalar ham hisobga olinadi — o'qituvchi o'z natijasini ko'radi.
   * Hisob faqat shu o'qituvchining sinflari va ishlari bo'yicha yuritiladi:
   * ball kiritilayotganda butun maktabni qayta hisoblash shart emas.
   */
  const myClasses = useMemo(() => {
    const ids = new Set(mine.map((c) => c.classId))
    return classes.filter((c) => ids.has(c.id))
  }, [classes, mine])

  const myWorks = useMemo(() => {
    const keys = new Set(mine.map((c) => cellKey(c.classId, c.subjectId)))
    return assessments.filter((a) => keys.has(cellKey(a.classId, a.subjectId)))
  }, [assessments, mine])

  const book = useMemo(
    () =>
      buildGradeBook({
        classes: myClasses, students, teachers, assessments: myWorks, assignments, overrides,
        settings, quarter, includeDrafts: true,
      }),
    [myClasses, students, teachers, myWorks, assignments, overrides, settings, quarter],
  )

  const roster = useMemo(() => {
    const m = new Map<string, Student[]>()
    for (const s of students) {
      if (!s.active) continue
      const list = m.get(s.classId)
      if (list) list.push(s)
      else m.set(s.classId, [s])
    }
    for (const l of m.values()) l.sort((a, b) => a.order - b.order)
    return m
  }, [students])

  if (!teacher) return null

  const activeKey = picked && mine.some((c) => cellKey(c.classId, c.subjectId) === picked)
    ? picked
    : (mine[0] ? cellKey(mine[0].classId, mine[0].subjectId) : null)
  const cell: Cell | undefined = activeKey ? book.cells.get(activeKey) : undefined

  /* ── Umumiy ko'rsatkichlar ────────────────────────────────────────── */
  const ready = mine.filter((c) => book.cells.get(cellKey(c.classId, c.subjectId))?.status === 'tayyor').length
  const drafts = assessments.filter(
    (a) => a.teacherId === teacher.id && a.quarter === quarter && !a.submittedAt,
  ).length
  const myStats = book.byTeacher.find((t) => t.teacherId === teacher.id)

  /* ── Amallar ──────────────────────────────────────────────────────── */
  const add = (kind: AssessmentKind) => {
    if (!cell) return
    if (kind === 'chsb' && cell.works.some((w) => w.kind === 'chsb')) {
      alert('Bu chorak uchun ChSB allaqachon yaratilgan.')
      return
    }
    createAssessment({
      classId: cell.classId,
      subjectId: cell.subjectId,
      teacherId: teacher.id,
      quarter,
      kind,
    })
  }

  const submit = (w: Assessment) => {
    const list = roster.get(w.classId) ?? []
    const missing = list.filter((s) => w.scores[s.id] === undefined && !w.absent.includes(s.id))
    if (missing.length > 0) {
      const ok = confirm(
        `${missing.length} ta o'quvchiga ball qo'yilmagan.\n` +
          `Ular o'rtachaga qo'shilmaydi. Baribir topshirilsinmi?`,
      )
      if (!ok) return
    }
    submitAssessment(w.id)
  }

  const download = async () => {
    if (!cell || !teacher) return
    await exportJournal({
      classId: cell.classId,
      subjectId: cell.subjectId,
      quarter,
      teacherName: teacher.fullName,
      schoolName: site.profile.shortName,
      works: cell.works,
      students: roster.get(cell.classId) ?? [],
    })
  }

  const upload = async (file: File) => {
    if (!cell || !teacher) return
    const open = cell.works.filter((w) => !w.submittedAt)
    if (open.length === 0) {
      alert('Bu sinf-fanda tahrirlash mumkin bo\'lgan ish yo\'q — barchasi topshirilgan.')
      return
    }
    const res = await parseJournal(await file.arrayBuffer(), {
      classId: cell.classId,
      subjectId: cell.subjectId,
      quarter,
      teacherName: teacher.fullName,
      schoolName: site.profile.shortName,
      works: open,
      students: roster.get(cell.classId) ?? [],
    })
    if (res.errors.length === 0) {
      for (const w of open) {
        const scores = res.scores[w.id]
        const absent = res.absent[w.id]
        if (!scores) continue
        if (Object.keys(scores).length === 0 && absent.length === 0) continue
        setScores(w.id, scores, absent)
      }
    }
    setReport(res)
  }

  const sendRequest = () => {
    if (!ask || !teacher) return
    const text = askText.trim()
    if (!text) {
      alert("Sababini yozing — ma'muriyat shu matnni ko'radi.")
      return
    }
    const sub = SUBJECT_BY_ID[ask.subjectId]?.name ?? ask.subjectId
    addRequest({
      teacherId: teacher.id,
      kind: 'baho',
      title: `${ask.classId} — ${sub}, ${workLabel(ask)} (${QUARTER_LABELS[ask.quarter]})`,
      message: text,
      assessmentId: ask.id,
    })
    setAsk(null)
    setAskText('')
    alert("So'rov yuborildi. «So'rovlarim» bo'limida holatini kuzatib boring.")
  }

  /* ── Ko'rinish ────────────────────────────────────────────────────── */
  const list = cell ? [...cell.works].sort(sortWorks) : []
  const classRoster = cell ? (roster.get(cell.classId) ?? []) : []
  const editable = (w: Assessment) => !w.submittedAt

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-fg">BSB va ChSB</h1>
          <p className="mt-1 text-sm text-muted">
            O'zingiz dars beradigan sinflar bo'yicha summativ baholash natijalarini kiritasiz.
            Topshirilgan ish rahbariyat hisobotiga tushadi.
          </p>
        </div>
        <Select
          className="w-40"
          value={String(quarter)}
          onChange={(v) => setQuarter(Number(v) as Quarter)}
          options={QUARTERS.map((q) => ({ value: String(q), label: QUARTER_LABELS[q] }))}
        />
      </div>

      {/* Ko'rsatkichlar */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Sinf-fanlarim" value={mine.length} hint={`${QUARTER_LABELS[quarter]}`} />
        <Stat label="Tayyor" value={ready} hint={`${mine.length} tadan`} tone={ready === mine.length && mine.length > 0 ? 'emerald' : 'amber'} />
        <Stat label="Qoralama" value={drafts} hint="topshirilmagan ish" tone={drafts ? 'amber' : 'slate'} />
        <Stat
          label="O'rtacha ball"
          value={ball(myStats?.summary.avgMark ?? null)}
          hint={myStats?.summary.count ? `${myStats.summary.count} ta baho` : "hali baho yo'q"}
          tone="indigo"
        />
      </div>

      {mine.length === 0 ? (
        <div className="card grid place-items-center gap-3 p-14 text-center">
          <IcoGrade className="h-10 w-10 text-faint" />
          <p className="text-sm text-muted">
            Sizga hali sinf va fan biriktirilmagan yoki biriktirilgan sinflar baholanmaydi.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
          {/* ── Sinf-fanlar ro'yxati ──────────────────────────────────── */}
          <div className="card overflow-hidden">
            <div className="border-b border-line bg-raised px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted">
              Sinf va fanlarim
            </div>
            <div className="max-h-[70vh] divide-y divide-line-soft overflow-y-auto">
              {mine.map((c) => {
                const k = cellKey(c.classId, c.subjectId)
                const cc = book.cells.get(k)
                const on = k === activeKey
                return (
                  <button
                    key={k}
                    onClick={() => setPicked(k)}
                    className={`flex w-full items-center gap-2 px-4 py-2.5 text-left transition-colors ${
                      on ? 'bg-indigo-500/10' : 'hover:bg-raised'
                    }`}
                  >
                    <span
                      className="h-8 w-1 shrink-0 rounded-full"
                      style={{ background: SUBJECT_BY_ID[c.subjectId]?.color ?? '#94a3b8' }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-sm ${on ? 'font-semibold text-fg' : 'text-fg-2'}`}>
                        {c.classId} — {SUBJECT_BY_ID[c.subjectId]?.name ?? c.subjectId}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-faint">
                        <span className={`badge ${STATUS_TINT[cc?.status ?? 'yoq']}`}>
                          {STATUS_LABELS[cc?.status ?? 'yoq']}
                        </span>
                        {cc && cc.summary.count > 0 && <span>{ball(cc.summary.avgMark)} ball</span>}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── Jurnal ────────────────────────────────────────────────── */}
          {!cell ? null : (
            <div className="space-y-4">
              <div className="card">
                <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-semibold text-fg">
                      {cell.classId} sinf · {SUBJECT_BY_ID[cell.subjectId]?.name ?? cell.subjectId}
                    </h2>
                    <p className="mt-0.5 text-xs text-muted">
                      Haftasiga {cell.hours} soat · rejada {cell.plannedBsb} ta BSB va 1 ta ChSB ·{' '}
                      {classRoster.length} o'quvchi
                    </p>
                  </div>
                  <span className={`badge ${STATUS_TINT[cell.status]}`}>{STATUS_LABELS[cell.status]}</span>
                </div>

                <div className="flex flex-wrap gap-2 px-4 py-3">
                  <button className="btn-primary" onClick={() => add('bsb')}>
                    <IcoPlus className="h-4 w-4" /> BSB qo'shish
                  </button>
                  <button
                    className="btn-ghost"
                    onClick={() => add('chsb')}
                    disabled={cell.works.some((w) => w.kind === 'chsb')}
                  >
                    <IcoPlus className="h-4 w-4" /> ChSB qo'shish
                  </button>
                  <span className="mx-1 hidden w-px self-stretch bg-line sm:block" />
                  <button className="btn-ghost" onClick={download} disabled={list.length === 0}>
                    <IcoTemplate className="h-4 w-4" /> Excel shablon
                  </button>
                  <button className="btn-ghost" onClick={() => fileRef.current?.click()} disabled={list.length === 0}>
                    <IcoUpload className="h-4 w-4" /> Fayldan yuklash
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      e.target.value = ''
                      if (f) void upload(f)
                    }}
                  />
                </div>
              </div>

              {list.length === 0 ? (
                <div className="card grid place-items-center gap-3 p-12 text-center">
                  <IcoJournal className="h-9 w-9 text-faint" />
                  <p className="text-sm text-muted">
                    Bu chorak uchun hali ish yaratilmagan. «BSB qo'shish» tugmasidan boshlang.
                  </p>
                </div>
              ) : (
                <div className="card overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-line bg-raised">
                        <th className="th w-10 text-center">№</th>
                        <th className="th min-w-[190px]">O'quvchi</th>
                        {list.map((w) => (
                          <th key={w.id} className="th min-w-[92px] text-center">
                            <div className="flex flex-col items-center gap-1">
                              <span className="flex items-center gap-1 font-semibold text-fg-2">
                                {workLabel(w)}
                                {w.submittedAt && <IcoLock className="h-3 w-3 text-emerald-500" />}
                              </span>
                              <span className="text-[10px] font-normal normal-case text-faint">
                                {w.maxScore} ball
                              </span>
                              <div className="flex gap-0.5">
                                {editable(w) ? (
                                  <>
                                    <button className="btn-icon h-6 w-6" title="Tahrirlash" onClick={() => setEdit(w)}>
                                      <IcoEdit className="h-3 w-3" />
                                    </button>
                                    <button
                                      className="btn-icon h-6 w-6"
                                      title="Topshirish"
                                      onClick={() => submit(w)}
                                    >
                                      <IcoCheck className="h-3 w-3" />
                                    </button>
                                    <button
                                      className="btn-icon h-6 w-6"
                                      title="O'chirish"
                                      onClick={() => {
                                        if (confirm(`${workLabel(w)} va undagi barcha ballar o'chirilsinmi?`))
                                          removeAssessment(w.id)
                                      }}
                                    >
                                      <IcoTrash className="h-3 w-3" />
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    className="btn-icon h-6 w-6"
                                    title="Ochish uchun so'rov yuborish"
                                    onClick={() => setAsk(w)}
                                  >
                                    <IcoSend className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </th>
                        ))}
                        <th className="th w-20 text-center">Foiz</th>
                        <th className="th w-16 text-center">Baho</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classRoster.map((st) => {
                        const r = cell.results.find((x) => x.studentId === st.id)
                        return (
                          <tr key={st.id} className="border-b border-line-soft last:border-0 hover:bg-raised/50">
                            <td className="td text-center text-xs text-faint">{st.order}</td>
                            <td className="td truncate font-medium text-fg">{st.fullName}</td>
                            {list.map((w) => (
                              <td key={w.id} className="px-1 py-1">
                                <div className="flex items-center gap-1">
                                  <ScoreInput
                                    value={w.scores[st.id]}
                                    max={w.maxScore}
                                    disabled={!editable(w)}
                                    absent={w.absent.includes(st.id)}
                                    onChange={(v) => setScore(w.id, st.id, v)}
                                  />
                                  {editable(w) && (
                                    <button
                                      className="btn-icon h-6 w-5 shrink-0"
                                      title={w.absent.includes(st.id) ? 'Kelgan deb belgilash' : 'Kelmadi'}
                                      onClick={() => toggleAbsent(w.id, st.id)}
                                    >
                                      {w.absent.includes(st.id) ? (
                                        <IcoOk className="h-3 w-3" />
                                      ) : (
                                        <IcoClose className="h-3 w-3" />
                                      )}
                                    </button>
                                  )}
                                </div>
                              </td>
                            ))}
                            <td className="td text-center tabular-nums text-muted">{pct(r?.percent ?? null)}</td>
                            <td className="td text-center">
                              {r?.mark ? (
                                <span className={`badge ${MARK_TINT[r.mark]} px-2 py-0.5 text-xs font-semibold`}>
                                  {r.mark}
                                </span>
                              ) : (
                                <span className="text-faint">—</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-line bg-raised text-xs">
                        <td className="td" colSpan={2}>
                          <span className="font-semibold uppercase tracking-wide text-muted">O'rtacha</span>
                        </td>
                        {list.map((w) => {
                          const vals = Object.values(w.scores)
                          const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
                          return (
                            <td key={w.id} className="td text-center tabular-nums text-fg-2">
                              {avg === null ? '—' : `${ball(avg)} / ${w.maxScore}`}
                            </td>
                          )
                        })}
                        <td className="td text-center tabular-nums font-semibold text-fg">
                          {pct(cell.summary.avgPercent)}
                        </td>
                        <td className="td text-center font-semibold text-fg">{ball(cell.summary.avgMark)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {/* Sinf natijasi */}
              {cell.summary.count > 0 && (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Stat label="Sifat" value={pct(cell.summary.quality)} hint="«4» va «5» ulushi" tone="indigo" />
                  <Stat label="O'zlashtirish" value={pct(cell.summary.progress)} hint="«3» va undan yuqori" tone="emerald" />
                  <Stat
                    label="Baholar"
                    value={`${cell.summary.dist[5]}·${cell.summary.dist[4]}·${cell.summary.dist[3]}·${cell.summary.dist[2]}`}
                    hint="5 · 4 · 3 · 2"
                  />
                  <Stat
                    label="Baholanmagan"
                    value={cell.ungraded}
                    hint="o'quvchi"
                    tone={cell.ungraded > 0 ? 'amber' : 'slate'}
                  />
                </div>
              )}

              <p className="flex gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-xs leading-relaxed text-muted">
                <IcoInfo className="mt-0.5 h-4 w-4 shrink-0 text-faint" />
                Chorak natijasi:{' '}
                <b className="font-semibold text-fg-2">
                  BSB foizi × {g.bsbWeight.toFixed(2).replace('.', ',')} + ChSB foizi ×{' '}
                  {g.chsbWeight.toFixed(2).replace('.', ',')}
                </b>
                . Baho chegaralari: «5» — {g.mark5}% dan, «4» — {g.mark4}% dan, «3» — {g.mark3}% dan.
                Ish topshirilgach uni faqat ma'muriyat qayta ocha oladi.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Ish sozlamalari ──────────────────────────────────────────── */}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit ? `${workLabel(edit)} — sozlamalar` : ''}>
        {edit && (
          <div className="space-y-3">
            <Field label="Ish nomi" hint="Masalan: «Sonlar va amallar» bo'limi">
              <input
                className="input"
                value={edit.title}
                onChange={(e) => setEdit({ ...edit, title: e.target.value })}
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Maksimal ball">
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={100}
                  value={edit.maxScore}
                  onChange={(e) => setEdit({ ...edit, maxScore: Math.max(1, Number(e.target.value) || 1) })}
                />
              </Field>
              <Field label="O'tkazilgan sana">
                <input
                  className="input"
                  type="date"
                  value={edit.date}
                  onChange={(e) => setEdit({ ...edit, date: e.target.value })}
                />
              </Field>
            </div>
            {edit.maxScore !== (assessments.find((a) => a.id === edit.id)?.maxScore ?? edit.maxScore) && (
              <p className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                <IcoWarn className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Maksimal ball o'zgarsa, undan katta ballar yangi chegaraga tushiriladi.
              </p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button className="btn-ghost" onClick={() => setEdit(null)}>
                Bekor qilish
              </button>
              <button
                className="btn-primary"
                onClick={() => {
                  updateAssessment(edit.id, {
                    title: edit.title.trim() || workLabel(edit),
                    maxScore: edit.maxScore,
                    date: edit.date,
                  })
                  setEdit(null)
                }}
              >
                <IcoCheck className="h-4 w-4" /> Saqlash
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Qayta ochish so'rovi ─────────────────────────────────────── */}
      <Modal open={!!ask} onClose={() => setAsk(null)} title="Baholashni qayta ochish so'rovi">
        {ask && (
          <div className="space-y-3">
            <p className="text-sm text-muted">
              <b className="text-fg-2">
                {ask.classId} · {SUBJECT_BY_ID[ask.subjectId]?.name} · {workLabel(ask)}
              </b>{' '}
              topshirilgan va rahbariyat hisobotiga kirgan. Uni tahrirlash uchun sabab yozib so'rov
              yuboring.
            </p>
            <Field label="Sabab">
              <textarea
                className="input min-h-[110px] resize-y"
                value={askText}
                onChange={(e) => setAskText(e.target.value)}
                placeholder="Masalan: 3 ta o'quvchi kasal bo'lgani uchun ishni keyin topshirdi, ballarini kiritishim kerak."
              />
            </Field>
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setAsk(null)}>
                Bekor qilish
              </button>
              <button className="btn-primary" onClick={sendRequest}>
                <IcoSend className="h-4 w-4" /> Yuborish
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Excel yuklash natijasi ───────────────────────────────────── */}
      <Modal open={!!report} onClose={() => setReport(null)} title="Fayl o'qildi">
        {report && (
          <div className="space-y-3 text-sm">
            {report.errors.length > 0 ? (
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-rose-700 dark:text-rose-300">
                {report.errors.map((e, i) => (
                  <p key={i} className="flex gap-2">
                    <IcoWarn className="mt-0.5 h-4 w-4 shrink-0" />
                    {e}
                  </p>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-700 dark:text-emerald-300">
                <p className="flex gap-2">
                  <IcoOk className="mt-0.5 h-4 w-4 shrink-0" />
                  {report.matched} ta o'quvchi topildi, {report.values} ta ball kiritildi.
                </p>
              </div>
            )}
            {report.missingColumns.length > 0 && (
              <p className="text-xs text-muted">
                Faylda ustuni topilmagan ishlar: {report.missingColumns.join(', ')}
              </p>
            )}
            {report.warnings.length > 0 && (
              <ul className="space-y-1 text-xs text-amber-700 dark:text-amber-300">
                {report.warnings.slice(0, 8).map((w, i) => (
                  <li key={i} className="flex gap-2">
                    <IcoWarn className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {w}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex justify-end">
              <button className="btn-primary" onClick={() => setReport(null)}>
                Tushunarli
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
