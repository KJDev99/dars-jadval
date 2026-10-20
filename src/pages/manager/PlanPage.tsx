import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase, errText } from '../../lib/supabase'
import { readPlanFile, downloadPlanTemplate } from '../../lib/excel'
import type { PlanRow } from '../../lib/excel'
import { useToast } from '../../ui/Toast'
import { Loading, Modal, Page, PageHeader, Segmented, Stat, TableWrap } from '../../ui/ui'
import { IcoUpload, IcoTemplate, IcoTrash, IcoClear } from '../../ui/icons'
import { workLabel, ball } from '../../lib/grading'
import type { AcademicYear, PlanStatusRow, Quarter, SchoolClass, Subject } from '../../lib/types'

const STATE_BADGE: Record<string, { cls: string; text: string }> = {
  done: { cls: 'tint-emerald', text: 'Bajarildi' },
  partial: { cls: 'tint-amber', text: 'Chala' },
  none: { cls: 'tint-slate', text: 'Boshlanmagan' },
}

const fmtDate = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('uz-UZ', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  })

interface Prepared {
  rows: {
    year_id: number
    quarter: number
    class_id: string
    subject_id: number
    kind: 'bsb' | 'chsb'
    idx: number
    planned_on: string
    max_points: number | null
  }[]
  badClasses: string[]
  badSubjects: string[]
  skipped: number
  raw: number
}

