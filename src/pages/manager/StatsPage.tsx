import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase, errText } from '../../lib/supabase'
import { useToast } from '../../ui/Toast'
import { Loading, Page, PageHeader, Segmented, Stat, TableWrap } from '../../ui/ui'
import { IcoExcel, IcoTrend } from '../../ui/icons'
import { ball, delta, deltaTone, pct, QUARTER_PAIRS, pairAvg } from '../../lib/grading'
import { exportSheets, today } from '../../lib/excel'
import type { Sheet } from '../../lib/excel'
import type {
  AcademicYear, ClassQuarter, Profile, SchoolQuarter, SubjectQuarter,
  TeacherActivity, TeacherBlocked, TeacherQuarter,
} from '../../lib/types'

type Tab = 'teachers' | 'classes' | 'subjects'

/** Bir kesimning choraklar bo'yicha qatori */
interface Line {
  key: string
  name: string
  hint?: string
  q: Record<number, number | null>
  students: number
}

const QS = [1, 2, 3, 4] as const

/** Choraklar bo'yicha o'sish: oxirgi mavjud chorak − birinchi mavjud chorak */
function growth(q: Record<number, number | null>): number | null {
  const vals = QS.map((n) => q[n]).filter((v): v is number => v !== null && v !== undefined)
  if (vals.length < 2) return null
  return vals[vals.length - 1] - vals[0]
}

