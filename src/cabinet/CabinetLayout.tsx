import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { useAuth } from '../authStore'
import { Photo } from '../components/Photo'
import { THEME_LABELS } from '../lib/theme'
import type { ThemeMode } from '../lib/theme'
import { CATEGORY_LABELS } from '../types'
import {
  IcoAccount, IcoSchedule, IcoUser, IcoInbox, IcoLogout, IcoSun, IcoMoon, IcoSystem,
  IcoHome, IcoDashboard,
} from '../components/icons'

const TABS = [
  { to: '/kabinet', label: 'Bosh sahifa', Icon: IcoDashboard, end: true },
  { to: '/kabinet/jadval', label: 'Dars jadvalim', Icon: IcoSchedule },
  { to: '/kabinet/malumot', label: "Ma'lumotlarim", Icon: IcoUser },
  { to: '/kabinet/sorovlar', label: "So'rovlarim", Icon: IcoInbox },
]

const THEMES: { mode: ThemeMode; Icon: typeof IcoSun }[] = [
  { mode: 'light', Icon: IcoSun },
  { mode: 'dark', Icon: IcoMoon },
  { mode: 'system', Icon: IcoSystem },
]

export default function CabinetLayout() {
  const navigate = useNavigate()
  const session = useAuth((s) => s.session)
  const logout = useAuth((s) => s.logout)
  const { teachers, settings, requests, site, setSettings } = useStore()

  const teacher = teachers.find((t) => t.id === session?.userId)
  const mine = requests.filter((r) => r.teacherId === session?.userId)
  const pending = mine.filter((r) => r.status === 'yangi' || r.status === 'korilmoqda').length

  if (!teacher) {
    return (
      <div className="grid min-h-screen place-items-center bg-canvas p-6 text-center">
        <div>
          <h1 className="h-section">Ma'lumot topilmadi</h1>
          <p className="lede mt-2">Hisobingiz o'chirilgan bo'lishi mumkin. Ma'muriyatga murojaat qiling.</p>
          <button className="btn-primary mt-6" onClick={() => { logout(); navigate('/kirish?rol=teacher') }}>
            Chiqish
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-canvas">
      {/* ── Yuqori panel ─────────────────────────────────────────────── */}
      <header className="no-print sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur-md">
        <div className="site-wrap flex h-16 items-center gap-3">
          <Link to="/" className="flex items-center gap-2.5" title="Rasmiy saytga o'tish">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
              <IcoAccount className="h-4 w-4" />
            </span>
            <span className="hidden sm:block">
              <span className="block text-sm font-bold leading-tight text-fg">Shaxsiy kabinet</span>
              <span className="block text-[11px] leading-tight text-muted">{site.profile.shortName}</span>
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-2">
            <div className="seg hidden sm:inline-flex">
              {THEMES.map(({ mode, Icon }) => (
                <button key={mode} onClick={() => setSettings({ theme: mode })} title={THEME_LABELS[mode]}
                  className={`seg-item px-2 ${(settings.theme ?? 'system') === mode ? 'seg-item-on' : ''}`}>
                  <Icon className="h-3.5 w-3.5" />
                </button>
              ))}
            </div>

            <Link to="/" className="btn-ghost" title="Rasmiy sayt">
              <IcoHome className="h-4 w-4" />
              <span className="hidden lg:inline">Sayt</span>
            </Link>

            <div className="flex items-center gap-2.5 rounded-xl border border-line bg-raised py-1 pl-1 pr-3">
              <Photo src={teacher.photo} name={teacher.fullName} className="h-8 w-8 shrink-0" />
              <div className="hidden min-w-0 leading-tight md:block">
                <div className="truncate text-xs font-semibold text-fg">{teacher.fullName}</div>
                <div className="truncate text-[11px] text-muted">
                  {CATEGORY_LABELS[teacher.category ?? 'yoq']}
                </div>
              </div>
            </div>

            <button
              className="btn-ghost"
              onClick={() => { logout(); navigate('/', { replace: true }) }}
              title="Tizimdan chiqish"
            >
              <IcoLogout className="h-4 w-4" />
              <span className="hidden lg:inline">Chiqish</span>
            </button>
          </div>
        </div>

        {/* Bo'limlar */}
        <nav className="border-t border-line">
          <div className="site-wrap flex gap-1 overflow-x-auto py-1.5">
            {TABS.map(({ to, label, Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300'
                      : 'text-muted hover:bg-raised hover:text-fg'
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                {label}
                {to.endsWith('sorovlar') && pending > 0 && (
                  <span className="badge bg-amber-500/15 text-amber-700 dark:text-amber-300">{pending}</span>
                )}
              </NavLink>
            ))}
          </div>
        </nav>
      </header>

      <main className="site-wrap py-6">
        <Outlet />
      </main>
    </div>
  )
}
