import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase, errText } from '../../lib/supabase'
import { useAuth, ROLE_LABEL, fullName } from '../../store/auth'
import { useToast } from '../../ui/Toast'
import { Field, Loading, Modal, Page, PageHeader, Segmented, TableWrap } from '../../ui/ui'
import { Select } from '../../ui/Select'
import { IcoCheck, IcoBan, IcoKey, IcoTrash, IcoClock } from '../../ui/icons'
import type { Profile, Role, Subject, UserStatus } from '../../lib/types'

const STATUS_LABEL: Record<UserStatus, string> = {
  pending: 'Kutilmoqda',
  approved: 'Tasdiqlangan',
  blocked: 'Bloklangan',
}

const STATUS_TINT: Record<UserStatus, string> = {
  pending: 'tint-amber',
  approved: 'tint-emerald',
  blocked: 'tint-rose',
}

export default function AdminUsersPage() {
  const { profile: me } = useAuth()
  const toast = useToast()
  const [rows, setRows] = useState<Profile[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | UserStatus>('pending')
  const [pwFor, setPwFor] = useState<Profile | null>(null)
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const [u, s] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('subjects').select('*').order('name'),
    ])
    if (u.error) toast.err(errText(u.error))
    setRows((u.data as Profile[]) ?? [])
    setSubjects((s.data as Subject[]) ?? [])
    setLoading(false)
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  const subjectName = useMemo(() => {
    const m = new Map(subjects.map((s) => [s.id, s.name]))
    return (id: number | null) => (id ? m.get(id) ?? '—' : '—')
  }, [subjects])

  const pendingCount = rows.filter((r) => r.status === 'pending').length
  const shown = filter === 'all' ? rows : rows.filter((r) => r.status === filter)

  async function setStatus(p: Profile, status: UserStatus) {
    const { error } = await supabase.from('profiles').update({ status }).eq('id', p.id)
    if (error) return toast.err(errText(error))
    setRows((list) => list.map((r) => (r.id === p.id ? { ...r, status } : r)))
    toast.ok(`${fullName(p)} — ${STATUS_LABEL[status].toLowerCase()}`)
  }

  async function setRole(p: Profile, role: Role) {
    const patch: Partial<Profile> = { role }
    if (role !== 'teacher') patch.subject_id = null
    const { error } = await supabase.from('profiles').update(patch).eq('id', p.id)
    if (error) return toast.err(errText(error))
    setRows((list) => list.map((r) => (r.id === p.id ? { ...r, ...patch } : r)))
    toast.ok('Rol o‘zgartirildi')
  }

  async function setSubject(p: Profile, subject_id: number | null) {
    const { error } = await supabase.from('profiles').update({ subject_id }).eq('id', p.id)
    if (error) return toast.err(errText(error))
    setRows((list) => list.map((r) => (r.id === p.id ? { ...r, subject_id } : r)))
  }

  async function callAdmin(action: string, user_id: string, password?: string) {
    const { data, error } = await supabase.functions.invoke('admin-users', {
      body: { action, user_id, password },
    })
    if (error) throw new Error(error.message)
    if (data?.error) throw new Error(data.error)
  }

  async function savePassword() {
    if (!pwFor) return
    if (pw.length < 6) return toast.err('Parol kamida 6 belgidan bo‘lsin')
    setBusy(true)
    try {
      await callAdmin('set_password', pwFor.id, pw)
      toast.ok(`${fullName(pwFor)} uchun yangi parol o‘rnatildi`)
      setPwFor(null)
      setPw('')
    } catch (e) {
      toast.err(
        /Failed to send a request|not found/i.test(String(e))
          ? 'admin-users funksiyasi deploy qilinmagan (README ga qarang)'
          : errText(e),
      )
    } finally {
      setBusy(false)
    }
  }

  async function remove(p: Profile) {
    if (!confirm(`${fullName(p)} akkaunti butunlay o‘chiriladi. Davom etasizmi?`)) return
    try {
      await callAdmin('delete_user', p.id)
      setRows((list) => list.filter((r) => r.id !== p.id))
      toast.ok('Akkaunt o‘chirildi')
    } catch (e) {
      toast.err(errText(e))
    }
  }

  if (loading) return <Loading />

  return (
    <Page>
      <PageHeader
        title="Foydalanuvchilar"
        subtitle="O‘qituvchi va menejerlarni tasdiqlash, rol berish, parolni almashtirish"
        actions={
          <Segmented
            value={filter}
            onChange={setFilter}
            items={[
              {
                value: 'pending' as const,
                label: (
                  <span className="flex items-center gap-1.5">
                    <IcoClock className="h-3.5 w-3.5" />
                    Kutilmoqda
                    {pendingCount > 0 && (
                      <span className="rounded bg-amber-500/20 px-1 text-[11px] text-amber-700 dark:text-amber-300">
                        {pendingCount}
                      </span>
                    )}
                  </span>
                ),
              },
              { value: 'approved' as const, label: 'Tasdiqlangan' },
              { value: 'blocked' as const, label: 'Bloklangan' },
              { value: 'all' as const, label: 'Hammasi' },
            ]}
          />
        }
      />

      {shown.length === 0 ? (
        <div className="card p-10 text-center text-sm text-faint">
          {filter === 'pending' ? 'Tasdiqlashni kutayotgan arizalar yo‘q' : 'Ro‘yxat bo‘sh'}
        </div>
      ) : (
        <TableWrap>
          <table className="w-full min-w-[820px]">
            <thead className="border-b border-line bg-raised">
              <tr>
                <th className="th">F.I.Sh.</th>
                <th className="th">Login</th>
                <th className="th">Rol</th>
                <th className="th">Fan</th>
                <th className="th">Holat</th>
                <th className="th text-right">Amallar</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.id} className="border-b border-line-soft last:border-0">
                  <td className="td font-medium text-fg">
                    {fullName(p)}
                    {p.id === me?.id && <span className="ml-1.5 text-[11px] text-faint">(siz)</span>}
                  </td>
                  <td className="td font-mono text-xs">{p.login}</td>
                  <td className="td">
                    <Select
                      size="sm"
                      value={p.role}
                      disabled={p.id === me?.id}
                      onChange={(v) => void setRole(p, v as Role)}
                      options={(['teacher', 'manager', 'admin'] as Role[]).map((r) => ({
                        value: r,
                        label: ROLE_LABEL[r],
                      }))}
                    />
                  </td>
                  <td className="td">
                    {p.role === 'teacher' ? (
                      <Select
                        size="sm"
                        value={p.subject_id ?? 0}
                        onChange={(v) => void setSubject(p, v ? Number(v) : null)}
                        options={[
                          { value: 0, label: '— fan yo‘q —' },
                          ...subjects.map((s) => ({ value: s.id, label: s.name })),
                        ]}
                        placeholder="—"
                      />
                    ) : (
                      <span className="text-faint">{subjectName(p.subject_id)}</span>
                    )}
                  </td>
                  <td className="td">
                    <span className={`badge border ${STATUS_TINT[p.status]}`}>
                      {STATUS_LABEL[p.status]}
                    </span>
                  </td>
                  <td className="td">
                    <div className="flex items-center justify-end gap-1.5">
                      {p.status !== 'approved' && (
                        <button
                          onClick={() => void setStatus(p, 'approved')}
                          className="btn-soft py-1 text-xs"
                          title="Tasdiqlash"
                        >
                          <IcoCheck className="h-3.5 w-3.5" /> Tasdiqlash
                        </button>
                      )}
                      {p.status === 'approved' && p.id !== me?.id && (
                        <button
                          onClick={() => void setStatus(p, 'blocked')}
                          className="btn-ghost py-1 text-xs"
                          title="Bloklash"
                        >
                          <IcoBan className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setPwFor(p)
                          setPw('')
                        }}
                        className="btn-ghost py-1 text-xs"
                        title="Parolni almashtirish"
                      >
                        <IcoKey className="h-3.5 w-3.5" />
                      </button>
                      {p.id !== me?.id && (
                        <button
                          onClick={() => void remove(p)}
                          className="btn-danger py-1 text-xs"
                          title="O‘chirish"
                        >
                          <IcoTrash className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}

      <Modal
        open={!!pwFor}
        onClose={() => setPwFor(null)}
        title={`Yangi parol — ${pwFor ? fullName(pwFor) : ''}`}
      >
        <div className="space-y-3">
          <Field label="Parol" hint="Kamida 6 belgi. Foydalanuvchiga o‘zingiz yetkazasiz.">
            <input
              className="input"
              type="text"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              autoFocus
            />
          </Field>
          <div className="flex justify-end gap-2">
            <button onClick={() => setPwFor(null)} className="btn-ghost">
              Bekor qilish
            </button>
            <button onClick={() => void savePassword()} disabled={busy} className="btn-primary">
              {busy ? 'Saqlanmoqda…' : 'O‘rnatish'}
            </button>
          </div>
        </div>
      </Modal>
    </Page>
  )
}
