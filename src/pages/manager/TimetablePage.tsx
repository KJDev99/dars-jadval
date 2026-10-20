import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase, errText } from '../../lib/supabase'
import { readLessonsFile, downloadLessonsTemplate, WEEKDAYS } from '../../lib/excel'
import type { LessonRow } from '../../lib/excel'
import { useToast } from '../../ui/Toast'
import { Loading, Modal, Page, PageHeader, Segmented, Stat } from '../../ui/ui'
import { Select } from '../../ui/Select'
import { IcoUpload, IcoTemplate, IcoClear } from '../../ui/icons'
import type { AcademicYear, Profile, SchoolClass, Subject, TimetableRow } from '../../lib/types'

type Mode = 'class' | 'teacher'

interface Prepared {
  rows: {
    year_id: number
    class_id: string
    subject_id: number
    weekday: number
    lesson_no: number
    teacher_id: string | null
    room: string | null
  }[]
  badClasses: string[]
  badSubjects: string[]
  badTeachers: string[]
  skipped: number
  raw: number
}

export default function TimetablePage() {
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState<AcademicYear | null>(null)
  const [rows, setRows] = useState<TimetableRow[]>([])
  const [classes, setClasses] = useState<SchoolClass[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [teachers, setTeachers] = useState<Profile[]>([])
  const [mode, setMode] = useState<Mode>('class')
  const [pickId, setPickId] = useState('')
  const [prep, setPrep] = useState<Prepared | null>(null)
  const [replace, setReplace] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const y = await supabase.from('academic_years').select('*').eq('is_active', true).maybeSingle()
    const yr = (y.data as AcademicYear) ?? null
    setYear(yr)
    if (!yr) return setLoading(false)

    const [t, c, s, p] = await Promise.all([
      supabase.from('v_timetable').select('*').eq('year_id', yr.id),
      supabase.from('classes').select('*').eq('year_id', yr.id).order('grade').order('letter'),
      supabase.from('subjects').select('*').order('name'),
      supabase.from('profiles').select('*').eq('role', 'teacher').order('last_name'),
    ])
    if (t.error) toast.err(errText(t.error))
    const list = (t.data as TimetableRow[]) ?? []
    setRows(list)
    const cl = (c.data as SchoolClass[]) ?? []
    setClasses(cl)
    setSubjects((s.data as Subject[]) ?? [])
    setTeachers((p.data as Profile[]) ?? [])
    setPickId((prev) => prev || cl[0]?.id || '')
    setLoading(false)
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  const maxLesson = useMemo(
    () => Math.max(6, ...rows.map((r) => r.lesson_no)),
    [rows],
  )

  /** Tanlangan sinf yoki o'qituvchi uchun katakchalar */
  const cell = useMemo(() => {
    const m = new Map<string, TimetableRow>()
    for (const r of rows) {
      if (mode === 'class' ? r.class_id === pickId : r.teacher_id === pickId) {
        m.set(`${r.weekday}|${r.lesson_no}`, r)
      }
    }
    return m
  }, [rows, mode, pickId])

  function prepare(parsed: LessonRow[], skipped: number): Prepared {
    if (!year)
      return { rows: [], badClasses: [], badSubjects: [], badTeachers: [], skipped, raw: parsed.length }

    const byClass = new Map(classes.map((c) => [`${c.grade}${c.letter}`.toLowerCase(), c.id]))
    const bySubject = new Map(subjects.map((s) => [s.name.toLowerCase(), s.id]))
    const byTeacher = new Map<string, string>()
    for (const t of teachers) {
      byTeacher.set(`${t.last_name} ${t.first_name}`.toLowerCase(), t.id)
      byTeacher.set(`${t.first_name} ${t.last_name}`.toLowerCase(), t.id)
      byTeacher.set(t.last_name.toLowerCase(), t.id)
      byTeacher.set(t.login.toLowerCase(), t.id)
    }

    const out: Prepared['rows'] = []
    const badClasses = new Set<string>()
    const badSubjects = new Set<string>()
    const badTeachers = new Set<string>()
    const seen = new Set<string>()

    for (const r of parsed) {
      const class_id = byClass.get(r.class_name)
      if (!class_id) {
        badClasses.add(r.class_name)
        continue
      }
      const subject_id =
        bySubject.get(r.subject.toLowerCase()) ??
        subjects.find((s) => s.name.toLowerCase().startsWith(r.subject.toLowerCase().slice(0, 6)))?.id
      if (!subject_id) {
        badSubjects.add(r.subject)
        continue
      }
      let teacher_id: string | null = null
      if (r.teacher) {
        teacher_id = byTeacher.get(r.teacher.toLowerCase()) ?? null
        if (!teacher_id) badTeachers.add(r.teacher)
      }
      // bitta sinfda bir vaqtda bitta dars
      const key = `${class_id}|${r.weekday}|${r.lesson_no}`
      if (seen.has(key)) continue
      seen.add(key)

      out.push({
        year_id: year.id,
        class_id,
        subject_id,
        weekday: r.weekday,
        lesson_no: r.lesson_no,
        teacher_id,
        room: r.room,
      })
    }
    return {
      rows: out,
      badClasses: [...badClasses],
      badSubjects: [...badSubjects],
      badTeachers: [...badTeachers],
      skipped,
      raw: parsed.length,
    }
  }

  async function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const { rows: parsed, skipped } = await readLessonsFile(file)
      if (parsed.length === 0)
        return toast.err('Faylda dars topilmadi — namunani yuklab, ustunlarni tekshiring')
      setPrep(prepare(parsed, skipped))
    } catch (err) {
      toast.err(errText(err))
    }
  }

  async function runImport() {
    if (!prep || !year || prep.rows.length === 0) return
    setBusy(true)
    try {
      if (replace) {
        const { error } = await supabase.from('lessons').delete().eq('year_id', year.id)
        if (error) throw new Error(error.message)
      }
      for (let i = 0; i < prep.rows.length; i += 400) {
        const { error } = await supabase
          .from('lessons')
          .upsert(prep.rows.slice(i, i + 400), { onConflict: 'class_id,weekday,lesson_no' })
        if (error) throw new Error(error.message)
      }
      toast.ok(`${prep.rows.length} ta dars yuklandi`)
      setPrep(null)
      void load()
    } catch (err) {
      toast.err(errText(err))
    } finally {
      setBusy(false)
    }
  }

  async function clearAll() {
    if (!year) return
    if (!confirm('Butun dars jadvali o‘chiriladi. Davom etasizmi?')) return
    const { error } = await supabase.from('lessons').delete().eq('year_id', year.id)
    if (error) return toast.err(errText(error))
    toast.ok('Dars jadvali o‘chirildi')
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

  const days = [1, 2, 3, 4, 5, 6]

  return (
    <Page>
      <PageHeader
        title="Dars jadvali"
        subtitle={`${year.name} · ${rows.length} dars`}
        actions={
          <>
            <button onClick={() => void downloadLessonsTemplate()} className="btn-ghost">
              <IcoTemplate className="h-4 w-4" /> Namuna
            </button>
            <button onClick={() => fileRef.current?.click()} className="btn-primary">
              <IcoUpload className="h-4 w-4" /> Excel'dan yuklash
            </button>
            {rows.length > 0 && (
              <button onClick={() => void clearAll()} className="btn-danger">
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

      {rows.length === 0 ? (
        <div className="card p-10 text-center text-sm text-faint">
          Dars jadvali yo‘q. «Namuna» ni yuklab olib to‘ldiring va Excel'dan yuklang.
          <div className="mt-2 text-xs">
            Ustunlar: Sinf · Kun · Dars · Fan · O‘qituvchi · Xona. «O‘qituvchi» ustuni to‘ldirilsa,
            BSB eslatmalari to‘g‘ri odamga boradi.
          </div>
        </div>
      ) : (
        <>
          <div className="card mb-4 flex flex-wrap items-end gap-3 p-4">
            <div>
              <span className="mb-1 block text-xs font-medium text-fg-2">Ko‘rinish</span>
              <Segmented
                value={mode}
                onChange={(m) => {
                  setMode(m)
                  setPickId(m === 'class' ? classes[0]?.id ?? '' : teachers[0]?.id ?? '')
                }}
                items={[
                  { value: 'class' as const, label: 'Sinf bo‘yicha' },
                  { value: 'teacher' as const, label: 'O‘qituvchi bo‘yicha' },
                ]}
              />
            </div>
            <div className="min-w-48">
              <span className="mb-1 block text-xs font-medium text-fg-2">
                {mode === 'class' ? 'Sinf' : 'O‘qituvchi'}
              </span>
              <Select
                value={pickId}
                onChange={setPickId}
                options={
                  mode === 'class'
                    ? classes.map((c) => ({ value: c.id, label: `${c.grade}${c.letter}` }))
                    : teachers.map((t) => ({
                        value: t.id,
                        label: `${t.last_name} ${t.first_name}`,
                        hint: subjects.find((s) => s.id === t.subject_id)?.name,
                      }))
                }
              />
            </div>
            <div className="ml-auto">
              <Stat label="Haftadagi dars" value={cell.size} />
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px]">
                <thead className="border-b border-line bg-raised">
                  <tr>
                    <th className="th w-14 text-center">Dars</th>
                    {days.map((d) => (
                      <th key={d} className="th text-center">
                        {WEEKDAYS[d - 1]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: maxLesson }, (_, i) => i + 1).map((no) => (
                    <tr key={no} className="border-b border-line-soft last:border-0">
                      <td className="td text-center font-semibold text-muted">{no}</td>
                      {days.map((d) => {
                        const r = cell.get(`${d}|${no}`)
                        return (
                          <td key={d} className="td align-top">
                            {r ? (
                              <div className="rounded-lg border border-line bg-raised px-2 py-1.5">
                                <div className="text-xs font-medium leading-tight text-fg">
                                  {r.subject_name}
                                </div>
                                <div className="mt-0.5 text-[11px] leading-tight text-muted">
                                  {mode === 'class'
                                    ? r.teacher_name ?? '—'
                                    : r.class_name}
                                  {r.room && ` · ${r.room}`}
                                </div>
                              </div>
                            ) : (
                              <span className="text-faint">·</span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <Modal open={!!prep} onClose={() => setPrep(null)} title="Dars jadvalini yuklash" wide>
        {prep && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label="Yuklanadigan dars" value={prep.rows.length} />
              <Stat
                label="Faylda topilgan"
                value={prep.raw}
                hint={prep.skipped ? `${prep.skipped} satr o‘tkazildi` : undefined}
              />
              <Stat
                label="Tanilmagan"
                value={prep.badClasses.length + prep.badSubjects.length + prep.badTeachers.length}
                tone={
                  prep.badClasses.length + prep.badSubjects.length + prep.badTeachers.length
                    ? 'amber'
                    : 'slate'
                }
              />
            </div>

            {(prep.badClasses.length > 0 ||
              prep.badSubjects.length > 0 ||
              prep.badTeachers.length > 0) && (
              <div className="space-y-1 rounded-lg border border-amber-500/40 bg-amber-500/[0.08] p-3 text-xs">
                {prep.badClasses.length > 0 && (
                  <div>
                    <b>Topilmagan sinflar:</b> {prep.badClasses.join(', ')}
                  </div>
                )}
                {prep.badSubjects.length > 0 && (
                  <div>
                    <b>Topilmagan fanlar:</b> {prep.badSubjects.join(', ')}
                  </div>
                )}
                {prep.badTeachers.length > 0 && (
                  <div>
                    <b>Topilmagan o‘qituvchilar:</b> {prep.badTeachers.join(', ')} — dars baribir
                    yuklanadi, lekin o‘qituvchisiz
                  </div>
                )}
              </div>
            )}

            <label className="flex items-center gap-2 text-sm text-fg-2">
              <input
                type="checkbox"
                checked={replace}
                onChange={(e) => setReplace(e.target.checked)}
              />
              Avval mavjud dars jadvalini o‘chirish (tavsiya etiladi)
            </label>

            <div className="max-h-64 overflow-y-auto rounded-lg border border-line">
              <table className="w-full">
                <thead className="sticky top-0 bg-raised">
                  <tr>
                    <th className="th">Sinf</th>
                    <th className="th">Kun</th>
                    <th className="th">Dars</th>
                    <th className="th">Fan</th>
                    <th className="th">O‘qituvchi</th>
                  </tr>
                </thead>
                <tbody>
                  {prep.rows.slice(0, 300).map((r, i) => {
                    const c = classes.find((x) => x.id === r.class_id)
                    const s = subjects.find((x) => x.id === r.subject_id)
                    const t = teachers.find((x) => x.id === r.teacher_id)
                    return (
                      <tr key={i} className="border-b border-line-soft last:border-0">
                        <td className="td font-medium">{c ? `${c.grade}${c.letter}` : '—'}</td>
                        <td className="td">{WEEKDAYS[r.weekday - 1]}</td>
                        <td className="td tabular-nums">{r.lesson_no}</td>
                        <td className="td">{s?.name}</td>
                        <td className="td text-muted">
                          {t ? `${t.last_name} ${t.first_name}` : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => setPrep(null)} className="btn-ghost">
                Bekor qilish
              </button>
              <button onClick={() => void runImport()} disabled={busy} className="btn-primary">
                {busy ? 'Yuklanmoqda…' : `${prep.rows.length} darsni yuklash`}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </Page>
  )
}
