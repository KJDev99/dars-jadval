import { useState } from 'react'
import { useStore } from './store'
import Dashboard from './pages/Dashboard'
import ClassesPage from './pages/ClassesPage'
import TeachersPage from './pages/TeachersPage'
import CurriculumPage from './pages/CurriculumPage'
import TarifikatsiyaPage from './pages/TarifikatsiyaPage'
import GeneratePage from './pages/GeneratePage'
import SchedulePage from './pages/SchedulePage'
import ReportPage from './pages/ReportPage'
import RulesPage from './pages/RulesPage'

const NAV = [
  { id: 'dashboard', label: 'Boshqaruv paneli', icon: '▦' },
  { id: 'classes', label: 'Sinflar', icon: '▤' },
  { id: 'teachers', label: "O'qituvchilar", icon: '👤' },
  { id: 'curriculum', label: "O'quv reja", icon: '📚' },
  { id: 'tarif', label: 'Tarifikatsiya', icon: '🗂' },
  { id: 'rules', label: "Shartlar va izohlar", icon: '📌' },
  { id: 'generate', label: 'Jadval yaratish', icon: '⚙' },
  { id: 'schedule', label: 'Dars jadvali', icon: '🗓' },
  { id: 'report', label: 'Tekshiruv', icon: '✔' },
] as const

type PageId = (typeof NAV)[number]['id']

export default function App() {
  const [page, setPage] = useState<PageId>('dashboard')
  const schoolName = useStore((s) => s.settings.schoolName)
  const setSettings = useStore((s) => s.setSettings)
  const schedule = useStore((s) => s.schedule)
  const scheduleStale = useStore((s) => s.scheduleStale)
  const rulesCount = useStore((s) => s.rules.filter((r) => r.active && r.kind !== 'note').length)
  const locksCount = useStore((s) => s.lockedUnitIds.length)

  return (
    <div className="flex min-h-screen">
      {/* Yon panel */}
      <aside className="no-print flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-indigo-600">
            Dars Jadval
          </div>
          <input
            className="mt-1 w-full rounded border-0 bg-transparent p-0 text-sm font-semibold text-slate-900 outline-none focus:bg-slate-50"
            value={schoolName}
            onChange={(e) => setSettings({ schoolName: e.target.value })}
          />
        </div>
        <nav className="flex-1 space-y-0.5 p-2">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => setPage(n.id)}
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition ${
                page === n.id
                  ? 'bg-indigo-50 font-medium text-indigo-700'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className="w-4 text-center text-xs opacity-70">{n.icon}</span>
              <span className="flex-1">{n.label}</span>
              {n.id === 'rules' && rulesCount > 0 && (
                <span className="badge bg-indigo-100 text-indigo-700">{rulesCount}</span>
              )}
              {n.id === 'schedule' && locksCount > 0 && (
                <span className="badge bg-amber-100 text-amber-700">🔒{locksCount}</span>
              )}
              {n.id === 'generate' && scheduleStale && (
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" title="Qayta hisoblash kerak" />
              )}
            </button>
          ))}
        </nav>
        <div className="border-t border-slate-200 p-3 text-[11px] leading-relaxed text-slate-500">
          {schedule ? (
            scheduleStale ? (
              <span className="text-amber-600">
                ● Jadval eskirgan
                <br />
                Qayta hisoblash kerak
              </span>
            ) : (
              <span className="text-emerald-600">
                ● Jadval dolzarb
                <br />
                {new Date(schedule.createdAt).toLocaleString('uz-UZ')}
              </span>
            )
          ) : (
            <span>○ Jadval hali yaratilmagan</span>
          )}
        </div>
      </aside>

      {/* Asosiy maydon */}
      <main className="flex-1 overflow-x-hidden">
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
