import { useMemo, useState } from 'react'
import { useMe } from './useMe'
import { useStore } from '../store'
import { PhotoInput } from '../components/Photo'
import { Field } from '../components/ui'
import { CATEGORY_LABELS, DAY_NAMES } from '../types'
import type { Teacher } from '../types'
import { SUBJECT_BY_ID } from '../data/curriculum'
import {
  IcoSend, IcoOk, IcoInfo, IcoLock, IcoUser, IcoPassport, IcoReset, IcoWarn,
} from '../components/icons'

/** O'qituvchi o'zi taklif qila oladigan maydonlar */
type Editable = Pick<
  Teacher,
  'photo' | 'phone' | 'email' | 'birthDate' | 'education' | 'degree' | 'bio'
> & { achievementsText: string }

const FIELD_LABELS: Record<string, string> = {
  photo: 'Rasm',
  phone: 'Telefon',
  email: 'Elektron pochta',
  birthDate: "Tug'ilgan sana",
  education: "Ma'lumoti",
  degree: 'Ilmiy daraja / unvon',
  bio: 'Qisqacha ma\'lumot',
  achievements: 'Faoliyati va yutuqlari',
}

const toForm = (t: Teacher): Editable => ({
  photo: t.photo,
  phone: t.phone ?? '',
  email: t.email ?? '',
  birthDate: t.birthDate ?? '',
  education: t.education ?? '',
  degree: t.degree ?? '',
  bio: t.bio ?? '',
  achievementsText: (t.achievements ?? []).join('\n'),
})