export default function StatsPage() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState<AcademicYear | null>(null)
  const [school, setSchool] = useState<SchoolQuarter[]>([])
  const [teachers, setTeachers] = useState<TeacherQuarter[]>([])
  const [classes, setClasses] = useState<ClassQuarter[]>([])
  const [subjects, setSubjects] = useState<SubjectQuarter[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [activity, setActivity] = useState<TeacherActivity[]>([])
  const [blocked, setBlocked] = useState<TeacherBlocked[]>([])
  const [tab, setTab] = useState<Tab>('teachers')

  const load = useCallback(async () => {
    const y = await supabase.from('academic_years').select('*').eq('is_active', true).maybeSingle()
    const yr = (y.data as AcademicYear) ?? null
    setYear(yr)
    if (!yr) return setLoading(false)

    const [s, t, c, sub, p, a, b] = await Promise.all([
      supabase.from('v_school_quarter').select('*').eq('year_id', yr.id).order('quarter'),
      supabase.from('v_teacher_quarter').select('*').eq('year_id', yr.id),
      supabase.from('v_class_quarter').select('*').eq('year_id', yr.id),
      supabase.from('v_subject_quarter').select('*').eq('year_id', yr.id),
      supabase.from('profiles').select('*'),
      supabase.from('v_teacher_activity').select('*'),
      supabase.from('v_teacher_blocked').select('*'),
    ])
    if (s.error) toast.err(errText(s.error))
    setSchool((s.data as SchoolQuarter[]) ?? [])
    setTeachers((t.data as TeacherQuarter[]) ?? [])
    setClasses((c.data as ClassQuarter[]) ?? [])
    setSubjects((sub.data as SubjectQuarter[]) ?? [])
    setProfiles((p.data as Profile[]) ?? [])
    setActivity((a.data as TeacherActivity[]) ?? [])
    setBlocked((b.data as TeacherBlocked[]) ?? [])
    setLoading(false)
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  const schoolQ = useMemo(() => {
    const q: Record<number, number | null> = { 1: null, 2: null, 3: null, 4: null }
    for (const r of school) q[r.quarter] = r.avg_pct
    return q
  }, [school])

  const lines = useMemo<Line[]>(() => {
    const byName = new Map(profiles.map((p) => [p.id, `${p.last_name} ${p.first_name}`]))

    const group = <T extends { quarter: number; avg_pct: number | null; students: number }>(
      rows: T[],
      keyOf: (r: T) => string,
      nameOf: (r: T) => string,
      hintOf?: (r: T) => string,
    ): Line[] => {
      const map = new Map<string, Line>()
      for (const r of rows) {
        const key = keyOf(r)
        const line =
          map.get(key) ??
          { key, name: nameOf(r), hint: hintOf?.(r), q: { 1: null, 2: null, 3: null, 4: null }, students: 0 }
        line.q[r.quarter] = r.avg_pct
        line.students = Math.max(line.students, r.students)
        map.set(key, line)
      }
      return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
    }

    if (tab === 'teachers')
      return group(
        teachers,
        (r) => r.teacher_id,
        (r) => byName.get(r.teacher_id) ?? 'O‘chirilgan o‘qituvchi',
        (r) => `${r.classes} sinf`,
      )
    if (tab === 'classes')
      return group(classes, (r) => r.class_id, (r) => r.class_name, (r) => `${r.subjects} fan`)
    return group(subjects, (r) => String(r.subject_id), (r) => r.subject_name, (r) => `${r.teachers} o‘qituvchi`)
  }, [tab, teachers, classes, subjects, profiles])

  const activityByTeacher = useMemo(() => {
    const m = new Map<string, { changes: number; manual: number; auto: number; blocked: number }>()
    for (const a of activity) {
      const v = m.get(a.teacher_id) ?? { changes: 0, manual: 0, auto: 0, blocked: 0 }
      v.changes += a.changes
      v.manual += a.manual_changes
      v.auto += a.auto_changes
      m.set(a.teacher_id, v)
    }
    for (const b of blocked) {
      const v = m.get(b.teacher_id) ?? { changes: 0, manual: 0, auto: 0, blocked: 0 }
      v.blocked += b.blocked
      m.set(b.teacher_id, v)
    }
    return m
  }, [activity, blocked])

  async function exportAll() {
    const byName = new Map(profiles.map((p) => [p.id, `${p.last_name} ${p.first_name}`]))
    const head = ['Nomi', '1-chorak', '2-chorak', '3-chorak', '4-chorak', 'O‘sish', 'O‘quvchi']

    const linesOf = (rows: Line[]) =>
      rows.map((l) => [
        l.name,
        l.q[1] ?? '',
        l.q[2] ?? '',
        l.q[3] ?? '',
        l.q[4] ?? '',
        growth(l.q) ?? '',
        l.students,
      ])

    const teacherLines: Line[] = (() => {
      const m = new Map<string, Line>()
      for (const r of teachers) {
        const l =
          m.get(r.teacher_id) ??
          {
            key: r.teacher_id,
            name: byName.get(r.teacher_id) ?? '—',
            q: { 1: null, 2: null, 3: null, 4: null },
            students: 0,
          }
        l.q[r.quarter] = r.avg_pct
        l.students = Math.max(l.students, r.students)
        m.set(r.teacher_id, l)
      }
      return [...m.values()].sort((a, b) => a.name.localeCompare(b.name))
    })()

    const classLines: Line[] = (() => {
      const m = new Map<string, Line>()
      for (const r of classes) {
        const l =
          m.get(r.class_id) ??
          { key: r.class_id, name: r.class_name, q: { 1: null, 2: null, 3: null, 4: null }, students: 0 }
        l.q[r.quarter] = r.avg_pct
        l.students = Math.max(l.students, r.students)
        m.set(r.class_id, l)
      }
      return [...m.values()].sort((a, b) => a.name.localeCompare(b.name))
    })()

    const subjectLines: Line[] = (() => {
      const m = new Map<string, Line>()
      for (const r of subjects) {
        const k = String(r.subject_id)
        const l =
          m.get(k) ?? { key: k, name: r.subject_name, q: { 1: null, 2: null, 3: null, 4: null }, students: 0 }
        l.q[r.quarter] = r.avg_pct
        l.students = Math.max(l.students, r.students)
        m.set(k, l)
      }
      return [...m.values()].sort((a, b) => a.name.localeCompare(b.name))
    })()

    const sheets: Sheet[] = [
      {
        name: 'Maktab',
        rows: [
          ['Ko‘rsatkich', '1-chorak', '2-chorak', '3-chorak', '4-chorak'],
          ['O‘rtacha foiz', ...QS.map((n) => school.find((r) => r.quarter === n)?.avg_pct ?? '')],
          ['O‘rtacha baho', ...QS.map((n) => school.find((r) => r.quarter === n)?.avg_mark ?? '')],
          ['Sifat, %', ...QS.map((n) => school.find((r) => r.quarter === n)?.quality ?? '')],
          ['O‘zlashtirish, %', ...QS.map((n) => school.find((r) => r.quarter === n)?.progress ?? '')],
          ['O‘quvchilar', ...QS.map((n) => school.find((r) => r.quarter === n)?.students ?? '')],
          [],
          ['Choraklar juftligi', 'O‘rtacha'],
          ...QUARTER_PAIRS.map((p) => [p.label, pairAvg(schoolQ[p.a], schoolQ[p.b]) ?? '']),
        ],
      },
      { name: 'O‘qituvchilar', rows: [head, ...linesOf(teacherLines)] },
      { name: 'Sinflar', rows: [head, ...linesOf(classLines)] },
      { name: 'Fanlar', rows: [head, ...linesOf(subjectLines)] },
      {
        name: 'Faollik',
        rows: [
          ['O‘qituvchi', 'Jami o‘zgarish', 'Qo‘lda', 'Avtomatik', 'To‘xtatilgan urinish'],
          ...[...activityByTeacher.entries()].map(([id, v]) => [
            byName.get(id) ?? '—',
            v.changes,
            v.manual,
            v.auto,
            v.blocked,
          ]),
        ],
      },
    ]

    await exportSheets(`statistika-${year?.name ?? ''}-${today()}.xlsx`, sheets)
    toast.ok('Excel fayl yuklab olindi')
  }

  if (loading) return <Loading />
  if (!year)
    return (
      <Page>
        <div className="card p-10 text-center text-sm text-faint">
          Faol o‘quv yili yo‘q — administrator Sozlamalarda qo‘shishi kerak.
        </div>
      </Page>
    )

  const g = growth(schoolQ)
  const last = QS.map((n) => schoolQ[n]).filter((v): v is number => v !== null).at(-1) ?? null

  return (
    <Page>
      <PageHeader
        title="Maktab statistikasi"
        subtitle={`${year.name} o‘quv yili · faqat ko‘rsatkichlar, baholarning o‘zi emas`}
        actions={
          <button onClick={() => void exportAll()} className="btn-primary">
            <IcoExcel className="h-4 w-4" /> Excel'ga yuklash
          </button>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Hozirgi o‘rtacha"
          value={pct(last)}
          hint={`${school.at(-1)?.students ?? 0} o‘quvchi`}
        />
        <Stat
          label="Yillik o‘sish"
          value={
            <span className={deltaTone(g)}>
              {delta(g)}
              {g !== null && '%'}
            </span>
          }
          hint="1-chorakdan oxirgisiga"
          tone={g !== null && g < 0 ? 'rose' : 'emerald'}
        />
        <Stat
          label="Sifat"
          value={pct(school.at(-1)?.quality ?? null)}
          hint="«4» va «5» baholilar ulushi"
        />
        <Stat
          label="O‘zlashtirish"
          value={pct(school.at(-1)?.progress ?? null)}
          hint="«3» va yuqori baholilar"
        />
      </div>

      {/* Choraklar va juftliklar */}
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-fg">
            <IcoTrend className="h-4 w-4 text-indigo-500" /> Choraklar bo‘yicha o‘sish
          </h2>
          <div className="grid grid-cols-4 gap-2">
            {QS.map((n, i) => {
              const v = schoolQ[n]
              const prev = i > 0 ? schoolQ[QS[i - 1]] : null
              const d = v !== null && prev !== null ? v - prev : null
              return (
                <div key={n} className="rounded-lg bg-raised p-3 text-center">
                  <div className="text-[11px] text-muted">{n}-chorak</div>
                  <div className="text-lg font-semibold tabular-nums text-fg">{ball(v, 1)}</div>
                  <div className={`text-xs tabular-nums ${deltaTone(d)}`}>{delta(d)}</div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="card p-5">
          <h2 className="mb-3 text-sm font-semibold text-fg">Choraklarni qo‘shib o‘rtachasi</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {QUARTER_PAIRS.map((p) => {
              const v = pairAvg(schoolQ[p.a], schoolQ[p.b])
              return (
                <div key={p.label} className="rounded-lg bg-raised p-3 text-center">
                  <div className="text-[11px] text-muted">{p.label}</div>
                  <div className="text-lg font-semibold tabular-nums text-fg">{ball(v, 1)}</div>
                </div>
              )
            })}
          </div>
          <p className="mt-2 text-[11px] text-faint">
            1+2 va 3+4 — yarim yilliklar; 1+3 va 2+4 — juft/toq choraklar. Har bir chorak o‘sib
            borgani uchun bu o‘rtachalar ham o‘sadi.
          </p>
        </div>
      </div>

      {/* Kesimlar */}
      <div className="mb-3">
        <Segmented
          value={tab}
          onChange={setTab}
          items={[
            { value: 'teachers' as const, label: 'O‘qituvchilar' },
            { value: 'classes' as const, label: 'Sinflar' },
            { value: 'subjects' as const, label: 'Fanlar' },
          ]}
        />
      </div>

      {lines.length === 0 ? (
        <div className="card p-10 text-center text-sm text-faint">
          Hali baho kiritilmagan — statistika baholar paydo bo‘lgach ko‘rinadi.
        </div>
      ) : (
        <TableWrap>
          <table className="w-full min-w-[760px]">
            <thead className="border-b border-line bg-raised">
              <tr>
                <th className="th">Nomi</th>
                {QS.map((n) => (
                  <th key={n} className="th text-center">
                    {n}-chorak
                  </th>
                ))}
                <th className="th text-center">O‘sish</th>
                {tab === 'teachers' && <th className="th text-center">Qo‘lda / avto</th>}
                {tab === 'teachers' && <th className="th text-center">To‘xtatilgan</th>}
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => {
                const d = growth(l.q)
                const act = activityByTeacher.get(l.key)
                return (
                  <tr key={l.key} className="border-b border-line-soft last:border-0">
                    <td className="td">
                      <div className="font-medium text-fg">{l.name}</div>
                      {l.hint && <div className="text-[11px] text-faint">{l.hint}</div>}
                    </td>
                    {QS.map((n) => (
                      <td key={n} className="td text-center tabular-nums">
                        {l.q[n] !== null && l.q[n] !== undefined ? (
                          ball(l.q[n], 1)
                        ) : (
                          <span className="text-faint">—</span>
                        )}
                      </td>
                    ))}
                    <td className={`td text-center font-medium tabular-nums ${deltaTone(d)}`}>
                      {delta(d)}
                    </td>
                    {tab === 'teachers' && (
                      <td className="td text-center text-xs tabular-nums text-muted">
                        {act ? `${act.manual} / ${act.auto}` : '—'}
                      </td>
                    )}
                    {tab === 'teachers' && (
                      <td className="td text-center text-xs tabular-nums">
                        {act?.blocked ? (
                          <span className="text-amber-600 dark:text-amber-400">{act.blocked}</span>
                        ) : (
                          <span className="text-faint">0</span>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </TableWrap>
      )}

      <p className="mt-3 text-xs text-faint">
        «To‘xtatilgan» — o‘qituvchi qo‘lda past baho qo‘yishga urinib, o‘sish qoidasi tufayli
        saqlanmagan hollar soni.
      </p>
    </Page>
  )
}
