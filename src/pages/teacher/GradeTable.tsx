import { useCallback, useEffect, useState } from 'react'
import { rpc, errText } from '../../lib/supabase'
import { useToast } from '../../ui/Toast'
import { Loading, TableWrap } from '../../ui/ui'
import { IcoAuto, IcoLock, IcoOk } from '../../ui/icons'
import { autoFill, ball, pct, workLabel } from '../../lib/grading'
import type { Assessment, BulkResult, JournalRow, SaveResult } from '../../lib/types'

/**
 * Bitta BSB/ChSB bo'yicha baho kiritish jadvali.
 *
 * Qo'lda kiritilgan baho umumiy foizni tushirsa — server saqlamaydi,
 * toast chiqadi va maydon avvalgi holatiga qaytadi.
 */
export default function GradeTable({
  assessment,
  onChanged,
}: {
  assessment: Assessment
  onChanged?: () => void
}) {
  const toast = useToast()
  const [rows, setRows] = useState<JournalRow[]>([])
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [savedAt, setSavedAt] = useState<Record<string, number>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await rpc<JournalRow[]>('journal_rows', { p_assessment: assessment.id })
      setRows(data)
      setDraft(
        Object.fromEntries(data.map((r) => [r.student_id, r.points === null ? '' : String(r.points)])),
      )
    } catch (e) {
      toast.err(errText(e))
    } finally {
      setLoading(false)
    }
  }, [assessment.id, toast])

  useEffect(() => {
    void load()
  }, [load])

  const flash = (id: string) => {
    setSavedAt((m) => ({ ...m, [id]: Date.now() }))
    window.setTimeout(() => setSavedAt((m) => ({ ...m, [id]: 0 })), 1400)
  }

  /** Bitta o'quvchining bahosini saqlash */
  async function save(row: JournalRow, raw: string) {
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
      const res = await rpc<SaveResult>('save_grade', {
        p_assessment: assessment.id,
        p_student: row.student_id,
        p_points: points,
        p_auto: false,
      })

      if (res.ok) {
        setRows((l) =>
          l.map((r) => (r.student_id === row.student_id ? { ...r, points, is_auto: false } : r)),
        )
        setDraft((d) => ({ ...d, [row.student_id]: String(points) }))
        flash(row.student_id)
        onChanged?.()
        return
      }

      // Saqlanmadi — sababini aytamiz va maydonni qaytaramiz
      setDraft((d) => ({ ...d, [row.student_id]: prev }))
      if (res.error === 'TOO_LOW') {
        toast.err(
          `${row.full_name}: baho saqlanmadi — umumiy foiz tushib ketadi. Kamida ${ball(res.min_points, 0)} ball qo‘ying (${pct(res.floor_pct)} darajasi).`,
        )
      } else if (res.error === 'LOCKED') {
        toast.err(`${row.full_name}: baho 2 kundan oshdi, endi o‘zgartirilmaydi`)
      } else if (res.error === 'OVER_MAX') {
        toast.err(`Bu ish ${ball(res.max_points, 0)} ballik — bundan yuqori baho bo‘lmaydi`)
      } else {
        toast.err('Baho saqlanmadi')
      }
    } catch (e) {
      setDraft((d) => ({ ...d, [row.student_id]: prev }))
      toast.err(errText(e))
    }
  }

  /** Avtomatik baholash — hammasi o'sish qoidasiga mos qo'yiladi */
  async function auto() {
    setBusy(true)
    try {
      const items = autoFill(rows, assessment.max_points, assessment.id)
      if (items.length === 0) {
        toast.warn('Baholanadigan o‘quvchi qolmadi')
        return
      }
      const res = await rpc<BulkResult>('save_grades', {
        p_assessment: assessment.id,
        p_items: items,
        p_auto: true,
      })
      await load()
      onChanged?.()
      if (res.failed.length === 0) toast.ok(`${res.saved} ta baho avtomatik qo‘yildi`)
      else
        toast.warn(
          `${res.saved} ta baho qo‘yildi, ${res.failed.length} tasi saqlanmadi (qulflangan yoki qoidaga mos emas)`,
        )
    } catch (e) {
      toast.err(errText(e))
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Loading />

  const filled = rows.filter((r) => r.points !== null).length
  const avg =
    filled > 0
      ? (rows.reduce((s, r) => s + (r.points ?? 0), 0) / filled / assessment.max_points) * 100
      : null

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted">
          <b className="text-fg">{workLabel(assessment.kind, assessment.idx)}</b> ·{' '}
          {ball(assessment.max_points, 0)} ball · {filled}/{rows.length} kiritildi
          {avg !== null && ` · o‘rtacha ${pct(avg)}`}
        </div>
        <button onClick={() => void auto()} disabled={busy} className="btn-soft">
          <IcoAuto className="h-4 w-4" /> {busy ? 'Qo‘yilmoqda…' : 'Avtomatik baholash'}
        </button>
      </div>

      <TableWrap>
        <table className="w-full min-w-[620px]">
          <thead className="border-b border-line bg-raised">
            <tr>
              <th className="th w-10">#</th>
              <th className="th">O‘quvchi</th>
              <th className="th w-28 text-center">Ball</th>
              <th className="th w-24 text-center">Minimal</th>
              <th className="th w-28 text-center">Foiz</th>
              <th className="th w-20 text-center">Holat</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const p = r.points
              const percent = p === null ? null : (p / assessment.max_points) * 100
              return (
                <tr key={r.student_id} className="border-b border-line-soft last:border-0">
                  <td className="td text-faint">{i + 1}</td>
                  <td className="td font-medium text-fg">{r.full_name}</td>
                  <td className="td">
                    <input
                      className={`input py-1 text-center tabular-nums ${
                        r.locked ? 'opacity-60' : ''
                      }`}
                      inputMode="decimal"
                      disabled={r.locked}
                      value={draft[r.student_id] ?? ''}
                      onChange={(e) => setDraft((d) => ({ ...d, [r.student_id]: e.target.value }))}
                      onBlur={(e) => void save(r, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                        if (e.key === 'Escape')
                          setDraft((d) => ({
                            ...d,
                            [r.student_id]: r.points === null ? '' : String(r.points),
                          }))
                      }}
                      placeholder="—"
                    />
                  </td>
                  <td className="td text-center text-xs tabular-nums text-muted">
                    {r.floor_pct > 0 ? ball(r.min_points, 0) : '—'}
                  </td>
                  <td className="td text-center tabular-nums">
                    {percent === null ? <span className="text-faint">—</span> : pct(percent)}
                  </td>
                  <td className="td text-center">
                    {r.locked ? (
                      <span className="badge border tint-slate" title="2 kun o‘tdi">
                        <IcoLock className="h-3 w-3" />
                      </span>
                    ) : savedAt[r.student_id] ? (
                      <span className="badge border tint-emerald">
                        <IcoOk className="h-3 w-3" />
                      </span>
                    ) : r.is_auto ? (
                      <span className="badge border tint-indigo" title="Avtomatik">
                        <IcoAuto className="h-3 w-3" />
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
        «Minimal» — o‘sish buzilmasligi uchun qo‘yish mumkin bo‘lgan eng kichik ball. Undan past
        baho saqlanmaydi. Baho kiritilgandan 2 kun o‘tgach qulflanadi.
      </p>
    </div>
  )
}
