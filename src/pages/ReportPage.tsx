import { useMemo, useState } from 'react'
import Select from '../components/Select'
import { useStore } from '../store'
import { Empty, Page, PageHeader, Stat } from '../components/ui'
import { validateSchedule } from '../scheduler/validate'
import { resolveTeacherConstraints } from '../lib/rules'
import type { ViolationLevel } from '../types'

const RULE_LABELS: Record<string, string> = {
  'oqituvchi-toqnashuv': "O'qituvchi to'qnashuvi",
  'sinf-boshliq': "Sinf jadvalidagi bo'shliq",
  'oqituvchi-oyna': "O'qituvchidagi ortiqcha oyna",
  'oqituvchi-kunlik': "O'qituvchining kunlik yuklamasi",
  'kunlik-chegara': 'Sinfning kunlik dars soati',
  'fan-takror': 'Bir fan bir kunda takrorlanishi',
  yuklama: 'Haftalik yuklama chegarasi',
  'soat-mos-emas': "O'quv rejaga mos emas",
  'band-kun': "Bo'sh bo'lishi kerak bo'lgan kunda dars",
  'band-soat': "Bo'sh bo'lishi kerak bo'lgan soatda dars",
  'maqsadli-soat': 'Qoidada belgilangan soat bajarilmagan',
  'oquv-kuni': "O'quv kunlari soni",
  joylashmagan: 'Joylashtirilmagan dars',
}

export default function ReportPage() {
  const { classes, teachers, settings, overrides, schedule, rules } = useStore()
  const [level, setLevel] = useState<ViolationLevel | 'all'>('all')

  const constraints = useMemo(() => resolveTeacherConstraints(teachers, rules, settings.pedagogicalDays), [teachers, rules, settings.pedagogicalDays])

  const report = useMemo(() => {
    if (!schedule) return null
    return validateSchedule({
      classes,
      teachers,
      units: schedule.units,
      placements: schedule.placements,
      settings,
      ov: overrides,
      teacherConstraints: constraints,
    })
  }, [schedule, classes, teachers, settings, overrides, constraints])

  const grouped = useMemo(() => {
    if (!report) return []
    const list = report.violations.filter((v) => level === 'all' || v.level === level)
    const m = new Map<string, typeof list>()
    for (const v of list) {
      if (!m.has(v.rule)) m.set(v.rule, [])
      m.get(v.rule)!.push(v)
    }
    return [...m.entries()]
  }, [report, level])

  if (!schedule || !report) {
    return (
      <Page>
        <PageHeader title="Tekshiruv" />
        <Empty text="Tekshirish uchun avval jadval yarating." />
      </Page>
    )
  }

  const clean = report.errors === 0

  return (
    <Page>
      <PageHeader
        title="Tekshiruv"
        subtitle="Tuzilgan jadval barcha qattiq va yumshoq qoidalarga muvofiqligi mustaqil ravishda qayta tekshiriladi."
        actions={
          <Select
            className="w-48"
            value={level}
            onChange={(v) => setLevel(v as ViolationLevel | 'all')}
            options={[
              { value: 'all', label: 'Barchasi' },
              { value: 'error', label: 'Faqat xatolar' },
              { value: 'warning', label: 'Faqat ogohlantirish' },
              { value: 'info', label: "Faqat ma'lumot" },
            ]}
          />
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Xatolar" value={report.errors} tone={report.errors ? 'rose' : 'emerald'} />
        <Stat label="Ogohlantirish" value={report.warnings} tone={report.warnings ? 'amber' : 'emerald'} />
        <Stat
          label="O'qituvchi to'qnashuvi"
          value={report.teacherClashes}
          tone={report.teacherClashes ? 'rose' : 'emerald'}
        />
        <Stat label="Sinf oynasi" value={report.classGaps} tone={report.classGaps ? 'rose' : 'emerald'} />
        <Stat
          label="Ortiqcha oynalar"
          value={report.teacherExtraGaps}
          tone={report.teacherExtraGaps ? 'rose' : 'emerald'}
        />
      </div>

      {clean && (
        <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-300">
          <b>Jadval qoidalarga to'liq mos.</b> Qattiq cheklovlarning birortasi ham buzilmagan: o'qituvchi
          to'qnashuvi yo'q, sinflar jadvalida bo'shliq yo'q, o'qituvchilarning oynalari belgilangan
          chegaradan oshmagan, haftalik soatlar o'quv rejaga to'liq mos.
        </div>
      )}

      <div className="mt-5 space-y-3">
        {grouped.map(([rule, list]) => (
          <div key={rule} className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-line bg-raised px-4 py-2">
              <h3 className="text-sm font-semibold text-fg-2">{RULE_LABELS[rule] ?? rule}</h3>
              <span
                className={`badge ${
                  list[0].level === 'error'
                    ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                    : list[0].level === 'warning'
                      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                      : 'bg-line-soft text-fg-2'
                }`}
              >
                {list.length} ta
              </span>
            </div>
            <ul className="max-h-72 divide-y divide-line-soft overflow-y-auto">
              {list.slice(0, 200).map((v, i) => (
                <li key={i} className="px-4 py-1.5 text-sm text-fg-2">
                  {v.message}
                </li>
              ))}
              {list.length > 200 && (
                <li className="px-4 py-1.5 text-xs text-faint">... yana {list.length - 200} ta</li>
              )}
            </ul>
          </div>
        ))}
        {grouped.length === 0 && <Empty text="Bu darajada hech qanday holat topilmadi." />}
      </div>
    </Page>
  )
}
