import { useEffect, useState } from 'react'
import { supabase, errText, LOGIN_DOMAIN } from '../lib/supabase'
import { useAuth } from '../store/auth'
import { useToast } from '../ui/Toast'
import { Field } from '../ui/ui'
import { Select } from '../ui/Select'
import { IcoGrade, IcoLogin, IcoUserPlus } from '../ui/icons'
import type { Subject } from '../lib/types'

type Tab = 'in' | 'up'

export default function LoginPage() {
  const { signIn, signUp } = useAuth()
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('in')
  const [busy, setBusy] = useState(false)
  const [subjects, setSubjects] = useState<Subject[]>([])

  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [lastName, setLastName] = useState('')
  const [firstName, setFirstName] = useState('')
  const [role, setRole] = useState<'teacher' | 'manager'>('teacher')
  const [subjectId, setSubjectId] = useState('')

  useEffect(() => {
    void supabase
      .from('subjects')
      .select('*')
      .order('name')
      .then(({ data }) => setSubjects((data as Subject[]) ?? []))
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    try {
      if (tab === 'in') {
        await signIn(login, password)
      } else {
        if (!lastName.trim() || !firstName.trim()) throw new Error('Ism va familiyani kiriting')
        if (role === 'teacher' && !subjectId) throw new Error('Fanni tanlang')
        if (!/^[a-z0-9._-]{3,}$/i.test(login.trim()))
          throw new Error('Login kamida 3 belgi: lotin harflari, raqam, nuqta yoki chiziqcha')
        await signUp({
          login,
          password,
          last_name: lastName,
          first_name: firstName,
          role,
          subject_id: role === 'teacher' ? Number(subjectId) : null,
        })
        toast.ok('Ro‘yxatdan o‘tdingiz — admin tasdiqlashini kuting')
      }
    } catch (e) {
      toast.err(errText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lift">
            <IcoGrade className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-semibold text-fg">Baholash tizimi</h1>
          <p className="text-sm text-muted">BSB va ChSB natijalari, o‘quvchilar o‘sishi</p>
        </div>

        <div className="card p-5">
          <div className="seg mb-4 w-full">
            <button
              onClick={() => setTab('in')}
              className={`seg-item flex-1 justify-center ${tab === 'in' ? 'seg-item-on' : ''}`}
            >
              <IcoLogin className="h-4 w-4" /> Kirish
            </button>
            <button
              onClick={() => setTab('up')}
              className={`seg-item flex-1 justify-center ${tab === 'up' ? 'seg-item-on' : ''}`}
            >
              <IcoUserPlus className="h-4 w-4" /> Ro‘yxatdan o‘tish
            </button>
          </div>

          <form onSubmit={submit} className="space-y-3">
            {tab === 'up' && (
              <>
                <div className="seg w-full">
                  <button
                    type="button"
                    onClick={() => setRole('teacher')}
                    className={`seg-item flex-1 justify-center ${role === 'teacher' ? 'seg-item-on' : ''}`}
                  >
                    O‘qituvchi
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('manager')}
                    className={`seg-item flex-1 justify-center ${role === 'manager' ? 'seg-item-on' : ''}`}
                  >
                    Menejer
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Familiya">
                    <input
                      className="input"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Aliyev"
                      autoComplete="family-name"
                    />
                  </Field>
                  <Field label="Ism">
                    <input
                      className="input"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Vali"
                      autoComplete="given-name"
                    />
                  </Field>
                </div>

                {role === 'teacher' && (
                  <Field label="Fan">
                    <Select
                      value={subjectId}
                      onChange={setSubjectId}
                      options={subjects.map((s) => ({ value: String(s.id), label: s.name }))}
                      placeholder="— fanni tanlang —"
                    />
                  </Field>
                )}
              </>
            )}

            <Field
              label="Login"
              hint={tab === 'up' ? `Kirish uchun ishlatiladi (${LOGIN_DOMAIN} ichida)` : undefined}
            >
              <input
                className="input"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder="aliyev.vali"
                autoComplete="username"
                autoCapitalize="none"
              />
            </Field>

            <Field label="Parol">
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                autoComplete={tab === 'in' ? 'current-password' : 'new-password'}
              />
            </Field>

            <button type="submit" disabled={busy} className="btn-primary w-full">
              {busy ? 'Kuting…' : tab === 'in' ? 'Kirish' : 'Ro‘yxatdan o‘tish'}
            </button>
          </form>

          {tab === 'up' && (
            <p className="mt-3 text-center text-[11px] leading-relaxed text-faint">
              Ro‘yxatdan o‘tgach akkauntingizni administrator tasdiqlaydi.
              Shundan keyin tizimga kirish mumkin bo‘ladi.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
