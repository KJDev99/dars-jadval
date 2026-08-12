import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { Empty, Field, Modal, Page, PageHeader } from '../components/ui'
import { classSubjects, classTotalHours } from '../lib/derive'
import { OFFICIAL_TOTALS, SUBJECTS } from '../data/curriculum'
import { CLASS_LETTERS } from '../data/seed'

export default function ClassesPage() {
  const { classes, overrides, settings, addClass, removeClass, updateClass, addGradeSet, removeGrade, setClassHours } =
    useStore()
  const [newGrade, setNewGrade] = useState(1)
  const [newLetter, setNewLetter] = useState('A')
  const [detail, setDetail] = useState<string | null>(null)

  const byGrade = useMemo(() => {
    const m = new Map<number, typeof classes>()
    for (const c of classes) {
      if (!m.has(c.grade)) m.set(c.grade, [])
      m.get(c.grade)!.push(c)
    }
    return [...m.entries()].sort((a, b) => a[0] - b[0])
  }, [classes])

  const detailClass = classes.find((c) => c.id === detail)

  return (
    <Page>
      <PageHeader
        title="Sinflar"
        subtitle="Maktabdagi sinflar ro'yxati. Sinf qo'shish yoki o'chirish mumkin. O'quvchilar ro'yxati talab qilinmaydi."
        actions={
          <div className="flex items-center gap-2">
            <select className="input w-24" value={newGrade} onChange={(e) => setNewGrade(+e.target.value)}>
              {Array.from({ length: 11 }, (_, i) => i + 1).map((g) => (
                <option key={g} value={g}>
                  {g}-sinf
                </option>
              ))}
            </select>
            <select className="input w-20" value={newLetter} onChange={(e) => setNewLetter(e.target.value)}>
              {CLASS_LETTERS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
            <button className="btn-primary" onClick={() => addClass(newGrade, newLetter)}>
              + Sinf qo'shish
            </button>
          </div>
        }
      />

      {classes.length === 0 && <Empty text="Sinflar yo'q. Yuqoridan sinf qo'shing." />}

      <div className="space-y-3">
        {byGrade.map(([grade, list]) => {
          const days = grade <= 4 ? settings.daysPrimary : settings.daysSenior
          const total = classTotalHours(list[0], overrides)
          const official = OFFICIAL_TOTALS[grade]
          return (
            <div key={grade} className="card p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-baseline gap-3">
                  <h2 className="text-base font-semibold text-slate-900">{grade}-sinflar</h2>
                  <span className="text-xs text-slate-500">
                    {list.length} ta sinf · {days} kunlik o'qish · haftalik {total} soat
                    {official && total !== official && (
                      <span className="ml-1 text-amber-600">(standart {official})</span>
                    )}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button className="btn-ghost" onClick={() => addGradeSet(grade, 1)}>
                    + sinf
                  </button>
                  <button
                    className="btn-danger"
                    onClick={() => {
                      if (confirm(`${grade}-sinflarning barchasi (${list.length} ta) o'chirilsinmi?`)) removeGrade(grade)
                    }}
                  >
                    Darajani o'chirish
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {list.map((c) => (
                  <div
                    key={c.id}
                    className="group flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-3 pr-1.5"
                  >
                    <button
                      className="text-sm font-medium text-slate-800 hover:text-indigo-600"
                      onClick={() => setDetail(c.id)}
                      title="Fan soatlarini ko'rish"
                    >
                      {c.grade}-{c.letter}
                    </button>
                    <input
                      type="number"
                      className="w-14 rounded border border-slate-200 bg-white px-1 py-0.5 text-center text-xs text-slate-500"
                      value={c.studentsCount ?? ''}
                      title="O'quvchilar soni (ixtiyoriy)"
                      onChange={(e) => updateClass(c.id, { studentsCount: +e.target.value || undefined })}
                    />
                    <button
                      className="rounded px-1.5 text-slate-300 transition hover:bg-rose-50 hover:text-rose-600"
                      onClick={() => removeClass(c.id)}
                      title="O'chirish"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <Modal
        open={!!detailClass}
        onClose={() => setDetail(null)}
        wide
        title={detailClass ? `${detailClass.grade}-${detailClass.letter} sinf — fan soatlari` : ''}
      >
        {detailClass && (
          <>
            <p className="mb-3 text-sm text-slate-500">
              Bu yerda faqat shu sinf uchun soatni o'zgartirish mumkin. Bo'sh qoldirilsa daraja bo'yicha
              umumiy reja qo'llaniladi.
            </p>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {classSubjects(detailClass, overrides).map(({ subject, hours }) => {
                const isOverride = overrides.byClass[detailClass.id]?.[subject.id] !== undefined
                return (
                  <div
                    key={subject.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-1.5"
                  >
                    <span className="flex items-center gap-2 text-sm">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: subject.color }} />
                      {subject.name}
                    </span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step={0.5}
                        min={0}
                        className={`w-16 rounded border px-1.5 py-0.5 text-center text-sm ${
                          isOverride ? 'border-indigo-400 bg-indigo-50 font-medium' : 'border-slate-200'
                        }`}
                        value={hours}
                        onChange={(e) => setClassHours(detailClass.id, subject.id, +e.target.value)}
                      />
                      {isOverride && (
                        <button
                          className="text-xs text-slate-400 hover:text-rose-600"
                          onClick={() => setClassHours(detailClass.id, subject.id, null)}
                          title="Standartga qaytarish"
                        >
                          ↺
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-3">
              <span className="text-sm text-slate-500">Fanlar soni: {classSubjects(detailClass, overrides).length}</span>
              <span className="text-sm font-semibold">
                Haftalik jami: {classTotalHours(detailClass, overrides)} soat
              </span>
            </div>
            <div className="mt-3">
              <details className="text-sm">
                <summary className="cursor-pointer text-slate-500">Rejada yo'q fanni qo'shish</summary>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {SUBJECTS.filter((s) => classSubjects(detailClass, overrides).every((x) => x.subject.id !== s.id)).map(
                    (s) => (
                      <button
                        key={s.id}
                        className="btn-ghost text-xs"
                        onClick={() => setClassHours(detailClass.id, s.id, 1)}
                      >
                        + {s.name}
                      </button>
                    ),
                  )}
                </div>
              </details>
            </div>
          </>
        )}
      </Modal>
    </Page>
  )
}
