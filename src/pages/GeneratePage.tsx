import { useMemo, useRef, useState } from 'react'
import { IcoRerun, IcoPlay, IcoUnlock, IcoStop } from '../components/icons'
import { useStore } from '../store'
import { Field, Page, PageHeader, Stat } from '../components/ui'
import { buildUnitsForClass } from '../lib/derive'
import { resolveTeacherConstraints, describeRule } from '../lib/rules'
import { autoAssign } from '../scheduler/assign'
import { validateSchedule } from '../scheduler/validate'
import type { LessonUnit, Placement } from '../types'
import type { WorkerResponse } from '../scheduler/worker'
import type { SolveOutput } from '../scheduler/solver'
import { DAY_NAMES } from '../types'
import { SUBJECT_BY_ID } from '../data/curriculum'

type Mode = 'full' | 'incremental'

interface DiffRow {
  classId: string
  label: string
  from: string
  to: string
}

export default function GeneratePage() {
  const store = useStore()
  const {
    classes, teachers, overrides, assignments, settings, rules, lockedUnitIds, scheduleStale,
    setSettings, setSchedule, setAssignments, clearLocks,
  } = store

  const [running, setRunning] = useState(false)
  const [pct, setPct] = useState(0)
  const [cost, setCost] = useState(0)
  const [log, setLog] = useState<string[]>([])
  const [lastResult, setLastResult] = useState<SolveOutput | null>(null)
  const [diff, setDiff] = useState<DiffRow[] | null>(null)
  const workerRef = useRef<Worker | null>(null)

  const constraints = useMemo(() => resolveTeacherConstraints(teachers, rules, settings.pedagogicalDays), [teachers, rules, settings.pedagogicalDays])
  const activeRules = useMemo(() => rules.filter((r) => r.active && r.kind !== 'note'), [rules])

  const { units, problems } = useMemo(() => {
    const all: LessonUnit[] = []
    const probs: string[] = []
    for (const c of classes) {
      const r = buildUnitsForClass(c, overrides, assignments)
      all.push(...r.units)
      probs.push(...r.problems)
    }
    return { units: all, problems: probs }
  }, [classes, overrides, assignments])

  const capacity = useMemo(() => {
    let cap = 0
    for (const c of classes) {
      const days = c.grade <= 4 ? settings.daysPrimary : settings.daysSenior
      cap += days * (settings.maxPerDayByGrade[c.grade] ?? 6)
    }
    return { need: units.length, cap }
  }, [classes, units, settings])

  const start = (mode: Mode) => {
    if (running) return
    setRunning(true)
    setPct(0)
    setLog([])
    setDiff(null)
    setLastResult(null)

    let asg = assignments
    if (problems.length > 0) {
      const r = autoAssign(classes, teachers, overrides, assignments, true, settings.seed,
      constraints,
      settings.stavkaHours,
    )
      asg = r.assignments
      setAssignments(r.assignments)
      setLog((l) => [...l, `Tarifikatsiya avtomatik to'ldirildi (${r.problems.length} muammo).`])
    }

    const allUnits: LessonUnit[] = []
    for (const c of classes) allUnits.push(...buildUnitsForClass(c, overrides, asg).units)

    const prev = store.schedule
    const baseline = mode === 'incremental' ? prev?.placements : undefined
    const prevMap = new Map((prev?.placements ?? []).map((p) => [p.unitId, p]))
    const prevUnits = new Map((prev?.units ?? []).map((u) => [u.id, u]))

    const worker = new Worker(new URL('../scheduler/worker.ts', import.meta.url), { type: 'module' })
    workerRef.current = worker

    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data
      if (msg.type === 'progress') {
        setPct(msg.pct)
        setCost(msg.cost)
      } else if (msg.type === 'done') {
        setLastResult(msg.result)
        setSchedule({
          units: allUnits,
          placements: msg.result.placements,
          createdAt: Date.now(),
          stats: msg.result.stats,
        })
        if (mode === 'incremental' && prev) setDiff(computeDiff(prevMap, prevUnits, msg.result.placements, allUnits))
        setLog((l) => [
          ...l,
          ...msg.result.notes,
          `Tugadi: ${msg.result.stats.message}. Vaqt: ${(msg.result.stats.durationMs / 1000).toFixed(1)} s.`,
        ])
        setRunning(false)
        worker.terminate()
      } else if (msg.type === 'error') {
        setLog((l) => [...l, 'Xatolik: ' + msg.message])
        setRunning(false)
        worker.terminate()
      }
    }

    worker.postMessage({
      type: 'solve',
      payload: {
        classes,
        teachers,
        units: allUnits,
        settings,
        baseline,
        lockedUnitIds: mode === 'incremental' ? lockedUnitIds : [],
        teacherConstraints: constraints,
      },
    })
  }

  const stop = () => {
    workerRef.current?.terminate()
    setRunning(false)
    setLog((l) => [...l, "To'xtatildi."])
  }

  const report = useMemo(() => {
    if (!store.schedule) return null
    return validateSchedule({
      classes,
      teachers,
      units: store.schedule.units,
      placements: store.schedule.placements,
      settings,
      ov: overrides,
      teacherConstraints: constraints,
    })
  }, [store.schedule, classes, teachers, settings, overrides, constraints])

  const hasSchedule = !!store.schedule

  return (
    <Page>
      <PageHeader
        title="Jadval yaratish"
        subtitle="Cheklovli optimallashtirish algoritmi (simulated annealing) barcha qoidalarni bir vaqtda hisobga olib jadval tuzadi."
      />

      {hasSchedule && scheduleStale && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300">
          <span>
            <b>Ma'lumot o'zgardi.</b> Jadval eskirdi. «Qayta hisoblash» tugmasi mavjud jadvalni asos qilib oladi va
            faqat zarur o'zgarishlarni kiritadi.
          </span>
          <button className="btn-primary shrink-0" onClick={() => start('incremental')} disabled={running}>
            <IcoRerun className="h-4 w-4" /> Qayta hisoblash (minimal o'zgarish)
          </button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* Cheklovlar */}
          <div className="card p-5">
            <h2 className="mb-3 font-semibold text-fg">Cheklovlar</h2>
            <ul className="space-y-1.5 text-sm text-fg-2">
              {[
                ['Qattiq', "O'qituvchi bir vaqtda ikki sinfda dars bera olmaydi"],
                ['Qattiq', "Sinf jadvalida bo'shliq (oyna) bo'lmaydi — darslar 1-soatdan ketma-ket"],
                ['Qattiq', `O'qituvchida kuniga ko'pi bilan ${settings.maxTeacherGapPerDay} ta oyna`],
                ['Qattiq', "O'qituvchining bo'sh kun / bo'sh soat shartlari"],
                ['Qattiq', `1–4 sinf ${settings.daysPrimary} kunlik, 5-sinfdan yuqorisi ${settings.daysSenior} kunlik`],
                ['Qattiq', 'Qulflangan darslar joyidan qo‘zg‘almaydi'],
                ['Yumshoq', 'Bir fan bir kunda faqat bir marta (soat kunlar sonidan ko‘p bo‘lsa — istisno)'],
                ['Yumshoq', "Og'ir fanlar (matematika, fizika, kimyo) kunning boshiga yaqin"],
                ['Yumshoq', 'Jismoniy tarbiya birinchi soatga qo‘yilmaydi'],
                ['Yumshoq', 'Mavjud jadvalni saqlash (barqarorlik)'],
              ].map(([k, v], i) => (
                <li key={i} className="flex gap-2">
                  <span
                    className={`badge shrink-0 ${
                      k === 'Qattiq' ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300' : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                    }`}
                  >
                    {k}
                  </span>
                  <span>{v}</span>
                </li>
              ))}
            </ul>

            {activeRules.length > 0 && (
              <div className="mt-4 rounded-lg border border-indigo-500/30 bg-indigo-500/10 p-3">
                <div className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                  Qo'shimcha shartlar ({activeRules.length})
                </div>
                <ul className="mt-1 max-h-32 space-y-0.5 overflow-y-auto text-xs text-indigo-700/90 dark:text-indigo-300/80">
                  {activeRules.map((r) => (
                    <li key={r.id}>
                      • {describeRule(r, teachers.find((t) => t.id === r.teacherId)?.fullName)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Sozlamalar */}
          <div className="card p-5">
            <h2 className="mb-3 font-semibold text-fg">Sozlamalar</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="1–4 sinf o'quv kunlari">
                <input type="number" min={4} max={6} className="input" value={settings.daysPrimary}
                  onChange={(e) => setSettings({ daysPrimary: +e.target.value })} />
              </Field>
              <Field label="5-sinfdan yuqori o'quv kunlari">
                <input type="number" min={4} max={6} className="input" value={settings.daysSenior}
                  onChange={(e) => setSettings({ daysSenior: +e.target.value })} />
              </Field>
              <Field label="O'qituvchi oynasi (kuniga)">
                <input type="number" min={0} max={4} className="input" value={settings.maxTeacherGapPerDay}
                  onChange={(e) => setSettings({ maxTeacherGapPerDay: +e.target.value })} />
              </Field>
              <Field label="O'qituvchining kunlik maks. soati">
                <input type="number" min={2} max={10} className="input" value={settings.maxTeacherLessonsPerDay}
                  onChange={(e) => setSettings({ maxTeacherLessonsPerDay: +e.target.value })} />
              </Field>
              <Field label="Iteratsiyalar" hint="Ko'proq = sifatliroq, sekinroq">
                <input type="number" step={50000} min={10000} max={5000000} className="input"
                  value={settings.solverIterations}
                  onChange={(e) => setSettings({ solverIterations: +e.target.value })} />
              </Field>
              <Field label="Tasodifiy urug' (seed)" hint="Boshqa variant uchun o'zgartiring">
                <input type="number" className="input" value={settings.seed}
                  onChange={(e) => setSettings({ seed: +e.target.value })} />
              </Field>
              <Field label="1 stavka (soat)" hint="Tarifikatsiyada toifa bo'yicha taqsimlash uchun">
                <input type="number" min={1} max={40} className="input" value={settings.stavkaHours}
                  onChange={(e) => setSettings({ stavkaHours: +e.target.value })} />
              </Field>
            </div>

            <div className="mt-4">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-medium text-fg-2">
                  Barqarorlik — mavjud jadvalni saqlash kuchi
                </span>
                <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">{settings.stabilityWeight}</span>
              </div>
              <input
                type="range"
                min={0}
                max={200}
                step={5}
                className="mt-1 w-full accent-indigo-600"
                value={settings.stabilityWeight}
                onChange={(e) => setSettings({ stabilityWeight: +e.target.value })}
              />
              <div className="flex justify-between text-[11px] text-faint">
                <span>0 — erkin qayta tuzish</span>
                <span>200 — faqat zarur o'zgarish</span>
              </div>
            </div>

            <div className="mt-4">
              <div className="mb-1.5 text-xs font-medium text-fg-2">Kunlik maksimal dars soati (sinf bo'yicha)</div>
              <div className="flex flex-wrap gap-1.5">
                {Object.keys(settings.maxPerDayByGrade).map(Number).sort((a, b) => a - b).map((g) => (
                  <label key={g} className="flex items-center gap-1 rounded-lg border border-line px-2 py-1">
                    <span className="text-xs text-muted">{g}-sinf</span>
                    <input type="number" min={3} max={9}
                      className="w-12 rounded border border-line px-1 py-0.5 text-center text-sm"
                      value={settings.maxPerDayByGrade[g]}
                      onChange={(e) =>
                        setSettings({ maxPerDayByGrade: { ...settings.maxPerDayByGrade, [g]: +e.target.value } })
                      } />
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* O'zgarishlar farqi */}
          {diff && (
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between border-b border-line bg-raised px-4 py-2">
                <h2 className="text-sm font-semibold text-fg-2">Nima o'zgardi</h2>
                <span className={`badge ${diff.length === 0 ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300'}`}>
                  {diff.length} ta dars ko'chdi
                </span>
              </div>
              {diff.length === 0 ? (
                <p className="p-4 text-sm text-muted">
                  Jadvalda birorta ham dars o'z o'rnidan qo'zg'almadi — yangi shartlar mavjud jadvalga to'liq mos keldi.
                </p>
              ) : (
                <ul className="max-h-72 divide-y divide-line-soft overflow-y-auto text-sm">
                  {diff.map((d, i) => (
                    <li key={i} className="flex items-center gap-2 px-4 py-1.5">
                      <span className="w-12 shrink-0 font-semibold text-fg-2">{d.classId}</span>
                      <span className="flex-1 text-fg-2">{d.label}</span>
                      <span className="text-xs text-faint line-through">{d.from}</span>
                      <span className="text-xs">→</span>
                      <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">{d.to}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Ishga tushirish */}
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="mb-3 font-semibold text-fg">Ishga tushirish</h2>
            <div className="space-y-2 text-sm">
              <Row label="Sinflar" value={classes.length} />
              <Row label="O'qituvchilar" value={teachers.length} />
              <Row label="Joylanadigan darslar" value={units.length} />
              <Row label="Jadval sig'imi" value={`${capacity.need} / ${capacity.cap}`} warn={capacity.need > capacity.cap} />
              <Row label="Faol shartlar" value={activeRules.length} />
              <Row label="Qulflangan darslar" value={lockedUnitIds.length} />
              <Row label="Biriktirilmagan" value={problems.length} warn={problems.length > 0} />
            </div>

            {problems.length > 0 && (
              <details className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">
                <summary className="cursor-pointer">Biriktirilmagan fanlar ({problems.length})</summary>
                <ul className="mt-1 max-h-32 list-disc overflow-y-auto pl-4">
                  {problems.slice(0, 60).map((p, i) => (<li key={i}>{p}</li>))}
                </ul>
                <p className="mt-1">Ishga tushirishda avtomatik tarifikatsiya bajariladi.</p>
              </details>
            )}

            <button
              className="btn-primary mt-4 w-full py-2"
              onClick={() => start('incremental')}
              disabled={running || units.length === 0 || !hasSchedule}
              title={!hasSchedule ? 'Avval jadval yarating' : undefined}
            >
              {running ? (
                'Hisoblanmoqda...'
              ) : (
                <>
                  <IcoRerun className="h-4 w-4" /> Qayta hisoblash (minimal o'zgarish)
                </>
              )}
            </button>
            <button
              className="btn-ghost mt-2 w-full py-2"
              onClick={() => {
                if (hasSchedule && !confirm("Jadval butunlay yangidan tuziladi. Barcha joylashuvlar o'zgarishi mumkin. Davom etilsinmi?")) return
                start('full')
              }}
              disabled={running || units.length === 0}
            >
              <IcoPlay className="h-3.5 w-3.5" /> Yangidan yaratish
            </button>

            {lockedUnitIds.length > 0 && (
              <button className="btn-ghost mt-2 w-full text-xs" onClick={clearLocks}>
                <IcoUnlock className="h-3.5 w-3.5" /> {lockedUnitIds.length} ta qulfni bo'shatish
              </button>
            )}

            {running && (
              <>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-line">
                  <div className="h-full bg-indigo-500/100 transition-all" style={{ width: `${Math.round(pct * 100)}%` }} />
                </div>
                <div className="mt-1 flex justify-between text-xs text-muted">
                  <span>{Math.round(pct * 100)}%</span>
                  <span>jarima: {Math.round(cost)}</span>
                </div>
                <button className="btn-ghost mt-2 w-full" onClick={stop}>
                  <IcoStop className="h-3.5 w-3.5" /> To'xtatish
                </button>
              </>
            )}
          </div>

          {report && (
            <div className="card p-5">
              <h2 className="mb-3 font-semibold text-fg">Natija</h2>
              <div className="grid grid-cols-2 gap-2">
                <Stat label="To'qnashuv" value={report.teacherClashes} tone={report.teacherClashes === 0 ? 'emerald' : 'rose'} />
                <Stat label="Sinf oynasi" value={report.classGaps} tone={report.classGaps === 0 ? 'emerald' : 'rose'} />
                <Stat label="Ortiqcha oyna" value={report.teacherExtraGaps} tone={report.teacherExtraGaps === 0 ? 'emerald' : 'rose'} />
                <Stat label="Xatolar" value={report.errors} tone={report.errors ? 'rose' : 'emerald'} />
              </div>
              {lastResult && (
                <p className="mt-3 text-xs text-muted">
                  {lastResult.stats.iterations.toLocaleString('uz-UZ')} iteratsiya,{' '}
                  {(lastResult.stats.durationMs / 1000).toFixed(1)} soniya
                </p>
              )}
            </div>
          )}

          {log.length > 0 && (
            <div className="card max-h-64 overflow-y-auto p-4 text-xs text-fg-2">
              {log.map((l, i) => (
                <div key={i} className="border-b border-line-soft py-1 last:border-0">{l}</div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Page>
  )
}

function Row({ label, value, warn }: { label: string; value: string | number; warn?: boolean }) {
  return (
    <div className="flex justify-between border-b border-line-soft pb-1">
      <span className="text-muted">{label}</span>
      <span className={`font-medium ${warn ? 'text-rose-600 dark:text-rose-400' : 'text-fg'}`}>{value}</span>
    </div>
  )
}

function computeDiff(
  prevMap: Map<string, Placement>,
  prevUnits: Map<string, LessonUnit>,
  next: Placement[],
  nextUnits: LessonUnit[],
): DiffRow[] {
  const unitById = new Map(nextUnits.map((u) => [u.id, u]))
  const out: DiffRow[] = []
  const where = (p: Placement) => `${DAY_NAMES[p.day]?.slice(0, 3) ?? '?'} ${p.period + 1}-soat`
  for (const p of next) {
    const old = prevMap.get(p.unitId)
    if (!old) continue
    if (old.day === p.day && old.period === p.period) continue
    const u = unitById.get(p.unitId) ?? prevUnits.get(p.unitId)
    if (!u) continue
    out.push({
      classId: u.classId,
      label: u.parts.map((x) => SUBJECT_BY_ID[x.subjectId]?.name ?? x.subjectId).join(' / '),
      from: where(old),
      to: where(p),
    })
  }
  return out.sort((a, b) => a.classId.localeCompare(b.classId))
}
