import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store'
import { useAuth } from '../authStore'
import Select from '../components/Select'
import { Photo } from '../components/Photo'
import { Empty, Field, Page, PageHeader, Stat } from '../components/ui'
import {
  REQUEST_KIND_LABELS, REQUEST_STATUS_LABELS,
} from '../types'
import type { RequestKind, RequestStatus, Teacher, TeacherRequest } from '../types'
import {
  IcoInbox, IcoOk, IcoClose, IcoClock, IcoMessage, IcoSend, IcoTrash, IcoEye,
  IcoGenerate, IcoWarn, IcoUser,
} from '../components/icons'

const STATUS_TINT: Record<RequestStatus, string> = {
  yangi: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300',
  korilmoqda: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  qabul: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  rad: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
}

const FIELD_LABELS: Record<string, string> = {
  photo: 'Rasm',
  phone: 'Telefon',
  email: 'Elektron pochta',
  birthDate: "Tug'ilgan sana",
  education: "Ma'lumoti",
  degree: 'Ilmiy daraja',
  bio: "Qisqacha ma'lumot",
  achievements: 'Yutuqlari',
}

export default function RequestsPage() {
  const { requests, teachers, reviewRequest, removeRequest } = useStore()
  const session = useAuth((s) => s.session)

  const [status, setStatus] = useState<RequestStatus | ''>('')
  const [kind, setKind] = useState<RequestKind | ''>('')
  const [answers, setAnswers] = useState<Record<string, string>>({})

  const byId = useMemo(() => new Map(teachers.map((t) => [t.id, t])), [teachers])

  const list = useMemo(
    () =>
      requests
        .filter((r) => (!status || r.status === status) && (!kind || r.kind === kind))
        .sort((a, b) => b.createdAt - a.createdAt),
    [requests, status, kind],
  )

  const counts = useMemo(() => {
    const m: Record<string, number> = { yangi: 0, korilmoqda: 0, qabul: 0, rad: 0 }
    for (const r of requests) m[r.status] = (m[r.status] ?? 0) + 1
    return m
  }, [requests])

  const act = (r: TeacherRequest, next: RequestStatus) => {
    const text = answers[r.id]?.trim() ?? ''
    if (next === 'rad' && !text) {
      alert('Rad etish sababini yozing.')
      return
    }
    reviewRequest(r.id, next, text, session?.fullName ?? "Ma'muriyat")
    setAnswers((a) => ({ ...a, [r.id]: '' }))
  }

  return (
    <Page>
      <PageHeader
        title="O'qituvchi so'rovlari"
        subtitle="O'qituvchilar shaxsiy kabinetdan yuborgan arizalar. Profil so'rovi qabul qilinsa, o'zgarishlar kartochkaga avtomatik ko'chadi."
        actions={
          <>
            <Select
              className="w-48"
              value={status}
              onChange={(v) => setStatus(v as RequestStatus | '')}
              emptyLabel="Barcha holatlar"
              options={(Object.keys(REQUEST_STATUS_LABELS) as RequestStatus[]).map((s) => ({
                value: s,
                label: REQUEST_STATUS_LABELS[s],
                hint: String(counts[s] ?? 0),
              }))}
            />
            <Select
              className="w-56"
              value={kind}
              onChange={(v) => setKind(v as RequestKind | '')}
              emptyLabel="Barcha turlar"
              options={(Object.keys(REQUEST_KIND_LABELS) as RequestKind[]).map((k) => ({
                value: k,
                label: REQUEST_KIND_LABELS[k],
              }))}
            />
          </>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Yangi" value={counts.yangi} tone={counts.yangi ? 'indigo' : 'slate'} hint="ko'rilmagan" />
        <Stat label="Ko'rib chiqilmoqda" value={counts.korilmoqda} tone="amber" />
        <Stat label="Qabul qilingan" value={counts.qabul} tone="emerald" />
        <Stat label="Rad etilgan" value={counts.rad} tone={counts.rad ? 'rose' : 'slate'} />
      </div>

      {list.length === 0 ? (
        <Empty text="So'rov topilmadi." />
      ) : (
        <div className="space-y-4">
          {list.map((r) => {
            const t = byId.get(r.teacherId)
            const open = r.status === 'yangi' || r.status === 'korilmoqda'
            return (
              <article key={r.id} className="card overflow-hidden">
                {/* Sarlavha */}
                <div className="flex flex-wrap items-start gap-3 border-b border-line bg-raised px-4 py-3">
                  <Photo src={t?.photo} name={t?.fullName ?? '?'} className="h-10 w-10 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-fg">{r.title}</h2>
                      <span className="badge tint-slate">{REQUEST_KIND_LABELS[r.kind]}</span>
                      <span className={`badge ${STATUS_TINT[r.status]}`}>{REQUEST_STATUS_LABELS[r.status]}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted">
                      <span className="flex items-center gap-1">
                        <IcoUser className="h-3 w-3" />
                        {t ? (
                          <Link to={`/oqituvchilar/${t.id}`} className="hover:text-indigo-600 dark:hover:text-indigo-400">
                            {t.fullName}
                          </Link>
                        ) : (
                          "O'chirilgan o'qituvchi"
                        )}
                      </span>
                      {t && <span>{t.speciality}</span>}
                      <span className="flex items-center gap-1">
                        <IcoClock className="h-3 w-3" />
                        {new Date(r.createdAt).toLocaleString('uz-UZ')}
                      </span>
                    </div>
                  </div>
                  <button
                    className="btn-icon"
                    title="So'rovni o'chirish"
                    onClick={() => {
                      if (confirm("So'rov butunlay o'chirilsinmi?")) removeRequest(r.id)
                    }}
                  >
                    <IcoTrash className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid gap-4 p-4 lg:grid-cols-[1.2fr_1fr]">
                  {/* Matn va taklif */}
                  <div>
                    <p className="whitespace-pre-line text-sm leading-relaxed text-fg-2">{r.message}</p>

                    {r.kind === 'profil' && r.proposed && t && (
                      <div className="mt-4 overflow-hidden rounded-xl border border-line">
                        <div className="border-b border-line bg-raised px-3 py-2 text-xs font-semibold text-fg-2">
                          Taklif qilingan o'zgarishlar
                        </div>
                        <ul className="divide-y divide-line-soft">
                          {Object.entries(r.proposed).map(([k, v]) => (
                            <li key={k} className="px-3 py-2 text-sm">
                              <div className="text-[11px] uppercase tracking-wide text-faint">
                                {FIELD_LABELS[k] ?? k}
                              </div>
                              <div className="mt-1 grid gap-1.5 sm:grid-cols-2">
                                <ValueBox label="Hozir" value={fmt(k, (t as unknown as Record<string, unknown>)[k])} muted />
                                <ValueBox label="Taklif" value={fmt(k, v)} />
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {r.kind === 'jadval' && open && (
                      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                        <IcoWarn className="h-4 w-4 shrink-0" />
                        <span className="flex-1">
                          Jadval o'zgarishi «Shartlar» yoki «Dars jadvali» bo'limida qo'lda kiritiladi,
                          so'ng qayta hisoblanadi.
                        </span>
                        <Link to="/boshqaruv/yaratish" className="btn-ghost shrink-0">
                          <IcoGenerate className="h-3.5 w-3.5" /> Qayta hisoblash
                        </Link>
                      </div>
                    )}

                    {r.response && (
                      <div className="mt-4 flex gap-2 rounded-xl border border-line bg-raised px-3 py-2 text-sm text-fg-2">
                        <IcoMessage className="mt-0.5 h-4 w-4 shrink-0 text-faint" />
                        <div>
                          <div className="text-[11px] uppercase tracking-wide text-faint">
                            Javob{r.reviewedBy ? ` · ${r.reviewedBy}` : ''}
                          </div>
                          <div className="whitespace-pre-line">{r.response}</div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Amallar */}
                  <div className="rounded-xl border border-line bg-raised p-3">
                    {open ? (
                      <>
                        <Field label="Javob matni" hint="O'qituvchi kabinetida ko'rinadi">
                          <textarea
                            className="input min-h-[90px] resize-y"
                            value={answers[r.id] ?? ''}
                            onChange={(e) => setAnswers((a) => ({ ...a, [r.id]: e.target.value }))}
                            placeholder="Masalan: So'rov qabul qilindi, jadval seshanbadan boshlab o'zgaradi."
                          />
                        </Field>
                        <div className="mt-3 grid gap-2">
                          <button className="btn-primary w-full" onClick={() => act(r, 'qabul')}>
                            <IcoOk className="h-4 w-4" /> Qabul qilish
                            {r.kind === 'profil' && r.proposed ? ' va qo‘llash' : ''}
                          </button>
                          <div className="grid grid-cols-2 gap-2">
                            {r.status === 'yangi' && (
                              <button className="btn-ghost" onClick={() => act(r, 'korilmoqda')}>
                                <IcoEye className="h-3.5 w-3.5" /> Ko'rib chiqilmoqda
                              </button>
                            )}
                            <button
                              className={`btn-danger ${r.status === 'yangi' ? '' : 'col-span-2'}`}
                              onClick={() => act(r, 'rad')}
                            >
                              <IcoClose className="h-3.5 w-3.5" /> Rad etish
                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center gap-2 py-6 text-center">
                        <span
                          className={`grid h-10 w-10 place-items-center rounded-full ${
                            r.status === 'qabul' ? 'bg-emerald-500/15 text-emerald-600' : 'bg-rose-500/15 text-rose-600'
                          }`}
                        >
                          {r.status === 'qabul' ? <IcoOk className="h-5 w-5" /> : <IcoClose className="h-5 w-5" />}
                        </span>
                        <p className="text-sm font-medium text-fg-2">{REQUEST_STATUS_LABELS[r.status]}</p>
                        {r.reviewedAt && (
                          <p className="text-xs text-faint">
                            {new Date(r.reviewedAt).toLocaleString('uz-UZ')}
                          </p>
                        )}
                        <button
                          className="btn-ghost mt-1"
                          onClick={() => reviewRequest(r.id, 'korilmoqda', r.response ?? '', session?.fullName ?? '')}
                        >
                          <IcoSend className="h-3.5 w-3.5" /> Qayta ko'rib chiqish
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {requests.length === 0 && (
        <p className="mt-4 flex items-center justify-center gap-2 text-xs text-faint">
          <IcoInbox className="h-3.5 w-3.5" />
          O'qituvchilar shaxsiy kabinetdan so'rov yuborganda ular shu yerda paydo bo'ladi.
        </p>
      )}
    </Page>
  )
}

function ValueBox({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={`rounded-lg border px-2 py-1.5 ${muted ? 'border-line bg-raised' : 'border-indigo-500/30 bg-indigo-500/10'}`}>
      <div className="text-[10px] uppercase tracking-wide text-faint">{label}</div>
      <div className={`mt-0.5 line-clamp-3 text-xs ${muted ? 'text-muted' : 'text-fg'}`}>{value}</div>
    </div>
  )
}

/** Taqqoslash uchun qiymatni matnga aylantirish */
function fmt(key: string, v: unknown): string {
  if (v === undefined || v === null || v === '') return '—'
  if (key === 'photo') return typeof v === 'string' ? 'rasm yuklangan' : '—'
  if (Array.isArray(v)) return v.length ? v.join('; ') : '—'
  return String(v)
}

/** Faqat o'qituvchi kartochkasidagi maydonlarni o'qish uchun yordamchi tur */
export type ProposedOf = Partial<Teacher>
