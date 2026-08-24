import { Link } from 'react-router-dom'
import { useMe, todayIndex } from './useMe'
import { Photo } from '../components/Photo'
import { Stat } from '../components/ui'
import { teacherWeekHours, gapsOfDay } from '../lib/view'
import { formatStavka } from '../lib/derive'
import { CATEGORY_LABELS, DAY_NAMES, REQUEST_STATUS_LABELS } from '../types'
import type { RequestStatus } from '../types'
import { SUBJECT_BY_ID } from '../data/curriculum'
import {
  IcoSchedule, IcoClock, IcoClasses, IcoCategory, IcoInbox, IcoArrowRight, IcoBook,
  IcoCheck, IcoInfo, IcoSend,
} from '../components/icons'
import type { IconType } from '../components/icons'

export const STATUS_TINT: Record<RequestStatus, string> = {
  yangi: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300',
  korilmoqda: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  qabul: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  rad: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
}

export default function CabinetHome() {
  const { teacher, idx, constraints, myRequests, settings, schedule } = useMe()
  if (!teacher) return null

  const today = todayIndex()
  const grid = idx.byTeacher.get(teacher.id)
  const hours = teacherWeekHours(schedule, teacher.id)

  const todayCells =
    today >= 0 && grid && today < grid.length
      ? grid[today].flatMap((cells, period) => cells.map((c) => ({ period, cell: c })))
      : []

  const workDays = grid ? grid.filter((day) => day.some((cells) => cells.length > 0)).length : 0
  const totalGaps = grid ? grid.reduce((s, _, d) => s + gapsOfDay(grid, d), 0) : 0

  return (
    <div className="space-y-5">
      {/* Salomlashuv */}
      <section className="relative overflow-hidden rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-600 to-violet-700 p-6 shadow-hero">
        <div className="grid-pattern absolute inset-0 opacity-60" />
        <div className="relative flex flex-wrap items-center gap-5">
          <Photo
            src={teacher.photo}
            name={teacher.fullName}
            shape="rounded"
            className="h-20 w-20 shrink-0 border-2 border-white/30"
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-wide text-indigo-200/80">Xush kelibsiz</p>
            <h1 className="mt-1 text-xl font-bold text-white sm:text-2xl">{teacher.fullName}</h1>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-white/90">
                <IcoCategory className="h-3 w-3" /> {CATEGORY_LABELS[teacher.category ?? 'yoq']}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-white/90">
                <IcoBook className="h-3 w-3" /> {teacher.speciality}
              </span>
              {teacher.homeroomClassId && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-white/90">
                  <IcoClasses className="h-3 w-3" /> {teacher.homeroomClassId} sinf rahbari
                </span>
              )}
            </div>
          </div>
          <Link to="/kabinet/jadval" className="btn-white shrink-0">
            <IcoSchedule className="h-4 w-4" /> Jadvalim
          </Link>
        </div>
      </section>

      {/* Ko'rsatkichlar */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Haftalik yuklama" value={`${hours} soat`} hint={`${formatStavka(hours, settings.stavkaHours)} stavka`} tone="indigo" />
        <Stat label="Ish kunlari" value={workDays} hint="haftada" />
        <Stat label="Bugungi darslar" value={today < 0 ? '—' : todayCells.length} hint={today < 0 ? 'Yakshanba' : DAY_NAMES[today]} tone={todayCells.length ? 'emerald' : 'slate'} />
        <Stat label="Oynalar" value={totalGaps} hint="haftalik jami" tone={totalGaps > 0 ? 'amber' : 'emerald'} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        {/* Bugungi darslar */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line bg-raised px-4 py-2.5">
            <h2 className="text-sm font-semibold text-fg-2">
              Bugungi darslar {today >= 0 && <span className="text-muted">· {DAY_NAMES[today]}</span>}
            </h2>
            <Link to="/kabinet/jadval" className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
              To'liq jadval
            </Link>
          </div>

          {today < 0 ? (
            <p className="p-8 text-center text-sm text-muted">Bugun dam olish kuni.</p>
          ) : !schedule ? (
            <p className="p-8 text-center text-sm text-muted">Dars jadvali hali tuzilmagan.</p>
          ) : todayCells.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted">
              Bugun dars yo'q{constraints?.pedagogicalDay === today ? ' — metodik kun.' : '.'}
            </p>
          ) : (
            <ul className="divide-y divide-line-soft">
              {todayCells.map(({ period, cell }) => {
                const part = cell.parts.find((p) => p.teacherId === teacher.id) ?? cell.parts[0]
                const subject = SUBJECT_BY_ID[part.subjectId]
                return (
                  <li key={cell.unitId} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-sm font-bold"
                      style={{ background: (subject?.color ?? '#94a3b8') + '22', color: subject?.color }}>
                      {period + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-fg">{part.subjectName}</div>
                      <div className="text-xs text-muted">{cell.classId} sinf</div>
                    </div>
                    <span className="badge tint-slate">{period + 1}-soat</span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* So'rovlar va eslatmalar */}
        <div className="space-y-5">
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-line bg-raised px-4 py-2.5">
              <h2 className="text-sm font-semibold text-fg-2">So'nggi so'rovlarim</h2>
              <Link to="/kabinet/sorovlar" className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                Barchasi
              </Link>
            </div>
            {myRequests.length === 0 ? (
              <div className="p-6 text-center">
                <IcoInbox className="mx-auto h-8 w-8 text-faint" />
                <p className="mt-2 text-sm text-muted">Hali so'rov yubormagansiz.</p>
                <Link to="/kabinet/sorovlar" className="btn-soft mt-3">
                  <IcoSend className="h-3.5 w-3.5" /> So'rov yuborish
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-line-soft">
                {myRequests.slice(0, 4).map((r) => (
                  <li key={r.id} className="px-4 py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm text-fg-2">{r.title}</span>
                      <span className={`badge ${STATUS_TINT[r.status]}`}>{REQUEST_STATUS_LABELS[r.status]}</span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-faint">
                      {new Date(r.createdAt).toLocaleDateString('uz-UZ')}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Eslatmalar */}
          <div className="card p-4">
            <h2 className="mb-3 text-sm font-semibold text-fg-2">Shaxsiy shartlar</h2>
            <ul className="space-y-2 text-sm">
              {constraints?.pedagogicalDay !== undefined && (
                <Note Icon={IcoInfo} text={`Metodik kuningiz — ${DAY_NAMES[constraints.pedagogicalDay]}. Bu kunda dars qo'yilmaydi.`} />
              )}
              {constraints?.blockedDays
                .filter((d) => d !== constraints.pedagogicalDay)
                .map((d) => <Note key={d} Icon={IcoClock} text={`${DAY_NAMES[d]} — bo'sh kun sifatida belgilangan.`} />)}
              {constraints?.targetHours !== undefined && (
                <Note Icon={IcoCheck} text={`Tarifikatsiyada belgilangan soat: ${constraints.targetHours}.`} />
              )}
              <Note
                Icon={IcoArrowRight}
                text={`Yuklama chegarangiz: ${teacher.minHours}–${teacher.maxHours} soat.`}
              />
            </ul>
            <p className="mt-3 rounded-lg border border-line bg-raised px-3 py-2 text-[11px] leading-relaxed text-muted">
              Shartlarni o'zgartirish uchun «So'rovlarim» bo'limi orqali ma'muriyatga murojaat qiling.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function Note({ Icon, text }: { Icon: IconType; text: string }) {
  return (
    <li className="flex gap-2 text-fg-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-faint" />
      <span>{text}</span>
    </li>
  )
}
