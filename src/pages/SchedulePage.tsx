import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { Empty, Page, PageHeader } from '../components/ui'
import { buildIndex, gapsOfDay, teacherWeekHours, weekLabel, type Cell } from '../lib/view'
import { DAY_NAMES, DAY_SHORT } from '../types'
import { exportClassesCsv, exportTeachersCsv } from '../lib/export'

type Mode = 'class' | 'teacher' | 'all'

export default function SchedulePage() {
  const { classes, teachers, settings, schedule, lockedUnitIds, swapPlacements, clearLocks } = useStore()
  const [mode, setMode] = useState<Mode>('class')
  const [selClass, setSelClass] = useState<string>('')
  const [selTeacher, setSelTeacher] = useState<string>('')
  const [picked, setPicked] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)

  const onPick = (unitId: string) => {
    if (!picked) {
      setPicked(unitId)
      setFlash(null)
      return
    }
    if (picked === unitId) {
      setPicked(null)
      return
    }
    swapPlacements(picked, unitId)
    setPicked(null)
    setFlash("Ikki dars o'rni almashtirildi va ikkalasi ham qulflandi.")
    setTimeout(() => setFlash(null), 4000)
  }

  const idx = useMemo(
    () => buildIndex(schedule, classes, teachers, settings),
    [schedule, classes, teachers, settings],
  )

  if (!schedule) {
    return (
      <Page>
        <PageHeader title="Dars jadvali" />
        <Empty text="Jadval hali yaratilmagan. «Jadval yaratish» bo'limiga o'ting." />
      </Page>
    )
  }

  const activeClass = selClass || classes[0]?.id
  const activeTeacher = selTeacher || teachers[0]?.id

  return (
    <Page>
      <PageHeader
        title="Dars jadvali"
        subtitle={`${settings.schoolName} · ${new Date(schedule.createdAt).toLocaleString('uz-UZ')}`}
        actions={
          <>
            <div className="inline-flex overflow-hidden rounded-lg border border-slate-300">
              {(
                [
                  ['class', 'Sinf bo‘yicha'],
                  ['teacher', 'O‘qituvchi bo‘yicha'],
                  ['all', 'Umumiy'],
                ] as [Mode, string][]
              ).map(([m, label]) => (
                <button
                  key={m}
                  className={`px-3 py-1.5 text-sm ${mode === m ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600'}`}
                  onClick={() => setMode(m)}
                >
                  {label}
                </button>
              ))}
            </div>
            <button className="btn-ghost" onClick={() => window.print()}>
              🖨 Chop etish
            </button>
            <button
              className="btn-ghost"
              onClick={() =>
                mode === 'teacher'
                  ? exportTeachersCsv(idx, teachers, settings.schoolName)
                  : exportClassesCsv(idx, classes, settings.schoolName)
              }
            >
              ⤓ CSV
            </button>
          </>
        }
      />

      {mode === 'class' && (
        <>
          <div className="no-print mb-4 flex flex-wrap gap-1.5">
            {classes.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setSelClass(c.id)
                  setPicked(null)
                }}
                className={`rounded-md px-2.5 py-1 text-sm ${
                  activeClass === c.id
                    ? 'bg-indigo-600 text-white'
                    : 'border border-slate-200 bg-white text-slate-600 hover:border-indigo-300'
                }`}
              >
                {c.grade}-{c.letter}
              </button>
            ))}
          </div>

          <div className="no-print mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
            <span>
              <b className="text-slate-800">Qo'lda tahrirlash:</b> ikkita darsni ketma-ket bosing — o'rinlari
              almashadi va ikkalasi qulflanadi.
            </span>
            <span>🔓/🔒 belgisi bilan darsni alohida qulflash mumkin.</span>
            {picked && (
              <span className="rounded bg-indigo-50 px-2 py-0.5 font-medium text-indigo-700">
                1-dars tanlandi — ikkinchisini bosing
                <button className="ml-2 text-indigo-400 hover:text-indigo-700" onClick={() => setPicked(null)}>
                  bekor
                </button>
              </span>
            )}
            {lockedUnitIds.length > 0 && (
              <span className="ml-auto">
                🔒 {lockedUnitIds.length} ta qulflangan
                <button className="ml-2 text-slate-400 underline hover:text-slate-700" onClick={clearLocks}>
                  hammasini bo'shatish
                </button>
              </span>
            )}
          </div>

          {flash && (
            <div className="no-print mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {flash} «Jadval yaratish» bo'limidagi <b>Qayta hisoblash</b> tugmasi qolgan jadvalni shu
              o'zgarishga moslashtiradi.
            </div>
          )}

          {activeClass && <ClassTable classId={activeClass} idx={idx} selected={picked} onPick={onPick} />}
        </>
      )}

      {mode === 'teacher' && (
        <>
          <div className="no-print mb-4">
            <select className="input max-w-md" value={activeTeacher} onChange={(e) => setSelTeacher(e.target.value)}>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.fullName} — {t.speciality} ({teacherWeekHours(schedule, t.id)} soat)
                </option>
              ))}
            </select>
          </div>
          {activeTeacher && <TeacherTable teacherId={activeTeacher} idx={idx} />}
        </>
      )}

      {mode === 'all' && <AllTable idx={idx} />}
    </Page>
  )
}

