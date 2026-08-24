import { useStore } from '../store'
import { Photo } from '../components/Photo'
import { PageHero, Reveal, SectionHead } from './ui'
import {
  IcoBuilding, IcoGraduation, IcoTeachers, IcoTrophy, IcoTarget, IcoHeart, IcoFlag,
  IcoBook, IcoNews,
} from '../components/icons'
import type { IconType } from '../components/icons'

const VALUES = [
  {
    Icon: IcoTarget,
    title: 'Bilim sifati',
    text: "Har bir dars natijaga yo'naltirilgan. O'quvchilarning bilim darajasi muntazam monitoring qilinadi.",
  },
  {
    Icon: IcoHeart,
    title: "Mehr va e'tibor",
    text: "Har bir o'quvchi alohida shaxs. Sinf rahbarlari va psixolog bilan doimiy hamkorlik yo'lga qo'yilgan.",
  },
  {
    Icon: IcoFlag,
    title: 'Vatanparvarlik',
    text: "Ma'naviy-ma'rifiy tadbirlar, tarixiy joylarga sayohatlar va uchrashuvlar muntazam o'tkaziladi.",
  },
  {
    Icon: IcoBook,
    title: 'Mustaqil fikr',
    text: "O'quvchilar loyiha ishlari, munozara va tadqiqot orqali mustaqil fikrlashga o'rgatiladi.",
  },
]

export default function AboutPage() {
  const { site, classes, teachers } = useStore()
  const { profile, news } = site
  const pupils = classes.reduce((s, c) => s + (c.studentsCount ?? 0), 0)
  const paragraphs = profile.about.split('\n\n').filter(Boolean)

  return (
    <>
      <PageHero
        eyebrow="Maktab haqida"
        title={profile.name}
        text={`${profile.foundedYear}-yilda tashkil etilgan. ${profile.region}, ${profile.district}.`}
      />

      {/* Asosiy matn va rasm */}
      <section className="section">
        <div className="site-wrap grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
          <Reveal>
            <div className="prose-uz max-w-none">
              {paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </Reveal>

          <Reveal delay={80}>
            <div className="space-y-4">
              <div className="overflow-hidden rounded-2xl border border-line shadow-lift">
                <Photo
                  src={profile.aboutPhoto}
                  name={profile.shortName}
                  icon={!profile.aboutPhoto}
                  shape="square"
                  className="aspect-[4/3] w-full"
                  alt="Maktab"
                />
              </div>
              <div className="card divide-y divide-line-soft">
                {[
                  [IcoBuilding, 'Tashkil etilgan', `${profile.foundedYear}-yil`],
                  [IcoGraduation, "O'quvchilar", `${pupils.toLocaleString('uz-UZ')} nafar`],
                  [IcoTeachers, 'Pedagoglar', `${teachers.length} nafar`],
                  [IcoTrophy, 'Bitiruvchilar', `${profile.graduatesCount.toLocaleString('uz-UZ')} nafar`],
                ].map(([Icon, label, value]) => {
                  const I = Icon as IconType
                  return (
                    <div key={label as string} className="flex items-center gap-3 px-4 py-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                        <I className="h-4 w-4" />
                      </span>
                      <span className="flex-1 text-sm text-muted">{label as string}</span>
                      <span className="text-sm font-semibold text-fg">{value as string}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Qadriyatlar */}
      <section className="section border-y border-line bg-surface">
        <div className="site-wrap">
          <SectionHead
            eyebrow="Tamoyillarimiz"
            title="Nimaga tayanamiz"
            text="Maktabimiz faoliyatining asosini tashkil etuvchi to'rt tamoyil."
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {VALUES.map((v, i) => (
              <Reveal key={v.title} delay={i * 70}>
                <div className="card h-full p-5">
                  <span className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
                    <v.Icon className="h-5 w-5" />
                  </span>
                  <h3 className="font-semibold text-fg">{v.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{v.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Yangiliklar */}
      {news.length > 0 && (
        <section className="section">
          <div className="site-wrap">
            <SectionHead eyebrow="Yangiliklar" title="Maktab hayotidan" />
            <div className="space-y-4">
              {news.map((n, i) => (
                <Reveal key={n.id} delay={i * 60}>
                  <article className="card-lift flex flex-col gap-5 p-5 sm:flex-row">
                    <div className="w-full shrink-0 overflow-hidden rounded-xl bg-raised sm:w-56">
                      <Photo src={n.photo} name={n.title} icon shape="square" className="aspect-[16/10] w-full" />
                    </div>
                    <div className="min-w-0">
                      <time className="flex items-center gap-1.5 text-xs text-faint">
                        <IcoNews className="h-3.5 w-3.5" />
                        {new Date(n.date).toLocaleDateString('uz-UZ', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </time>
                      <h3 className="mt-1.5 text-lg font-semibold leading-snug text-fg">{n.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted">{n.summary}</p>
                      {n.body && (
                        <details className="mt-2 text-sm">
                          <summary className="cursor-pointer text-indigo-600 dark:text-indigo-400">Batafsil</summary>
                          <div className="prose-uz mt-2">
                            {n.body.split('\n\n').map((p, k) => (
                              <p key={k}>{p}</p>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  )
}
