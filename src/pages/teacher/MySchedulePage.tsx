import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, rpc, errText } from '../../lib/supabase'
import { useAuth } from '../../store/auth'
import { useToast } from '../../ui/Toast'
import { Loading, Page, PageHeader, Stat, TableWrap } from '../../ui/ui'
import { IcoNext, IcoWarn, IcoClock, IcoOk } from '../../ui/icons'
import { WEEKDAYS } from '../../lib/excel'
import { workLabel, ball } from '../../lib/grading'
import type { AcademicYear, FeedItem, TimetableRow } from '../../lib/types'

const fmtDate = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('uz-UZ', {
    day: '2-digit',
    month: 'short',
    weekday: 'short',
  })

/** Bugun hafta kuni: 1 = dushanba */
const todayWeekday = () => ((new Date().getDay() + 6) % 7) + 1

export default function MySchedulePage() {
  const { profile } = useAuth()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState<AcademicYear | null>(null)
  const [lessons, setLessons] = useState<TimetableRow[]>([])
  const [feed, setFeed] = useState<FeedItem[]>([])

  const load = useCallback(async () => {
    if (!profile) return
    const y = await supabase.from('academic_years').select('*').eq('is_active', true).maybeSingle()
    const yr = (y.data as AcademicYear) ?? null
    setYear(yr)

    const [l, f] = await Promise.all([
      yr
        ? supabase.from('v_timetable').select('*').eq('year_id', yr.id).eq('teacher_id', profile.id)
        : Promise.resolve({ data: [] as TimetableRow[], error: null }),
      rpc<FeedItem[]>('plan_feed', { p_soon: 120 }).catch(() => [] as FeedItem[]),
    ])
    if (l.error) toast.err(errText(l.error))
    setLessons((l.data as TimetableRow[]) ?? [])
    setFeed(f)
    setLoading(false)
  }, [profile, toast])

  useEffect(() => {
    void load()
  }, [load])

  const maxLesson = useMemo(() => Math.max(6, ...lessons.map((r) => r.lesson_no)), [lessons])
  const cell = useMemo(() => {
    const m = new Map<string, TimetableRow>()
    for (const r of lessons) m.set(`${r.weekday}|${r.lesson_no}`, r)
    return m
  }, [lessons])

  if (loading) return <Loading />

  const days = [1, 2, 3, 4, 5, 6]
  const wd = todayWeekday()
  const late = feed.filter((f) => f.urgency === 'late')
  const now = feed.filter((f) => f.urgency === 'today')

  return (
    <Page>
      <PageHeader
        title="Jadval va reja"
        subtitle={`${year?.name ?? ''} · dars jadvali va rejadagi BSB/ChSB ishlari`}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Stat label="Haftadagi darsim" value={lessons.length} />
        <Stat
          label="Kechikkan ish"
          value={late.length}
          tone={late.length ? 'rose' : 'emerald'}
          hint={late.length ? 'muddati o‘tgan' : 'kechikish yo‘q'}
        />
        <Stat label="Bugun" value={now.length} tone={now.length ? 'amber' : 'slate'} />
      </div>

      {/* ───────── Rejadagi ishlar ───────── */}
      <h2 className="mb-2 text-sm font-semibold text-fg">Rejadagi ishlarim</h2>
      {feed.length === 0 ? (
        <div className="card mb-6 p-8 text-center text-sm text-faint">
          Bajarilmagan rejadagi ish yo‘q. Reja menejer tomonidan Excel'dan yuklanadi.
        </div>
      ) : (
        <div className="mb-6">
          <TableWrap>
            <table className="w-full min-w-[640px]">
              <thead className="border-b border-line bg-raised">
                <tr>
                  <th className="th">Sana</th>
                  <th className="th">Sinf</th>
                  <th className="th">Fan</th>
                  <th className="th text-center">Ish</th>
                  <th className="th text-center">Ball</th>
                  <th className="th text-center">Holat</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody>
                {feed.map((f) => (
                  <tr key={f.plan_id} className="border-b border-line-soft last:border-0">
                    <td className="td whitespace-nowrap tabular-nums">
                      <span
                        className={
                          f.urgency === 'late'
                            ? 'font-medium text-rose-600 dark:text-rose-400'
                            : f.urgency === 'today'
                              ? 'font-medium text-amber-600 dark:text-amber-400'
                              : ''
                        }
                      >
                        {fmtDate(f.planned_on)}
                      </span>
                      <span className="ml-1.5 text-[11px] text-faint">
                        {f.urgency === 'late'
                          ? `${Math.abs(f.days)} kun kechikdi`
                          : f.urgency === 'today'
                            ? 'bugun'
                            : `${f.days} kun`}
                      </span>
                    </td>
                    <td className="td font-medium text-fg">{f.class_name}</td>
                    <td className="td">{f.subject_name}</td>
                    <td className="td text-center">{workLabel(f.kind, f.idx)}</td>
                    <td className="td text-center tabular-nums text-muted">
                      {f.max_points ? ball(f.max_points, 0) : '—'}
                    </td>
                    <td className="td text-center">
                      {f.state === 'partial' ? (
                        <span className="badge border tint-amber">
                          <IcoClock className="h-3 w-3" /> Chala
                        </span>
                      ) : (
                        <span className="badge border tint-slate">
                          <IcoWarn className="h-3 w-3" /> Boshlanmagan
                        </span>
                      )}
                    </td>
                    <td className="td text-right">
                      <Link
                        to={`/journal?class=${f.class_id}&q=${f.quarter}`}
                        className="btn-soft py-1 text-xs"
                      >
                        Jurnal <IcoNext className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </div>
      )}

      {/* ───────── Dars jadvali ───────── */}
      <h2 className="mb-2 text-sm font-semibold text-fg">Dars jadvalim</h2>
      {lessons.length === 0 ? (
        <div className="card p-8 text-center text-sm text-faint">
          Dars jadvali kiritilmagan yoki unda sizning darsingiz belgilanmagan.
          <div className="mt-1 text-xs">Jadvalni menejer Excel'dan yuklaydi.</div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead className="border-b border-line bg-raised">
                <tr>
                  <th className="th w-14 text-center">Dars</th>
                  {days.map((d) => (
                    <th
                      key={d}
                      className={`th text-center ${d === wd ? 'text-indigo-600 dark:text-indigo-400' : ''}`}
                    >
                      {WEEKDAYS[d - 1]}
                      {d === wd && <span className="ml-1 text-[10px]">bugun</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: maxLesson }, (_, i) => i + 1).map((no) => (
                  <tr key={no} className="border-b border-line-soft last:border-0">
                    <td className="td text-center font-semibold text-muted">{no}</td>
                    {days.map((d) => {
                      const r = cell.get(`${d}|${no}`)
                      return (
                        <td key={d} className={`td align-top ${d === wd ? 'bg-indigo-500/[0.04]' : ''}`}>
                          {r ? (
                            <div className="rounded-lg border border-line bg-raised px-2 py-1.5">
                              <div className="text-xs font-medium leading-tight text-fg">
                                {r.class_name}
                              </div>
                              <div className="mt-0.5 text-[11px] leading-tight text-muted">
                                {r.subject_name}
                                {r.room && ` · ${r.room}`}
                              </div>
                            </div>
                          ) : (
                            <span className="text-faint">·</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {feed.length === 0 && lessons.length === 0 && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-faint">
          <IcoOk className="h-3.5 w-3.5" /> Hozircha hammasi joyida.
        </p>
      )}
    </Page>
  )
}
