import { useMemo, useState } from 'react'
import { useStore } from '../store'
import Select from '../components/Select'
import Timetable from './Timetable'
import { PageHero } from './ui'
import { buildIndex } from '../lib/view'
import { useIsDark } from '../lib/theme'
import { CATEGORY_LABELS } from '../types'
import { IcoPrint, IcoClasses, IcoTeachers, IcoSchedule } from '../components/icons'

type Mode = 'class' | 'teacher'

export default function PublicSchedulePage() {
  const { classes, teachers, settings, schedule } = useStore()
  const dark = useIsDark(settings.theme ?? 'system')

  const [mode, setMode] = useState<Mode>('class')
  const [classId, setClassId] = useState(classes[0]?.id ?? '')
  const [teacherId, setTeacherId] = useState('')

  const idx = useMemo(
    () => buildIndex(schedule, classes, teachers, settings),
    [schedule, classes, teachers, settings],
  )

  const cls = classes.find((c) => c.id === classId)
  const teacher = teachers.find((t) => t.id === teacherId)
  const days = cls ? (cls.grade <= 4 ? settings.daysPrimary : settings.daysSenior) : idx.days

  return (
    <>
      <PageHero
        eyebrow="Dars jadvali"
        title="Umumiy dars jadvali"
        text={
          schedule
            ? `Jadval ${new Date(schedule.createdAt).toLocaleDateString('uz-UZ', { day: 'numeric', month: 'long', year: 'numeric' })} holatiga ko'ra amal qiladi.`
            : "Jadval hali e'lon qilinmagan."
        }
      />

      <section className="section">
        <div className="site-wrap">
          {/* Boshqaruv */}
          <div className="no-print mb-6 flex flex-wrap items-center gap-3">
            <div className="seg">
              <button
                className={`seg-item ${mode === 'class' ? 'seg-item-on' : ''}`}
                onClick={() => setMode('class')}
              >
                <IcoClasses className="h-3.5 w-3.5" /> Sinf bo'yicha
              </button>
              <button
                className={`seg-item ${mode === 'teacher' ? 'seg-item-on' : ''}`}
                onClick={() => {
                  setMode('teacher')
                  if (!teacherId) setTeacherId(teachers[0]?.id ?? '')
                }}
              >
                <IcoTeachers className="h-3.5 w-3.5" /> O'qituvchi bo'yicha
              </button>
            </div>

            {mode === 'class' ? (
              <Select
                className="w-44"
                value={classId}
                onChange={setClassId}
                placeholder="Sinfni tanlang"
                options={classes.map((c) => ({
                  value: c.id,
                  label: `${c.grade}-${c.letter} sinf`,
                  group: `${c.grade}-sinflar`,
                }))}
              />
            ) : (
              <Select
                className="w-72"
                value={teacherId}
                onChange={setTeacherId}
                placeholder="O'qituvchini tanlang"
                options={teachers.map((t) => ({
                  value: t.id,
                  label: t.fullName,
                  hint: CATEGORY_LABELS[t.category ?? 'yoq'],
                  group: t.speciality || 'Boshqa',
                }))}
              />
            )}

            <button className="btn-ghost ml-auto" onClick={() => window.print()}>
              <IcoPrint className="h-4 w-4" /> Chop etish
            </button>
          </div>

          {/* Sarlavha */}
          <div className="mb-4 flex flex-wrap items-baseline gap-3">
            <h2 className="text-xl font-bold text-fg">
              {mode === 'class'
                ? cls
                  ? `${cls.grade}-${cls.letter} sinf`
                  : 'Sinf tanlanmagan'
                : (teacher?.fullName ?? "O'qituvchi tanlanmagan")}
            </h2>
            {mode === 'class' && cls && (
              <span className="text-sm text-muted">
                {days} kunlik o'qish{cls.studentsCount ? ` · ${cls.studentsCount} o'quvchi` : ''}
              </span>
            )}
            {mode === 'teacher' && teacher && (
              <span className="text-sm text-muted">{teacher.speciality}</span>
            )}
          </div>

          {!schedule ? (
            <div className="card grid place-items-center gap-3 p-14 text-center">
              <IcoSchedule className="h-10 w-10 text-faint" />
              <p className="text-sm text-muted">
                Dars jadvali hali e'lon qilinmagan. Iltimos, keyinroq qayta urinib ko'ring.
              </p>
            </div>
          ) : mode === 'class' ? (
            classId && <Timetable idx={idx} kind="class" id={classId} dark={dark} days={days} />
          ) : (
            teacherId && <Timetable idx={idx} kind="teacher" id={teacherId} dark={dark} />
          )}

          <p className="no-print mt-6 text-xs text-faint">
            Jadval avtomatlashtirilgan tizim yordamida tuziladi: o'quvchilar jadvalida bo'shliq
            qoldirilmaydi, o'qituvchilarning metodik kunlari va yuklama chegaralari hisobga olinadi.
          </p>
        </div>
      </section>
    </>
  )
}
