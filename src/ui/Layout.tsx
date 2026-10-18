import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth, ROLE_LABEL, fullName } from '../store/auth'
import { applyTheme, getTheme } from './theme'
import type { Theme } from './theme'
import {
  IcoDashboard, IcoClasses, IcoHistory, IcoUserCog, IcoJournal, IcoLogout,
  IcoSun, IcoMoon, IcoSystem, IcoMenu, IcoClose, IcoKey, IcoGrade, IcoSettings,
} from './icons'
import type { IconType } from './icons'
import type { Role } from '../lib/types'

interface Link {
  to: string
  label: string
  icon: IconType
}

const NAV: Record<Role, Link[]> = {
  admin: [
    { to: '/admin/users', label: 'Foydalanuvchilar', icon: IcoUserCog },
    { to: '/admin/settings', label: 'Sozlamalar', icon: IcoSettings },
    { to: '/stats', label: 'Statistika', icon: IcoDashboard },
  ],
  manager: [
    { to: '/stats', label: 'Statistika', icon: IcoDashboard },
    { to: '/classes', label: 'Sinflar', icon: IcoClasses },
    { to: '/changes', label: "O'zgarishlar", icon: IcoHistory },
  ],
  teacher: [
    { to: '/journal', label: 'Jurnal', icon: IcoJournal },
    { to: '/my-stats', label: 'Natijalarim', icon: IcoGrade },
  ],
}

const THEMES: { v: Theme; icon: IconType; title: string }[] = [
  { v: 'light', icon: IcoSun, title: 'Yorug‘' },
  { v: 'dark', icon: IcoMoon, title: 'Qorong‘i' },
  { v: 'system', icon: IcoSystem, title: 'Tizim' },
]

export default function Layout() {
  const { profile, signOut } = useAuth()
  const nav = useNavigate()
  const [theme, setTheme] = useState<Theme>(getTheme)
  const [open, setOpen] = useState(false)

  useEffect(() => applyTheme(theme), [theme])

  const links = profile ? NAV[profile.role] : []

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-2 font-semibold text-fg">
            <IcoGrade className="h-5 w-5 text-indigo-500" />
            <span>Baholash</span>
          </div>

          <nav className="ml-4 hidden items-center gap-1 md:flex">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) => `nav-link flex items-center gap-1.5 ${isActive ? 'nav-link-on' : ''}`}
              >
                <l.icon className="h-4 w-4" />
                {l.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <div className="seg hidden sm:inline-flex">
              {THEMES.map((t) => (
                <button
                  key={t.v}
                  onClick={() => setTheme(t.v)}
                  title={t.title}
                  className={`seg-item px-2 ${theme === t.v ? 'seg-item-on' : ''}`}
                >
                  <t.icon className="h-4 w-4" />
                </button>
              ))}
            </div>

            <div className="hidden text-right leading-tight sm:block">
              <div className="text-sm font-medium text-fg">{fullName(profile)}</div>
              <div className="text-[11px] text-muted">{profile && ROLE_LABEL[profile.role]}</div>
            </div>

            <button onClick={() => nav('/profile')} className="btn-ghost" title="Parolni almashtirish">
              <IcoKey className="h-4 w-4" />
            </button>
            <button
              onClick={async () => {
                await signOut()
                nav('/login')
              }}
              className="btn-ghost"
              title="Chiqish"
            >
              <IcoLogout className="h-4 w-4" />
            </button>
            <button onClick={() => setOpen((v) => !v)} className="btn-ghost md:hidden" title="Menyu">
              {open ? <IcoClose className="h-4 w-4" /> : <IcoMenu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {open && (
          <nav className="flex flex-col gap-1 border-t border-line px-4 py-2 md:hidden">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className={({ isActive }) => `nav-link flex items-center gap-2 ${isActive ? 'nav-link-on' : ''}`}
              >
                <l.icon className="h-4 w-4" />
                {l.label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      <main>
        <Outlet />
      </main>
    </div>
  )
}
