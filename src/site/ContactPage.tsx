import { useState } from 'react'
import { useStore } from '../store'
import { PageHero, SectionHead } from './ui'
import { Field } from '../components/ui'
import {
  IcoPhone, IcoMail, IcoMapPin, IcoClock, IcoSend, IcoInstagram, IcoOk, IcoGlobe,
} from '../components/icons'
import type { IconType } from '../components/icons'

export default function ContactPage() {
  const { profile, staff } = useStore((s) => s.site)
  const [sent, setSent] = useState(false)
  const [form, setForm] = useState({ name: '', contact: '', message: '' })

  const canSend = form.name.trim().length > 1 && form.message.trim().length > 4

  return (
    <>
      <PageHero
        eyebrow="Aloqa"
        title="Biz bilan bog'laning"
        text="Savol, taklif yoki murojaatingiz bo'lsa — quyidagi ma'lumotlar orqali murojaat qilishingiz mumkin."
      />

      <section className="section">
        <div className="site-wrap grid gap-8 lg:grid-cols-[1fr_1fr]">
          {/* Kontaktlar */}
          <div className="space-y-4">
            <div className="card divide-y divide-line-soft">
              <ContactRow Icon={IcoMapPin} label="Manzil" value={`${profile.region}, ${profile.address}`} />
              <ContactRow Icon={IcoPhone} label="Telefon" value={profile.phone} href={`tel:${profile.phone.replace(/\s/g, '')}`} />
              <ContactRow Icon={IcoMail} label="Elektron pochta" value={profile.email} href={`mailto:${profile.email}`} />
              {profile.website && <ContactRow Icon={IcoGlobe} label="Veb-sayt" value={profile.website} />}
              <ContactRow Icon={IcoClock} label="Ish vaqti" value="Dushanba–Shanba, 08:00–18:00" />
            </div>

            {(profile.telegram || profile.instagram) && (
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-fg">Ijtimoiy tarmoqlar</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {profile.telegram && (
                    <a href={profile.telegram} target="_blank" rel="noreferrer" className="btn-ghost">
                      <IcoSend className="h-4 w-4" /> Telegram
                    </a>
                  )}
                  {profile.instagram && (
                    <a href={profile.instagram} target="_blank" rel="noreferrer" className="btn-ghost">
                      <IcoInstagram className="h-4 w-4" /> Instagram
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Qabul kunlari */}
            {staff.some((s) => s.receptionHours) && (
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-fg">Rahbariyat qabul kunlari</h3>
                <ul className="mt-3 space-y-2.5">
                  {staff
                    .filter((s) => s.receptionHours)
                    .sort((a, b) => a.order - b.order)
                    .map((s) => (
                      <li key={s.id} className="text-sm">
                        <div className="font-medium text-fg-2">{s.position}</div>
                        <div className="text-xs text-muted">
                          {s.fullName} · {s.receptionHours}
                        </div>
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </div>

          {/* Murojaat shakli */}
          <div>
            <SectionHead title="Murojaat yuborish" text="Xabaringiz maktab ma'muriyatiga yetkaziladi." />

            {sent ? (
              <div className="card flex items-start gap-3 border-emerald-500/30 bg-emerald-500/[0.08] p-6">
                <IcoOk className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <h3 className="font-semibold text-emerald-700 dark:text-emerald-300">Murojaatingiz qabul qilindi</h3>
                  <p className="mt-1 text-sm text-emerald-700/90 dark:text-emerald-300/80">
                    Ma'muriyat imkon qadar tez javob beradi. Shoshilinch masalalarda telefon orqali
                    bog'lanishingizni so'raymiz.
                  </p>
                  <button className="btn-ghost mt-4" onClick={() => { setSent(false); setForm({ name: '', contact: '', message: '' }) }}>
                    Yangi murojaat
                  </button>
                </div>
              </div>
            ) : (
              <form
                className="card space-y-4 p-6"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (canSend) setSent(true)
                }}
              >
                <Field label="Ismingiz">
                  <input
                    className="input"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="F.I.Sh."
                  />
                </Field>
                <Field label="Telefon yoki elektron pochta" hint="Javob berishimiz uchun kerak">
                  <input
                    className="input"
                    value={form.contact}
                    onChange={(e) => setForm({ ...form, contact: e.target.value })}
                    placeholder="+998 __ ___-__-__"
                  />
                </Field>
                <Field label="Xabar">
                  <textarea
                    className="input min-h-[140px] resize-y"
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    placeholder="Savol yoki taklifingizni yozing…"
                  />
                </Field>
                <button className="btn-primary w-full py-2.5" disabled={!canSend}>
                  <IcoSend className="h-4 w-4" /> Yuborish
                </button>
                <p className="text-[11px] leading-relaxed text-faint">
                  Bu shakl hozircha faqat ko'rinish uchun ishlaydi — xabar brauzerdan tashqariga
                  chiqmaydi. Server qismi ulangach murojaatlar ma'muriyat paneliga tushadi.
                </p>
              </form>
            )}
          </div>
        </div>
      </section>
    </>
  )
}

function ContactRow({
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
    <div className="flex items-start gap-3 px-5 py-4">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-faint">{label}</div>
        <div className="text-sm font-medium text-fg">
          {href ? (
            <a href={href} className="transition-colors hover:text-indigo-600 dark:hover:text-indigo-400">
              {value}
            </a>
          ) : (
            value
          )}
        </div>
      </div>
    </div>
  )
}
