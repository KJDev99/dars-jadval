import { ball, pct } from '../../lib/grading'
import { IcoOk, IcoWarn, IcoTrend } from '../../ui/icons'
import type { ClassProgress } from '../../lib/types'

/**
 * Jurnal ustidagi holat chizig'i.
 *
 * O'sish qoidasi sinf darajasida ishlaydi, shuning uchun o'qituvchi
 * alohida o'quvchi emas, SINF o'rtachasi qanday turganini ko'rib turishi kerak.
 */
export default function ClassStrip({ cp }: { cp: ClassProgress | null }) {
  if (!cp) return null

  const hasFloor = cp.floor_pct !== null
  const good = !hasFloor || cp.ok

  return (
    <div
      className={`mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border px-4 py-2.5 text-sm ${
        good
          ? 'border-emerald-500/30 bg-emerald-500/[0.07]'
          : 'border-amber-500/40 bg-amber-500/[0.08]'
      }`}
    >
      <span className="flex items-center gap-1.5 font-medium text-fg">
        <IcoTrend className="h-4 w-4 text-indigo-500" />
        Sinf
      </span>

      <span className="text-muted">
        Baholandi:{' '}
        <b className="tabular-nums text-fg">
          {cp.filled}/{cp.roster}
        </b>
      </span>

      {cp.work_pct !== null && (
        <span className="text-muted">
          Bu ish: <b className="tabular-nums text-fg">{pct(cp.work_pct)}</b>
        </span>
      )}

      <span className="text-muted">
        Chorak o‘rtachasi: <b className="tabular-nums text-fg">{pct(cp.quarter_pct)}</b>
      </span>

      {hasFloor && (
        <span className="text-muted">
          Kerak: <b className="tabular-nums text-fg">≥ {pct(cp.floor_pct)}</b>
        </span>
      )}

      <span className="ml-auto flex items-center gap-1.5 font-medium">
        {!hasFloor ? (
          <span className="text-muted">Birinchi ish — cheklov yo‘q</span>
        ) : good ? (
          <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
            <IcoOk className="h-4 w-4" /> O‘sish shartiga mos
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
            <IcoWarn className="h-4 w-4" /> Sinfga yana {ball(cp.need_points, 1)} ball kerak
          </span>
        )}
      </span>
    </div>
  )
}
