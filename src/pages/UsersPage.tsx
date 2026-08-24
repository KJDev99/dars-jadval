import { useState } from 'react'
import { useStore } from '../store'
import { useAuth } from '../authStore'
import Select from '../components/Select'
import { Empty, Field, Modal, Page, PageHeader } from '../components/ui'
import { ROLE_LABELS } from '../types'
import type { AdminUser } from '../types'
import { initialsOf } from '../lib/image'
import {
  IcoPlus, IcoEdit, IcoTrash, IcoOk, IcoEye, IcoKey, IcoShield, IcoInfo, IcoPassport,
  IcoSearch, IcoUserCog,
} from '../components/icons'

const blank = (): AdminUser => ({
  id: `u-${Date.now().toString(36)}`,
  login: '',
  password: '',
  fullName: '',
  role: 'zavuch',
  active: true,
  createdAt: Date.now(),
})

export default function UsersPage() {
  const { users, teachers, upsertUser, removeUser, updateTeacher } = useStore()
  const session = useAuth((s) => s.session)
  const [edit, setEdit] = useState<AdminUser | null>(null)
  const [showPass, setShowPass] = useState<Record<string, boolean>>({})
  const [q, setQ] = useState('')

  const filtered = teachers.filter((t) => {
    const s = q.trim().toLowerCase()
    return !s || t.fullName.toLowerCase().includes(s) || (t.passportNumber ?? '').includes(s)
  })

  const dupLogin =
    edit && users.some((u) => u.id !== edit.id && u.login.trim().toLowerCase() === edit.login.trim().toLowerCase())

  return (
    <Page>
      <PageHeader
        title="Foydalanuvchilar"
        subtitle="Ma'muriyat hisoblari va o'qituvchilarning kabinetga kirish ma'lumotlari. Bu bo'lim faqat direktorga ochiq."
        actions={
          <button className="btn-primary" onClick={() => setEdit(blank())}>
            <IcoPlus className="h-4 w-4" /> Hisob qo'shish
          </button>
        }
      />

      <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
        <IcoInfo className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Hozircha parollar brauzer xotirasida ochiq saqlanadi — bu faqat namoyish uchun.
          Server qismi ulangach parollar shifrlanib serverda saqlanadi va bu yerda ko'rinmaydi.
        </span>
      </div>

      {/* ── Ma'muriyat hisoblari ── */}
      <section className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
          <IcoShield className="h-4 w-4" /> Ma'muriyat hisoblari
        </h2>

        {users.length === 0 ? (
          <Empty text="Hisoblar yo'q." />
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead className="bg-raised">
                <tr>
                  <th className="th text-left">Foydalanuvchi</th>
                  <th className="th text-left">Login</th>
                  <th className="th text-left">Parol</th>
                  <th className="th text-left">Rol</th>
                  <th className="th text-left">Holat</th>
                  <th className="th" />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-line-soft">
                    <td className="td">
                      <span className="flex items-center gap-2.5">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-[11px] font-semibold text-white">
                          {initialsOf(u.fullName)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-fg">{u.fullName}</span>
                          {session?.userId === u.id && <span className="text-[11px] text-emerald-600 dark:text-emerald-400">shu seans</span>}
                        </span>
                      </span>
                    </td>
                    <td className="td font-mono text-xs">{u.login}</td>
                    <td className="td">
                      <span className="flex items-center gap-1.5">
                        <code className="rounded bg-raised px-1.5 py-0.5 font-mono text-xs">
                          {showPass[u.id] ? u.password : '•'.repeat(Math.min(u.password.length, 10))}
                        </code>
                        <button
                          className="btn-icon h-6 w-6"
                          onClick={() => setShowPass((s) => ({ ...s, [u.id]: !s[u.id] }))}
                          title={showPass[u.id] ? 'Yashirish' : "Ko'rsatish"}
                        >
                          <IcoEye className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    </td>
                    <td className="td">
                      <span className={`badge ${u.role === 'director' ? 'tint-indigo' : 'tint-emerald'}`}>
                        {ROLE_LABELS[u.role]}
                      </span>
                    </td>
                    <td className="td">
                      <button
                        className={`badge ${u.active ? 'tint-emerald' : 'tint-rose'}`}
                        onClick={() => upsertUser({ ...u, active: !u.active })}
                        disabled={session?.userId === u.id}
                        title={session?.userId === u.id ? "O'z hisobingizni o'chira olmaysiz" : 'Holatni almashtirish'}
                      >
                        {u.active ? 'Faol' : 'Faolsiz'}
                      </button>
                    </td>
                    <td className="td text-right">
                      <span className="flex justify-end gap-1">
                        <button className="btn-icon" onClick={() => setEdit(u)} title="Tahrirlash">
                          <IcoEdit className="h-4 w-4" />
                        </button>
                        <button
                          className="btn-icon hover:bg-rose-500/10 hover:text-rose-600"
                          disabled={session?.userId === u.id}
                          onClick={() => { if (confirm(`${u.fullName} hisobi o'chirilsinmi?`)) removeUser(u.id) }}
                          title="O'chirish"
                        >
                          <IcoTrash className="h-4 w-4" />
                        </button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── O'qituvchilarning kirish ma'lumoti ── */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
            <IcoPassport className="h-4 w-4" /> O'qituvchilarning kirish ma'lumoti
          </h2>
          <div className="relative w-64">
            <IcoSearch className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
            <input className="input pl-8" placeholder="Ism yoki pasport raqami…" value={q}
              onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>

        <p className="mb-3 text-xs text-muted">
          O'qituvchi kabinetga pasport seriyasi va raqami bilan kiradi. Bu yerdan to'g'rilash mumkin.
        </p>

        <div className="card max-h-[520px] overflow-y-auto">
          <table className="w-full">
            <thead className="sticky top-0 z-10 bg-raised">
              <tr>
                <th className="th text-left">O'qituvchi</th>
                <th className="th text-left">Mutaxassislik</th>
                <th className="th text-left">Seriya</th>
                <th className="th text-left">Raqam</th>
                <th className="th text-left">Kabinet</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const ready = !!t.passportSeries && (t.passportNumber ?? '').length === 7
                return (
                  <tr key={t.id} className="border-t border-line-soft">
                    <td className="td font-medium text-fg">{t.fullName}</td>
                    <td className="td text-muted">{t.speciality}</td>
                    <td className="td">
                      <input
                        className="w-16 rounded border border-line bg-surface px-1.5 py-0.5 text-center font-mono text-xs uppercase"
                        value={t.passportSeries ?? ''}
                        maxLength={2}
                        onChange={(e) =>
                          updateTeacher(t.id, {
                            passportSeries: e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase(),
                          })
                        }
                      />
                    </td>
                    <td className="td">
                      <input
                        className="w-28 rounded border border-line bg-surface px-1.5 py-0.5 text-center font-mono text-xs"
                        value={t.passportNumber ?? ''}
                        maxLength={7}
                        onChange={(e) =>
                          updateTeacher(t.id, { passportNumber: e.target.value.replace(/\D/g, '').slice(0, 7) })
                        }
                      />
                    </td>
                    <td className="td">
                      <span className={`badge ${ready ? 'tint-emerald' : 'tint-amber'}`}>
                        {ready ? 'Kira oladi' : "To'ldirilmagan"}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Hisob tahriri ── */}
      <Modal open={!!edit} onClose={() => setEdit(null)} title="Ma'muriyat hisobi">
        {edit && (
          <div className="space-y-4">
            <Field label="F.I.Sh.">
              <input className="input" value={edit.fullName} onChange={(e) => setEdit({ ...edit, fullName: e.target.value })} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Login" hint={dupLogin ? 'Bu login band' : undefined}>
                <input
                  className={`input ${dupLogin ? 'border-rose-500 focus:border-rose-500' : ''}`}
                  value={edit.login}
                  onChange={(e) => setEdit({ ...edit, login: e.target.value.replace(/\s/g, '') })}
                />
              </Field>
              <Field label="Parol" hint="Kamida 6 belgi">
                <div className="relative">
                  <IcoKey className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
                  <input className="input pl-8" value={edit.password}
                    onChange={(e) => setEdit({ ...edit, password: e.target.value })} />
                </div>
              </Field>
            </div>
            <Field label="Rol" hint="Direktor qo'shimcha ravishda sayt va foydalanuvchilarni boshqaradi">
              <Select
                value={edit.role}
                onChange={(v) => setEdit({ ...edit, role: v as AdminUser['role'] })}
                options={[
                  { value: 'director', label: ROLE_LABELS.director },
                  { value: 'zavuch', label: ROLE_LABELS.zavuch },
                ]}
              />
            </Field>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" className="accent-indigo-600" checked={edit.active}
                onChange={(e) => setEdit({ ...edit, active: e.target.checked })} />
              Hisob faol
            </label>

            <div className="flex items-center justify-between gap-2 border-t border-line pt-4">
              <span className="flex items-center gap-1.5 text-xs text-faint">
                <IcoUserCog className="h-3.5 w-3.5" /> Rol o'zgarishi keyingi kirishda kuchga kiradi
              </span>
              <span className="flex gap-2">
                <button className="btn-ghost" onClick={() => setEdit(null)}>Bekor qilish</button>
                <button
                  className="btn-primary"
                  disabled={!edit.fullName.trim() || edit.login.trim().length < 3 || edit.password.length < 6 || !!dupLogin}
                  onClick={() => { upsertUser(edit); setEdit(null) }}
                >
                  <IcoOk className="h-4 w-4" /> Saqlash
                </button>
              </span>
            </div>
          </div>
        )}
      </Modal>
    </Page>
  )
}
