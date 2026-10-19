import { useCallback, useEffect, useState } from 'react'
import { rpc, errText } from '../../lib/supabase'
import { useToast } from '../../ui/Toast'
import { Loading, TableWrap } from '../../ui/ui'
import { IcoAuto, IcoLock, IcoOk } from '../../ui/icons'
import { ball, minBall, pct, EXTRA_TOTAL, markOf, MARK_TINT } from '../../lib/grading'
import type { ExtraRow, SaveResult } from '../../lib/types'

/**
 * Chorak oxirida o'qituvchi qo'yadigan 10 ballik baho.
 * Shu ball qo'shilgandan keyin chorak 100 ballik bo'ladi.
 */
export default function ExtraTable({
  assignmentId,
  quarter,
  onChanged,
}: {
  assignmentId: string
  quarter: number
  onChanged?: () => void
}) {
  const toast = useToast()
  const [rows, setRows] = useState<ExtraRow[]>([])
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [savedAt, setSavedAt] = useState<Record<string, number>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await rpc<ExtraRow[]>('extra_rows', {
        p_assignment: assignmentId,
        p_quarter: quarter,
      })
      setRows(data)
      setDraft(
        Object.fromEntries(data.map((r) => [r.student_id, r.points === null ? '' : String(r.points)])),
      )
    } catch (e) {
      toast.err(errText(e))
    } finally {
      setLoading(false)
    }
  }, [assignmentId, quarter, toast])

  useEffect(() => {
    void load()
  }, [load])

  const flash = (id: string) => {
    setSavedAt((m) => ({ ...m, [id]: Date.now() }))
    window.setTimeout(() => setSavedAt((m) => ({ ...m, [id]: 0 })), 1400)
  }

  async function save(row: ExtraRow, raw: string) {
    const prev = row.points === null ? '' : String(row.points)
    if (raw.trim() === '') {
      setDraft((d) => ({ ...d, [row.student_id]: prev }))
      return
    }
    const points = Number(raw.replace(',', '.'))
    if (!Number.isFinite(points)) {
      toast.err('Ball son bo‘lishi kerak')
      setDraft((d) => ({ ...d, [row.student_id]: prev }))
      return
    }
    if (points === row.points) return

    try {
      const res = await rpc<SaveResult>('save_extra', {
        p_assignment: assignmentId,
        p_quarter: quarter,
        p_student: row.student_id,
        p_points: points,
      })
      if (res.ok) {
        setRows((l) => l.map((r) => (r.student_id === row.student_id ? { ...r, points } : r)))
        setDraft((d) => ({ ...d, [row.student_id]: String(points) }))
        flash(row.student_id)
        onChanged?.()
        return
      }
      setDraft((d) => ({ ...d, [row.student_id]: prev }))
      if (res.error === 'TOO_LOW')
        toast.err(
          `${row.full_name}: saqlanmadi — chorak foizi tushadi. Kamida ${minBall(res.min_points)} ball qo‘ying.`,
        )
      else if (res.error === 'LOCKED')
        toast.err(`${row.full_name}: 2 kundan oshdi, o‘zgartirilmaydi`)
      else if (res.error === 'OVER_MAX') toast.err(`Bu baho ${EXTRA_TOTAL} ballik`)
      else toast.err('Saqlanmadi')
    } catch (e) {
      setDraft((d) => ({ ...d, [row.student_id]: prev }))
      toast.err(errText(e))
    }
  }

  async function auto() {
    setBusy(true)
    try {
      let saved = 0
      let failed = 0
      for (const r of rows) {
        if (r.locked) continue
        const points = Math.min(EXTRA_TOTAL, Math.max(0, Math.ceil(r.min_points)))
        if (r.points === points) continue
        const res = await rpc<SaveResult>('save_extra', {
          p_assignment: assignmentId,
          p_quarter: quarter,
          p_student: r.student_id,
          p_points: points,
        })
        if (res.ok) saved++
        else failed++
      }
      await load()
      onChanged?.()
      if (failed === 0) toast.ok(`${saved} ta baho qo‘yildi`)
      else toast.warn(`${saved} ta qo‘yildi, ${failed} tasi saqlanmadi`)
    } catch (e) {
      toast.err(errText(e))
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Loading />

  const filled = rows.filter((r) => r.points !== null).length

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted">
          <b className="text-fg">O‘qituvchi bahosi</b> · {EXTRA_TOTAL} ball · {filled}/{rows.length}{' '}
          kiritildi
        </div>
        <button onClick={() => void auto()} disabled={busy} className="btn-soft">
          <IcoAuto className="h-4 w-4" /> {busy ? 'Qo‘yilmoqda…' : 'Avtomatik'}
        </button>
      </div>

      <TableWrap>
        <table className="w-full min-w-[680px]">
          <thead className="border-b border-line bg-raised">
            <tr>
              <th className="th w-10">#</th>
              <th className="th">O‘quvchi</th>
              <th className="th w-32 text-center">BSB+ChSB foizi</th>
              <th className="th w-28 text-center">10 ballik</th>
              <th className="th w-24 text-center">Minimal</th>
              <th className="th w-24 text-center">Chorak bahosi</th>
              <th className="th w-16 text-center">Holat</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              // Chorak yakuni = (BSB+ChSB) + 10 ballik baho, o'z maksimaliga nisbatan
              const finalPct =
                r.points === null
                  ? null
                  : (100 * (r.q_points + r.points)) / (r.q_max + EXTRA_TOTAL)
              const mark = markOf(finalPct)
              return (
                <tr key={r.student_id} className="border-b border-line-soft last:border-0">
                  <td className="td text-faint">{i + 1}</td>
                  <td className="td font-medium text-fg">{r.full_name}</td>
                  <td className="td text-center tabular-nums text-muted">
                    {pct(r.pct_now)}
                    <span className="ml-1 text-[11px] text-faint">
                      {ball(r.q_points, 0)}/{ball(r.q_max, 0)}
                    </span>
                  </td>
                  <td className="td">
                    <input
                      className={`input py-1 text-center tabular-nums ${r.locked ? 'opacity-60' : ''}`}
                      inputMode="decimal"
                      disabled={r.locked}
                      value={draft[r.student_id] ?? ''}
                      onChange={(e) => setDraft((d) => ({ ...d, [r.student_id]: e.target.value }))}
                      onBlur={(e) => void save(r, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                      }}
                      placeholder="—"
                    />
                  </td>
                  <td className="td text-center text-xs tabular-nums text-muted">
                    {r.min_points > 0 ? minBall(r.min_points) : '—'}
                  </td>
                  <td className="td text-center">
                    {mark ? (
                      <span className={`badge ${MARK_TINT[mark]}`}>
                        {mark} · {pct(finalPct)}
                      </span>
                    ) : (
                      <span className="text-faint">—</span>
                    )}
                  </td>
                  <td className="td text-center">
                    {r.locked ? (
                      <span className="badge border tint-slate">
                        <IcoLock className="h-3 w-3" />
                      </span>
                    ) : savedAt[r.student_id] ? (
                      <span className="badge border tint-emerald">
                        <IcoOk className="h-3 w-3" />
                      </span>
                    ) : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </TableWrap>

      <p className="mt-2 text-xs text-faint">
        Chorak bahosi = BSB (50) + ChSB (40) + shu 10 ball. «Minimal» — chorak foizi pasaymasligi
        uchun eng kichik ruxsat etilgan ball.
      </p>
    </div>
  )
}
