import { DAY_NAMES } from '../types'
import type { TimetableIndex } from '../lib/view'
import { weekLabel } from '../lib/view'
import { tintOf } from '../lib/theme'

interface Props {
  idx: TimetableIndex
  /** Sinf jadvali yoki o'qituvchi jadvali */
  kind: 'class' | 'teacher'
  id: string
  /** Sinf jadvalida o'qituvchi ismi ko'rsatilsinmi */
  showTeacher?: boolean
  dark: boolean
  /** Sinf jadvalida shu sinfning kunlari soni (1–4 sinflar uchun 5) */
  days?: number
}

/** Bitta sinf yoki bitta o'qituvchining haftalik jadvali */
export default function Timetable({ idx, kind, id, showTeacher = true, dark, days }: Props) {
  const D = Math.min(days ?? idx.days, idx.days)

  // Bo'sh soatlarni kesib tashlaymiz
  let P = 0
  for (let d = 0; d < D; d++) {
    for (let p = 0; p < idx.periods; p++) {
      const filled =
        kind === 'class'
          ? !!idx.byClass.get(id)?.[d]?.[p]
          : (idx.byTeacher.get(id)?.[d]?.[p]?.length ?? 0) > 0
      if (filled) P = Math.max(P, p + 1)
    }
  }
  if (P === 0) {
    return (
      <div className="card grid place-items-center p-10 text-center text-sm text-faint">
        Bu jadvalda dars topilmadi.
      </div>
    )
  }

  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[680px] border-collapse">
        <thead>
          <tr className="border-b border-line bg-raised">
            <th className="w-14 px-2 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted">Soat</th>
            {Array.from({ length: D }, (_, d) => (
              <th key={d} className="px-2 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted">
                {DAY_NAMES[d]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: P }, (_, p) => (
            <tr key={p} className="border-b border-line-soft last:border-0">
              <td className="bg-raised/60 px-2 py-1.5 text-center text-xs font-semibold text-muted">{p + 1}</td>
              {Array.from({ length: D }, (_, d) => {
                if (kind === 'class') {
                  const cell = idx.byClass.get(id)?.[d]?.[p]
                  if (!cell) return <td key={d} className="p-1" />
                  return (
                    <td key={d} className="p-1 align-top">
                      <div
                        className="rounded-lg border px-2 py-1.5 leading-tight"
                        style={{
                          borderColor: cell.parts[0].color + '55',
                          background: tintOf(cell.parts[0].color, dark),
                        }}
                      >
                        {cell.parts.map((pt, i) => (
                          <div key={i} className={i > 0 ? 'mt-1 border-t border-line-soft pt-1' : ''}>
                            <div className="text-[13px] font-medium text-fg">{pt.subjectName}</div>
                            {showTeacher && <div className="truncate text-[11px] text-muted">{pt.teacherName}</div>}
                            {pt.week !== 'all' && (
                              <div className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
                                {weekLabel(pt.week)}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </td>
                  )
                }

                const cells = idx.byTeacher.get(id)?.[d]?.[p] ?? []
                if (cells.length === 0) return <td key={d} className="p-1" />
                return (
                  <td key={d} className="p-1 align-top">
                    {cells.map((c) => {
                      const part = c.parts.find((x) => x.teacherId === id) ?? c.parts[0]
                      return (
                        <div
                          key={c.unitId}
                          className="mb-1 rounded-lg border px-2 py-1.5 leading-tight last:mb-0"
                          style={{ borderColor: part.color + '55', background: tintOf(part.color, dark) }}
                        >
                          <div className="text-[13px] font-medium text-fg">{c.classId} sinf</div>
                          <div className="truncate text-[11px] text-muted">{part.subjectName}</div>
                          {part.week !== 'all' && (
                            <div className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
                              {weekLabel(part.week)}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
