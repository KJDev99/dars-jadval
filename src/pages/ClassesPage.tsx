import { useMemo, useState } from 'react'
import Select from '../components/Select'
import { IcoPlus, IcoTrash, IcoReset } from '../components/icons'
import { useStore } from '../store'
import { Empty, Field, Modal, Page, PageHeader } from '../components/ui'
import { classSubjects, classTotalHours, classPlanHours, classExtraHours } from '../lib/derive'
import { OFFICIAL_TOTALS, SUBJECTS } from '../data/curriculum'
import { CLASS_LETTERS } from '../data/seed'

export default function ClassesPage() {
  const {
    classes, teachers, overrides, settings,
    addClass, removeClass, updateClass, addGradeSet, removeGrade, setClassHours, setHomeroom,
  } = useStore()
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
            <Select
              className="w-28"
              value={String(newGrade)}
              onChange={(v) => setNewGrade(+v)}
              options={Array.from({ length: 11 }, (_, i) => ({ value: String(i + 1), label: `${i + 1}-sinf` }))}
            />
            <Select
              className="w-20"
              value={newLetter}
              onChange={setNewLetter}
              options={CLASS_LETTERS.map((l) => ({ value: l, label: l }))}
            />
            <button className="btn-primary" onClick={() => addClass(newGrade, newLetter)}>
              <IcoPlus className="h-4 w-4" /> Sinf qo'shish
            </button>
          </div>
        }
      />

      {classes.length === 0 && <Empty text="Sinflar yo'q. Yuqoridan sinf qo'shing." />}

      <div className="space-y-3">
        {byGrade.map(([grade, list]) => {
          const days = grade <= 4 ? settings.daysPrimary : settings.daysSenior
          const total = classPlanHours(list[0], overrides)
          const extra = classExtraHours(list[0], overrides)
          const official = OFFICIAL_TOTALS[grade]
          return (
            <div key={grade} className="card p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-baseline gap-3">
                  <h2 className="text-base font-semibold text-fg">{grade}-sinflar</h2>
                  <span className="text-xs text-muted">
                    {list.length} ta sinf · {days} kunlik o'qish · reja bo'yicha {total} soat
                    {official && total !== official && (
                      <span className="ml-1 text-amber-600 dark:text-amber-400">(standart {official})</span>
                    )}
                    {extra > 0 && <span className="ml-1 text-teal-600 dark:text-teal-400">+ {extra} soat Ma'naviyat</span>}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button className="btn-ghost" onClick={() => addGradeSet(grade, 1)}>
                    <IcoPlus className="h-3.5 w-3.5" /> sinf
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

              <div className="grid gap-2 lg:grid-cols-2 2xl:grid-cols-3">
                {list.map((c) => {
                  const hr = teachers.find((t) => t.homeroomClassId === c.id)
                  return (
                    <div
                      key={c.id}
                      className="flex items-center gap-2 rounded-lg border border-line bg-raised px-2.5 py-1.5"
                    >
                      <button
                        className="w-12 shrink-0 text-left text-sm font-semibold text-fg transition-colors hover:text-indigo-600 dark:hover:text-indigo-400"
                        onClick={() => setDetail(c.id)}
                        title="Fan soatlarini ko'rish"
                      >
                        {c.grade}-{c.letter}
                      </button>

                      <input
                        type="number"
                        className="w-12 shrink-0 rounded border border-line bg-surface px-1 py-0.5 text-center text-xs text-muted"
                        value={c.studentsCount ?? ''}
                        title="O'quvchilar soni (ixtiyoriy)"
                        onChange={(e) => updateClass(c.id, { studentsCount: +e.target.value || undefined })}
                      />

                      <Select
                        size="sm"
                        className="min-w-0 flex-1"
                        placeholder="Sinf rahbari…"
                        invalid={!hr}
                        title="Sinf rahbari — o'z sinfida haftada 1 soat Ma'naviyat soatini o'tadi"
                        value={hr?.id ?? ''}
                        onChange={(v) => setHomeroom(c.id, v || null)}
                        emptyLabel="— rahbarsiz —"
                        options={teachers.map((t) => {
                          const busy = t.homeroomClassId && t.homeroomClassId !== c.id
                          return {
                            value: t.id,
                            label: t.fullName,
                            hint: busy ? t.homeroomClassId : undefined,
                            disabled: !!busy,
                            group: t.speciality,
                          }
                        })}
                      />

                      <button
                        className="grid h-6 w-6 shrink-0 place-items-center rounded text-faint transition-colors hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400"
                        onClick={() => removeClass(c.id)}
                        title="O'chirish"
                      >
                        <IcoTrash className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )
                })}
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
            <p className="mb-3 text-sm text-muted">
              Bu yerda faqat shu sinf uchun soatni o'zgartirish mumkin. Bo'sh qoldirilsa daraja bo'yicha
              umumiy reja qo'llaniladi.
            </p>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {classSubjects(detailClass, overrides).map(({ subject, hours }) => {
                const isOverride = overrides.byClass[detailClass.id]?.[subject.id] !== undefined
                return (
                  <div
                    key={subject.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-1.5"
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
                          isOverride ? 'border-indigo-500/60 bg-indigo-500/10 font-medium' : 'border-line'
                        }`}
                        value={hours}
                        onChange={(e) => setClassHours(detailClass.id, subject.id, +e.target.value)}
                      />
                      {isOverride && (
                        <button
                          className="grid h-6 w-6 place-items-center rounded text-faint transition-colors hover:bg-raised hover:text-indigo-600 dark:hover:text-indigo-400"
                          onClick={() => setClassHours(detailClass.id, subject.id, null)}
                          title="Standartga qaytarish"
                        >
                          <IcoReset className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
              <span className="text-sm text-muted">Fanlar soni: {classSubjects(detailClass, overrides).length}</span>
              <span className="text-sm font-semibold">
                Reja {classPlanHours(detailClass, overrides)} + reja tashqarisi{' '}
                {classExtraHours(detailClass, overrides)} = {classTotalHours(detailClass, overrides)} soat
              </span>
            </div>
            <div className="mt-3">
              <details className="text-sm">
                <summary className="cursor-pointer text-muted">Rejada yo'q fanni qo'shish</summary>
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
