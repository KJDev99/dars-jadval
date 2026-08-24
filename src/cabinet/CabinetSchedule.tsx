import { Link } from 'react-router-dom'
import { useMe } from './useMe'
import Timetable from '../site/Timetable'
import { useIsDark } from '../lib/theme'
import { gapsOfDay, teacherWeekHours } from '../lib/view'
import { formatStavka } from '../lib/derive'
import { DAY_NAMES } from '../types'
import { IcoPrint, IcoSend, IcoInfo, IcoSchedule } from '../components/icons'

export default function CabinetSchedule() {
  const { teacher, idx, constraints, settings, schedule } = useMe()
  const dark = useIsDark(settings.theme ?? 'system')
  if (!teacher) return null

  const grid = idx.byTeacher.get(teacher.id)
  const hours = teacherWeekHours(schedule, teacher.id)

  const perDay = (grid ?? []).map((day, d) => ({
    day: d,
    count: day.reduce((s, cells) => s + cells.length, 0),
    gaps: grid ? gapsOfDay(grid, d) : 0,
  }))

  return (
    <div className="space-y-5">
      <div className="no-print flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-fg">Dars jadvalim</h1>
          <p className="mt-1 text-sm text-muted">
            {schedule
              ? `Jadval ${new Date(schedule.createdAt).toLocaleDateString('uz-UZ')} da tuzilgan · haftalik ${hours} soat (${formatStavka(hours, settings.stavkaHours)} stavka)`
              : "Jadval hali tuzilmagan."}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/kabinet/sorovlar?tur=jadval" className="btn-ghost">
            <IcoSend className="h-4 w-4" /> O'zgartirish so'rash
          </Link>
          <button className="btn-primary" onClick={() => window.print()}>
            <IcoPrint className="h-4 w-4" /> Chop etish
          </button>
        </div>
      </div>

      {!schedule ? (
        <div className="card grid place-items-center gap-3 p-14 text-center">
          <IcoSchedule className="h-10 w-10 text-faint" />
          <p className="text-sm text-muted">Dars jadvali hali tuzilmagan.</p>
        </div>
      ) : (
        <>
          <Timetable idx={idx} kind="teacher" id={teacher.id} dark={dark} />

          {/* Kunlar kesimida */}
          <div className="no-print grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {perDay.map((d) => {
              const blocked = constraints?.blockedDays.includes(d.day)
              const metodik = constraints?.pedagogicalDay === d.day
              return (
                <div
                  key={d.day}
                  className={`card p-3 text-center ${blocked ? 'border-dashed opacity-70' : ''}`}
                >
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted">
                    {DAY_NAMES[d.day]}
                  </div>
                  <div className="mt-1 text-2xl font-bold text-fg">{d.count}</div>
                  <div className="text-[11px] text-faint">
                    {metodik ? 'metodik kun' : blocked ? "bo'sh kun" : d.gaps > 0 ? `${d.gaps} ta oyna` : 'oynasiz'}
                  </div>
                </div>
              )
            })}
          </div>

          <p className="no-print flex gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-xs leading-relaxed text-muted">
            <IcoInfo className="mt-0.5 h-4 w-4 shrink-0 text-faint" />
            Jadvalni o'zingiz o'zgartira olmaysiz. O'zgartirish zarur bo'lsa «So'rovlarim» bo'limi
            orqali ariza yuboring — o'quv ishlari bo'yicha direktor o'rinbosari ko'rib chiqadi va
            jadval qayta hisoblanadi.
          </p>
        </>
      )}
    </div>
  )
}