export default function PlanPage() {
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState<AcademicYear | null>(null)
  const [rows, setRows] = useState<PlanStatusRow[]>([])
  const [classes, setClasses] = useState<SchoolClass[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [quarter, setQuarter] = useState<Quarter | 0>(0)
  const [prep, setPrep] = useState<Prepared | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const y = await supabase.from('academic_years').select('*').eq('is_active', true).maybeSingle()
    const yr = (y.data as AcademicYear) ?? null
    setYear(yr)
    if (!yr) return setLoading(false)

    const [p, c, s] = await Promise.all([
      supabase
        .from('v_plan_status')
        .select('*')
        .eq('year_id', yr.id)
        .order('planned_on'),
      supabase.from('classes').select('*').eq('year_id', yr.id).order('grade').order('letter'),
      supabase.from('subjects').select('*').order('name'),
    ])
    if (p.error) toast.err(errText(p.error))
    setRows((p.data as PlanStatusRow[]) ?? [])
    setClasses((c.data as SchoolClass[]) ?? [])
    setSubjects((s.data as Subject[]) ?? [])
    setLoading(false)
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  const shown = quarter === 0 ? rows : rows.filter((r) => r.quarter === quarter)

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return {
      total: shown.length,
      done: shown.filter((r) => r.state === 'done').length,
      late: shown.filter((r) => r.state !== 'done' && r.planned_on < today).length,
      now: shown.filter((r) => r.state !== 'done' && r.planned_on === today).length,
    }
  }, [shown])

  /** Excel satrlarini baza yozuvlariga aylantirish */
  function prepare(parsed: PlanRow[], skipped: number): Prepared {
    if (!year) return { rows: [], badClasses: [], badSubjects: [], skipped, raw: parsed.length }

    const byName = new Map<string, string>() // «8a» → class_id
    const byGrade = new Map<number, string[]>() // 8 → [class_id...]
    for (const c of classes) {
      byName.set(`${c.grade}${c.letter}`.toLowerCase(), c.id)
      const l = byGrade.get(c.grade) ?? []
      l.push(c.id)
      byGrade.set(c.grade, l)
    }
    const subjByName = new Map(subjects.map((s) => [s.name.toLowerCase(), s.id]))

    const out: Prepared['rows'] = []
    const badClasses = new Set<string>()
    const badSubjects = new Set<string>()

    for (const r of parsed) {
      const subject_id =
        subjByName.get(r.subject.toLowerCase()) ??
        subjects.find((s) => s.name.toLowerCase().startsWith(r.subject.toLowerCase().slice(0, 6)))?.id
      if (!subject_id) {
        badSubjects.add(r.subject)
        continue
      }

      // «8a» — bitta sinf, «8» — butun parallel
      let ids: string[] = []
      const one = byName.get(r.class_name)
      if (one) ids = [one]
      else if (/^\d{1,2}$/.test(r.class_name)) ids = byGrade.get(Number(r.class_name)) ?? []
      if (ids.length === 0) {
        badClasses.add(r.class_name)
        continue
      }

      for (const class_id of ids) {
        out.push({
          year_id: year.id,
          quarter: r.quarter,
          class_id,
          subject_id,
          kind: r.kind,
          idx: r.idx,
          planned_on: r.planned_on,
          max_points: r.max_points,
        })
      }
    }
    return {
      rows: out,
      badClasses: [...badClasses],
      badSubjects: [...badSubjects],
      skipped,
      raw: parsed.length,
    }
  }

  async function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const { rows: parsed, skipped } = await readPlanFile(file)
      if (parsed.length === 0)
        return toast.err('Faylda reja topilmadi — namunani yuklab, ustunlarni tekshiring')
      setPrep(prepare(parsed, skipped))
    } catch (err) {
      toast.err(errText(err))
    }
  }

  async function runImport() {
    if (!prep || prep.rows.length === 0) return
    setBusy(true)
    try {
      for (let i = 0; i < prep.rows.length; i += 400) {
        const { error } = await supabase
          .from('assessment_plan')
          .upsert(prep.rows.slice(i, i + 400), {
            onConflict: 'class_id,subject_id,quarter,kind,idx',
          })
        if (error) throw new Error(error.message)
      }
      toast.ok(`${prep.rows.length} ta reja satri saqlandi`)
      setPrep(null)
      void load()
    } catch (err) {
      toast.err(errText(err))
    } finally {
      setBusy(false)
    }
  }

  async function removeRow(r: PlanStatusRow) {
    const { error } = await supabase.from('assessment_plan').delete().eq('id', r.plan_id)
    if (error) return toast.err(errText(error))
    setRows((l) => l.filter((x) => x.plan_id !== r.plan_id))
  }

  async function clearQuarter() {
    if (!year) return
    const label = quarter === 0 ? 'butun yil' : `${quarter}-chorak`
    if (!confirm(`${label} uchun BSB/ChSB rejasi o‘chiriladi. Baholar saqlanib qoladi. Davom etasizmi?`))
      return
    let q = supabase.from('assessment_plan').delete().eq('year_id', year.id)
    if (quarter !== 0) q = q.eq('quarter', quarter)
    const { error } = await q
    if (error) return toast.err(errText(error))
    toast.ok('Reja o‘chirildi')
    void load()
  }

  if (loading) return <Loading />
  if (!year)
    return (
      <Page>
        <div className="card p-10 text-center text-sm text-faint">
          Faol o‘quv yili yo‘q — administrator Sozlamalarda qo‘shishi kerak.
        </div>
      </Page>
    )

  return (
    <Page>
      <PageHeader
        title="BSB / ChSB rejasi"
        subtitle={`${year.name} · qaysi sinfda, qaysi fandan, qachon ish olinadi`}
        actions={
          <>
            <button onClick={() => void downloadPlanTemplate()} className="btn-ghost">
              <IcoTemplate className="h-4 w-4" /> Namuna
            </button>
            <button onClick={() => fileRef.current?.click()} className="btn-primary">
              <IcoUpload className="h-4 w-4" /> Excel'dan yuklash
            </button>
            {rows.length > 0 && (
              <button onClick={() => void clearQuarter()} className="btn-danger">
                <IcoClear className="h-4 w-4" /> Tozalash
              </button>
            )}
          </>
        }
      />

      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(e) => void pickFile(e)}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <Stat label="Rejadagi ishlar" value={stats.total} />
        <Stat label="Bajarildi" value={stats.done} tone="emerald" />
        <Stat label="Bugun" value={stats.now} tone={stats.now ? 'amber' : 'slate'} />
        <Stat label="Kechikkan" value={stats.late} tone={stats.late ? 'rose' : 'slate'} />
      </div>

      <div className="mb-3">
        <Segmented
          value={quarter}
          onChange={setQuarter}
          items={[
            { value: 0 as const, label: 'Hammasi' },
            ...([1, 2, 3, 4] as Quarter[]).map((q) => ({ value: q, label: `${q}-chorak` })),
          ]}
        />
      </div>

      {shown.length === 0 ? (
        <div className="card p-10 text-center text-sm text-faint">
          Reja yo‘q. «Namuna» ni yuklab olib to‘ldiring va Excel'dan yuklang.
          <div className="mt-2 text-xs">
            Ustunlar: Chorak · Sinf · Fan · Ish · Sana · Ball. «Sinf» ustuniga <b>8a</b> (bitta sinf)
            yoki <b>8</b> (barcha 8-sinflar) yozish mumkin.
          </div>
        </div>
      ) : (
        <TableWrap>
          <table className="w-full min-w-[760px]">
            <thead className="border-b border-line bg-raised">
              <tr>
                <th className="th">Sana</th>
                <th className="th text-center">Chorak</th>
                <th className="th">Sinf</th>
                <th className="th">Fan</th>
                <th className="th text-center">Ish</th>
                <th className="th text-center">Ball</th>
                <th className="th text-center">Holat</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const b = STATE_BADGE[r.state]
                const overdue = r.state !== 'done' && r.days < 0
                const today = r.state !== 'done' && r.days === 0
                return (
                  <tr key={r.plan_id} className="border-b border-line-soft last:border-0">
                    <td className="td whitespace-nowrap tabular-nums">
                      <span
                        className={
                          overdue
                            ? 'font-medium text-rose-600 dark:text-rose-400'
                            : today
                              ? 'font-medium text-amber-600 dark:text-amber-400'
                              : ''
                        }
                      >
                        {fmtDate(r.planned_on)}
                      </span>
                    </td>
                    <td className="td text-center tabular-nums">{r.quarter}</td>
                    <td className="td font-medium text-fg">{r.class_name}</td>
                    <td className="td">{r.subject_name}</td>
                    <td className="td text-center">{workLabel(r.kind, r.idx)}</td>
                    <td className="td text-center tabular-nums text-muted">
                      {r.max_points ? ball(r.max_points, 0) : '—'}
                    </td>
                    <td className="td text-center">
                      <span className={`badge border ${b.cls}`}>{b.text}</span>
                    </td>
                    <td className="td text-right">
                      <button
                        onClick={() => void removeRow(r)}
                        className="btn-icon text-rose-500"
                        title="O‘chirish"
                      >
                        <IcoTrash className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </TableWrap>
      )}

      <p className="mt-3 text-xs text-faint">
        Holat jurnaldan avtomatik aniqlanadi: ish yaratilib, hamma o‘quvchi baholansa «Bajarildi».
        Bajarilmagan va sanasi yaqinlashgan ishlar o‘qituvchi hamda menejerga eslatma bo‘lib chiqadi.
      </p>

      {/* Import oldidan tekshirish */}
      <Modal open={!!prep} onClose={() => setPrep(null)} title="Rejani yuklash" wide>
        {prep && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label="Saqlanadigan satr" value={prep.rows.length} />
              <Stat
                label="Faylda topilgan"
                value={prep.raw}
                hint={prep.skipped ? `${prep.skipped} satr o‘tkazib yuborildi` : undefined}
              />
              <Stat
                label="Tanilmagan"
                value={prep.badClasses.length + prep.badSubjects.length}
                tone={prep.badClasses.length + prep.badSubjects.length ? 'amber' : 'slate'}
              />
            </div>

            {(prep.badClasses.length > 0 || prep.badSubjects.length > 0) && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/[0.08] p-3 text-xs">
                {prep.badClasses.length > 0 && (
                  <div>
                    <b>Topilmagan sinflar:</b> {prep.badClasses.join(', ')} — bu sinflar avval
                    «Sinflar» bo‘limida yaratilishi kerak.
                  </div>
                )}
                {prep.badSubjects.length > 0 && (
                  <div className={prep.badClasses.length ? 'mt-1' : ''}>
                    <b>Topilmagan fanlar:</b> {prep.badSubjects.join(', ')} — fan nomini
                    Sozlamalardagi nom bilan bir xil yozing.
                  </div>
                )}
              </div>
            )}

            <div className="max-h-72 overflow-y-auto rounded-lg border border-line">
              <table className="w-full">
                <thead className="sticky top-0 bg-raised">
                  <tr>
                    <th className="th">Sana</th>
                    <th className="th">Ch</th>
                    <th className="th">Sinf</th>
                    <th className="th">Fan</th>
                    <th className="th">Ish</th>
                    <th className="th">Ball</th>
                  </tr>
                </thead>
                <tbody>
                  {prep.rows.slice(0, 300).map((r, i) => {
                    const c = classes.find((x) => x.id === r.class_id)
                    const s = subjects.find((x) => x.id === r.subject_id)
                    return (
                      <tr key={i} className="border-b border-line-soft last:border-0">
                        <td className="td tabular-nums">{fmtDate(r.planned_on)}</td>
                        <td className="td tabular-nums">{r.quarter}</td>
                        <td className="td font-medium">
                          {c ? `${c.grade}${c.letter}` : '—'}
                        </td>
                        <td className="td">{s?.name}</td>
                        <td className="td">{workLabel(r.kind, r.idx)}</td>
                        <td className="td tabular-nums">{r.max_points ?? '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-muted">
              Bir xil sinf-fan-chorak-ish uchun satr allaqachon bo‘lsa, sanasi yangilanadi
              (takrorlanmaydi).
            </p>

            <div className="flex justify-end gap-2">
              <button onClick={() => setPrep(null)} className="btn-ghost">
                Bekor qilish
              </button>
              <button
                onClick={() => void runImport()}
                disabled={busy || prep.rows.length === 0}
                className="btn-primary"
              >
                {busy ? 'Saqlanmoqda…' : `${prep.rows.length} satrni saqlash`}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </Page>
  )
}
