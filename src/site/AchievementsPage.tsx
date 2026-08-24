import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { Photo } from '../components/Photo'
import { PageHero, Reveal, SectionHead, EmptyBlock } from './ui'
import Select from '../components/Select'
import { LEVEL_LABELS } from '../types'
import type { AchievementLevel } from '../types'
import { SUBJECT_BY_ID } from '../data/curriculum'
import { IcoTrophy, IcoStar, IcoGraduation } from '../components/icons'

const LEVEL_TINT: Record<AchievementLevel, string> = {
  maktab: 'bg-slate-500',
  tuman: 'bg-sky-500',
  viloyat: 'bg-indigo-500',
  respublika: 'bg-emerald-600',
  xalqaro: 'bg-amber-500',
}

export default function AchievementsPage() {
  const { students, alumni } = useStore((s) => s.site)
  const [level, setLevel] = useState<AchievementLevel | ''>('')
  const [year, setYear] = useState('')

  const years = useMemo(
    () => [...new Set(students.map((s) => s.year))].sort((a, b) => b - a),
    [students],
  )

  const list = useMemo(
    () =>
      students
        .filter((s) => (!level || s.level === level) && (!year || String(s.year) === year))
        .sort((a, b) => b.year - a.year || a.fullName.localeCompare(b.fullName)),
    [students, level, year],
  )

  const counts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const s of students) m[s.level] = (m[s.level] ?? 0) + 1
    return m
  }, [students])

  return (
    <>
      <PageHero
        eyebrow="Yutuqlar"
        title="Faxrimiz — o'quvchilarimiz"
        text="Fan olimpiadalari, tanlov va musobaqalarda maktabimiz nomini yuksaltirgan o'quvchilar va faxriy bitiruvchilar."
      >
        <div className="mt-6 flex flex-wrap gap-2">
          {(Object.keys(LEVEL_LABELS) as AchievementLevel[]).map((l) => (
            <span
              key={l}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-medium text-white/90"
            >
              {LEVEL_LABELS[l]} <b className="text-white">{counts[l] ?? 0}</b>
            </span>
          ))}
        </div>
      </PageHero>

      {/* ── A'lochi o'quvchilar ── */}
      <section className="section">
        <div className="site-wrap">
          <SectionHead
            eyebrow="Iqtidorli o'quvchilar"
            title="Olimpiada va tanlov g'oliblari"
            action={
              <div className="flex gap-2">
                <Select
                  className="w-40"
                  value={level}
                  onChange={(v) => setLevel(v as AchievementLevel | '')}
                  emptyLabel="Barcha bosqichlar"
                  options={(Object.keys(LEVEL_LABELS) as AchievementLevel[]).map((l) => ({
                    value: l,
                    label: LEVEL_LABELS[l],
                    hint: String(counts[l] ?? 0),
                  }))}
                />
                <Select
                  className="w-32"
                  value={year}
                  onChange={setYear}
                  emptyLabel="Barcha yillar"
                  options={years.map((y) => ({ value: String(y), label: `${y}-yil` }))}
                />
              </div>
            }
          />

          {list.length === 0 ? (
            <EmptyBlock text="Bu shartlarga mos yutuq topilmadi." />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {list.map((s, i) => {
                const subject = s.subjectId ? SUBJECT_BY_ID[s.subjectId] : undefined
                return (
                  <Reveal key={s.id} delay={Math.min(i, 8) * 50}>
                    <article className="card-lift h-full">
                      <div className="relative aspect-[4/5] overflow-hidden bg-raised">
                        <Photo src={s.photo} name={s.fullName} shape="square" className="h-full w-full" />
                        <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 shadow-sm">
                          {s.classId} sinf
                        </span>
                        <span
                          className={`absolute right-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm ${LEVEL_TINT[s.level]}`}
                        >
                          {LEVEL_LABELS[s.level]}
                        </span>
                      </div>
                      <div className="p-4">
                        <h3 className="font-semibold leading-snug text-fg">{s.fullName}</h3>
                        <p className="mt-1.5 text-sm leading-relaxed text-muted">{s.achievement}</p>
                        <div className="mt-3 flex flex-wrap items-center gap-1.5">
                          <span className="badge tint-amber">
                            <IcoStar className="h-3 w-3" /> {s.year}
                          </span>
                          {subject && (
                            <span
                              className="badge"
                              style={{ background: subject.color + '22', color: subject.color }}
                            >
                              {subject.name}
                            </span>
                          )}
                        </div>
                      </div>
                    </article>
                  </Reveal>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* ── Faxriy bitiruvchilar ── */}
      <section className="section border-t border-line bg-surface">
        <div className="site-wrap">
          <SectionHead
            eyebrow="Faxriy bitiruvchilar"
            title="Maktabimiz yetishtirgan shaxslar"
            text="Turli sohalarda yuksak natijalarga erishgan bitiruvchilarimiz maktab bilan aloqani uzmagan."
          />

          {alumni.length === 0 ? (
            <EmptyBlock text="Faxriy bitiruvchilar ro'yxati hali to'ldirilmagan." />
          ) : (
            <div className="grid gap-5 md:grid-cols-2">
              {alumni
                .slice()
                .sort((a, b) => a.graduationYear - b.graduationYear)
                .map((a, i) => (
                  <Reveal key={a.id} delay={Math.min(i, 6) * 60}>
                    <article className="card-lift flex h-full gap-5 p-5">
                      <Photo src={a.photo} name={a.fullName} shape="rounded" className="h-24 w-24 shrink-0" />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-fg">{a.fullName}</h3>
                          <span className="badge tint-indigo">
                            <IcoGraduation className="h-3 w-3" /> {a.graduationYear}
                          </span>
                        </div>
                        <p className="mt-1 text-sm font-medium text-indigo-600 dark:text-indigo-400">
                          {a.occupation}
                        </p>
                        <p className="mt-2 text-sm leading-relaxed text-muted">{a.description}</p>
                      </div>
                    </article>
                  </Reveal>
                ))}
            </div>
          )}

          <p className="mt-8 flex items-center justify-center gap-2 text-xs text-faint">
            <IcoTrophy className="h-3.5 w-3.5" />
            Ro'yxat maktab ma'muriyati tomonidan muntazam yangilab boriladi.
          </p>
        </div>
      </section>
    </>
  )
}
