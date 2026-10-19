import { useCallback, useEffect, useState } from 'react'
import { supabase, errText } from '../../lib/supabase'
import { useToast } from '../../ui/Toast'
import { Loading, Page, PageHeader, Segmented, TableWrap } from '../../ui/ui'
import { IcoAuto, IcoEdit, IcoWarn } from '../../ui/icons'
import { ball } from '../../lib/grading'
import type { Profile } from '../../lib/types'

const PAGE = 100

interface LogRow {
  id: number
  target: 'grade' | 'extra'
  quarter: number
  old_points: number | null
  new_points: number
  is_auto: boolean
  actor_id: string | null
  at: string
  students: { full_name: string } | null
  assignments: {
    teacher_id: string
    subjects: { name: string } | null
    classes: { grade: number; letter: string } | null
  } | null
}

interface BlockedRow {
  id: number
  quarter: number
  tried_points: number
  min_points: number
  at: string
  students: { full_name: string } | null
  assignments: {
    teacher_id: string
    subjects: { name: string } | null
    classes: { grade: number; letter: string } | null
  } | null
}

const EMBED =
  'students(full_name), assignments(teacher_id, subjects(name), classes(grade, letter))'

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString('uz-UZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

export default function ChangesPage() {
  const toast = useToast()
  const [tab, setTab] = useState<'log' | 'blocked'>('log')
  const [loading, setLoading] = useState(true)
  const [log, setLog] = useState<LogRow[]>([])
  const [blocked, setBlocked] = useState<BlockedRow[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [limit, setLimit] = useState(PAGE)

  const load = useCallback(async () => {
    const [l, b, p] = await Promise.all([
      supabase
        .from('grade_log')
        .select(`id, target, quarter, old_points, new_points, is_auto, actor_id, at, ${EMBED}`)
        .order('at', { ascending: false })
        .limit(limit),
      supabase
        .from('blocked_attempts')
        .select(`id, quarter, tried_points, min_points, at, ${EMBED}`)
        .order('at', { ascending: false })
        .limit(limit),
      supabase.from('profiles').select('*'),
    ])
    if (l.error) toast.err(errText(l.error))
    setLog((l.data as unknown as LogRow[]) ?? [])
    setBlocked((b.data as unknown as BlockedRow[]) ?? [])
    setProfiles((p.data as Profile[]) ?? [])
    setLoading(false)
  }, [limit, toast])

  useEffect(() => {
    void load()
  }, [load])

  const name = (id: string | null | undefined) => {
    const p = profiles.find((x) => x.id === id)
    return p ? `${p.last_name} ${p.first_name}` : '—'
  }

  const where = (r: LogRow | BlockedRow) => {
    const c = r.assignments?.classes
    const s = r.assignments?.subjects?.name
    return `${c ? `${c.grade}${c.letter}` : '—'} · ${s ?? '—'}`
  }

  if (loading) return <Loading />

  return (
    <Page>
      <PageHeader
        title="Baholardagi o‘zgarishlar"
        subtitle="Kim, qachon, qanday baho qo‘ygan yoki tahrirlagan"
        actions={
          <Segmented
            value={tab}
            onChange={setTab}
            items={[
              { value: 'log' as const, label: 'Tarix' },
              {
                value: 'blocked' as const,
                label: (
                  <span className="flex items-center gap-1.5">
                    <IcoWarn className="h-3.5 w-3.5" /> To‘xtatilganlar
                  </span>
                ),
              },
            ]}
          />
        }
      />

      {tab === 'log' ? (
        log.length === 0 ? (
          <div className="card p-10 text-center text-sm text-faint">Hali o‘zgarish bo‘lmagan</div>
        ) : (
          <TableWrap>
            <table className="w-full min-w-[840px]">
              <thead className="border-b border-line bg-raised">
                <tr>
                  <th className="th">Vaqt</th>
                  <th className="th">O‘qituvchi</th>
                  <th className="th">Sinf · fan</th>
                  <th className="th">O‘quvchi</th>
                  <th className="th text-center">Chorak</th>
                  <th className="th text-center">Tur</th>
                  <th className="th text-center">Baho</th>
                </tr>
              </thead>
              <tbody>
                {log.map((r) => (
                  <tr key={r.id} className="border-b border-line-soft last:border-0">
                    <td className="td whitespace-nowrap text-xs text-muted">{fmtTime(r.at)}</td>
                    <td className="td">{name(r.actor_id ?? r.assignments?.teacher_id)}</td>
                    <td className="td text-xs">{where(r)}</td>
                    <td className="td">{r.students?.full_name ?? '—'}</td>
                    <td className="td text-center tabular-nums">{r.quarter}</td>
                    <td className="td text-center">
                      <span
                        className={`badge border ${r.is_auto ? 'tint-indigo' : 'tint-slate'}`}
                        title={r.is_auto ? 'Avtomatik qo‘yilgan' : 'Qo‘lda kiritilgan'}
                      >
                        {r.is_auto ? (
                          <IcoAuto className="h-3 w-3" />
                        ) : (
                          <IcoEdit className="h-3 w-3" />
                        )}
                        {r.target === 'extra' ? '10 ball' : r.is_auto ? 'avto' : 'qo‘lda'}
                      </span>
                    </td>
                    <td className="td text-center tabular-nums">
                      {r.old_points !== null && (
                        <span className="text-faint line-through">{ball(r.old_points, 0)}</span>
                      )}{' '}
                      <span className="font-medium text-fg">{ball(r.new_points, 0)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )
      ) : blocked.length === 0 ? (
        <div className="card p-10 text-center text-sm text-faint">
          O‘sish qoidasi hech qanday bahoni to‘xtatmagan
        </div>
      ) : (
        <TableWrap>
          <table className="w-full min-w-[760px]">
            <thead className="border-b border-line bg-raised">
              <tr>
                <th className="th">Vaqt</th>
                <th className="th">O‘qituvchi</th>
                <th className="th">Sinf · fan</th>
                <th className="th">O‘quvchi</th>
                <th className="th text-center">Chorak</th>
                <th className="th text-center">Qo‘ymoqchi bo‘ldi</th>
                <th className="th text-center">Minimal</th>
              </tr>
            </thead>
            <tbody>
              {blocked.map((r) => (
                <tr key={r.id} className="border-b border-line-soft last:border-0">
                  <td className="td whitespace-nowrap text-xs text-muted">{fmtTime(r.at)}</td>
                  <td className="td">{name(r.assignments?.teacher_id)}</td>
                  <td className="td text-xs">{where(r)}</td>
                  <td className="td">{r.students?.full_name ?? '—'}</td>
                  <td className="td text-center tabular-nums">{r.quarter}</td>
                  <td className="td text-center tabular-nums text-rose-600 dark:text-rose-400">
                    {ball(r.tried_points, 0)}
                  </td>
                  <td className="td text-center tabular-nums text-emerald-600 dark:text-emerald-400">
                    {ball(r.min_points, 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}

      {(tab === 'log' ? log.length : blocked.length) >= limit && (
        <div className="mt-3 text-center">
          <button onClick={() => setLimit((n) => n + PAGE)} className="btn-ghost">
            Ko‘proq ko‘rsatish
          </button>
        </div>
      )}
    </Page>
  )
}
