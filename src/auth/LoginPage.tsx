import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useStore } from '../store'
import { useAuth, normNumber, normSeries } from '../authStore'
import { Field } from '../components/ui'
import {
  IcoSchedule, IcoLogin, IcoKey, IcoUser, IcoPassport, IcoError, IcoShield, IcoAccount,
  IcoArrowRight, IcoEye, IcoInfo,
} from '../components/icons'
import type { IconType } from '../components/icons'

type Tab = 'admin' | 'teacher'

export default function LoginPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const profile = useStore((s) => s.site.profile)
  const { session, loginAdmin, loginTeacher } = useAuth()

  const [tab, setTab] = useState<Tab>(params.get('rol') === 'teacher' ? 'teacher' : 'admin')
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [series, setSeries] = useState('')
  const [number, setNumber] = useState('')
  const [error, setError] = useState('')

  // Allaqachon kirgan bo'lsa — o'z bo'limiga yo'naltiramiz
  useEffect(() => {
    if (session) navigate(session.role === 'teacher' ? '/kabinet' : '/boshqaruv', { replace: true })
  }, [session, navigate])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const res = tab === 'admin' ? loginAdmin(login, password) : loginTeacher(series, number)
    if (!res.ok) {
      setError(res.error ?? 'Kirishda xatolik.')
      return
    }
    navigate(tab === 'admin' ? '/boshqaruv' : '/kabinet', { replace: true })
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* ── Chap tomon: brend ─────────────────────────────────────────── */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-indigo-700 via-indigo-800 to-violet-900 lg:block">
        <div className="grid-pattern absolute inset-0 opacity-70" />
        <div className="absolute -left-24 bottom-0 h-96 w-96 rounded-full bg-sky-400/20 blur-3xl" />
        <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-violet-400/25 blur-3xl" />

        <div className="relative flex h-full flex-col justify-between p-12">
          <Link to="/" className="flex items-center gap-3 text-white">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/15 backdrop-blur-sm">
              <IcoSchedule className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-sm font-bold leading-tight">{profile.shortName}</span>
              <span className="block text-xs text-indigo-200/80">{profile.district}</span>
            </span>
          </Link>

          <div className="max-w-md">
            <h1 className="text-3xl font-bold leading-tight text-white xl:text-4xl">
              Ichki tizimga kirish
            </h1>
            <p className="mt-4 leading-relaxed text-indigo-100/85">
              Dars jadvali, tarifikatsiya va o'qituvchilar ma'lumotlari himoyalangan bo'limda
              saqlanadi. Ma'muriyat login va parol bilan, o'qituvchilar esa pasport ma'lumoti orqali
              kiradi.
            </p>

            <div className="mt-8 space-y-3">
              {[
                [IcoShield, "Ma'muriyat paneli", "Direktor va zavuch: jadval, tarifikatsiya, o'qituvchilar"],
                [IcoAccount, 'Shaxsiy kabinet', "O'qituvchi: shaxsiy jadval, ma'lumot va so'rov yuborish"],
              ].map(([Icon, title, text]) => {
                const I = Icon as IconType
                return (
                  <div key={title as string} className="flex gap-3 rounded-2xl border border-white/15 bg-white/[0.07] p-4 backdrop-blur-sm">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/15 text-white">
                      <I className="h-4 w-4" />
                    </span>
                    <div>
                      <div className="text-sm font-semibold text-white">{title as string}</div>
                      <div className="mt-0.5 text-xs leading-relaxed text-indigo-100/75">{text as string}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-indigo-100/70 transition-colors hover:text-white">
            ← Rasmiy saytga qaytish
          </Link>
        </div>
      </div>

      {/* ── O'ng tomon: shakl ─────────────────────────────────────────── */}
      <div className="flex items-center justify-center bg-canvas px-5 py-12">
        <div className="w-full max-w-sm">
          <Link to="/" className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
              <IcoSchedule className="h-4 w-4" />
            </span>
            <span className="text-sm font-bold text-fg">{profile.shortName}</span>
          </Link>

          <h2 className="text-2xl font-bold tracking-tight text-fg">Xush kelibsiz</h2>
          <p className="mt-1.5 text-sm text-muted">Davom etish uchun tizimga kiring.</p>

          {/* Tab tanlagich */}
          <div className="seg mt-6 w-full">
            <button
              className={`seg-item flex-1 justify-center ${tab === 'admin' ? 'seg-item-on' : ''}`}
              onClick={() => { setTab('admin'); setError('') }}
            >
              <IcoShield className="h-3.5 w-3.5" /> Ma'muriyat
            </button>
            <button
              className={`seg-item flex-1 justify-center ${tab === 'teacher' ? 'seg-item-on' : ''}`}
              onClick={() => { setTab('teacher'); setError('') }}
            >
              <IcoAccount className="h-3.5 w-3.5" /> O'qituvchi
            </button>
          </div>

          <form className="mt-6 space-y-4" onSubmit={submit}>
            {tab === 'admin' ? (
              <>
                <Field label="Login">
                  <div className="relative">
                    <IcoUser className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
                    <input
                      className="input pl-9"
                      value={login}
                      autoComplete="username"
                      onChange={(e) => setLogin(e.target.value)}
                      placeholder="direktor"
                    />
                  </div>
                </Field>
                <Field label="Parol">
                  <div className="relative">
                    <IcoKey className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
                    <input
                      className="input pl-9 pr-10"
                      type={showPass ? 'text' : 'password'}
                      value={password}
                      autoComplete="current-password"
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      className="absolute right-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-faint transition-colors hover:bg-raised hover:text-fg-2"
                      onClick={() => setShowPass((v) => !v)}
                      title={showPass ? 'Yashirish' : "Ko'rsatish"}
                    >
                      <IcoEye className="h-4 w-4" />
                    </button>
                  </div>
                </Field>
              </>
            ) : (
              <>
                <div className="grid grid-cols-[5rem_1fr] gap-2">
                  <Field label="Seriya">
                    <input
                      className="input text-center uppercase tracking-widest"
                      value={series}
                      onChange={(e) => setSeries(normSeries(e.target.value))}
                      placeholder="AA"
                      maxLength={2}
                    />
                  </Field>
                  <Field label="Pasport raqami">
                    <div className="relative">
                      <IcoPassport className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
                      <input
                        className="input pl-9 tracking-widest"
                        value={number}
                        onChange={(e) => setNumber(normNumber(e.target.value))}
                        placeholder="1234567"
                        inputMode="numeric"
                      />
                    </div>
                  </Field>
                </div>
                <p className="flex gap-2 rounded-lg border border-line bg-raised px-3 py-2 text-[11px] leading-relaxed text-muted">
                  <IcoInfo className="mt-0.5 h-3.5 w-3.5 shrink-0 text-faint" />
                  Pasport ma'lumoti maktab ma'muriyati tomonidan kiritiladi. Kira olmasangiz
                  o'quv ishlari bo'yicha direktor o'rinbosariga murojaat qiling.
                </p>
              </>
            )}

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
                <IcoError className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <button className="btn-primary w-full py-2.5">
              <IcoLogin className="h-4 w-4" /> Kirish
            </button>
          </form>

          <DemoHint tab={tab} />

          <Link
            to="/"
            className="mt-8 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg lg:hidden"
          >
            Rasmiy saytga qaytish <IcoArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  )
}

/**
 * Sinov ma'lumotlari.
 * Tizim hozircha faqat brauzerda ishlaydi — backend ulangach bu blok olib tashlanadi.
 */
function DemoHint({ tab }: { tab: Tab }) {
  const users = useStore((s) => s.users)
  const teachers = useStore((s) => s.teachers)
  const sample = teachers.find((t) => t.passportNumber)

  return (
    <details className="mt-6 rounded-xl border border-line bg-surface p-3 text-xs">
      <summary className="cursor-pointer font-medium text-muted">Sinov uchun ma'lumot</summary>
      {tab === 'admin' ? (
        <ul className="mt-2 space-y-1.5 text-muted">
          {users.map((u) => (
            <li key={u.id} className="flex justify-between gap-2">
              <span className="truncate">{u.fullName.split(' ')[0]}</span>
              <code className="rounded bg-raised px-1.5 py-0.5 font-mono text-[11px] text-fg-2">
                {u.login} / {u.password}
              </code>
            </li>
          ))}
        </ul>
      ) : sample ? (
        <div className="mt-2 space-y-1 text-muted">
          <div className="truncate">{sample.fullName}</div>
          <code className="inline-block rounded bg-raised px-1.5 py-0.5 font-mono text-[11px] text-fg-2">
            {sample.passportSeries} {sample.passportNumber}
          </code>
        </div>
      ) : (
        <p className="mt-2 text-muted">Pasport ma'lumoti kiritilmagan.</p>
      )}
    </details>
  )
}
