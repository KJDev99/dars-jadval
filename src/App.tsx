import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { configured } from './lib/supabase'
import { useAuth } from './store/auth'
import Layout from './ui/Layout'
import { Loading, Page } from './ui/ui'
import LoginPage from './pages/LoginPage'
import PendingPage from './pages/PendingPage'
import ProfilePage from './pages/ProfilePage'
import AdminUsersPage from './pages/admin/AdminUsersPage'
import AdminSettingsPage from './pages/admin/AdminSettingsPage'
import StatsPage from './pages/manager/StatsPage'
import ClassesPage from './pages/manager/ClassesPage'
import ClassPage from './pages/manager/ClassPage'
import ChangesPage from './pages/manager/ChangesPage'
import PlanPage from './pages/manager/PlanPage'
import TimetablePage from './pages/manager/TimetablePage'
import JournalPage from './pages/teacher/JournalPage'
import MyStatsPage from './pages/teacher/MyStatsPage'
import MySchedulePage from './pages/teacher/MySchedulePage'

function SetupNotice() {
  return (
    <Page>
      <div className="card mx-auto mt-10 max-w-xl p-6">
        <h1 className="text-lg font-semibold text-fg">Supabase sozlanmagan</h1>
        <p className="mt-2 text-sm text-muted">
          Loyiha ildizida <code className="rounded bg-raised px-1">.env</code> fayl yarating va
          Supabase proyektingiz ma'lumotlarini kiriting:
        </p>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-raised p-3 text-xs text-fg-2">
{`VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...`}
        </pre>
        <p className="mt-3 text-xs text-faint">
          Kalitlar: Supabase Dashboard → Project Settings → API. Keyin <code>npm run dev</code> ni
          qayta ishga tushiring.
        </p>
      </div>
    </Page>
  )
}

export default function App() {
  const { ready, session, profile, init } = useAuth()

  useEffect(() => {
    void init()
  }, [init])

  if (!configured) return <SetupNotice />
  if (!ready) return <Loading />

  // Kirmagan foydalanuvchi
  if (!session) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  if (!profile) return <Loading text="Profil yuklanmoqda…" />

  // Admin tasdiqlamagan yoki bloklangan
  if (profile.status !== 'approved') {
    return (
      <Routes>
        <Route path="*" element={<PendingPage />} />
      </Routes>
    )
  }

  const home =
    profile.role === 'admin' ? '/admin/users' : profile.role === 'manager' ? '/stats' : '/journal'

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to={home} replace />} />
        <Route path="/login" element={<Navigate to={home} replace />} />
        <Route path="/profile" element={<ProfilePage />} />

        {profile.role === 'admin' && (
          <>
            <Route path="/admin/users" element={<AdminUsersPage />} />
            <Route path="/admin/settings" element={<AdminSettingsPage />} />
          </>
        )}

        {(profile.role === 'manager' || profile.role === 'admin') && (
          <>
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/classes" element={<ClassesPage />} />
            <Route path="/classes/:classId" element={<ClassPage />} />
            <Route path="/changes" element={<ChangesPage />} />
            <Route path="/plan" element={<PlanPage />} />
            <Route path="/timetable" element={<TimetablePage />} />
          </>
        )}

        {profile.role === 'teacher' && (
          <>
            <Route path="/journal" element={<JournalPage />} />
            <Route path="/journal/:assignmentId" element={<JournalPage />} />
            <Route path="/my-stats" element={<MyStatsPage />} />
            <Route path="/schedule" element={<MySchedulePage />} />
          </>
        )}

        <Route path="*" element={<Navigate to={home} replace />} />
      </Route>
    </Routes>
  )
}
