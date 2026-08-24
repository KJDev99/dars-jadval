import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useStore } from './store'
import { useTheme } from './lib/theme'

import PublicLayout from './site/PublicLayout'
import HomePage from './site/HomePage'
import AboutPage from './site/AboutPage'
import LeadershipPage from './site/LeadershipPage'
import StaffPage from './site/StaffPage'
import TeacherPublicPage from './site/TeacherPublicPage'
import AchievementsPage from './site/AchievementsPage'
import PublicSchedulePage from './site/PublicSchedulePage'
import ContactPage from './site/ContactPage'

import RequireAuth from './auth/RequireAuth'

/*
 * Yopiq bo'limlar alohida bo'laklarga ajratiladi — rasmiy saytga kirgan
 * mehmon ma'muriyat paneli va kabinet kodini yuklamaydi.
 */
const LoginPage = lazy(() => import('./auth/LoginPage'))
const CabinetLayout = lazy(() => import('./cabinet/CabinetLayout'))
const CabinetHome = lazy(() => import('./cabinet/CabinetHome'))
const CabinetSchedule = lazy(() => import('./cabinet/CabinetSchedule'))
const CabinetProfile = lazy(() => import('./cabinet/CabinetProfile'))
const CabinetRequests = lazy(() => import('./cabinet/CabinetRequests'))
const AdminApp = lazy(() => import('./admin/AdminApp'))

/** Bo'lak yuklanayotgandagi ko'rinish */
function Loading() {
  return (
    <div className="grid min-h-screen place-items-center bg-canvas">
      <div className="flex items-center gap-3 text-sm text-muted">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-indigo-500" />
        Yuklanmoqda…
      </div>
    </div>
  )
}

/**
 * Ilova uch qismdan iborat:
 *   1. Rasmiy sayt — hamma uchun ochiq
 *   2. Ma'muriyat paneli (/boshqaruv) — login va parol bilan
 *   3. O'qituvchi kabineti (/kabinet) — pasport ma'lumoti bilan
 */
export default function App() {
  const theme = useStore((s) => s.settings.theme)
  useTheme(theme ?? 'system')

  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        {/* ── Rasmiy sayt ─────────────────────────────────────────────── */}
        <Route element={<PublicLayout />}>
          <Route index element={<HomePage />} />
          <Route path="maktab" element={<AboutPage />} />
          <Route path="rahbariyat" element={<LeadershipPage />} />
          <Route path="oqituvchilar" element={<StaffPage />} />
          <Route path="oqituvchilar/:id" element={<TeacherPublicPage />} />
          <Route path="yutuqlar" element={<AchievementsPage />} />
          <Route path="jadval" element={<PublicSchedulePage />} />
          <Route path="aloqa" element={<ContactPage />} />
        </Route>

        {/* ── Kirish ──────────────────────────────────────────────────── */}
        <Route path="/kirish" element={<LoginPage />} />

        {/* ── O'qituvchi kabineti ─────────────────────────────────────── */}
        <Route
          path="/kabinet"
          element={
            <RequireAuth need="teacher">
              <CabinetLayout />
            </RequireAuth>
          }
        >
          <Route index element={<CabinetHome />} />
          <Route path="jadval" element={<CabinetSchedule />} />
          <Route path="malumot" element={<CabinetProfile />} />
          <Route path="sorovlar" element={<CabinetRequests />} />
        </Route>

        {/* ── Ma'muriyat paneli ───────────────────────────────────────── */}
        <Route
          path="/boshqaruv/*"
          element={
            <RequireAuth need="admin">
              <AdminApp />
            </RequireAuth>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
