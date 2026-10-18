import { useState } from 'react'
import { useAuth, fullName, ROLE_LABEL } from '../store/auth'
import { errText } from '../lib/supabase'
import { useToast } from '../ui/Toast'
import { Field, Page, PageHeader } from '../ui/ui'

export default function ProfilePage() {
  const { profile, changeOwnPassword } = useAuth()
  const toast = useToast()
  const [p1, setP1] = useState('')
  const [p2, setP2] = useState('')
  const [busy, setBusy] = useState(false)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (p1.length < 6) return toast.err('Parol kamida 6 belgidan bo‘lsin')
    if (p1 !== p2) return toast.err('Parollar bir xil emas')
    setBusy(true)
    try {
      await changeOwnPassword(p1)
      setP1('')
      setP2('')
      toast.ok('Parol almashtirildi')
    } catch (e) {
      toast.err(errText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Page>
      <PageHeader title="Mening profilim" />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-3 text-sm font-semibold text-fg">Ma'lumotlar</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">F.I.Sh.</dt>
              <dd className="font-medium text-fg">{fullName(profile)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Login</dt>
              <dd className="font-medium text-fg">{profile?.login}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Rol</dt>
              <dd className="font-medium text-fg">{profile && ROLE_LABEL[profile.role]}</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-faint">
            Ism, familiya, fan yoki rolni faqat administrator o‘zgartiradi.
          </p>
        </div>

        <form onSubmit={save} className="card space-y-3 p-5">
          <h2 className="text-sm font-semibold text-fg">Parolni almashtirish</h2>
          <Field label="Yangi parol">
            <input
              className="input"
              type="password"
              value={p1}
              onChange={(e) => setP1(e.target.value)}
              autoComplete="new-password"
            />
          </Field>
          <Field label="Takrorlang">
            <input
              className="input"
              type="password"
              value={p2}
              onChange={(e) => setP2(e.target.value)}
              autoComplete="new-password"
            />
          </Field>
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? 'Saqlanmoqda…' : 'Saqlash'}
          </button>
        </form>
      </div>
    </Page>
  )
}
