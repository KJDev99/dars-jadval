import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, errText } from '../../lib/supabase'
import { readStudentsFile, downloadTemplate, parseClassName } from '../../lib/excel'
import type { ImportedStudent } from '../../lib/excel'
import { useToast } from '../../ui/Toast'
import { Field, Loading, Modal, Page, PageHeader, Stat, TableWrap } from '../../ui/ui'
import { Select } from '../../ui/Select'
import { IcoPlus, IcoTrash, IcoUpload, IcoTemplate, IcoNext } from '../../ui/icons'
import type { AcademicYear, SchoolClass } from '../../lib/types'

interface ClassRow extends SchoolClass {
  students: { count: number }[]
}

export default function ClassesPage() {
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState<AcademicYear | null>(null)
  const [rows, setRows] = useState<ClassRow[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const [grade, setGrade] = useState('8')
  const [letter, setLetter] = useState('a')
  const [preview, setPreview] = useState<ImportedStudent[] | null>(null)
  const [skipped, setSkipped] = useState(0)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const y = await supabase.from('academic_years').select('*').eq('is_active', true).maybeSingle()
    const yr = (y.data as AcademicYear) ?? null
    setYear(yr)
    if (!yr) {
      setRows([])
      setLoading(false)
      return
    }
    const c = await supabase
      .from('classes')
      .select('*, students(count)')
      .eq('year_id', yr.id)
      .order('grade')
      .order('letter')
    if (c.error) toast.err(errText(c.error))
    setRows((c.data as ClassRow[]) ?? [])
    setLoading(false)
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  const count = (r: ClassRow) => r.students?.[0]?.count ?? 0
  const total = rows.reduce((n, r) => n + count(r), 0)

  async function addClass() {
    if (!year) return toast.err('Faol o‘quv yili yo‘q — Sozlamalarda qo‘shing')
    const g = Number(grade)
    const l = letter.trim().toLowerCase()
    if (!g || g < 1 || g > 11) return toast.err('Sinf 1–11 orasida')
    if (!l) return toast.err('Harfni kiriting')
    const { error } = await supabase.from('classes').insert({ year_id: year.id, grade: g, letter: l })
    if (error)
      return toast.err(/duplicate/i.test(error.message) ? 'Bu sinf allaqachon bor' : errText(error))
    setAddOpen(false)
    toast.ok(`${g}${l} sinfi qo‘shildi`)
    void load()
  }

  async function removeClass(r: ClassRow) {
    if (
      !confirm(
        `${r.grade}${r.letter} sinfi va undagi ${count(r)} o‘quvchi, barcha baholari bilan o‘chiriladi. Davom etasizmi?`,
      )
    )
      return
    const { error } = await supabase.from('classes').delete().eq('id', r.id)
    if (error) return toast.err(errText(error))
    setRows((l) => l.filter((x) => x.id !== r.id))
    toast.ok('Sinf o‘chirildi')
  }

  async function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const { rows: parsed, skipped: s } = await readStudentsFile(file)
      if (parsed.length === 0) return toast.err('Faylda o‘quvchi topilmadi — namunani yuklab ko‘ring')
      setPreview(parsed)
      setSkipped(s)
    } catch (err) {
      toast.err(errText(err))
    }
  }

  /** Import: yetishmayotgan sinflar yaratiladi, o'quvchilar qo'shiladi */
  async function runImport() {
    if (!preview || !year) return
    setBusy(true)
    try {
      const names = [...new Set(preview.map((r) => r.class_name))]
      const existing = new Map(rows.map((r) => [`${r.grade}${r.letter}`, r.id]))

      const toCreate = names
        .filter((n) => !existing.has(n))
        .map((n) => {
          const p = parseClassName(n)!
          return { year_id: year.id, grade: p.grade, letter: p.letter }
        })

      if (toCreate.length > 0) {
        const { data, error } = await supabase.from('classes').insert(toCreate).select()
        if (error) throw new Error(error.message)
        for (const c of (data as SchoolClass[]) ?? []) existing.set(`${c.grade}${c.letter}`, c.id)
      }

      const payload = preview.map((r) => ({
        class_id: existing.get(r.class_name)!,
        full_name: r.full_name,
        order_no: r.order_no,
      }))

      // Katta ro'yxatni bo'lib yuboramiz
      for (let i = 0; i < payload.length; i += 500) {
        const { error } = await supabase.from('students').insert(payload.slice(i, i + 500))
        if (error) throw new Error(error.message)
      }

      toast.ok(`${payload.length} o‘quvchi, ${names.length} sinfga yuklandi`)
      setPreview(null)
      void load()
    } catch (err) {
      toast.err(errText(err))
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Loading />

  const previewClasses = preview ? [...new Set(preview.map((r) => r.class_name))] : []

  return (
    <Page>
      <PageHeader
        title="Sinflar"
        subtitle={
          year ? `${year.name} o‘quv yili` : 'Faol o‘quv yili yo‘q — administrator sozlashi kerak'
        }
        actions={
          <>
            <button onClick={() => void downloadTemplate()} className="btn-ghost">
              <IcoTemplate className="h-4 w-4" /> Namuna
            </button>
            <button onClick={() => fileRef.current?.click()} className="btn-ghost">
              <IcoUpload className="h-4 w-4" /> Excel'dan import
            </button>
            <button onClick={() => setAddOpen(true)} className="btn-primary">
              <IcoPlus className="h-4 w-4" /> Sinf qo‘shish
            </button>
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

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Stat label="Sinflar" value={rows.length} />
        <Stat label="O‘quvchilar" value={total} />
        <Stat
          label="O‘rtacha sinf"
          value={rows.length ? Math.round(total / rows.length) : '—'}
          hint="o‘quvchi"
        />
      </div>

      {rows.length === 0 ? (
        <div className="card p-10 text-center text-sm text-faint">
          Sinflar yo‘q. Excel'dan import qiling yoki qo‘lda qo‘shing.
        </div>
      ) : (
        <TableWrap>
          <table className="w-full min-w-[520px]">
            <thead className="border-b border-line bg-raised">
              <tr>
                <th className="th">Sinf</th>
                <th className="th">O‘quvchilar</th>
                <th className="th text-right">Amallar</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-line-soft last:border-0">
                  <td className="td">
                    <Link
                      to={`/classes/${r.id}`}
                      className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      {r.grade}
                      {r.letter}
                    </Link>
                  </td>
                  <td className="td tabular-nums">{count(r)}</td>
                  <td className="td">
                    <div className="flex items-center justify-end gap-1.5">
                      <Link to={`/classes/${r.id}`} className="btn-ghost py-1 text-xs">
                        Ochish <IcoNext className="h-3.5 w-3.5" />
                      </Link>
                      <button
                        onClick={() => void removeClass(r)}
                        className="btn-danger py-1 text-xs"
                        title="O‘chirish"
                      >
                        <IcoTrash className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}

      {/* Sinf qo'shish */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Yangi sinf">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Sinf raqami">
              <Select
                value={grade}
                onChange={setGrade}
                searchable={false}
                options={Array.from({ length: 11 }, (_, i) => ({
                  value: String(i + 1),
                  label: `${i + 1}-sinf`,
                }))}
              />
            </Field>
            <Field label="Harfi">
              <input
                className="input"
                value={letter}
                onChange={(e) => setLetter(e.target.value)}
                placeholder="a"
                maxLength={2}
              />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setAddOpen(false)} className="btn-ghost">
              Bekor qilish
            </button>
            <button onClick={() => void addClass()} className="btn-primary">
              Qo‘shish
            </button>
          </div>
        </div>
      </Modal>

      {/* Import oldidan tekshirish */}
      <Modal open={!!preview} onClose={() => setPreview(null)} title="Import" wide>
        {preview && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label="O‘quvchi" value={preview.length} />
              <Stat label="Sinf" value={previewClasses.length} />
              <Stat
                label="O‘tkazib yuborildi"
                value={skipped}
                tone={skipped ? 'amber' : 'slate'}
                hint={skipped ? 'sinf yoki ism noto‘g‘ri' : undefined}
              />
            </div>

            <div className="max-h-72 overflow-y-auto rounded-lg border border-line">
              <table className="w-full">
                <thead className="sticky top-0 bg-raised">
                  <tr>
                    <th className="th">#</th>
                    <th className="th">Sinf</th>
                    <th className="th">F.I.Sh.</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 300).map((r, i) => (
                    <tr key={i} className="border-b border-line-soft last:border-0">
                      <td className="td text-faint">{i + 1}</td>
                      <td className="td font-medium">{r.class_name}</td>
                      <td className="td">{r.full_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.length > 300 && (
              <p className="text-xs text-faint">… va yana {preview.length - 300} ta satr</p>
            )}

            <p className="text-xs text-muted">
              Mavjud bo‘lmagan sinflar avtomatik yaratiladi. O‘quvchilar qo‘shiladi — eski ro‘yxat
              o‘chmaydi, shuning uchun bir faylni ikki marta yuklamang.
            </p>

            <div className="flex justify-end gap-2">
              <button onClick={() => setPreview(null)} className="btn-ghost">
                Bekor qilish
              </button>
              <button onClick={() => void runImport()} disabled={busy} className="btn-primary">
                {busy ? 'Yuklanmoqda…' : `${preview.length} o‘quvchini yuklash`}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </Page>
  )
}