export default function CabinetProfile() {
  const { teacher, myRequests } = useMe()
  const addRequest = useStore((s) => s.addRequest)
  const [form, setForm] = useState<Editable | null>(null)
  const [sent, setSent] = useState(false)

  const pending = myRequests.find((r) => r.kind === 'profil' && (r.status === 'yangi' || r.status === 'korilmoqda'))

  const current = useMemo(() => (teacher ? toForm(teacher) : null), [teacher])
  const data = form ?? current

  const diff = useMemo(() => {
    if (!teacher || !data) return {} as Partial<Teacher>
    const out: Partial<Teacher> = {}
    if (data.photo !== teacher.photo) out.photo = data.photo
    if ((data.phone ?? '') !== (teacher.phone ?? '')) out.phone = data.phone
    if ((data.email ?? '') !== (teacher.email ?? '')) out.email = data.email
    if ((data.birthDate ?? '') !== (teacher.birthDate ?? '')) out.birthDate = data.birthDate
    if ((data.education ?? '') !== (teacher.education ?? '')) out.education = data.education
    if ((data.degree ?? '') !== (teacher.degree ?? '')) out.degree = data.degree
    if ((data.bio ?? '') !== (teacher.bio ?? '')) out.bio = data.bio
    const ach = data.achievementsText.split('\n').map((s) => s.trim()).filter(Boolean)
    if (JSON.stringify(ach) !== JSON.stringify(teacher.achievements ?? [])) out.achievements = ach
    return out
  }, [teacher, data])

  if (!teacher || !data) return null

  const changed = Object.keys(diff)
  const set = (patch: Partial<Editable>) => {
    setSent(false)
    setForm({ ...data, ...patch })
  }

  const send = () => {
    if (changed.length === 0) return
    addRequest({
      teacherId: teacher.id,
      kind: 'profil',
      title: `Shaxsiy ma'lumotni yangilash (${changed.length} ta maydon)`,
      message:
        "Quyidagi maydonlarni yangilashni so'rayman:\n" +
        changed.map((k) => `• ${FIELD_LABELS[k] ?? k}`).join('\n'),
      proposed: diff,
    })
    setForm(null)
    setSent(true)
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-fg">Ma'lumotlarim</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Ma'lumotlarni to'g'ridan-to'g'ri o'zgartirib bo'lmaydi. Kerakli joyni tahrirlab
          «So'rov yuborish» tugmasini bosing — ma'muriyat tasdiqlagach ma'lumot yangilanadi.
        </p>
      </div>

      {sent && (
        <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-300">
          <IcoOk className="mt-0.5 h-4 w-4 shrink-0" />
          So'rovingiz yuborildi. «So'rovlarim» bo'limida holatini kuzatib borishingiz mumkin.
        </div>
      )}

      {pending && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300">
          <IcoWarn className="mt-0.5 h-4 w-4 shrink-0" />
          Sizda ko'rib chiqilayotgan profil so'rovi bor: «{pending.title}». Yangi so'rov yuborsangiz
          ikkalasi ham navbatda turadi.
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        {/* ── Tahrirlash mumkin bo'lgan qism ── */}
        <div className="card p-5">
          <h2 className="flex items-center gap-2 font-semibold text-fg">
            <IcoUser className="h-4 w-4 text-faint" /> O'zgartirish taklif qilish
          </h2>

          <div className="mt-4 space-y-4">
            <PhotoInput
              value={data.photo}
              onChange={(v) => set({ photo: v })}
              name={teacher.fullName}
              shape="rounded"
              size="h-24 w-24"
              hint="Rasm rasmiy saytdagi sahifangizda ko'rinadi."
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Telefon">
                <input className="input" value={data.phone} onChange={(e) => set({ phone: e.target.value })}
                  placeholder="+998 __ ___-__-__" />
              </Field>
              <Field label="Elektron pochta">
                <input className="input" value={data.email} onChange={(e) => set({ email: e.target.value })} />
              </Field>
              <Field label="Tug'ilgan sana">
                <input className="input" type="date" value={data.birthDate}
                  onChange={(e) => set({ birthDate: e.target.value })} />
              </Field>
              <Field label="Ilmiy daraja / unvon">
                <input className="input" value={data.degree} onChange={(e) => set({ degree: e.target.value })}
                  placeholder="masalan: PhD" />
              </Field>
            </div>

            <Field label="Ma'lumoti" hint="Bitirgan oliy o'quv yurti va yo'nalishi">
              <input className="input" value={data.education} onChange={(e) => set({ education: e.target.value })} />
            </Field>

            <Field label="Qisqacha ma'lumot" hint="Rasmiy saytdagi sahifangizda ko'rsatiladi">
              <textarea className="input min-h-[90px] resize-y" value={data.bio}
                onChange={(e) => set({ bio: e.target.value })} />
            </Field>

            <Field label="Faoliyati va yutuqlari" hint="Har bir yutuq alohida qatorda">
              <textarea className="input min-h-[110px] resize-y" value={data.achievementsText}
                onChange={(e) => set({ achievementsText: e.target.value })} />
            </Field>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
            <button className="btn-primary" onClick={send} disabled={changed.length === 0}>
              <IcoSend className="h-4 w-4" /> So'rov yuborish
            </button>
            {form && (
              <button className="btn-ghost" onClick={() => { setForm(null); setSent(false) }}>
                <IcoReset className="h-3.5 w-3.5" /> Bekor qilish
              </button>
            )}
            <span className="ml-auto text-xs text-muted">
              {changed.length === 0
                ? "O'zgarish yo'q"
                : `${changed.length} ta maydon o'zgartirildi`}
            </span>
          </div>

          {changed.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {changed.map((k) => (
                <li key={k} className="badge tint-indigo">{FIELD_LABELS[k] ?? k}</li>
              ))}
            </ul>
          )}
        </div>

        {/* ── Ma'muriyat boshqaradigan qism ── */}
        <div className="space-y-5">
          <div className="card p-5">
            <h2 className="flex items-center gap-2 font-semibold text-fg">
              <IcoLock className="h-4 w-4 text-faint" /> Ma'muriyat belgilaydigan ma'lumotlar
            </h2>
            <p className="mt-1 text-xs text-muted">
              Bu qatorlarni faqat direktor yoki o'quv ishlari bo'yicha o'rinbosari o'zgartira oladi.
            </p>

            <dl className="mt-4 divide-y divide-line-soft">
              <Ro label="F.I.Sh." value={teacher.fullName} />
              <Ro label="Mutaxassislik" value={teacher.speciality} />
              <Ro label="Malaka toifasi" value={CATEGORY_LABELS[teacher.category ?? 'yoq']} />
              <Ro
                label="O'qitadigan fanlar"
                value={teacher.subjectIds.map((s) => SUBJECT_BY_ID[s]?.name ?? s).join(', ') || '—'}
              />
              <Ro label="Yuklama chegarasi" value={`${teacher.minHours}–${teacher.maxHours} soat`} />
              <Ro label="Sinf rahbarligi" value={teacher.homeroomClassId ? `${teacher.homeroomClassId} sinf` : '—'} />
              <Ro
                label="Bo'sh kunlar"
                value={
                  (teacher.unavailableDays ?? []).length
                    ? teacher.unavailableDays.map((d) => DAY_NAMES[d]).join(', ')
                    : '—'
                }
              />
              <Ro
                label="Maktabda"
                value={teacher.startYear ? `${teacher.startYear}-yildan buyon` : '—'}
              />
              <Ro
                label="Pedagogik staj"
                value={teacher.experienceYears ? `${teacher.experienceYears} yil` : '—'}
              />
            </dl>
          </div>

          <div className="card p-5">
            <h2 className="flex items-center gap-2 font-semibold text-fg">
              <IcoPassport className="h-4 w-4 text-faint" /> Kirish ma'lumoti
            </h2>
            <p className="mt-2 text-sm text-fg-2">
              Kabinetga pasport seriyasi va raqami bilan kirasiz:
            </p>
            <code className="mt-2 inline-block rounded-lg border border-line bg-raised px-3 py-1.5 font-mono text-sm tracking-widest text-fg">
              {teacher.passportSeries ?? '—'} {teacher.passportNumber ? maskNumber(teacher.passportNumber) : ''}
            </code>
            <p className="mt-3 flex gap-2 text-[11px] leading-relaxed text-muted">
              <IcoInfo className="mt-0.5 h-3.5 w-3.5 shrink-0 text-faint" />
              Pasport ma'lumoti o'zgargan bo'lsa, ma'muriyatga shaxsan murojaat qiling —
              bu ma'lumot so'rov orqali o'zgartirilmaydi.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

const maskNumber = (n: string) => n.slice(0, 3) + '••••'

function Ro({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="max-w-[60%] text-right text-sm font-medium text-fg-2">{value}</dd>
    </div>
  )
}
