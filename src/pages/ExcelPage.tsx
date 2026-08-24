import { useRef, useState } from 'react'
import { useStore } from '../store'
import { Empty, Page, PageHeader, Stat } from '../components/ui'
import { exportExcel, parseWorkbook, SHEETS } from '../lib/excel'
import type { ImportPreview } from '../lib/excel'
import { CATEGORY_LABELS, CATEGORY_RANK, DAY_NAMES } from '../types'
import type { TeacherCategory } from '../types'
import { SUBJECT_BY_ID } from '../data/curriculum'
import { formatStavka } from '../lib/derive'
import {
  IcoDownload, IcoUpload, IcoExcel, IcoTemplate, IcoWarn, IcoError, IcoOk, IcoGenerate, IcoClose,
} from '../components/icons'

const CAT_TINT: Record<TeacherCategory, string> = {
  oliy: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300',
  birinchi: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  ikkinchi: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  yoq: 'bg-line-soft text-muted',
}

interface Props {
  onNavigate?: (page: string) => void
}

export default function ExcelPage({ onNavigate }: Props) {
  const { classes, teachers, assignments, overrides, settings, applyExcelImport } = useStore()

  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [fileName, setFileName] = useState('')
  const [removeMissing, setRemoveMissing] = useState(true)
  const [exactPlan, setExactPlan] = useState(true)
  const [applied, setApplied] = useState<null | { teachers: number; lessons: number; hours: number }>(null)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const download = (template: boolean) => {
    void exportExcel({ classes, teachers, assignments, overrides, settings }, template)
  }

  const readFile = async (file: File) => {
    setBusy(true)
    setApplied(null)
    setFileName(file.name)
    try {
      const buf = await file.arrayBuffer()
      setPreview(await parseWorkbook(buf, { classes, teachers, overrides }))
    } catch (e) {
      setPreview({
        imported: [], missing: [], assignments: {}, classHours: {}, newClasses: [],
        totalHours: 0, rowsRead: 0, warnings: [],
        errors: ["Faylni o'qishda xatolik: " + (e as Error).message],
      })
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const apply = () => {
    if (!preview || preview.errors.length) return
    applyExcelImport({
      teachers: preview.imported.map((r) => r.teacher),
      assignments: preview.assignments,
      classHours: preview.classHours,
      newClasses: preview.newClasses,
      removeMissing,
      exactPlan,
    })
    setApplied({
      teachers: preview.imported.length,
      lessons: preview.rowsRead,
      hours: preview.totalHours,
    })
    setPreview(null)
  }

  const sorted = preview
    ? [...preview.imported].sort(
        (a, b) =>
          CATEGORY_RANK[a.teacher.category ?? 'yoq'] - CATEGORY_RANK[b.teacher.category ?? 'yoq'] ||
          b.hours - a.hours ||
          a.teacher.fullName.localeCompare(b.teacher.fullName),
      )
    : []

  return (
    <Page>
      <PageHeader
        title="Excel"
        subtitle="O'qituvchilar ro'yxatini, toifasini va tarifikatsiyani Excelga chiqarish hamda tayyor fayl asosida dars jadvalini tuzish."
        actions={
          <>
            <button className="btn-ghost" onClick={() => download(true)}>
              <IcoTemplate className="h-4 w-4" /> Bo'sh shablon
            </button>
            <button className="btn-primary" onClick={() => download(false)}>
              <IcoDownload className="h-4 w-4" /> Excelga yuklab olish
            </button>
          </>
        }
      />

      {applied && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-300">
          <span className="flex items-center gap-2">
            <IcoOk className="h-4 w-4 shrink-0" />
            <span>
              <b>Fayl qo'llandi.</b> {applied.teachers} ta o'qituvchi, {applied.lessons} ta tarifikatsiya
              qatori, jami {applied.hours} soat. Endi shu ma'lumot bo'yicha jadval tuzish mumkin.
            </span>
          </span>
          <button className="btn-primary shrink-0" onClick={() => onNavigate?.('generate')}>
            <IcoGenerate className="h-4 w-4" /> Jadval tuzishga o'tish
          </button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ── Yuklash maydoni ───────────────────────────────────────────── */}
        <div className="space-y-4 lg:col-span-2">
          <div
            className={`card flex flex-col items-center justify-center gap-2 border-2 border-dashed p-8 text-center transition-colors ${
              dragging ? 'border-indigo-500 bg-indigo-500/5' : 'border-line'
            }`}
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              const f = e.dataTransfer.files?.[0]
              if (f) readFile(f)
            }}
          >
            <IcoExcel className="h-8 w-8 text-faint" />
            <p className="text-sm font-medium text-fg">Excel faylni shu yerga tashlang</p>
            <p className="max-w-md text-xs text-muted">
              .xlsx yoki .xls fayl. Ustunlar sarlavhasi bo'yicha o'qiladi — tartibini o'zgartirsangiz ham
              ishlaydi. Namuna uchun yuqoridagi «Bo'sh shablon» tugmasidan foydalaning.
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) readFile(f)
              }}
            />
            <button className="btn-soft mt-1" onClick={() => inputRef.current?.click()} disabled={busy}>
              <IcoUpload className="h-4 w-4" /> {busy ? "O'qilmoqda..." : 'Fayl tanlash'}
            </button>
            {fileName && <p className="text-[11px] text-faint">{fileName}</p>}
          </div>

          {/* ── Ko'rib chiqish ─────────────────────────────────────────── */}
          {preview && (
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between border-b border-line bg-raised px-4 py-2.5">
                <h2 className="text-sm font-semibold text-fg-2">Fayl mazmuni</h2>
                <button className="btn-icon" onClick={() => setPreview(null)} title="Bekor qilish">
                  <IcoClose className="h-4 w-4" />
                </button>
              </div>

              {preview.errors.length > 0 && (
                <ul className="space-y-1 border-b border-line bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
                  {preview.errors.map((e, i) => (
                    <li key={i} className="flex gap-2">
                      <IcoError className="mt-0.5 h-4 w-4 shrink-0" />
                      {e}
                    </li>
                  ))}
                </ul>
              )}

              {preview.errors.length === 0 && (
                <>
                  <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-4">
                    <Stat label="O'qituvchi" value={preview.imported.length} tone="indigo"
                      hint={`${preview.imported.filter((r) => r.status === 'new').length} ta yangi`} />
                    <Stat label="Dars qatori" value={preview.rowsRead} />
                    <Stat label="Jami soat" value={preview.totalHours}
                      hint={`${formatStavka(preview.totalHours, settings.stavkaHours)} stavka`} />
                    <Stat label="Ogohlantirish" value={preview.warnings.length}
                      tone={preview.warnings.length ? 'amber' : 'emerald'} />
                  </div>

                  {preview.newClasses.length > 0 && (
                    <div className="mx-4 mb-3 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-xs text-indigo-700 dark:text-indigo-300">
                      Faylda bazada yo'q {preview.newClasses.length} ta sinf bor — ular qo'shiladi:{' '}
                      {preview.newClasses.map((c) => `${c.grade}-${c.letter}`).join(', ')}
                    </div>
                  )}

                  {preview.missing.length > 0 && (
                    <div className="mx-4 mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                      Bazada bor, lekin faylda yo'q {preview.missing.length} ta o'qituvchi:{' '}
                      {preview.missing.slice(0, 8).map((t) => t.fullName).join(', ')}
                      {preview.missing.length > 8 && ` va yana ${preview.missing.length - 8} ta`}
                    </div>
                  )}

                  {/* O'qituvchilar jadvali */}
                  <div className="max-h-96 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 z-10 bg-raised">
                        <tr>
                          <th className="th text-left">F.I.Sh.</th>
                          <th className="th text-left">Toifa</th>
                          <th className="th text-left">Mutaxassislik</th>
                          <th className="th text-left">Fanlar</th>
                          <th className="th text-right">Soat</th>
                          <th className="th text-right">Stavka</th>
                          <th className="th text-left">Rahbarlik</th>
                          <th className="th text-left">Bo'sh kun</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sorted.map(({ teacher: t, status, hours }) => {
                          const over = hours > t.maxHours
                          const under = hours > 0 && hours < t.minHours
                          return (
                            <tr key={t.id} className="border-t border-line-soft">
                              <td className="td">
                                <span className="flex items-center gap-1.5">
                                  {t.fullName}
                                  {status === 'new' && <span className="badge tint-emerald">yangi</span>}
                                </span>
                              </td>
                              <td className="td">
                                <span className={`badge ${CAT_TINT[t.category ?? 'yoq']}`}>
                                  {CATEGORY_LABELS[t.category ?? 'yoq']}
                                </span>
                              </td>
                              <td className="td text-muted">{t.speciality || '—'}</td>
                              <td className="td max-w-[16rem] truncate text-xs text-muted"
                                title={t.subjectIds.map((id) => SUBJECT_BY_ID[id]?.name ?? id).join(', ')}>
                                {t.subjectIds.map((id) => SUBJECT_BY_ID[id]?.short ?? id).join(', ') || '—'}
                              </td>
                              <td className={`td text-right font-medium ${
                                over ? 'text-rose-600 dark:text-rose-400' : under ? 'text-amber-600 dark:text-amber-400' : ''
                              }`}>
                                {hours}
                              </td>
                              <td className="td text-right text-xs text-muted">
                                {formatStavka(hours, settings.stavkaHours)}
                              </td>
                              <td className="td text-xs">{t.homeroomClassId ?? '—'}</td>
                              <td className="td text-xs text-muted">
                                {(t.unavailableDays ?? []).map((d) => DAY_NAMES[d]?.slice(0, 3)).join(', ') || '—'}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {preview.warnings.length > 0 && (
                    <details className="border-t border-line px-4 py-3">
                      <summary className="flex cursor-pointer items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                        <IcoWarn className="h-4 w-4" /> Ogohlantirishlar ({preview.warnings.length})
                      </summary>
                      <ul className="mt-2 max-h-48 list-disc space-y-0.5 overflow-y-auto pl-5 text-xs text-muted">
                        {preview.warnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </details>
                  )}

                  {/* Qo'llash */}
                  <div className="space-y-2 border-t border-line bg-raised p-4">
                    <label className="flex cursor-pointer items-start gap-2 text-sm">
                      <input type="checkbox" className="mt-0.5 accent-indigo-600" checked={removeMissing}
                        onChange={(e) => setRemoveMissing(e.target.checked)} />
                      <span>
                        Faqat fayldagi o'qituvchilar qolsin
                        <span className="block text-xs text-muted">
                          Belgilanmasa, bazadagi eski o'qituvchilar ham saqlanadi.
                        </span>
                      </span>
                    </label>
                    <label className="flex cursor-pointer items-start gap-2 text-sm">
                      <input type="checkbox" className="mt-0.5 accent-indigo-600" checked={exactPlan}
                        onChange={(e) => setExactPlan(e.target.checked)} />
                      <span>
                        Sinf o'quv rejasi aynan fayl bo'yicha bo'lsin
                        <span className="block text-xs text-muted">
                          Faylda ko'rsatilmagan fanlar o'sha sinfda 0 soat bo'ladi — jadval faylga
                          to'liq mos tushadi.
                        </span>
                      </span>
                    </label>
                    <button className="btn-primary mt-1 w-full py-2" onClick={apply}>
                      <IcoOk className="h-4 w-4" /> Qo'llash
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {!preview && !applied && <Empty text="Fayl yuklanmagan." />}
        </div>

        {/* ── Yo'riqnoma ────────────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="mb-2 font-semibold text-fg">Fayl tuzilishi</h2>
            <p className="mb-3 text-xs text-muted">
              Yuklab olingan kitobda 4 ta varaq bo'ladi. Import ham shu varaqlarni izlaydi.
            </p>
            <ul className="space-y-2.5 text-sm">
              {[
                [SHEETS.teachers, "F.I.Sh., toifa, mutaxassislik, o'qitadigan fanlar, min/max soat, sinf rahbarligi, bo'sh kunlar."],
                [SHEETS.tarif, "Har bir qator — bitta o'qituvchining bitta sinfdagi bitta fani va haftalik soati."],
                [SHEETS.classes, 'Sinflar, sinf rahbari va haftalik soat.'],
                [SHEETS.ref, "To'ldirish qoidalari, fanlar va toifalar ro'yxati."],
              ].map(([name, desc]) => (
                <li key={name}>
                  <div className="font-medium text-fg-2">{name}</div>
                  <div className="text-xs text-muted">{desc}</div>
                </li>
              ))}
            </ul>
          </div>

          <div className="card p-5">
            <h2 className="mb-2 font-semibold text-fg">Qanday ishlaydi</h2>
            <ol className="space-y-2 text-sm text-fg-2">
              {[
                'Joriy ma\'lumotni Excelga yuklab oling (yoki bo\'sh shablonni oling).',
                "Excelda o'qituvchilarni, toifalarini va tarifikatsiyani to'ldiring.",
                'Faylni shu yerga qaytarib yuklang — mazmuni tekshirilib ko\'rsatiladi.',
                "«Qo'llash» tugmasidan so'ng «Jadval yaratish» bo'limida jadval tuziladi.",
              ].map((t, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-indigo-500/15 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300">
                    {i + 1}
                  </span>
                  <span>{t}</span>
                </li>
              ))}
            </ol>
            <p className="mt-3 rounded-lg border border-line bg-raised px-3 py-2 text-xs text-muted">
              Fayldagi soatlar sinf o'quv rejasiga yoziladi, o'qituvchilar esa tarifikatsiyaga
              biriktiriladi. Shu sababli jadval tuzilganda hech qanday avtomatik taqsimot
              ishlamaydi — hammasi fayldagidek qoladi.
            </p>
          </div>
        </div>
      </div>
    </Page>
  )
}
