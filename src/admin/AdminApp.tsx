import { useMemo, useState } from 'react'
import { Link, NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { useAuth, isDirector } from '../authStore'
import { ADMIN_NAV, NAV_GROUPS, adminPath } from './nav'
import { THEME_LABELS } from '../lib/theme'
import type { ThemeMode } from '../lib/theme'
import { ROLE_SHORT } from '../types'
import { initialsOf } from '../lib/image'

import Dashboard from '../pages/Dashboard'
import ClassesPage from '../pages/ClassesPage'
import TeachersPage from '../pages/TeachersPage'
import CurriculumPage from '../pages/CurriculumPage'
import TarifikatsiyaPage from '../pages/TarifikatsiyaPage'
import ExcelPage from '../pages/ExcelPage'
import RulesPage from '../pages/RulesPage'
import GeneratePage from '../pages/GeneratePage'
import SchedulePage from '../pages/SchedulePage'
import ReportPage from '../pages/ReportPage'
import RequestsPage from '../pages/RequestsPage'
import SitePage from '../pages/SitePage'
import UsersPage from '../pages/UsersPage'

import {
  IcoSchedule, IcoSun, IcoMoon, IcoSystem, IcoLock, IcoLogout, IcoHome, IcoMenu, IcoClose,
} from '../components/icons'

const THEMES: { mode: ThemeMode; Icon: typeof IcoSun }[] = [
  { mode: 'light', Icon: IcoSun },
  { mode: 'dark', Icon: IcoMoon },
  { mode: 'system', Icon: IcoSystem },
]

export default function AdminApp() {
  const navigate = useNavigate()
  const session = useAuth((s) => s.session)
  const logout = useAuth((s) => s.logout)
  const {
    settings, schedule, scheduleStale, rules, lockedUnitIds, requests, site, setSettings,
  } = useStore()
  const [open, setOpen] = useState(false)

  const director = isDirector(session?.role)
  const items = useMemo(() => ADMIN_NAV.filter((n) => !n.directorOnly || director), [director])

  const rulesCount = rules.filter((r) => r.active && r.kind !== 'note').length
  const newRequests = requests.filter((r) => r.status === 'yangi').length

  const go = (id: string) => navigate(adminPath(id))

  return (
    <div className="flex min-h-screen">
      {/* ── Yon panel ─────────────────────────────────────────────────── */}
      <aside
        className={`no-print fixed inset-y-0 left-0 z-50 flex h-screen w-64 shrink-0 flex-col border-r border-line bg-surface
                    transition-transform duration-200 lg:sticky lg:top-0 lg:translate-x-0
                    ${open ? 'translate-x-0 shadow-lift' : '-translate-x-full'}`}
      >
        <div className="border-b border-line px-4 py-3.5">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
              <IcoSchedule className="h-3.5 w-3.5" />
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Boshqaruv paneli
            </span>
            <button className="btn-icon ml-auto lg:hidden" onClick={() => setOpen(false)}>
              <IcoClose className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-1.5 truncate text-sm font-semibold text-fg" title={site.profile.name}>
            {site.profile.shortName}
          </div>
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto p-2">
          {NAV_GROUPS.map((group) => {
            const list = items.filter((n) => n.group === group)
            if (list.length === 0) return null
            return (
              <div key={group}>
                <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-faint">
                  {group}
                </div>
                <div className="space-y-0.5">
                  {list.map(({ id, path, label, Icon }) => (
                    <NavLink
                      key={id}
                      to={`/boshqaruv${path ? '/' + path : ''}`}
                      end={path === ''}
                      onClick={() => setOpen(false)}
                      className={({ isActive }) =>
                        `group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors duration-150 ${
                          isActive
                            ? 'bg-indigo-500/10 font-medium text-indigo-700 dark:text-indigo-300'
                            : 'text-muted hover:bg-raised hover:text-fg'
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <Icon
                            className={`h-4 w-4 shrink-0 transition-colors ${
                              isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-faint group-hover:text-fg-2'
                            }`}
                          />
                          <span className="flex-1 truncate">{label}</span>
                          {id === 'rules' && rulesCount > 0 && (
                            <span className="badge bg-indigo-500/15 text-indigo-700 dark:text-indigo-300">{rulesCount}</span>
                          )}
                          {id === 'requests' && newRequests > 0 && (
                            <span className="badge bg-rose-500/15 text-rose-700 dark:text-rose-300">{newRequests}</span>
                          )}
                          {id === 'schedule' && lockedUnitIds.length > 0 && (
                            <span className="badge bg-amber-500/15 text-amber-700 dark:text-amber-300">
                              <IcoLock className="h-2.5 w-2.5" />
                              {lockedUnitIds.length}
                            </span>
                          )}
                          {id === 'generate' && scheduleStale && (
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" title="Qayta hisoblash kerak" />
                          )}
                        </>
                      )}
                    </NavLink>
                  ))}
                </div>
              </div>
            )
          })}
        </nav>

        {/* Mavzu va holat */}
        <div className="border-t border-line p-3">
          <div className="seg w-full">
            {THEMES.map(({ mode, Icon }) => (
              <button
                key={mode}
                onClick={() => setSettings({ theme: mode })}
                title={THEME_LABELS[mode]}
                className={`seg-item flex-1 justify-center px-0 ${(settings.theme ?? 'system') === mode ? 'seg-item-on' : ''}`}
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
                <>Jadval eskirgan<br />Qayta hisoblash kerak</>
              ) : (
                <>Jadval dolzarb<br />{new Date(schedule.createdAt).toLocaleString('uz-UZ')}</>
              )}
            </span>
          </div>
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden" onClick={() => setOpen(false)} />
      )}

      {/* ── Asosiy maydon ─────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur-md">
          <button className="btn-ghost h-8 w-8 p-0 lg:hidden" onClick={() => setOpen(true)}>
            <IcoMenu className="h-4 w-4" />
          </button>

          <Link to="/" className="btn-ghost" title="Rasmiy saytga o'tish">
            <IcoHome className="h-4 w-4" />
            <span className="hidden sm:inline">Sayt</span>
          </Link>

          <div className="ml-auto flex items-center gap-2.5">
            <div className="hidden text-right leading-tight sm:block">
              <div className="text-xs font-semibold text-fg">{session?.fullName}</div>
              <div className="text-[11px] text-muted">
                {session ? ROLE_SHORT[session.role] : ''}
              </div>
            </div>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-semibold text-white">
              {initialsOf(session?.fullName ?? '')}
            </span>
            <button
              className="btn-ghost"
              onClick={() => { logout(); navigate('/', { replace: true }) }}
              title="Tizimdan chiqish"
            >
              <IcoLogout className="h-4 w-4" />
              <span className="hidden lg:inline">Chiqish</span>
            </button>
          </div>
        </header>

        <main className="min-w-0 flex-1">
          <Routes>
            <Route index element={<Dashboard onNavigate={go} />} />
            <Route path="sinflar" element={<ClassesPage />} />
            <Route path="oqituvchilar" element={<TeachersPage />} />
            <Route path="oquv-reja" element={<CurriculumPage />} />
            <Route path="tarifikatsiya" element={<TarifikatsiyaPage />} />
            <Route path="excel" element={<ExcelPage onNavigate={go} />} />
            <Route path="shartlar" element={<RulesPage />} />
            <Route path="yaratish" element={<GeneratePage />} />
            <Route path="jadval" element={<SchedulePage />} />
            <Route path="tekshiruv" element={<ReportPage />} />
            <Route path="sorovlar" element={<RequestsPage />} />
            {director && <Route path="sayt" element={<SitePage />} />}
            {director && <Route path="foydalanuvchilar" element={<UsersPage />} />}
            <Route path="*" element={<Navigate to="/boshqaruv" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
