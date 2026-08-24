import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store'
import { Photo } from '../components/Photo'
import { BigStat, MoreLink, PersonCard, Reveal, SectionHead } from './ui'
import GridBeams from './GridBeams'
import { LEVEL_LABELS } from '../types'
import {
  IcoTeachers, IcoClasses, IcoGraduation, IcoTrophy, IcoSchedule, IcoArrowRight,
  IcoStar, IcoCheck, IcoNews, IcoQuote, IcoBuilding, IcoSparkles,
} from '../components/icons'

const HIGHLIGHTS = [
  "1-sinfdan 10-sinfgacha 30 ta sinf",
  "Oliy va birinchi toifali 60 nafar pedagog",
  "Fizika, kimyo va biologiya laboratoriyalari",
  "Ikkita informatika xonasi va axborot-resurs markazi",
  "Olimpiadalarga muntazam tayyorgarlik",
  "Avtomatlashtirilgan dars jadvali tizimi",
]

export default function HomePage() {
  const { site, classes, teachers, schedule } = useStore()
  const { profile, staff, students, alumni, news } = site

  const stats = useMemo(() => {
    const pupils = classes.reduce((s, c) => s + (c.studentsCount ?? 0), 0)
    return {
      pupils,
      teachers: teachers.length,
      classes: classes.length,
      graduates: profile.graduatesCount,
      years: new Date().getFullYear() - profile.foundedYear,
    }
  }, [classes, teachers, profile])

  const topStudents = [...students].sort((a, b) => b.year - a.year).slice(0, 4)

  return (
    <>
      {/* ═══════════════════════ Bosh ekran ═══════════════════════ */}
      <section className="relative overflow-hidden border-b border-line bg-gradient-to-br from-indigo-700 via-indigo-800 to-violet-900">
        <GridBeams opacity={0.7} />
        <div className="absolute -left-20 top-1/3 h-80 w-80 rounded-full bg-sky-400/20 blur-3xl" />
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-violet-400/20 blur-3xl" />

        <div className="site-wrap relative grid gap-10 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-white/90 backdrop-blur-sm">
              <IcoSparkles className="h-3.5 w-3.5" />
              {profile.foundedYear}-yildan buyon · {stats.years} yillik tarix
            </span>

            <h1 className="mt-5 text-3xl font-bold leading-[1.15] tracking-tight text-white sm:text-4xl lg:text-5xl">
              {profile.shortName}
              <span className="mt-2 block bg-gradient-to-r from-sky-200 to-indigo-100 bg-clip-text text-transparent">
                {profile.motto}
              </span>
            </h1>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-indigo-100/90 sm:text-lg">
              {profile.intro}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/jadval" className="btn-white btn-lg">
                <IcoSchedule className="h-4 w-4" /> Dars jadvali
              </Link>
              <Link to="/maktab" className="btn-outline-white btn-lg">
                Maktab haqida <IcoArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t border-white/15 pt-6">
              {[
                [stats.pupils.toLocaleString('uz-UZ'), "o'quvchi"],
                [stats.teachers, 'pedagog'],
                [stats.classes, 'sinf'],
              ].map(([v, l]) => (
                <div key={l as string}>
                  <dt className="text-2xl font-bold text-white sm:text-3xl">{v}</dt>
                  <dd className="mt-0.5 text-xs uppercase tracking-wide text-indigo-200/80">{l}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative">
            <div className="overflow-hidden rounded-3xl border border-white/20 shadow-hero">
              <Photo
                src={profile.heroPhoto}
                name={profile.shortName}
                icon={!profile.heroPhoto}
                shape="square"
                className="aspect-[4/3] w-full"
                alt="Maktab binosi"
              />
            </div>
            <div className="absolute -bottom-5 -left-4 hidden rounded-2xl border border-line bg-surface p-4 shadow-lift sm:block">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <IcoTrophy className="h-5 w-5" />
                </span>
                <div>
                  <div className="text-lg font-bold leading-none text-fg">{profile.awardsCount}+</div>
                  <div className="mt-1 text-xs text-muted">yutuq va mukofot</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════ Ko'rsatkichlar ═══════════════════════ */}
      <section className="border-b border-line bg-surface py-10">
        <div className="site-wrap grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <BigStat value={stats.pupils.toLocaleString('uz-UZ')} label="O'quvchi" hint="30 ta sinfda" Icon={IcoGraduation} />
          <BigStat value={stats.teachers} label="Pedagog" hint="malaka toifasiga ega" Icon={IcoTeachers} />
          <BigStat value={stats.classes} label="Sinf" hint="1–10 sinflar" Icon={IcoClasses} />
          <BigStat value={stats.graduates.toLocaleString('uz-UZ')} label="Bitiruvchi" hint={`${profile.foundedYear}-yildan buyon`} Icon={IcoTrophy} />
        </div>
      </section>

      {/* ═══════════════════════ Maktab haqida ═══════════════════════ */}
      <section className="section">
        <div className="site-wrap grid gap-10 lg:grid-cols-2 lg:items-center">
          <Reveal>
            <div className="overflow-hidden rounded-3xl border border-line shadow-lift">
              <Photo
                src={profile.aboutPhoto}
                name={profile.shortName}
                icon={!profile.aboutPhoto}
                shape="square"
                className="aspect-[4/3] w-full"
                alt="Maktab hayoti"
              />
            </div>
          </Reveal>

          <Reveal delay={80}>
            <span className="eyebrow mb-3">
              <IcoBuilding className="h-3.5 w-3.5" /> Biz haqimizda
            </span>
            <h2 className="h-section">Har bir o'quvchining iqtidorini ochamiz</h2>
            <p className="lede mt-4">{profile.about.split('\n\n')[0]}</p>

            <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
              {HIGHLIGHTS.map((h) => (
                <li key={h} className="flex items-start gap-2 text-sm text-fg-2">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                    <IcoCheck className="h-3 w-3" />
                  </span>
                  {h}
                </li>
              ))}
            </ul>

            <div className="mt-7">
              <MoreLink to="/maktab">Batafsil ma'lumot</MoreLink>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════════════ Rahbariyat ═══════════════════════ */}
      {staff.length > 0 && (
        <section className="section border-y border-line bg-surface">
          <div className="site-wrap">
            <SectionHead
              eyebrow="Rahbariyat"
              title="Maktab boshqaruvi"
              text="Ta'lim jarayonini tashkil etuvchi va yo'naltiruvchi rahbariyat a'zolari."
              action={<MoreLink to="/rahbariyat">Barcha rahbariyat</MoreLink>}
            />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {staff.slice(0, 4).map((m, i) => (
                <Reveal key={m.id} delay={i * 70}>
                  <PersonCard
                    photo={m.photo}
                    name={m.fullName}
                    role={m.position}
                    meta={m.experienceYears ? `${m.experienceYears} yillik pedagogik staj` : undefined}
                    to="/rahbariyat"
                  />
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════ A'lochi o'quvchilar ═══════════════════════ */}
      {topStudents.length > 0 && (
        <section className="section">
          <div className="site-wrap">
            <SectionHead
              eyebrow="Faxrimiz"
              title="Iqtidorli o'quvchilarimiz"
              text="Fan olimpiadalari va tanlovlarda maktabimiz sharafini himoya qilgan o'quvchilar."
              action={<MoreLink to="/yutuqlar">Barcha yutuqlar</MoreLink>}
            />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {topStudents.map((s, i) => (
                <Reveal key={s.id} delay={i * 70}>
                  <div className="card-lift h-full">
                    <div className="relative aspect-[4/5] overflow-hidden bg-raised">
                      <Photo src={s.photo} name={s.fullName} shape="square" className="h-full w-full" />
                      <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 shadow-sm">
                        {s.classId} sinf
                      </span>
                      <span className="absolute right-3 top-3 rounded-full bg-amber-500 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm">
                        {LEVEL_LABELS[s.level]}
                      </span>
                    </div>
                    <div className="p-4">
                      <h3 className="truncate font-semibold text-fg" title={s.fullName}>{s.fullName}</h3>
                      <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted">{s.achievement}</p>
                      <p className="mt-2 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                        <IcoStar className="h-3.5 w-3.5" /> {s.year}-yil
                      </p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════ Faxriy bitiruvchilar ═══════════════════════ */}
      {alumni.length > 0 && (
        <section className="section border-y border-line bg-surface">
          <div className="site-wrap">
            <SectionHead
              eyebrow="Faxriy bitiruvchilar"
              title="Maktabimiz yetishtirgan shaxslar"
              text="Turli sohalarda yuksak natijalarga erishgan bitiruvchilarimiz bilan faxrlanamiz."
            />
            <div className="grid gap-5 md:grid-cols-2">
              {alumni.slice(0, 4).map((a, i) => (
                <Reveal key={a.id} delay={i * 70}>
                  <article className="card-lift flex h-full gap-4 p-5">
                    <Photo src={a.photo} name={a.fullName} shape="rounded" className="h-20 w-20 shrink-0" />
                    <div className="min-w-0">
                      <h3 className="font-semibold text-fg">{a.fullName}</h3>
                      <p className="mt-0.5 text-sm font-medium text-indigo-600 dark:text-indigo-400">{a.occupation}</p>
                      <p className="mt-1 text-xs text-faint">{a.graduationYear}-yil bitiruvchisi</p>
                      <p className="mt-2 text-sm leading-relaxed text-muted">{a.description}</p>
                    </div>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════ Yangiliklar ═══════════════════════ */}
      {news.length > 0 && (
        <section className="section">
          <div className="site-wrap">
            <SectionHead eyebrow="Yangiliklar" title="Maktab hayotidan" />
            <div className="grid gap-5 md:grid-cols-3">
              {news.slice(0, 3).map((n, i) => (
                <Reveal key={n.id} delay={i * 70}>
                  <article className="card-lift flex h-full flex-col">
                    <div className="aspect-[16/9] overflow-hidden bg-raised">
                      <Photo src={n.photo} name={n.title} icon shape="square" className="h-full w-full" />
                    </div>
                    <div className="flex flex-1 flex-col p-5">
                      <time className="flex items-center gap-1.5 text-xs text-faint">
                        <IcoNews className="h-3.5 w-3.5" />
                        {new Date(n.date).toLocaleDateString('uz-UZ', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </time>
                      <h3 className="mt-2 font-semibold leading-snug text-fg">{n.title}</h3>
                      <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{n.summary}</p>
                    </div>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════ Chaqiruv ═══════════════════════ */}
      <section className="section pt-0">
        <div className="site-wrap">
          <div className="relative overflow-hidden rounded-3xl border border-indigo-500/20 bg-gradient-to-br from-indigo-600 to-violet-700 p-8 shadow-hero sm:p-12">
            <GridBeams opacity={0.6} compact />
            <div className="relative flex flex-wrap items-center justify-between gap-6">
              <div className="max-w-xl">
                <IcoQuote className="mb-3 h-6 w-6 text-white/60" />
                <h2 className="text-2xl font-bold text-white sm:text-3xl">
                  Dars jadvali har doim ochiq va dolzarb
                </h2>
                <p className="mt-3 text-indigo-100/90">
                  Har bir sinfning haftalik jadvali saytda e'lon qilinadi.
                  {schedule ? " Jadval oxirgi marta " + new Date(schedule.createdAt).toLocaleDateString('uz-UZ') + " da yangilangan." : ''}
                </p>
              </div>
              <Link to="/jadval" className="btn-white btn-lg shrink-0">
                <IcoSchedule className="h-4 w-4" /> Jadvalni ko'rish
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
