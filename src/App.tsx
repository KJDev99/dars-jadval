import { useState } from 'react'
import { useStore } from './store'
import { useTheme, THEME_LABELS } from './lib/theme'
import type { ThemeMode } from './lib/theme'
import Dashboard from './pages/Dashboard'
import ClassesPage from './pages/ClassesPage'
import TeachersPage from './pages/TeachersPage'
import CurriculumPage from './pages/CurriculumPage'
import TarifikatsiyaPage from './pages/TarifikatsiyaPage'
import GeneratePage from './pages/GeneratePage'
import SchedulePage from './pages/SchedulePage'
import ReportPage from './pages/ReportPage'
import RulesPage from './pages/RulesPage'
import {
  IcoDashboard,
  IcoClasses,
  IcoTeachers,
  IcoCurriculum,
  IcoTarif,
  IcoRules,
  IcoGenerate,
  IcoSchedule,
  IcoReport,
  IcoSun,
  IcoMoon,
  IcoSystem,
  IcoLock,
} from './components/icons'

const NAV = [
  { id: 'dashboard', label: 'Boshqaruv paneli', Icon: IcoDashboard },
  { id: 'classes', label: 'Sinflar', Icon: IcoClasses },
  { id: 'teachers', label: "O'qituvchilar", Icon: IcoTeachers },
  { id: 'curriculum', label: "O'quv reja", Icon: IcoCurriculum },
  { id: 'tarif', label: 'Tarifikatsiya', Icon: IcoTarif },
  { id: 'rules', label: 'Shartlar va izohlar', Icon: IcoRules },
  { id: 'generate', label: 'Jadval yaratish', Icon: IcoGenerate },
  { id: 'schedule', label: 'Dars jadvali', Icon: IcoSchedule },
  { id: 'report', label: 'Tekshiruv', Icon: IcoReport },
] as const

type PageId = (typeof NAV)[number]['id']

const THEME_OPTIONS: { mode: ThemeMode; Icon: typeof IcoSun }[] = [
  { mode: 'light', Icon: IcoSun },
  { mode: 'dark', Icon: IcoMoon },
  { mode: 'system', Icon: IcoSystem },
]

export default function App() {
  const [page, setPage] = useState<PageId>('dashboard')
  const schoolName = useStore((s) => s.settings.schoolName)
  const theme = useStore((s) => s.settings.theme)
  const setSettings = useStore((s) => s.setSettings)
  const schedule = useStore((s) => s.schedule)
  const scheduleStale = useStore((s) => s.scheduleStale)
  const rulesCount = useStore((s) => s.rules.filter((r) => r.active && r.kind !== 'note').length)
  const locksCount = useStore((s) => s.lockedUnitIds.length)

  useTheme(theme ?? 'system')

  return (
    <div className="flex min-h-screen">
      {/* Yon panel */}
      <aside className="no-print sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-line bg-surface">
        <div className="border-b border-line px-4 py-4">
          <div className="flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-md bg-indigo-600 text-white">
              <IcoSchedule className="h-3.5 w-3.5" />
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Dars Jadval
            </span>
          </div>
          <input
            className="mt-1.5 w-full rounded border-0 bg-transparent p-0 text-sm font-semibold text-fg outline-none
                       transition-colors focus:text-indigo-600 dark:focus:text-indigo-400"
            value={schoolName}
            onChange={(e) => setSettings({ schoolName: e.target.value })}
          />
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {NAV.map(({ id, label, Icon }) => {
            const on = page === id
            return (
              <button
                key={id}
                onClick={() => setPage(id)}
                className={`group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm
                            transition-colors duration-150 ${
                              on
                                ? 'bg-indigo-500/10 font-medium text-indigo-700 dark:text-indigo-300'
                                : 'text-muted hover:bg-raised hover:text-fg'
                            }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 transition-colors ${
                    on ? 'text-indigo-600 dark:text-indigo-400' : 'text-faint group-hover:text-fg-2'
                  }`}
                />
                <span className="flex-1 truncate">{label}</span>
                {id === 'rules' && rulesCount > 0 && (
                  <span className="badge bg-indigo-500/15 text-indigo-700 dark:text-indigo-300">{rulesCount}</span>
                )}
                {id === 'schedule' && locksCount > 0 && (
                  <span className="badge bg-amber-500/15 text-amber-700 dark:text-amber-300">
                    <IcoLock className="h-2.5 w-2.5" />
                    {locksCount}
                  </span>
                )}
                {id === 'generate' && scheduleStale && (
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" title="Qayta hisoblash kerak" />
                )}
              </button>
            )
          })}
        </nav>

        {/* Mavzu almashtirgich */}
        <div className="border-t border-line p-3">
          <div className="seg w-full">
            {THEME_OPTIONS.map(({ mode, Icon }) => (
              <button
                key={mode}
                onClick={() => setSettings({ theme: mode })}
                title={THEME_LABELS[mode]}
                className={`seg-item flex-1 justify-center px-0 ${
                  (theme ?? 'system') === mode ? 'seg-item-on' : ''
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>

          <div className="mt-2.5 flex items-start gap-1.5 text-[11px] leading-relaxed">
            <span
              className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${
                !schedule ? 'bg-faint' : scheduleStale ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
            />
            <span className="text-muted">
              {!schedule ? (
                'Jadval hali yaratilmagan'
              ) : scheduleStale ? (
                <>
                  Jadval eskirgan
                  <br />
                  Qayta hisoblash kerak
                </>
              ) : (
                <>
                  Jadval dolzarb
                  <br />
                  {new Date(schedule.createdAt).toLocaleString('uz-UZ')}
                </>
              )}
            </span>
          </div>
        </div>
      </aside>

      {/* Asosiy maydon */}
      <main className="min-w-0 flex-1">
        {page === 'dashboard' && <Dashboard onNavigate={setPage} />}
        {page === 'classes' && <ClassesPage />}
        {page === 'teachers' && <TeachersPage />}
        {page === 'curriculum' && <CurriculumPage />}
        {page === 'tarif' && <TarifikatsiyaPage />}
        {page === 'rules' && <RulesPage />}
        {page === 'generate' && <GeneratePage />}
        {page === 'schedule' && <SchedulePage />}
        {page === 'report' && <ReportPage />}
      </main>
    </div>
  )
}

export type { PageId }
