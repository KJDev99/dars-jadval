import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useStore } from '../store'
import { useAuth } from '../authStore'
import { Photo } from '../components/Photo'
import { THEME_LABELS } from '../lib/theme'
import type { ThemeMode } from '../lib/theme'
import {
  IcoPhone, IcoMail, IcoMapPin, IcoLogin, IcoMenu, IcoClose, IcoSun, IcoMoon, IcoSystem,
  IcoSchedule, IcoInstagram, IcoSend, IcoYoutube, IcoAccount, IcoGenerate,
} from '../components/icons'

export const SITE_NAV = [
  { to: '/', label: 'Bosh sahifa', end: true },
  { to: '/maktab', label: 'Maktab haqida' },
  { to: '/rahbariyat', label: 'Rahbariyat' },
  { to: '/oqituvchilar', label: "Pedagoglar" },
  { to: '/yutuqlar', label: 'Yutuqlar' },
  { to: '/jadval', label: 'Dars jadvali' },
  { to: '/aloqa', label: 'Aloqa' },
]

const THEMES: { mode: ThemeMode; Icon: typeof IcoSun }[] = [
  { mode: 'light', Icon: IcoSun },
  { mode: 'dark', Icon: IcoMoon },
  { mode: 'system', Icon: IcoSystem },
]

