import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase, errText } from '../../lib/supabase'
import { useAuth } from '../../store/auth'
import { useToast } from '../../ui/Toast'
import { Loading, Page, PageHeader, Stat, TableWrap } from '../../ui/ui'
import { IcoExcel, IcoTrend } from '../../ui/icons'
import { ball, delta, deltaTone, pct, MARK_TINT, QUARTER_PAIRS, pairAvg } from '../../lib/grading'
import { exportSheets, today } from '../../lib/excel'
import type { AcademicYear, StudentQuarter } from '../../lib/types'

const QS = [1, 2, 3, 4] as const

export default function MyStatsPage() {
  const { profile } = useAuth()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState<AcademicYear | null>(null)
  const [rows, setRows] = useState<StudentQuarter[]>([])

  const load = useCallback(async () => {
    const y = await supabase.from('academic_years').select('*').eq('is_active', true).maybeSingle()
    const yr = (y.data as AcademicYear) ?? null
    setYear(yr)
    if (!yr) return setLoading(false)
    // RLS tufayli bu yerda faqat o'z baholari ko'rinadi
    const { data, error } = await supabase.from('v_student_quarter').select('*').eq('year_id', yr.id)
    if (error) toast.err(errText(error))
    setRows((data as StudentQuarter[]) ?? [])
    setLoading(false)
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  /** Chorak bo'yicha umumiy o'rtacha */
  const mine = useMemo(() => {
    const q: Record<number, number | null> = { 1: null, 2: null, 3: null, 4: null }
    for (const n of QS) {
      const list = rows.filter((r) => r.quarter === n)
      q[n] = list.length ? list.reduce((s, r) => s + r.pct, 0) / list.length : null
    }
    return q
  }, [rows])

  /** Sinflar kesimi — bir marta aylanib yig'amiz */
  const byClass = useMemo(() => {
    interface Acc {
      name: string
      sum: Record<number, number>
      cnt: Record<number, number>
      students: Set<string>
    }
    const m = new Map<string, Acc>()
    for (const r of rows) {
      const e =
        m.get(r.class_id) ??
        { name: r.class_name, sum: {}, cnt: {}, students: new Set<string>() }
      e.sum[r.quarter] = (e.sum[r.quarter] ?? 0) + r.pct
      e.cnt[r.quarter] = (e.cnt[r.quarter] ?? 0) + 1
      e.students.add(r.student_id)
      m.set(r.class_id, e)
    }
    return [...m.entries()]
      .map(([id, v]) => {
        const q: Record<number, number | null> = { 1: null, 2: null, 3: null, 4: null }
        for (const n of QS) if (v.cnt[n]) q[n] = v.sum[n] / v.cnt[n]
        return { id, name: v.name, q, n: v.students.size }
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [rows])

  /** O'quvchilar kesimi — kim o'sgan, kim turib qolgan */
  const byStudent = useMemo(() => {
    const m = new Map<
      string,
      { name: string; cls: string; q: Record<number, number | null> }
    >()
    for (const r of rows) {
      const e =
        m.get(r.student_id) ??
        { name: r.student_name, cls: r.class_name, q: { 1: null, 2: null, 3: null, 4: null } }
      e.q[r.quarter] = r.pct
      m.set(r.student_id, e)
    }
    return [...m.entries()]
      .map(([id, v]) => {
        const vals = QS.map((n) => v.q[n]).filter((x): x is number => x !== null)
        const g = vals.length > 1 ? vals[vals.length - 1] - vals[0] : null
        return { id, ...v, growth: g }
      })
      .sort((a, b) => a.cls.localeCompare(b.cls) || a.name.localeCompare(b.name))
  }, [rows])

  async function exportMine() {
    await exportSheets(`natijalarim-${today()}.xlsx`, [
      {
        name: 'Choraklar',
        rows: [
          ['Chorak', 'O‘rtacha foiz'],
          ...QS.map((n) => [`${n}-chorak`, mine[n] ?? '']),
          [],
          ['Juftlik', 'O‘rtacha'],
          ...QUARTER_PAIRS.map((p) => [p.label, pairAvg(mine[p.a], mine[p.b]) ?? '']),
        ],
      },
      {
        name: 'Sinflar',
        rows: [
          ['Sinf', '1-chorak', '2-chorak', '3-chorak', '4-chorak', 'O‘quvchi'],
          ...byClass.map((c) => [c.name, c.q[1] ?? '', c.q[2] ?? '', c.q[3] ?? '', c.q[4] ?? '', c.n]),
        ],
      },
      {
        name: 'O‘quvchilar',
        rows: [
          ['Sinf', 'O‘quvchi', '1-chorak', '2-chorak', '3-chorak', '4-chorak', 'O‘sish'],
          ...byStudent.map((s) => [
            s.cls,
            s.name,
            s.q[1] ?? '',
            s.q[2] ?? '',
            s.q[3] ?? '',
            s.q[4] ?? '',
            s.growth ?? '',
          ]),
        ],
      },
    ])
    toast.ok('Excel fayl yuklab olindi')
  }

  if (loading) return <Loading />
  if (!year || rows.length === 0)
    return (
      <Page>
        <PageHeader title="Natijalarim" />
        <div className="card p-10 text-center text-sm text-faint">
          Hali baho kiritmagansiz — jurnalga o‘tib baholashni boshlang.
        </div>
      </Page>
    )

  const vals = QS.map((n) => mine[n]).filter((v): v is number => v !== null)
  const g = vals.length > 1 ? vals[vals.length - 1] - vals[0] : null
  const dropped = byStudent.filter((s) => s.growth !== null && s.growth < 0).length

  return (
    <Page>
      <PageHeader
        title="Natijalarim"
        subtitle={`${year.name} · ${byStudent.length} o‘quvchi, ${byClass.length} sinf`}
        actions={
          <button onClick={() => void exportMine()} className="btn-ghost">
            <IcoExcel className="h-4 w-4" /> Excel
          </button>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Hozirgi o‘rtacha" value={pct(vals.at(-1) ?? null)} />
        <Stat
          label="O‘sish"
          value={<span className={deltaTone(g)}>{delta(g)}{g !== null && '%'}</span>}
          tone={g !== null && g < 0 ? 'rose' : 'emerald'}
          hint="1-chorakdan oxirgisiga"
        />
        <Stat label="O‘quvchilar" value={byStudent.length} />
        <Stat
          label="Pasaygan o‘quvchi"
          value={dropped}
          tone={dropped ? 'amber' : 'slate'}
          hint={dropped ? 'tekshirib ko‘ring' : 'hammasi o‘sgan'}
        />
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-fg">
            <IcoTrend className="h-4 w-4 text-indigo-500" /> Choraklar
          </h2>
          <div className="grid grid-cols-4 gap-2">
            {QS.map((n, i) => {
              const v = mine[n]
              const prev = i > 0 ? mine[QS[i - 1]] : null
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
          <h2 className="mb-3 text-sm font-semibold text-fg">Sinflar bo‘yicha</h2>
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">Sinf</th>
                {QS.map((n) => (
                  <th key={n} className="th text-center">
                    {n}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {byClass.map((c) => (
                <tr key={c.id} className="border-b border-line-soft last:border-0">
                  <td className="td font-medium text-fg">{c.name}</td>
                  {QS.map((n) => (
                    <td key={n} className="td text-center tabular-nums">
                      {c.q[n] !== null ? ball(c.q[n], 1) : <span className="text-faint">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <TableWrap>
        <table className="w-full min-w-[720px]">
          <thead className="border-b border-line bg-raised">
            <tr>
              <th className="th">Sinf</th>
              <th className="th">O‘quvchi</th>
              {QS.map((n) => (
                <th key={n} className="th text-center">
                  {n}-chorak
                </th>
              ))}
              <th className="th text-center">O‘sish</th>
            </tr>
          </thead>
          <tbody>
            {byStudent.map((s) => (
              <tr key={s.id} className="border-b border-line-soft last:border-0">
                <td className="td text-muted">{s.cls}</td>
                <td className="td font-medium text-fg">{s.name}</td>
                {QS.map((n) => {
                  const v = s.q[n]
                  const mark = v === null ? null : v >= 86 ? 5 : v >= 71 ? 4 : v >= 56 ? 3 : 2
                  return (
                    <td key={n} className="td text-center">
                      {v === null ? (
                        <span className="text-faint">—</span>
                      ) : (
                        <span className={`badge ${MARK_TINT[mark as 2 | 3 | 4 | 5]}`}>
                          {pct(v)}
                        </span>
                      )}
                    </td>
                  )
                })}
                <td className={`td text-center font-medium tabular-nums ${deltaTone(s.growth)}`}>
                  {delta(s.growth)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
    </Page>
  )
}