/* ─────────────────────────── Sinf jadvali ─────────────────────────── */
function ClassTable({
  classId,
  idx,
  selected,
  onPick,
}: {
  classId: string
  idx: ReturnType<typeof buildIndex>
  selected: string | null
  onPick: (unitId: string) => void
}) {
  const { classes, settings, lockedUnitIds, toggleLock } = useStore()
  const cls = classes.find((c) => c.id === classId)
  if (!cls) return null
  const grid = idx.byClass.get(classId)
  if (!grid) return null
  const locks = new Set(lockedUnitIds)
  const days = cls.grade <= 4 ? settings.daysPrimary : settings.daysSenior
  const maxP = Math.max(
    1,
    ...grid.slice(0, days).map((d) => {
      let last = 0
      d.forEach((c, p) => {
        if (c) last = p + 1
      })
      return last
    }),
  )

  let total = 0
  for (let d = 0; d < days; d++) for (let p = 0; p < maxP; p++) if (grid[d][p]) total++

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
        <h2 className="font-semibold text-slate-900">
          {cls.grade}-{cls.letter} sinf dars jadvali
        </h2>
        <span className="text-xs text-slate-500">
          {days} kun · haftalik {total} soat
        </span>
      </div>
      <table className="w-full table-fixed border-collapse">
        <thead>
          <tr className="bg-slate-50">
            <th className="w-14 border border-slate-200 px-2 py-1.5 text-xs font-semibold text-slate-500">Soat</th>
            {Array.from({ length: days }, (_, d) => (
              <th key={d} className="border border-slate-200 px-2 py-1.5 text-sm font-semibold text-slate-700">
                {DAY_NAMES[d]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: maxP }, (_, p) => (
            <tr key={p}>
              <td className="border border-slate-200 bg-slate-50 text-center text-sm font-medium text-slate-500">
                {p + 1}
              </td>
              {Array.from({ length: days }, (_, d) => {
                const cell = grid[d][p]
                const isSel = !!cell && cell.unitId === selected
                const isLocked = !!cell && locks.has(cell.unitId)
                return (
                  <td
                    key={d}
                    className={`border p-1 align-top transition ${
                      isSel ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-300' : 'border-slate-200'
                    } ${cell ? 'cursor-pointer hover:bg-slate-50' : ''}`}
                    onClick={() => cell && onPick(cell.unitId)}
                  >
                    {cell ? (
                      <div className="relative">
                        <CellBox cell={cell} showTeacher />
                        <button
                          className={`no-print absolute right-0 top-0 rounded px-1 text-[10px] leading-none ${
                            isLocked ? 'text-amber-600' : 'text-slate-300 hover:text-slate-500'
                          }`}
                          title={isLocked ? 'Qulf ochish' : 'Qulflash — qayta hisoblashda joyida qoladi'}
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleLock(cell.unitId)
                          }}
                        >
                          {isLocked ? '🔒' : '🔓'}
                        </button>
                      </div>
                    ) : (
                      <div className="h-10" />
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CellBox({ cell, showTeacher, showClass }: { cell: Cell; showTeacher?: boolean; showClass?: boolean }) {
  return (
    <div className="space-y-0.5">
      {cell.parts.map((pt, i) => (
        <div
          key={i}
          className="rounded px-1.5 py-1 text-xs leading-tight"
          style={{ background: pt.color + '1f', borderLeft: `3px solid ${pt.color}` }}
        >
          <div className="font-medium text-slate-800">
            {showClass ? cell.classId + ' · ' : ''}
            {pt.subjectName}
          </div>
          {pt.week !== 'all' && (
            <div className="text-[10px] font-medium uppercase tracking-wide" style={{ color: pt.color }}>
              {weekLabel(pt.week)}
            </div>
          )}
          {showTeacher && <div className="truncate text-[11px] text-slate-500">{pt.teacherName}</div>}
        </div>
      ))}
    </div>
  )
}

/* ────────────────────────── O'qituvchi jadvali ────────────────────── */
function TeacherTable({ teacherId, idx }: { teacherId: string; idx: ReturnType<typeof buildIndex> }) {
  const { teachers, settings, schedule } = useStore()
  const t = teachers.find((x) => x.id === teacherId)
  const grid = idx.byTeacher.get(teacherId)
  if (!t || !grid) return null

  const days = settings.daysSenior
  const maxP = idx.periods
  const hours = teacherWeekHours(schedule, teacherId)

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-2.5">
        <div>
          <h2 className="font-semibold text-slate-900">{t.fullName}</h2>
          <p className="text-xs text-slate-500">{t.speciality}</p>
        </div>
        <div className="flex gap-4 text-xs">
          <span>
            Haftalik: <b className="text-slate-800">{hours}</b> soat
          </span>
          <span>
            Chegara: {t.minHours}–{t.maxHours}
          </span>
        </div>
      </div>
      <table className="w-full table-fixed border-collapse">
        <thead>
          <tr className="bg-slate-50">
            <th className="w-14 border border-slate-200 px-2 py-1.5 text-xs font-semibold text-slate-500">Soat</th>
            {Array.from({ length: days }, (_, d) => {
              const gaps = gapsOfDay(grid, d)
              return (
                <th key={d} className="border border-slate-200 px-2 py-1.5 text-sm font-semibold text-slate-700">
                  {DAY_NAMES[d]}
                  {gaps > 0 && (
                    <span
                      className={`ml-1 badge ${
                        gaps > settings.maxTeacherGapPerDay ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {gaps} oyna
                    </span>
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: maxP }, (_, p) => (
            <tr key={p}>
              <td className="border border-slate-200 bg-slate-50 text-center text-sm font-medium text-slate-500">
                {p + 1}
              </td>
              {Array.from({ length: days }, (_, d) => {
                const cells = grid[d][p]
                return (
                  <td key={d} className="border border-slate-200 p-1 align-top">
                    {cells.length ? (
                      cells.map((c) => {
                        const part = c.parts.find((x) => x.teacherId === teacherId)!
                        return (
                          <div
                            key={c.unitId}
                            className="rounded px-1.5 py-1 text-xs leading-tight"
                            style={{ background: part.color + '1f', borderLeft: `3px solid ${part.color}` }}
                          >
                            <div className="font-semibold text-slate-800">{c.classId}</div>
                            <div className="truncate text-[11px] text-slate-600">{part.subjectShort}</div>
                            {part.week !== 'all' && (
                              <div className="text-[10px] uppercase" style={{ color: part.color }}>
                                {weekLabel(part.week)}
                              </div>
                            )}
                          </div>
                        )
                      })
                    ) : (
                      <div className="h-9" />
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ──────────────────────────── Umumiy jadval ───────────────────────── */
function AllTable({ idx }: { idx: ReturnType<typeof buildIndex> }) {
  const { classes, settings } = useStore()
  const [day, setDay] = useState(0)
  const P = idx.periods

  return (
    <>
      <div className="no-print mb-3 flex gap-1.5">
        {DAY_NAMES.slice(0, settings.daysSenior).map((d, i) => (
          <button
            key={d}
            onClick={() => setDay(i)}
            className={`rounded-md px-3 py-1.5 text-sm ${
              day === i ? 'bg-indigo-600 text-white' : 'border border-slate-200 bg-white text-slate-600'
            }`}
          >
            {d}
          </button>
        ))}
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50">
              <th className="sticky left-0 z-10 border border-slate-200 bg-slate-50 px-2 py-1.5 text-slate-500">
                Sinf
              </th>
              {Array.from({ length: P }, (_, p) => (
                <th key={p} className="border border-slate-200 px-2 py-1.5 text-slate-600">
                  {p + 1}-soat
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {classes.map((c) => {
              const grid = idx.byClass.get(c.id)
              const days = c.grade <= 4 ? settings.daysPrimary : settings.daysSenior
              return (
                <tr key={c.id}>
                  <td className="sticky left-0 z-10 border border-slate-200 bg-white px-2 py-1 font-semibold text-slate-700">
                    {c.grade}-{c.letter}
                  </td>
                  {Array.from({ length: P }, (_, p) => {
                    const cell = day < days ? grid?.[day][p] : null
                    return (
                      <td key={p} className="border border-slate-200 p-0.5">
                        {cell ? (
                          <div
                            className="rounded px-1 py-0.5 leading-tight"
                            style={{ background: cell.parts[0].color + '22' }}
                            title={cell.parts.map((x) => `${x.subjectName} — ${x.teacherName}`).join(' / ')}
                          >
                            <div className="font-medium text-slate-800">
                              {cell.parts.map((x) => x.subjectShort).join('/')}
                            </div>
                          </div>
                        ) : (
                          <div className="h-5" />
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-400">
        {DAY_SHORT[day]} kuni · katak ustiga sichqonchani olib borsangiz o'qituvchi ko'rinadi
      </p>
    </>
  )
}
