/**
 * Sahifalarni serverda render qilib, ishga tushishdagi xatolarni topadi.
 * Ishga tushirish:  npm run smoke
 *
 * Bu to'liq brauzer sinovi emas — hodisalar va effektlar bajarilmaydi.
 * Maqsad: har bir sahifa xatosiz chizilishini tekshirish.
 *
 * React `renderToString` do'kon holatini birinchi renderda «muzlatib» qo'yadi,
 * shuning uchun har bir rol alohida jarayonda sinaladi (SMOKE muhit o'zgaruvchisi).
 */
// Muhit taqlidi — authStore dan oldin yuklanishi shart
import { SMOKE_TEACHER } from './smoke-env'
import { renderToString } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import App from '../src/App'
import LoginPage from '../src/auth/LoginPage'
import AdminApp from '../src/admin/AdminApp'
import CabinetLayout from '../src/cabinet/CabinetLayout'
import CabinetHome from '../src/cabinet/CabinetHome'
import CabinetSchedule from '../src/cabinet/CabinetSchedule'
import CabinetProfile from '../src/cabinet/CabinetProfile'
import CabinetRequests from '../src/cabinet/CabinetRequests'
import { useStore } from '../src/store'
import { useAuth } from '../src/authStore'

const phase = process.env.SMOKE ?? 'public'
let failures = 0

function render(name: string, node: JSX.Element, minBytes = 2000) {
  try {
    const html = renderToString(node)
    const ok = html.length >= minBytes
    console.log(
      `  ${ok ? '✓' : '✗'} ${name.padEnd(26)} ${(html.length / 1024).toFixed(1)} KB` +
        (ok ? '' : '  ← sahifa deyarli bo‘sh'),
    )
    if (!ok) failures++
  } catch (e) {
    console.log(`  ✗ ${name.padEnd(26)} ${(e as Error).message}`)
    failures++
  }
}

/* ══════════════════════ 1. Rasmiy sayt ══════════════════════ */

if (phase === 'public') {
  console.log('=== RASMIY SAYT ===')
  const teacherId = useStore.getState().teachers[3].id
  const at = (path: string) => (
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  )
  for (const [name, path] of [
    ['Bosh sahifa', '/'],
    ['Maktab haqida', '/maktab'],
    ['Rahbariyat', '/rahbariyat'],
    ['Pedagoglar', '/oqituvchilar'],
    ['Pedagog sahifasi', `/oqituvchilar/${teacherId}`],
    ['Yutuqlar', '/yutuqlar'],
    ['Dars jadvali', '/jadval'],
    ['Aloqa', '/aloqa'],
  ] as const) {
    render(name, at(path))
  }

  // Kirish sahifasi App ichida kechiktirilib yuklanadi — to'g'ridan-to'g'ri chizamiz
  render(
    'Kirish sahifasi',
    <MemoryRouter initialEntries={['/kirish']}>
      <LoginPage />
    </MemoryRouter>,
  )

  // Mehmon yopiq bo'limga kira olmasligi kerak
  const guest = renderToString(
    <MemoryRouter initialEntries={['/boshqaruv']}>
      <App />
    </MemoryRouter>,
  )
  const blocked = !guest.includes('Boshqaruv paneli') || guest.length < 2000
  console.log(`  ${blocked ? '✓' : '✗'} Mehmon /boshqaruv ga kira olmaydi`)
  if (!blocked) failures++
}

/* ══════════════════════ 2. O'qituvchi kabineti ══════════════════════ */

if (phase === 'cabinet') {
  console.log('=== O‘QITUVCHI KABINETI ===')
  const me = SMOKE_TEACHER
  const session = useAuth.getState().session
  console.log(`  o‘qituvchi: ${me.fullName} (${me.passportSeries} ${me.passportNumber})`)
  if (session?.userId !== me.id) {
    console.log('  ✗ seans tiklanmadi')
    failures++
  }

  const cabinet = (path: string, page: JSX.Element) => (
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/kabinet" element={<CabinetLayout />}>
          <Route index element={page} />
          <Route path="jadval" element={page} />
          <Route path="malumot" element={page} />
          <Route path="sorovlar" element={page} />
        </Route>
      </Routes>
    </MemoryRouter>
  )

  render('Kabinet — bosh sahifa', cabinet('/kabinet', <CabinetHome />))
  render('Kabinet — jadval', cabinet('/kabinet/jadval', <CabinetSchedule />))
  render('Kabinet — ma’lumotlar', cabinet('/kabinet/malumot', <CabinetProfile />))
  render('Kabinet — so‘rovlar', cabinet('/kabinet/sorovlar', <CabinetRequests />))
}

/* ══════════════════════ 3. Ma'muriyat paneli ══════════════════════ */

if (phase === 'admin' || phase === 'zavuch') {
  const director = phase === 'admin'
  console.log(`=== MA’MURIYAT PANELI (${director ? 'direktor' : 'zavuch'}) ===`)
  const session = useAuth.getState().session
  if (session?.role !== (director ? 'director' : 'zavuch')) {
    console.log('  ✗ seans tiklanmadi')
    failures++
  }

  const admin = (path: string) => (
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/boshqaruv/*" element={<AdminApp />} />
      </Routes>
    </MemoryRouter>
  )

  const pages = [
    ['Boshqaruv paneli', '/boshqaruv'],
    ['Sinflar', '/boshqaruv/sinflar'],
    ['O‘qituvchilar', '/boshqaruv/oqituvchilar'],
    ['O‘quv reja', '/boshqaruv/oquv-reja'],
    ['Tarifikatsiya', '/boshqaruv/tarifikatsiya'],
    ['Excel', '/boshqaruv/excel'],
    ['Shartlar', '/boshqaruv/shartlar'],
    ['Jadval yaratish', '/boshqaruv/yaratish'],
    ['Dars jadvali', '/boshqaruv/jadval'],
    ['Tekshiruv', '/boshqaruv/tekshiruv'],
    ['So‘rovlar', '/boshqaruv/sorovlar'],
  ] as const

  for (const [name, path] of pages) render(name, admin(path))

  if (director) {
    render('Rasmiy sayt', admin('/boshqaruv/sayt'))
    render('Foydalanuvchilar', admin('/boshqaruv/foydalanuvchilar'))
    const menu = renderToString(admin('/boshqaruv'))
    const hasBoth =
      menu.includes('href="/boshqaruv/sayt"') && menu.includes('href="/boshqaruv/foydalanuvchilar"')
    console.log(`  ${hasBoth ? '✓' : '✗'} Direktor menyusida barcha bo‘limlar bor`)
    if (!hasBoth) failures++
  } else {
    // Zavuchga direktor bo'limlari ko'rinmaydi
    const html = renderToString(admin('/boshqaruv/foydalanuvchilar'))
    const hidden = !html.includes('Ma’muriyat hisoblari') && !html.includes("Ma'muriyat hisoblari")
    console.log(`  ${hidden ? '✓' : '✗'} Zavuchga «Foydalanuvchilar» bo‘limi berilmaydi`)
    if (!hidden) failures++
    const menu = renderToString(admin('/boshqaruv'))
    const noSite = !menu.includes('href="/boshqaruv/sayt"')
    const noUsers = !menu.includes('href="/boshqaruv/foydalanuvchilar"')
    console.log(`  ${noSite && noUsers ? '✓' : '✗'} Zavuch menyusida direktor bo‘limlari yo‘q`)
    if (!noSite || !noUsers) failures++
  }
}

console.log(failures === 0 ? '  — xatosiz' : `  — ${failures} ta xato`)
process.exit(failures === 0 ? 0 : 1)
