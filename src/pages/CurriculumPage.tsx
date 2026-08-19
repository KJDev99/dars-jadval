import { Fragment, useMemo } from 'react'
import { useStore } from '../store'
import { Page, PageHeader } from '../components/ui'
import { EXTRA_SUBJECTS, OFFICIAL_TOTALS, PLAN_SUBJECTS, SUBJECTS, YONALISHLAR, standardHours } from '../data/curriculum'
import { gradeHours } from '../lib/derive'

export default function CurriculumPage() {
  const { classes, overrides, setGradeHours, resetGradePlan, resetAllPlan } = useStore()

  const grades = useMemo(
    () => [...new Set(classes.map((c) => c.grade))].sort((a, b) => a - b),
    [classes],
  )

  const totals = useMemo(() => {
    const t: Record<number, number> = {}
    for (const g of grades) t[g] = PLAN_SUBJECTS.reduce((s, sub) => s + gradeHours(g, sub.id, overrides), 0)
    return t
  }, [grades, overrides])

  const yonalishTotal = (y: string, g: number) =>
    PLAN_SUBJECTS.filter((s) => s.yonalish === y).reduce((sum, s) => sum + gradeHours(g, s.id, overrides), 0)

  const extraTotal = (g: number) =>
    EXTRA_SUBJECTS.reduce((sum, s) => sum + gradeHours(g, s.id, overrides), 0)

  const changed = Object.keys(overrides.byGrade).length > 0

  return (
    <Page>
      <PageHeader
        title="O'quv reja (tayanch o'quv reja)"
        subtitle={
          <>
            O'zbekiston Respublikasi Maktabgacha va maktab ta'limi vazirining{' '}
            <b>2026-yil 10-apreldagi 133-son buyrug'i</b>, 1-ilova asosida. Har bir katakni bosib soatni
            o'zgartirish mumkin — o'zgartirilgan kataklar ko'k rangda belgilanadi. Ma'naviyat soati
            tayanch rejadan tashqarida bo'lib, uni har doim sinf rahbari o'z sinfida o'tadi.
          </>
        }
        actions={
          <>
            {changed && (
              <button
                className="btn-danger"
                onClick={() => {
                  if (confirm("Barcha o'zgartirishlar bekor qilinib, standart rejaga qaytarilsinmi?")) resetAllPlan()
                }}
              >
                Standartga qaytarish
              </button>
            )}
          </>
        }
      />

      <div className="card overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-surface">
            <tr className="border-b-2 border-line">
              <th className="th sticky left-0 z-10 bg-surface">Fan</th>
              {grades.map((g) => (
                <th key={g} className="th w-16 text-center">
                  {g}
                </th>
              ))}
              <th className="th w-16 text-center">Jami</th>
            </tr>
          </thead>
          <tbody>
            {YONALISHLAR.map((y) => {
              const subjects = PLAN_SUBJECTS.filter((s) => s.yonalish === y)
              if (subjects.length === 0) return null
              return (
                <Fragment key={y}>
                  <tr className="bg-raised">
                    <td className="sticky left-0 z-10 bg-raised px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                      {y}
                    </td>
                    {grades.map((g) => (
                      <td key={g} className="px-1 py-1.5 text-center text-xs font-semibold text-muted">
                        {yonalishTotal(y, g) || ''}
                      </td>
                    ))}
                    <td className="px-1 py-1.5 text-center text-xs font-semibold text-muted">
                      {grades.reduce((s, g) => s + yonalishTotal(y, g), 0)}
                    </td>
                  </tr>
                  {subjects.map((s) => {
                    const rowTotal = grades.reduce((sum, g) => sum + gradeHours(g, s.id, overrides), 0)
                    return (
                      <tr key={s.id} className="border-b border-line-soft hover:bg-indigo-500/10/30">
                        <td className="sticky left-0 z-10 bg-surface px-2.5 py-1 text-fg-2">
                          <span className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.color }} />
                            {s.name}
                          </span>
                        </td>
                        {grades.map((g) => {
                          const v = gradeHours(g, s.id, overrides)
                          const std = standardHours(g, s.id)
                          const isOverride = overrides.byGrade[g]?.[s.id] !== undefined
                          return (
                            <td key={g} className="p-0.5 text-center">
                              <input
                                type="number"
                                step={0.5}
                                min={0}
                                max={12}
                                value={v || ''}
                                placeholder="—"
                                title={isOverride ? `Standart: ${std}` : undefined}
                                onChange={(e) =>
                                  setGradeHours(g, s.id, e.target.value === '' ? 0 : +e.target.value)
                                }
                                className={`w-full rounded border px-0.5 py-1 text-center text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 ${
                                  isOverride
                                    ? 'border-indigo-500/40 bg-indigo-500/10 font-semibold text-indigo-700 dark:text-indigo-300'
                                    : v
                                      ? 'border-transparent text-fg-2 hover:border-line'
                                      : 'border-transparent text-faint hover:border-line'
                                }`}
                              />
                            </td>
                          )
                        })}
                        <td className="px-1 text-center text-xs font-medium text-muted">{rowTotal || ''}</td>
                      </tr>
                    )
                  })}
                </Fragment>
              )
            })}
            {/* Reja tashqarisidagi fanlar */}
            <tr className="bg-teal-500/10">
              <td className="sticky left-0 z-10 bg-teal-500/10 px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-300">
                Reja tashqarisi
              </td>
              {grades.map((g) => (
                <td key={g} className="px-1 py-1.5 text-center text-xs font-semibold text-teal-700 dark:text-teal-300">
                  {extraTotal(g) || ''}
                </td>
              ))}
              <td className="px-1 py-1.5 text-center text-xs font-semibold text-teal-700 dark:text-teal-300">
                {grades.reduce((s, g) => s + extraTotal(g), 0)}
              </td>
            </tr>
            {EXTRA_SUBJECTS.map((s) => (
              <tr key={s.id} className="border-b border-line-soft hover:bg-indigo-500/[0.07]">
                <td className="sticky left-0 z-10 bg-surface px-2.5 py-1 text-fg-2">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.color }} />
                    {s.name}
                    <span className="badge tint-slate">sinf rahbari</span>
                  </span>
                </td>
                {grades.map((g) => (
                  <td key={g} className="p-0.5 text-center">
                    <input
                      type="number"
                      step={1}
                      min={0}
                      max={4}
                      value={gradeHours(g, s.id, overrides) || ''}
                      placeholder="—"
                      onChange={(e) => setGradeHours(g, s.id, e.target.value === '' ? 0 : +e.target.value)}
                      className="w-full rounded border border-transparent px-0.5 py-1 text-center text-sm text-fg-2 outline-none hover:border-line focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20"
                    />
                  </td>
                ))}
                <td className="px-1 text-center text-xs font-medium text-muted">
                  {grades.reduce((sum, g) => sum + gradeHours(g, s.id, overrides), 0)}
                </td>
              </tr>
            ))}

            <tr className="border-t-2 border-line-strong bg-raised">
              <td className="sticky left-0 z-10 bg-raised px-2.5 py-2 font-semibold">Reja bo'yicha jami</td>
              {grades.map((g) => {
                const ok = totals[g] === OFFICIAL_TOTALS[g]
                return (
                  <td
                    key={g}
                    className={`px-1 py-2 text-center font-semibold ${ok ? 'text-fg' : 'text-amber-600 dark:text-amber-400'}`}
                    title={ok ? 'Standartga mos' : `Standart: ${OFFICIAL_TOTALS[g]}`}
                  >
                    {totals[g]}
                  </td>
                )
              })}
              <td className="px-1 py-2 text-center font-semibold">
                {grades.reduce((s, g) => s + totals[g], 0)}
              </td>
            </tr>
            <tr className="text-xs text-faint">
              <td className="sticky left-0 z-10 bg-surface px-2.5 py-1">Rasmiy standart</td>
              {grades.map((g) => (
                <td key={g} className="px-1 py-1 text-center">
                  {OFFICIAL_TOTALS[g]}
                </td>
              ))}
              <td className="px-1 py-1 text-center">
                {grades.reduce((s, g) => s + (OFFICIAL_TOTALS[g] ?? 0), 0)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {grades.map((g) => (
          <button
            key={g}
            className="btn-ghost text-xs"
            disabled={!overrides.byGrade[g]}
            onClick={() => resetGradePlan(g)}
          >
            {g}-sinfni standartga qaytarish
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-3 text-sm md:grid-cols-2">
        <div className="card p-4">
          <h3 className="font-semibold text-fg">0,5 soatlik fanlar</h3>
          <p className="mt-1 text-muted">
            8- va 9-sinflarda Geografiya 1,5 soat va Iqtisodiy bilim asoslari 0,5 soat. Tizim ularni
            <b> juft/toq hafta</b> tamoyili bo'yicha bitta katakka joylaydi: toq haftada Geografiya,
            juft haftada Iqtisodiy bilim asoslari.
          </p>
        </div>
        <div className="card p-4">
          <h3 className="font-semibold text-fg">O'zgartirish qoidasi</h3>
          <p className="mt-1 text-muted">
            Soatni o'zgartirsangiz, sinf haftalik jami soati ham o'zgaradi. Sanitariya normalariga rioya
            qilish uchun jami soat rasmiy standartdan sezilarli farq qilmasligi tavsiya etiladi.
          </p>
        </div>
      </div>
    </Page>
  )
}
