import { useMemo, useState } from 'react'
import { useStore } from '../store'
import Select from '../components/Select'
import { PageHero, Reveal, EmptyBlock } from './ui'
import { PersonCard } from './ui'
import { CATEGORY_LABELS, CATEGORY_ORDER, CATEGORY_RANK } from '../types'
import type { TeacherCategory } from '../types'
import { SUBJECT_BY_ID } from '../data/curriculum'
import { IcoSearch, IcoCategory } from '../components/icons'

export default function StaffPage() {
  const teachers = useStore((s) => s.teachers)
  const [q, setQ] = useState('')
  const [spec, setSpec] = useState('')
  const [cat, setCat] = useState<TeacherCategory | ''>('')

  const visible = useMemo(() => teachers.filter((t) => t.publicVisible !== false), [teachers])

  const specialities = useMemo(
    () => [...new Set(visible.map((t) => t.speciality).filter(Boolean))].sort(),
    [visible],
  )

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return visible
      .filter(
        (t) =>
          (!s || t.fullName.toLowerCase().includes(s) || t.speciality.toLowerCase().includes(s)) &&
          (!spec || t.speciality === spec) &&
          (!cat || (t.category ?? 'yoq') === cat),
      )
      .sort(
        (a, b) =>
          CATEGORY_RANK[a.category ?? 'yoq'] - CATEGORY_RANK[b.category ?? 'yoq'] ||
          (b.experienceYears ?? 0) - (a.experienceYears ?? 0) ||
          a.fullName.localeCompare(b.fullName),
      )
  }, [visible, q, spec, cat])

  const byCategory = useMemo(() => {
    const m: Record<string, number> = {}
    for (const t of visible) m[t.category ?? 'yoq'] = (m[t.category ?? 'yoq'] ?? 0) + 1
    return m
  }, [visible])

  return (
    <>
      <PageHero
        eyebrow="Pedagoglar"
        title="Maktab o'qituvchilari"
        text="Har bir pedagogning mutaxassisligi, malaka toifasi va ish tajribasi bilan tanishing."
      >
        <div className="mt-6 flex flex-wrap gap-2">
          {CATEGORY_ORDER.map((c) => (
            <span
              key={c}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-medium text-white/90"
            >
              {CATEGORY_LABELS[c]}
              <b className="text-white">{byCategory[c] ?? 0}</b>
            </span>
          ))}
        </div>
      </PageHero>

      <section className="section">
        <div className="site-wrap">
          {/* Filtrlar */}
          <div className="mb-8 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
              <IcoSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
              <input
                className="input pl-9"
                placeholder="Ism yoki mutaxassislik bo'yicha qidirish…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <Select
              className="w-56"
              value={spec}
              onChange={setSpec}
              emptyLabel="Barcha mutaxassisliklar"
              options={specialities.map((s) => ({
                value: s,
                label: s,
                hint: String(visible.filter((t) => t.speciality === s).length),
              }))}
            />
            <Select
              className="w-44"
              value={cat}
              onChange={(v) => setCat(v as TeacherCategory | '')}
              emptyLabel="Barcha toifalar"
              options={CATEGORY_ORDER.map((c) => ({
                value: c,
                label: CATEGORY_LABELS[c],
                hint: String(byCategory[c] ?? 0),
              }))}
            />
            <span className="ml-auto text-sm text-muted">
              <b className="text-fg">{list.length}</b> ta pedagog
            </span>
          </div>

          {list.length === 0 ? (
            <EmptyBlock text="Bu shartlarga mos pedagog topilmadi." />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {list.map((t, i) => (
                <Reveal key={t.id} delay={Math.min(i, 8) * 50}>
                  <PersonCard
                    photo={t.photo}
                    name={t.fullName}
                    role={t.speciality}
                    meta={
                      t.experienceYears
                        ? `${t.experienceYears} yillik pedagogik staj`
                        : undefined
                    }
                    tags={[
                      CATEGORY_LABELS[t.category ?? 'yoq'],
                      ...(t.homeroomClassId ? [`${t.homeroomClassId} sinf rahbari`] : []),
                      ...t.subjectIds.slice(0, 1).map((s) => SUBJECT_BY_ID[s]?.short ?? s),
                    ]}
                    to={`/oqituvchilar/${t.id}`}
                  />
                </Reveal>
              ))}
            </div>
          )}

          <p className="mt-8 flex items-center justify-center gap-2 text-xs text-faint">
            <IcoCategory className="h-3.5 w-3.5" />
            Malaka toifasi — pedagogning attestatsiyadan o'tgan darajasi. Dars yuklamasi ham shu tartibda taqsimlanadi.
          </p>
        </div>
      </section>
    </>
  )
}
