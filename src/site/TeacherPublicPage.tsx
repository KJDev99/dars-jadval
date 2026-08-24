import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useStore } from '../store'
import { Photo } from '../components/Photo'
import Timetable from './Timetable'
import { buildIndex, teacherWeekHours } from '../lib/view'
import { useIsDark } from '../lib/theme'
import { formatStavka } from '../lib/derive'
import { CATEGORY_LABELS } from '../types'
import { SUBJECT_BY_ID } from '../data/curriculum'
import {
  IcoArrowRight, IcoBriefcase, IcoGraduation, IcoTrophy, IcoClock, IcoClasses,
  IcoSchedule, IcoCategory, IcoBook,
} from '../components/icons'
import type { IconType } from '../components/icons'

export default function TeacherPublicPage() {
  const { id } = useParams()
  const { teachers, classes, settings, schedule } = useStore()
  const dark = useIsDark(settings.theme ?? 'system')

  const teacher = teachers.find((t) => t.id === id)
  const idx = useMemo(
    () => buildIndex(schedule, classes, teachers, settings),
    [schedule, classes, teachers, settings],
  )

  if (!teacher || teacher.publicVisible === false) {
    return (
      <div className="site-wrap py-24 text-center">
        <h1 className="h-section">O'qituvchi topilmadi</h1>
        <p className="lede mt-2">Bunday sahifa mavjud emas yoki ma'lumot yopilgan.</p>
        <Link to="/oqituvchilar" className="btn-primary mt-6">
          Pedagoglar ro'yxati <IcoArrowRight className="h-4 w-4" />
        </Link>
      </div>
    )
  }

  const hours = teacherWeekHours(schedule, teacher.id)
  const homeroom = teacher.homeroomClassId
  const subjects = teacher.subjectIds.map((s) => SUBJECT_BY_ID[s]).filter(Boolean)

  return (
    <>
      {/* Yuqori qism */}
      <section className="relative overflow-hidden border-b border-line bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800">
        <div className="grid-pattern absolute inset-0 opacity-70" />
        <div className="site-wrap relative py-10 sm:py-14">
          <Link
            to="/oqituvchilar"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-100/80 transition-colors hover:text-white"
          >
            ← Pedagoglar ro'yxati
          </Link>

          <div className="mt-5 flex flex-col gap-6 sm:flex-row sm:items-end">
            <Photo
              src={teacher.photo}
              name={teacher.fullName}
              shape="rounded"
              className="h-32 w-32 shrink-0 border-4 border-white/25 shadow-hero sm:h-40 sm:w-40"
            />
            <div className="min-w-0 flex-1">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/90">
                <IcoCategory className="h-3.5 w-3.5" /> {CATEGORY_LABELS[teacher.category ?? 'yoq']}
              </span>
              <h1 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                {teacher.fullName}
              </h1>
              <p className="mt-1.5 text-indigo-100/90">{teacher.speciality}</p>
              {teacher.degree && <p className="mt-1 text-sm text-indigo-200/80">{teacher.degree}</p>}
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="site-wrap grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          {/* Chap ustun — ma'lumotlar */}
          <div className="space-y-5">
            <div className="card divide-y divide-line-soft">
              {[
                teacher.experienceYears
                  ? { Icon: IcoBriefcase, label: 'Pedagogik staj', value: `${teacher.experienceYears} yil` }
                  : null,
                teacher.startYear
                  ? { Icon: IcoClock, label: 'Maktabda', value: `${teacher.startYear}-yildan buyon` }
                  : null,
                teacher.education
                  ? { Icon: IcoGraduation, label: "Ma'lumoti", value: teacher.education }
                  : null,
                homeroom ? { Icon: IcoClasses, label: 'Sinf rahbari', value: `${homeroom} sinf` } : null,
                hours > 0
                  ? {
                      Icon: IcoSchedule,
                      label: 'Haftalik yuklama',
                      value: `${hours} soat · ${formatStavka(hours, settings.stavkaHours)} stavka`,
                    }
                  : null,
              ]
                .filter(Boolean)
                .map((r) => {
                  const row = r as { Icon: IconType; label: string; value: string }
                  return (
                    <div key={row.label} className="flex items-start gap-3 px-4 py-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                        <row.Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <div className="text-[11px] uppercase tracking-wide text-faint">{row.label}</div>
                        <div className="text-sm font-medium text-fg">{row.value}</div>
                      </div>
                    </div>
                  )
                })}
            </div>

            {subjects.length > 0 && (
              <div className="card p-5">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-fg">
                  <IcoBook className="h-4 w-4 text-faint" /> O'qitadigan fanlar
                </h2>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {subjects.map((s) => (
                    <span
                      key={s.id}
                      className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium"
                      style={{ borderColor: s.color + '55', color: s.color }}
                    >
                      <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />
                      {s.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {teacher.bio && (
              <div className="card p-5">
                <h2 className="text-sm font-semibold text-fg">Qisqacha ma'lumot</h2>
                <p className="mt-2 text-sm leading-relaxed text-fg-2">{teacher.bio}</p>
              </div>
            )}

            {teacher.achievements && teacher.achievements.length > 0 && (
              <div className="card border-amber-500/25 bg-amber-500/[0.06] p-5">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-400">
                  <IcoTrophy className="h-4 w-4" /> Faoliyati va yutuqlari
                </h2>
                <ul className="mt-3 space-y-2 text-sm text-fg-2">
                  {teacher.achievements.map((a, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                      {a}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* O'ng ustun — dars jadvali */}
          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="h-section text-xl sm:text-2xl">Haftalik dars jadvali</h2>
              {schedule && (
                <span className="text-xs text-faint">
                  {new Date(schedule.createdAt).toLocaleDateString('uz-UZ')} holatiga ko'ra
                </span>
              )}
            </div>
            {schedule ? (
              <Timetable idx={idx} kind="teacher" id={teacher.id} dark={dark} />
            ) : (
              <div className="card grid place-items-center p-10 text-center text-sm text-faint">
                Dars jadvali hali e'lon qilinmagan.
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  )
}
