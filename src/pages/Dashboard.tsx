import { useMemo } from 'react'
import { useStore } from '../store'
import { Page, PageHeader, Stat } from '../components/ui'
import { classTotalHours, teacherLoads } from '../lib/derive'
import { OFFICIAL_TOTALS } from '../data/curriculum'
import type { PageId } from '../App'

export default function Dashboard({ onNavigate }: { onNavigate: (p: PageId) => void }) {
  const { classes, teachers, overrides, assignments, schedule, settings, rules, scheduleStale } = useStore()

  const stats = useMemo(() => {
    const totalHours = classes.reduce((s, c) => s + classTotalHours(c, overrides), 0)
    const loads = teacherLoads(teachers, classes, assignments, overrides)
    const assigned = Object.values(loads).filter((x) => x > 0).length
    const over = teachers.filter((t) => loads[t.id] > t.maxHours).length
    const under = teachers.filter((t) => loads[t.id] > 0 && loads[t.id] < t.minHours).length
    const avg = assigned ? Object.values(loads).reduce((a, b) => a + b, 0) / assigned : 0
    const grades = [...new Set(classes.map((c) => c.grade))].sort((a, b) => a - b)
    return { totalHours, loads, assigned, over, under, avg, grades }
  }, [classes, teachers, overrides, assignments])

  const planDeviation = useMemo(() => {
    const out: { grade: number; actual: number; official: number }[] = []
    for (const g of stats.grades) {
      const cls = classes.find((c) => c.grade === g)!
      out.push({ grade: g, actual: classTotalHours(cls, overrides), official: OFFICIAL_TOTALS[g] ?? 0 })
    }
    return out
  }, [stats.grades, classes, overrides])

  return (
    <Page>
      <PageHeader
        title="Boshqaruv paneli"
        subtitle="Maktab dars jadvalini avtomatik tuzish tizimi. O'zbekiston Respublikasi tayanch o'quv rejasi asosida."
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Sinflar" value={classes.length} hint={`${stats.grades.length} ta daraja`} />
        <Stat label="O'qituvchilar" value={teachers.length} hint={`${stats.assigned} tasiga dars berilgan`} />
        <Stat label="Haftalik dars soati" value={stats.totalHours} hint="barcha sinflar bo'yicha" tone="indigo" />
        <Stat
          label="O'rtacha yuklama"
          value={stats.avg.toFixed(1)}
          hint={`limit ${teachers[0]?.minHours ?? 4}–${teachers[0]?.maxHours ?? 24} soat`}
          tone={stats.over > 0 ? 'rose' : 'emerald'}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <h2 className="font-semibold text-slate-900">Haftalik soatlar — o'quv reja bilan solishtirish</h2>
          <p className="mt-1 text-sm text-slate-500">
            Manba: Maktabgacha va maktab ta'limi vazirining 2026-yil 10-apreldagi 133-son buyrug'i, 1-ilova.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="th">Sinf</th>
                  {planDeviation.map((d) => (
                    <th key={d.grade} className="th text-center">
                      {d.grade}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-100">
                  <td className="td text-slate-500">Standart</td>
                  {planDeviation.map((d) => (
                    <td key={d.grade} className="td text-center text-slate-400">
                      {d.official}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="td font-medium">Maktabda</td>
                  {planDeviation.map((d) => (
                    <td
                      key={d.grade}
                      className={`td text-center font-medium ${
                        d.actual === d.official ? 'text-emerald-600' : 'text-amber-600'
                      }`}
                    >
                      {d.actual}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500">
            <span>
              <b className="text-slate-700">1–4 sinf:</b> {settings.daysPrimary} kunlik o'qish
            </span>
            <span>
              <b className="text-slate-700">5–11 sinf:</b> {settings.daysSenior} kunlik o'qish
            </span>
            <span>
              <b className="text-slate-700">O'qituvchi oynasi:</b> kuniga maks. {settings.maxTeacherGapPerDay}
            </span>
          </div>
        </div>

        <div className="card p-5">
          <h2 className="font-semibold text-slate-900">Keyingi qadam</h2>
          <ol className="mt-3 space-y-2 text-sm">
            {[
              { id: 'classes' as PageId, t: '1. Sinflarni tekshiring', d: `${classes.length} ta sinf kiritilgan` },
              { id: 'teachers' as PageId, t: "2. O'qituvchilarni tekshiring", d: `${teachers.length} ta o'qituvchi` },
              { id: 'curriculum' as PageId, t: "3. O'quv rejani sozlang", d: 'Soatlarni o‘zgartirish mumkin' },
              { id: 'tarif' as PageId, t: '4. Tarifikatsiya', d: `${Object.keys(assignments).length} ta biriktirish` },
              {
                id: 'rules' as PageId,
                t: "5. Qo'shimcha shartlar",
                d: rules.length ? `${rules.length} ta shart kiritilgan` : "Bo'sh kun, aniq soat, izoh...",
              },
              {
                id: 'generate' as PageId,
                t: '6. Jadvalni yarating',
                d: schedule ? (scheduleStale ? 'Eskirgan — qayta hisoblang' : 'Tayyor ✓') : 'Hali bajarilmagan',
              },
            ].map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => onNavigate(s.id)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-left transition hover:border-indigo-300 hover:bg-indigo-50/40"
                >
                  <div className="font-medium text-slate-800">{s.t}</div>
                  <div className="text-xs text-slate-500">{s.d}</div>
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {(stats.over > 0 || stats.under > 0) && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {stats.over > 0 && <div>{stats.over} ta o'qituvchining yuklamasi maksimal chegaradan oshgan.</div>}
          {stats.under > 0 && <div>{stats.under} ta o'qituvchining yuklamasi minimal chegaradan kam.</div>}
        </div>
      )}
    </Page>
  )
}