export default function PublicLayout() {
  const profile = useStore((s) => s.site.profile)
  const theme = useStore((s) => s.settings.theme) ?? 'system'
  const setSettings = useStore((s) => s.setSettings)
  const session = useAuth((s) => s.session)
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()

  // Sahifa almashganda yuqoriga qaytamiz va menyuni yopamiz
  useEffect(() => {
    setOpen(false)
    window.scrollTo({ top: 0 })
  }, [pathname])

  const cabinetLink =
    session?.role === 'teacher'
      ? { to: '/kabinet', label: 'Shaxsiy kabinet', Icon: IcoAccount }
      : session
        ? { to: '/boshqaruv', label: 'Boshqaruv paneli', Icon: IcoGenerate }
        : null

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      {/* ── Yuqori qator ─────────────────────────────────────────────── */}
      <div className="no-print hidden border-b border-line bg-surface text-xs text-muted lg:block">
        <div className="site-wrap flex h-9 items-center justify-between">
          <div className="flex items-center gap-5">
            <span className="flex items-center gap-1.5">
              <IcoMapPin className="h-3.5 w-3.5 text-faint" /> {profile.address}
            </span>
            <a href={`tel:${profile.phone.replace(/\s/g, '')}`} className="flex items-center gap-1.5 transition-colors hover:text-fg">
              <IcoPhone className="h-3.5 w-3.5 text-faint" /> {profile.phone}
            </a>
            <a href={`mailto:${profile.email}`} className="flex items-center gap-1.5 transition-colors hover:text-fg">
              <IcoMail className="h-3.5 w-3.5 text-faint" /> {profile.email}
            </a>
          </div>
          <div className="flex items-center gap-3">
            {profile.telegram && (
              <a href={profile.telegram} target="_blank" rel="noreferrer" title="Telegram"
                className="transition-colors hover:text-fg"><IcoSend className="h-3.5 w-3.5" /></a>
            )}
            {profile.instagram && (
              <a href={profile.instagram} target="_blank" rel="noreferrer" title="Instagram"
                className="transition-colors hover:text-fg"><IcoInstagram className="h-3.5 w-3.5" /></a>
            )}
            {profile.youtube && (
              <a href={profile.youtube} target="_blank" rel="noreferrer" title="YouTube"
                className="transition-colors hover:text-fg"><IcoYoutube className="h-3.5 w-3.5" /></a>
            )}
            <span className="text-faint">{profile.foundedYear}-yildan buyon</span>
          </div>
        </div>
      </div>

      {/* ── Sarlavha ─────────────────────────────────────────────────── */}
      <header className="no-print sticky top-0 z-40 border-b border-line bg-surface/85 backdrop-blur-md">
        <div className="site-wrap flex h-16 items-center gap-3">
          <Link to="/" className="flex min-w-0 items-center gap-2.5">
            {profile.logo ? (
              <Photo src={profile.logo} shape="rounded" className="h-9 w-9 shrink-0" alt="Logotip" />
            ) : (
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm">
                <IcoSchedule className="h-4 w-4" />
              </span>
            )}
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold leading-tight text-fg">{profile.shortName}</span>
              <span className="block truncate text-[11px] leading-tight text-muted">
                {profile.district}
              </span>
            </span>
          </Link>

          <nav className="ml-auto hidden items-center gap-0.5 xl:flex">
            {SITE_NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end}
                className={({ isActive }) => `nav-link ${isActive ? 'nav-link-on' : ''}`}>
                {n.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2 xl:ml-3">
            <div className="seg hidden sm:inline-flex">
              {THEMES.map(({ mode, Icon }) => (
                <button key={mode} onClick={() => setSettings({ theme: mode })} title={THEME_LABELS[mode]}
                  className={`seg-item px-2 ${theme === mode ? 'seg-item-on' : ''}`}>
                  <Icon className="h-3.5 w-3.5" />
                </button>
              ))}
            </div>

            {cabinetLink ? (
              <Link to={cabinetLink.to} className="btn-primary">
                <cabinetLink.Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{cabinetLink.label}</span>
              </Link>
            ) : (
              <Link to="/kirish" className="btn-primary">
                <IcoLogin className="h-4 w-4" />
                <span className="hidden sm:inline">Kirish</span>
              </Link>
            )}

            <button className="btn-ghost h-9 w-9 p-0 xl:hidden" onClick={() => setOpen((v) => !v)}
              title="Menyu">
              {open ? <IcoClose className="h-4 w-4" /> : <IcoMenu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Mobil menyu */}
        {open && (
          <nav className="border-t border-line bg-surface xl:hidden">
            <div className="site-wrap grid gap-0.5 py-3">
              {SITE_NAV.map((n) => (
                <NavLink key={n.to} to={n.to} end={n.end}
                  className={({ isActive }) => `nav-link block ${isActive ? 'nav-link-on' : ''}`}>
                  {n.label}
                </NavLink>
              ))}
            </div>
          </nav>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      {/* ── Pastki qism ──────────────────────────────────────────────── */}
      <footer className="no-print border-t border-line bg-surface">
        <div className="site-wrap grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
                <IcoSchedule className="h-4 w-4" />
              </span>
              <span className="text-sm font-bold text-fg">{profile.shortName}</span>
            </div>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted">{profile.motto}</p>
            <p className="mt-3 text-xs text-faint">{profile.foundedYear}-yilda tashkil etilgan</p>
          </div>

          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-fg-2">Bo'limlar</h3>
            <ul className="space-y-1.5 text-sm">
              {SITE_NAV.slice(1).map((n) => (
                <li key={n.to}>
                  <Link to={n.to} className="text-muted transition-colors hover:text-indigo-600 dark:hover:text-indigo-400">
                    {n.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-fg-2">Aloqa</h3>
            <ul className="space-y-2 text-sm text-muted">
              <li className="flex gap-2"><IcoMapPin className="mt-0.5 h-4 w-4 shrink-0 text-faint" />{profile.address}</li>
              <li className="flex gap-2"><IcoPhone className="mt-0.5 h-4 w-4 shrink-0 text-faint" />{profile.phone}</li>
              <li className="flex gap-2"><IcoMail className="mt-0.5 h-4 w-4 shrink-0 text-faint" />{profile.email}</li>
            </ul>
          </div>

          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-fg-2">Tizim</h3>
            <ul className="space-y-1.5 text-sm">
              <li>
                <Link to="/kirish" className="text-muted transition-colors hover:text-indigo-600 dark:hover:text-indigo-400">
                  Ma'muriyat paneli
                </Link>
              </li>
              <li>
                <Link to="/kirish?rol=teacher" className="text-muted transition-colors hover:text-indigo-600 dark:hover:text-indigo-400">
                  O'qituvchi kabineti
                </Link>
              </li>
              <li>
                <Link to="/jadval" className="text-muted transition-colors hover:text-indigo-600 dark:hover:text-indigo-400">
                  Umumiy dars jadvali
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-line">
          <div className="site-wrap flex flex-wrap items-center justify-between gap-2 py-4 text-xs text-faint">
            <span>© {new Date().getFullYear()} {profile.name}</span>
            <span>Dars jadvali avtomatlashtirilgan tizim asosida tuziladi</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
