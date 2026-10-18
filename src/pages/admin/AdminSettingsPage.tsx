import { useCallback, useEffect, useState } from 'react'
import { supabase, errText } from '../../lib/supabase'
import { useToast } from '../../ui/Toast'
import { Field, Loading, Page, PageHeader, TableWrap } from '../../ui/ui'
import { IcoPlus, IcoTrash, IcoCheck, IcoSave } from '../../ui/icons'
import type { AcademicYear, GradingRules, Subject } from '../../lib/types'

export default function AdminSettingsPage() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [years, setYears] = useState<AcademicYear[]>([])
  const [rules, setRules] = useState<GradingRules | null>(null)
  const [newSubject, setNewSubject] = useState('')
  const [newSplit, setNewSplit] = useState(false)
  const [newYear, setNewYear] = useState('')

  const load = useCallback(async () => {
    const [s, y, r] = await Promise.all([
      supabase.from('subjects').select('*').order('name'),
      supabase.from('academic_years').select('*').order('name', { ascending: false }),
      supabase.from('grading_rules').select('*').eq('id', 1).single(),
    ])
    setSubjects((s.data as Subject[]) ?? [])
    setYears((y.data as AcademicYear[]) ?? [])
    setRules((r.data as GradingRules) ?? null)
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function addSubject() {
    const name = newSubject.trim()
    if (!name) return
    const { data, error } = await supabase
      .from('subjects')
      .insert({ name, is_split: newSplit })
      .select()
      .single()
    if (error) return toast.err(errText(error))
    setSubjects((l) => [...l, data as Subject].sort((a, b) => a.name.localeCompare(b.name)))
    setNewSubject('')
    setNewSplit(false)
    toast.ok('Fan qo‘shildi')
  }

  async function toggleSplit(s: Subject) {
    const { error } = await supabase
      .from('subjects')
      .update({ is_split: !s.is_split })
      .eq('id', s.id)
    if (error) return toast.err(errText(error))
    setSubjects((l) => l.map((x) => (x.id === s.id ? { ...x, is_split: !x.is_split } : x)))
  }

  async function removeSubject(s: Subject) {
    if (!confirm(`«${s.name}» fani o‘chiriladi. Unga biriktirilgan baholar ham o‘chadi. Davom etasizmi?`))
      return
    const { error } = await supabase.from('subjects').delete().eq('id', s.id)
    if (error) return toast.err(errText(error))
    setSubjects((l) => l.filter((x) => x.id !== s.id))
    toast.ok('Fan o‘chirildi')
  }

  async function addYear() {
    const name = newYear.trim()
    if (!/^\d{4}-\d{4}$/.test(name)) return toast.err('Format: 2026-2027')
    const { data, error } = await supabase
      .from('academic_years')
      .insert({ name, is_active: false })
      .select()
      .single()
    if (error) return toast.err(errText(error))
    setYears((l) => [data as AcademicYear, ...l])
    setNewYear('')
    toast.ok('O‘quv yili qo‘shildi')
  }

  async function activateYear(y: AcademicYear) {
    // Faol yil bitta bo'ladi: avval hammasini o'chiramiz
    const off = await supabase.from('academic_years').update({ is_active: false }).eq('is_active', true)
    if (off.error) return toast.err(errText(off.error))
    const { error } = await supabase.from('academic_years').update({ is_active: true }).eq('id', y.id)
    if (error) return toast.err(errText(error))
    setYears((l) => l.map((x) => ({ ...x, is_active: x.id === y.id })))
    toast.ok(`${y.name} — faol o‘quv yili`)
  }

  async function saveRules() {
    if (!rules) return
    const { error } = await supabase
      .from('grading_rules')
      .update({
        edit_days: rules.edit_days,
        mark5: rules.mark5,
        mark4: rules.mark4,
        mark3: rules.mark3,
      })
      .eq('id', 1)
    if (error) return toast.err(errText(error))
    toast.ok('Qoidalar saqlandi')
  }

  if (loading) return <Loading />

  return (
    <Page>
      <PageHeader title="Sozlamalar" subtitle="Fanlar, o‘quv yillari va baholash qoidalari" />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ── Fanlar ── */}
        <div className="card p-5">
          <h2 className="mb-3 text-sm font-semibold text-fg">Fanlar</h2>
          <div className="mb-3 flex items-end gap-2">
            <Field label="Yangi fan">
              <input
                className="input"
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                placeholder="Astronomiya"
              />
            </Field>
            <label className="mb-1.5 flex items-center gap-1.5 whitespace-nowrap text-xs text-fg-2">
              <input
                type="checkbox"
                checked={newSplit}
                onChange={(e) => setNewSplit(e.target.checked)}
              />
              guruhga bo‘linadi
            </label>
            <button onClick={() => void addSubject()} className="btn-primary mb-0.5">
              <IcoPlus className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-[420px] overflow-y-auto rounded-lg border border-line">
            <table className="w-full">
              <tbody>
                {subjects.map((s) => (
                  <tr key={s.id} className="border-b border-line-soft last:border-0">
                    <td className="td font-medium text-fg">{s.name}</td>
                    <td className="td">
                      <label className="flex items-center gap-1.5 text-xs text-muted">
                        <input
                          type="checkbox"
                          checked={s.is_split}
                          onChange={() => void toggleSplit(s)}
                        />
                        guruhga bo‘linadi
                      </label>
                    </td>
                    <td className="td text-right">
                      <button
                        onClick={() => void removeSubject(s)}
                        className="btn-icon text-rose-500"
                        title="O‘chirish"
                      >
                        <IcoTrash className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-faint">
            «Guruhga bo‘linadi» — ingliz/rus tili kabi fanlar. Bunda o‘qituvchi sinfni guruhlarga
            ajratib, faqat o‘z guruhini baholaydi.
          </p>
        </div>

        <div className="space-y-4">
          {/* ── O'quv yillari ── */}
          <div className="card p-5">
            <h2 className="mb-3 text-sm font-semibold text-fg">O‘quv yillari</h2>
            <div className="mb-3 flex items-end gap-2">
              <Field label="Yangi yil">
                <input
                  className="input"
                  value={newYear}
                  onChange={(e) => setNewYear(e.target.value)}
                  placeholder="2027-2028"
                />
              </Field>
              <button onClick={() => void addYear()} className="btn-primary mb-0.5">
                <IcoPlus className="h-4 w-4" />
              </button>
            </div>
            <TableWrap>
              <table className="w-full">
                <tbody>
                  {years.map((y) => (
                    <tr key={y.id} className="border-b border-line-soft last:border-0">
                      <td className="td font-medium text-fg">{y.name}</td>
                      <td className="td text-right">
                        {y.is_active ? (
                          <span className="badge border tint-emerald">
                            <IcoCheck className="h-3 w-3" /> Faol
                          </span>
                        ) : (
                          <button onClick={() => void activateYear(y)} className="btn-ghost py-1 text-xs">
                            Faol qilish
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
            <p className="mt-2 text-[11px] text-faint">
              Yangi o‘quv yili boshlanganda yangi yil qo‘shiladi va faol qilinadi — statistika
              shundan keyin noldan yig‘iladi, eski yil saqlanib qoladi.
            </p>
          </div>

          {/* ── Baholash qoidalari ── */}
          {rules && (
            <div className="card p-5">
              <h2 className="mb-3 text-sm font-semibold text-fg">Baholash qoidalari</h2>
              <div className="mb-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-raised p-2">
                  <div className="text-xs text-muted">BSB jami</div>
                  <div className="text-lg font-semibold text-fg">{rules.bsb_total}</div>
                </div>
                <div className="rounded-lg bg-raised p-2">
                  <div className="text-xs text-muted">ChSB</div>
                  <div className="text-lg font-semibold text-fg">{rules.chsb_total}</div>
                </div>
                <div className="rounded-lg bg-raised p-2">
                  <div className="text-xs text-muted">O‘qituvchi</div>
                  <div className="text-lg font-semibold text-fg">{rules.extra_total}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Tahrir muddati (kun)">
                  <input
                    className="input"
                    type="number"
                    min={0}
                    max={30}
                    value={rules.edit_days}
                    onChange={(e) => setRules({ ...rules, edit_days: Number(e.target.value) })}
                  />
                </Field>
                <Field label="«5» chegarasi, %">
                  <input
                    className="input"
                    type="number"
                    value={rules.mark5}
                    onChange={(e) => setRules({ ...rules, mark5: Number(e.target.value) })}
                  />
                </Field>
                <Field label="«4» chegarasi, %">
                  <input
                    className="input"
                    type="number"
                    value={rules.mark4}
                    onChange={(e) => setRules({ ...rules, mark4: Number(e.target.value) })}
                  />
                </Field>
                <Field label="«3» chegarasi, %">
                  <input
                    className="input"
                    type="number"
                    value={rules.mark3}
                    onChange={(e) => setRules({ ...rules, mark3: Number(e.target.value) })}
                  />
                </Field>
              </div>

              <button onClick={() => void saveRules()} className="btn-primary mt-3">
                <IcoSave className="h-4 w-4" /> Saqlash
              </button>
              <p className="mt-2 text-[11px] text-faint">
                Chorak = {rules.bsb_total} + {rules.chsb_total} + {rules.extra_total} ={' '}
                {rules.bsb_total + rules.chsb_total + rules.extra_total} ball.
              </p>
            </div>
          )}
        </div>
      </div>
    </Page>
  )
}
