import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase, errText } from '../../lib/supabase'
import { useAuth } from '../../store/auth'
import { useToast } from '../../ui/Toast'
import { Field, Loading, Modal, Page, PageHeader, Segmented, TableWrap } from '../../ui/ui'
import { Select } from '../../ui/Select'
import { IcoPlus, IcoTrash, IcoUsers, IcoGrade, IcoPlan } from '../../ui/icons'
import { ball, pct, workLabel, BSB_TOTAL, CHSB_TOTAL, EXTRA_TOTAL, MARK_TINT } from '../../lib/grading'
import GradeTable from './GradeTable'
import ExtraTable from './ExtraTable'
import GroupsModal from './GroupsModal'
import type {
  AcademicYear, Assessment, Assignment, Group, PlanStatusRow, Quarter, SchoolClass,
  StudentQuarter, Subject,
} from '../../lib/types'

type Tab = string // assessment id | 'extra' | 'summary'

export default function JournalPage() {
  const { profile } = useAuth()
  const toast = useToast()

  const [params, setParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState<AcademicYear | null>(null)
  const [subject, setSubject] = useState<Subject | null>(null)
  const [classes, setClasses] = useState<SchoolClass[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [groups, setGroups] = useState<Group[]>([])

  const [classId, setClassId] = useState('')
  const [groupId, setGroupId] = useState<string>('') // '' — butun sinf
  const [quarter, setQuarter] = useState<Quarter>(1)
  const [tab, setTab] = useState<Tab>('summary')

  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [summary, setSummary] = useState<StudentQuarter[]>([])
  const [plan, setPlan] = useState<PlanStatusRow[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const [groupsOpen, setGroupsOpen] = useState(false)
  const [newMax, setNewMax] = useState('10')
  const [newTitle, setNewTitle] = useState('')
  const [busy, setBusy] = useState(false)

  /* ─────────────────────────── Yuklash ─────────────────────────── */

  const loadBase = useCallback(async () => {
    if (!profile) return
    const y = await supabase.from('academic_years').select('*').eq('is_active', true).maybeSingle()
    const yr = (y.data as AcademicYear) ?? null
    setYear(yr)

    const [c, a, s] = await Promise.all([
      yr
        ? supabase.from('classes').select('*').eq('year_id', yr.id).order('grade').order('letter')
        : Promise.resolve({ data: [] as SchoolClass[] }),
      supabase.from('assignments').select('*').eq('teacher_id', profile.id),
      profile.subject_id
        ? supabase.from('subjects').select('*').eq('id', profile.subject_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ])
    const cl = (c.data as SchoolClass[]) ?? []
    setClasses(cl)
    setAssignments((a.data as Assignment[]) ?? [])
    setSubject((s.data as Subject) ?? null)
    setClassId((prev) => prev || cl[0]?.id || '')
    setLoading(false)
  }, [profile])

  useEffect(() => {
    void loadBase()
  }, [loadBase])

  // Eslatmadagi havoladan kelgan bo'lsa — shu sinf va chorakni ochamiz
  useEffect(() => {
    const c = params.get('class')
    const q = Number(params.get('q'))
    if (!c && !q) return
    if (c) setClassId(c)
    if (q >= 1 && q <= 4) setQuarter(q as Quarter)
    setTab('summary')
    setParams({}, { replace: true })
  }, [params, setParams])

  // Tanlangan sinf uchun guruhlar (bo'linadigan fanda)
  const loadGroups = useCallback(async () => {
    if (!classId || !subject?.is_split || !profile?.subject_id) return setGroups([])
    const { data } = await supabase
      .from('groups')
      .select('*')
      .eq('class_id', classId)
      .eq('subject_id', profile.subject_id)
      .order('name')
    setGroups((data as Group[]) ?? [])
  }, [classId, subject, profile])

  useEffect(() => {
    void loadGroups()
  }, [loadGroups])

  const assignment = useMemo(
    () =>
      assignments.find(
        (a) => a.class_id === classId && (a.group_id ?? '') === groupId,
      ) ?? null,
    [assignments, classId, groupId],
  )

  // Shu sinf-fan-chorak uchun rejadagi ishlar
  const loadPlan = useCallback(async () => {
    if (!classId || !profile?.subject_id) return setPlan([])
    const { data } = await supabase
      .from('v_plan_status')
      .select('*')
      .eq('class_id', classId)
      .eq('subject_id', profile.subject_id)
      .eq('quarter', quarter)
      .order('planned_on')
    setPlan((data as PlanStatusRow[]) ?? [])
  }, [classId, profile, quarter])

  useEffect(() => {
    void loadPlan()
  }, [loadPlan])

  const loadWorks = useCallback(async () => {
    if (!assignment) {
      setAssessments([])
      setSummary([])
      return
    }
    const [w, s] = await Promise.all([
      supabase
        .from('assessments')
        .select('*')
        .eq('assignment_id', assignment.id)
        .eq('quarter', quarter)
        .order('kind')
        .order('idx'),
      supabase
        .from('v_student_quarter')
        .select('*')
        .eq('assignment_id', assignment.id)
        .eq('quarter', quarter),
    ])
    setAssessments((w.data as Assessment[]) ?? [])
    setSummary((s.data as StudentQuarter[]) ?? [])
  }, [assignment, quarter])

  useEffect(() => {
    void loadWorks()
  }, [loadWorks])

  /* ─────────────────────────── Amallar ─────────────────────────── */

  async function startJournal() {
    if (!profile?.subject_id || !classId) return
    setBusy(true)
    const { data, error } = await supabase
      .from('assignments')
      .insert({
        class_id: classId,
        subject_id: profile.subject_id,
        teacher_id: profile.id,
        group_id: groupId || null,
      })
      .select()
      .single()
    setBusy(false)
    if (error)
      return toast.err(
        /duplicate/i.test(error.message)
          ? 'Bu sinf-fan boshqa o‘qituvchiga biriktirilgan'
          : errText(error),
      )
    setAssignments((l) => [...l, data as Assignment])
    toast.ok('Jurnal ochildi')
  }

  async function addWork(kind: 'bsb' | 'chsb') {
    if (!assignment) return
    const bsbs = assessments.filter((a) => a.kind === 'bsb')
    const used = bsbs.reduce((n, a) => n + Number(a.max_points), 0)
    const max = kind === 'chsb' ? CHSB_TOTAL : Number(newMax)

    if (kind === 'bsb') {
      if (!max || max <= 0) return toast.err('Ball noto‘g‘ri')
      if (used + max > BSB_TOTAL)
        return toast.err(`BSB lar jami ${BSB_TOTAL} ball — yana ${BSB_TOTAL - used} ball qoldi`)
    }

    const { data, error } = await supabase
      .from('assessments')
      .insert({
        assignment_id: assignment.id,
        quarter,
        kind,
        idx: kind === 'chsb' ? 1 : bsbs.length + 1,
        title: newTitle.trim() || null,
        max_points: max,
      })
      .select()
      .single()
    if (error) return toast.err(errText(error))
    setAssessments((l) => [...l, data as Assessment])
    setAddOpen(false)
    setNewTitle('')
    setTab((data as Assessment).id)
  }

  /** Rejadagi ishni jurnalda yaratish */
  async function createFromPlan(pl: PlanStatusRow) {
    if (!assignment) return
    const used = assessments
      .filter((a) => a.kind === 'bsb')
      .reduce((n, a) => n + Number(a.max_points), 0)
    const max =
      pl.kind === 'chsb'
        ? CHSB_TOTAL
        : Number(pl.max_points ?? Math.min(10, Math.max(1, BSB_TOTAL - used)))

    if (pl.kind === 'bsb' && used + max > BSB_TOTAL)
      return toast.err(`BSB lar jami ${BSB_TOTAL} ball — yana ${BSB_TOTAL - used} ball qoldi`)

    const { data, error } = await supabase
      .from('assessments')
      .insert({
        assignment_id: assignment.id,
        quarter,
        kind: pl.kind,
        idx: pl.idx,
        max_points: max,
        held_on: pl.planned_on,
      })
      .select()
      .single()
    if (error) return toast.err(errText(error))
    setAssessments((l) => [...l, data as Assessment])
    setTab((data as Assessment).id)
    toast.ok(`${workLabel(pl.kind, pl.idx)} yaratildi — baholashni boshlang`)
    void loadPlan()
  }

  async function removeWork(a: Assessment) {
    if (!confirm(`${workLabel(a.kind, a.idx)} va unga qo‘yilgan baholar o‘chiriladi. Davom etasizmi?`))
      return
    const { error } = await supabase.from('assessments').delete().eq('id', a.id)
    if (error) return toast.err(errText(error))
    setAssessments((l) => l.filter((x) => x.id !== a.id))
    if (tab === a.id) setTab('summary')
    void loadWorks()
  }

  /* ─────────────────────────── Ko'rinish ─────────────────────────── */

  if (loading) return <Loading />

  if (!profile?.subject_id)
    return (
      <Page>
        <div className="card p-10 text-center text-sm text-faint">
          Sizga fan biriktirilmagan. Administratorga murojaat qiling.
        </div>
      </Page>
    )

  if (!year || classes.length === 0)
    return (
      <Page>
        <div className="card p-10 text-center text-sm text-faint">
          Sinflar hali kiritilmagan — menejer Excel'dan yuklashi kerak.
        </div>
      </Page>
    )

  const bsbs = assessments.filter((a) => a.kind === 'bsb')
  const chsb = assessments.find((a) => a.kind === 'chsb')
  // rejada bor, lekin jurnalda hali yaratilmagan ishlar
  const pendingPlan = plan.filter(
    (pl) => !assessments.some((a) => a.kind === pl.kind && a.idx === pl.idx),
  )
  const used = bsbs.reduce((n, a) => n + Number(a.max_points), 0)
  const current = assessments.find((a) => a.id === tab)
  const cls = classes.find((c) => c.id === classId)
  const clsName = cls ? `${cls.grade}${cls.letter}` : ''

  return (
    <Page>
      <PageHeader
        title="Jurnal"
        subtitle={`${subject?.name ?? ''} · ${year.name}`}
        actions={
          subject?.is_split && classId ? (
            <button onClick={() => setGroupsOpen(true)} className="btn-ghost">
              <IcoUsers className="h-4 w-4" /> Guruhlar
            </button>
          ) : null
        }
      />

      {/* Sinf, guruh, chorak */}
      <div className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <Field label="Sinf">
          <div className="min-w-32">
            <Select
              value={classId}
              onChange={(v) => {
                setClassId(v)
                setGroupId('')
                setTab('summary')
              }}
              options={classes.map((c) => ({ value: c.id, label: `${c.grade}${c.letter}` }))}
              placeholder="— sinf —"
            />
          </div>
        </Field>

        {subject?.is_split && (
          <Field label="Guruh">
            <div className="min-w-40">
              <Select
                value={groupId}
                onChange={(v) => {
                  setGroupId(v)
                  setTab('summary')
                }}
                options={[
                  { value: '', label: 'Butun sinf' },
                  ...groups.map((g) => ({ value: g.id, label: g.name })),
                ]}
              />
            </div>
          </Field>
        )}

        <div>
          <span className="mb-1 block text-xs font-medium text-fg-2">Chorak</span>
          <Segmented
            value={quarter}
            onChange={(q) => {
              setQuarter(q)
              setTab('summary')
            }}
            items={[1, 2, 3, 4].map((n) => ({ value: n as Quarter, label: `${n}` }))}
          />
        </div>

        {assignment && (
          <div className="ml-auto text-right text-xs text-muted">
            <div>
              BSB taqsimlandi: <b className="text-fg">{ball(used, 0)}</b> / {BSB_TOTAL}
            </div>
            <div>
              ChSB: {chsb ? <b className="text-fg">{CHSB_TOTAL}</b> : 'kiritilmagan'} · 10 ballik:{' '}
              {EXTRA_TOTAL}
            </div>
          </div>
        )}
      </div>

      {!assignment ? (
        <div className="card flex flex-col items-center gap-3 p-10 text-center">
          <IcoGrade className="h-8 w-8 text-faint" />
          <p className="text-sm text-muted">
            {clsName} sinfida <b>{subject?.name}</b>
            {groupId ? ` (${groups.find((g) => g.id === groupId)?.name})` : ''} uchun jurnal hali
            ochilmagan.
          </p>
          {subject?.is_split && !groupId && groups.length > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Bu fan guruhlarga bo‘linadi — avval guruhni tanlang.
            </p>
          )}
          <button onClick={() => void startJournal()} disabled={busy} className="btn-primary">
            {busy ? 'Ochilmoqda…' : 'Jurnalni ochish'}
          </button>
        </div>
      ) : (
        <>
          {/* Rejada bor, lekin hali yaratilmagan ishlar */}
          {pendingPlan.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/[0.06] px-4 py-2.5">
              <span className="flex items-center gap-1.5 text-sm font-medium text-fg">
                <IcoPlan className="h-4 w-4 text-indigo-500" />
                Rejada bor:
              </span>
              {pendingPlan.map((pl) => {
                const late = pl.days < 0
                const today = pl.days === 0
                return (
                  <button
                    key={pl.plan_id}
                    onClick={() => void createFromPlan(pl)}
                    className="btn-ghost py-1 text-xs"
                    title="Jurnalda shu ishni yaratish"
                  >
                    <IcoPlus className="h-3.5 w-3.5" />
                    {workLabel(pl.kind, pl.idx)}
                    <span
                      className={`ml-1 ${
                        late
                          ? 'text-rose-600 dark:text-rose-400'
                          : today
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-muted'
                      }`}
                    >
                      {new Date(pl.planned_on + 'T00:00:00').toLocaleDateString('uz-UZ', {
                        day: '2-digit',
                        month: 'short',
                      })}
                      {late && ` · ${Math.abs(pl.days)} kun kechikdi`}
                      {today && ' · bugun'}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {/* Ishlar ro'yxati */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <button
              onClick={() => setTab('summary')}
              className={`btn ${tab === 'summary' ? 'btn-primary' : 'btn-ghost'}`}
            >
              Chorak yakuni
            </button>

            {bsbs.map((a) => (
              <span key={a.id} className="inline-flex items-center">
                <button
                  onClick={() => setTab(a.id)}
                  className={`btn rounded-r-none ${tab === a.id ? 'btn-primary' : 'btn-ghost'}`}
                  title={a.title ?? undefined}
                >
                  {workLabel(a.kind, a.idx)}
                  <span className="ml-1 text-[11px] opacity-70">{ball(a.max_points, 0)}</span>
                </button>
                <button
                  onClick={() => void removeWork(a)}
                  className={`btn rounded-l-none border-l-0 px-1.5 ${
                    tab === a.id ? 'btn-primary' : 'btn-ghost'
                  }`}
                  title="O‘chirish"
                >
                  <IcoTrash className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}

            {chsb ? (
              <span className="inline-flex items-center">
                <button
                  onClick={() => setTab(chsb.id)}
                  className={`btn rounded-r-none ${tab === chsb.id ? 'btn-primary' : 'btn-ghost'}`}
                >
                  ChSB <span className="ml-1 text-[11px] opacity-70">{CHSB_TOTAL}</span>
                </button>
                <button
                  onClick={() => void removeWork(chsb)}
                  className={`btn rounded-l-none border-l-0 px-1.5 ${
                    tab === chsb.id ? 'btn-primary' : 'btn-ghost'
                  }`}
                  title="O‘chirish"
                >
                  <IcoTrash className="h-3.5 w-3.5" />
                </button>
              </span>
            ) : (
              <button onClick={() => void addWork('chsb')} className="btn-ghost">
                <IcoPlus className="h-4 w-4" /> ChSB ({CHSB_TOTAL})
              </button>
            )}

            <button
              onClick={() => setTab('extra')}
              className={`btn ${tab === 'extra' ? 'btn-primary' : 'btn-ghost'}`}
            >
              10 ballik
            </button>

            {used < BSB_TOTAL && (
              <button
                onClick={() => {
                  setNewMax(String(Math.min(10, BSB_TOTAL - used)))
                  setAddOpen(true)
                }}
                className="btn-soft"
              >
                <IcoPlus className="h-4 w-4" /> BSB qo‘shish
              </button>
            )}
          </div>

          {/* Mazmun */}
          {tab === 'summary' ? (
            <QuarterSummary rows={summary} />
          ) : tab === 'extra' ? (
            <ExtraTable
              assignmentId={assignment.id}
              quarter={quarter}
              onChanged={() => void loadWorks()}
            />
          ) : current ? (
            <GradeTable assessment={current} onChanged={() => void loadWorks()} />
          ) : (
            <div className="card p-10 text-center text-sm text-faint">Ish tanlanmagan</div>
          )}
        </>
      )}

      {/* BSB qo'shish */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Yangi BSB">
        <div className="space-y-3">
          <Field
            label="Maksimal ball"
            hint={`Chorakdagi barcha BSB lar jami ${BSB_TOTAL} ball. Qoldi: ${BSB_TOTAL - used}`}
          >
            <input
              className="input"
              type="number"
              min={1}
              max={BSB_TOTAL - used}
              value={newMax}
              onChange={(e) => setNewMax(e.target.value)}
            />
          </Field>
          <Field label="Nomi (ixtiyoriy)">
            <input
              className="input"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="1-bo‘lim: Sonlar"
            />
          </Field>
          <div className="flex justify-end gap-2">
            <button onClick={() => setAddOpen(false)} className="btn-ghost">
              Bekor qilish
            </button>
            <button onClick={() => void addWork('bsb')} className="btn-primary">
              Qo‘shish
            </button>
          </div>
        </div>
      </Modal>

      {profile.subject_id && classId && (
        <GroupsModal
          open={groupsOpen}
          onClose={() => setGroupsOpen(false)}
          classId={classId}
          subjectId={profile.subject_id}
          className={clsName}
          onSaved={() => void loadGroups()}
        />
      )}
    </Page>
  )
}

/** Chorak yakuni: har bir o'quvchining BSB, ChSB, 10 ballik va jami bali */
function QuarterSummary({ rows }: { rows: StudentQuarter[] }) {
  if (rows.length === 0)
    return (
      <div className="card p-10 text-center text-sm text-faint">
        Bu chorakda hali baho yo‘q. BSB qo‘shib, baholashni boshlang.
      </div>
    )

  const sorted = [...rows].sort((a, b) => a.student_name.localeCompare(b.student_name))
  const avg = rows.reduce((s, r) => s + r.pct, 0) / rows.length

  return (
    <div>
      <TableWrap>
        <table className="w-full min-w-[720px]">
          <thead className="border-b border-line bg-raised">
            <tr>
              <th className="th w-10">#</th>
              <th className="th">O‘quvchi</th>
              <th className="th text-center">BSB</th>
              <th className="th text-center">ChSB</th>
              <th className="th text-center">10 ballik</th>
              <th className="th text-center">Jami</th>
              <th className="th text-center">Foiz</th>
              <th className="th text-center">Baho</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={r.student_id} className="border-b border-line-soft last:border-0">
                <td className="td text-faint">{i + 1}</td>
                <td className="td font-medium text-fg">{r.student_name}</td>
                <td className="td text-center tabular-nums">{ball(r.bsb_points, 0)}</td>
                <td className="td text-center tabular-nums">{ball(r.chsb_points, 0)}</td>
                <td className="td text-center tabular-nums">{ball(r.extra_points, 0)}</td>
                <td className="td text-center tabular-nums">
                  {ball(r.points, 0)} / {ball(r.max_points, 0)}
                </td>
                <td className="td text-center tabular-nums">{pct(r.pct)}</td>
                <td className="td text-center">
                  <span className={`badge ${MARK_TINT[r.mark]}`}>{r.mark}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
      <p className="mt-2 text-xs text-faint">
        Sinf o‘rtachasi: <b className="text-fg-2">{pct(avg)}</b>. «Jami» — hozirgacha kiritilgan
        ishlar bo‘yicha; chorak to‘liq yakunlanganda maksimal 100 ball bo‘ladi.
      </p>
    </div>
  )
}
