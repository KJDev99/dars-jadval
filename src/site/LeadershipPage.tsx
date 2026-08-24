import { useStore } from '../store'
import { Photo } from '../components/Photo'
import { PageHero, Reveal, EmptyBlock } from './ui'
import { IcoPhone, IcoMail, IcoClock, IcoBriefcase, IcoGraduation, IcoTrophy } from '../components/icons'
import type { IconType } from '../components/icons'

export default function LeadershipPage() {
  const staff = useStore((s) => s.site.staff)
  const list = [...staff].sort((a, b) => a.order - b.order)

  return (
    <>
      <PageHero
        eyebrow="Rahbariyat"
        title="Maktab rahbariyati"
        text="Ta'lim-tarbiya jarayonini tashkil etuvchi rahbariyat a'zolari, ularning ish tajribasi va qabul kunlari."
      />

      <section className="section">
        <div className="site-wrap space-y-6">
          {list.length === 0 && <EmptyBlock text="Rahbariyat ro'yxati hali to'ldirilmagan." />}

          {list.map((m, i) => (
            <Reveal key={m.id} delay={i * 60}>
              <article className="card overflow-hidden lg:flex">
                {/* Rasm */}
                <div className="relative shrink-0 bg-raised lg:w-72">
                  <Photo
                    src={m.photo}
                    name={m.fullName}
                    shape="square"
                    className="aspect-[4/5] w-full lg:h-full"
                  />
                </div>

                {/* Ma'lumot */}
                <div className="flex-1 p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-bold text-fg">{m.fullName}</h2>
                      <p className="mt-1 font-medium text-indigo-600 dark:text-indigo-400">{m.position}</p>
                    </div>
                    {m.experienceYears > 0 && (
                      <span className="chip">
                        <IcoBriefcase className="h-3.5 w-3.5" /> {m.experienceYears} yillik staj
                      </span>
                    )}
                  </div>

                  {m.bio && <p className="mt-4 text-sm leading-relaxed text-fg-2">{m.bio}</p>}

                  <dl className="mt-5 grid gap-3 sm:grid-cols-2">
                    {m.education && (
                      <Row Icon={IcoGraduation} label="Ma'lumoti" value={m.education} />
                    )}
                    {m.startYear > 0 && (
                      <Row Icon={IcoBriefcase} label="Maktabda" value={`${m.startYear}-yildan buyon`} />
                    )}
                    {m.receptionHours && (
                      <Row Icon={IcoClock} label="Qabul vaqti" value={m.receptionHours} />
                    )}
                    {m.phone && <Row Icon={IcoPhone} label="Telefon" value={m.phone} href={`tel:${m.phone.replace(/\s/g, '')}`} />}
                    {m.email && <Row Icon={IcoMail} label="Elektron pochta" value={m.email} href={`mailto:${m.email}`} />}
                  </dl>

                  {m.awards.length > 0 && (
                    <div className="mt-5 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] p-4">
                      <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                        <IcoTrophy className="h-3.5 w-3.5" /> Yutuq va mukofotlar
                      </h3>
                      <ul className="mt-2 space-y-1 text-sm text-fg-2">
                        {m.awards.map((a, k) => (
                          <li key={k} className="flex gap-2">
                            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-500" />
                            {a}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </section>
    </>
  )
}

function Row({
  Icon,
  label,
  value,
  href,
}: {
  Icon: IconType
  label: string
  value: string
  href?: string
}) {
  return (
    <div className="flex gap-2.5">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-raised text-faint">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <dt className="text-[11px] uppercase tracking-wide text-faint">{label}</dt>
        <dd className="text-sm text-fg-2">
          {href ? (
            <a href={href} className="transition-colors hover:text-indigo-600 dark:hover:text-indigo-400">
              {value}
            </a>
          ) : (
            value
          )}
        </dd>
      </div>
    </div>
  )
}
