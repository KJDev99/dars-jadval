import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMe } from './useMe'
import { useStore } from '../store'
import Select from '../components/Select'
import { Field } from '../components/ui'
import { STATUS_TINT } from './CabinetHome'
import {
  DAY_NAMES, REQUEST_KIND_LABELS, REQUEST_STATUS_LABELS,
} from '../types'
import type { RequestKind } from '../types'
import { IcoSend, IcoOk, IcoInbox, IcoClock, IcoMessage, IcoInfo } from '../components/icons'

export default function CabinetRequests() {
  const [params] = useSearchParams()
  const { teacher, idx, myRequests, schedule } = useMe()
  const addRequest = useStore((s) => s.addRequest)

  const [kind, setKind] = useState<RequestKind>(
    (params.get('tur') as RequestKind) || 'jadval',
  )
  const [lesson, setLesson] = useState('')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)

  /** O'qituvchining barcha darslari — so'rovda aniq darsni ko'rsatish uchun */
  const lessons = useMemo(() => {
    if (!teacher || !schedule) return []
    const grid = idx.byTeacher.get(teacher.id)
    if (!grid) return []
    const out: { value: string; label: string; group: string }[] = []
    grid.forEach((day, d) =>
      day.forEach((cells, p) =>
        cells.forEach((c) => {
          const part = c.parts.find((x) => x.teacherId === teacher.id) ?? c.parts[0]
          out.push({
            value: `${d}|${p}|${c.unitId}`,
            label: `${p + 1}-soat · ${c.classId} · ${part.subjectName}`,
            group: DAY_NAMES[d],
          })
        }),
      ),
    )
    return out
  }, [teacher, schedule, idx])

  if (!teacher) return null

  const canSend = title.trim().length > 3 && message.trim().length > 5

  const send = () => {
    if (!canSend) return
    const picked = lessons.find((l) => l.value === lesson)
    addRequest({
      teacherId: teacher.id,
      kind,
      title: title.trim(),
      message:
        message.trim() +
        (picked ? `\n\nTegishli dars: ${picked.group}, ${picked.label}` : ''),
    })
    setTitle('')
    setMessage('')
    setLesson('')
    setSent(true)
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-fg">So'rovlarim</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Dars jadvali, yuklama yoki shaxsiy ma'lumotni o'zgartirish uchun ma'muriyatga ariza
          yuboring. Har bir so'rovning holati shu yerda ko'rinadi.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        {/* ── Yangi so'rov ── */}
        <div className="card p-5">
          <h2 className="flex items-center gap-2 font-semibold text-fg">
            <IcoSend className="h-4 w-4 text-faint" /> Yangi so'rov
          </h2>

          {sent && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
              <IcoOk className="mt-0.5 h-4 w-4 shrink-0" />
              So'rovingiz ma'muriyatga yuborildi.
            </div>
          )}

          <div className="mt-4 space-y-4">
            <Field label="So'rov turi">
              <Select
                value={kind}
                onChange={(v) => { setKind(v as RequestKind); setSent(false) }}
                options={(Object.keys(REQUEST_KIND_LABELS) as RequestKind[])
                  .filter((k) => k !== 'profil')
                  .map((k) => ({ value: k, label: REQUEST_KIND_LABELS[k] }))}
              />
            </Field>

            {kind === 'jadval' && lessons.length > 0 && (
              <Field label="Qaysi dars haqida" hint="Ixtiyoriy — so'rovga aniqlik kiritadi">
                <Select
                  value={lesson}
                  onChange={setLesson}
                  emptyLabel="— aniq dars tanlanmagan —"
                  options={lessons}
                />
              </Field>
            )}

            <Field label="Mavzu">
              <input
                className="input"
                value={title}
                onChange={(e) => { setTitle(e.target.value); setSent(false) }}
                placeholder={
                  kind === 'jadval'
                    ? "Payshanba kungi darsni boshqa kunga ko'chirish"
                    : kind === 'yuklama'
                      ? 'Haftalik soatni oshirish'
                      : 'So\'rov mavzusi'
                }
              />
            </Field>

            <Field label="Izoh" hint="Sababini iloji boricha aniq yozing">
              <textarea
                className="input min-h-[140px] resize-y"
                value={message}
                onChange={(e) => { setMessage(e.target.value); setSent(false) }}
                placeholder="Masalan: Payshanba kuni malaka oshirish kursi bo'lgani uchun darslarni boshqa kunga ko'chirishni so'rayman."
              />
            </Field>

            <button className="btn-primary w-full py-2.5" onClick={send} disabled={!canSend}>
              <IcoSend className="h-4 w-4" /> Yuborish
            </button>

            <p className="flex gap-2 text-[11px] leading-relaxed text-faint">
              <IcoInfo className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Shaxsiy ma'lumotni o'zgartirish so'rovi «Ma'lumotlarim» bo'limidan yuboriladi —
              u yerda o'zgarishlar avtomatik taqqoslanadi.
            </p>
          </div>
        </div>

        {/* ── So'rovlar tarixi ── */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line bg-raised px-4 py-2.5">
            <h2 className="text-sm font-semibold text-fg-2">So'rovlar tarixi</h2>
            <span className="badge tint-slate">{myRequests.length} ta</span>
          </div>

          {myRequests.length === 0 ? (
            <div className="p-10 text-center">
              <IcoInbox className="mx-auto h-9 w-9 text-faint" />
              <p className="mt-2 text-sm text-muted">Hali so'rov yubormagansiz.</p>
            </div>
          ) : (
            <ul className="divide-y divide-line-soft">
              {myRequests.map((r) => (
                <li key={r.id} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="badge tint-slate">{REQUEST_KIND_LABELS[r.kind]}</span>
                        <h3 className="font-medium text-fg">{r.title}</h3>
                      </div>
                      <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-muted">
                        {r.message}
                      </p>
                    </div>
                    <span className={`badge shrink-0 ${STATUS_TINT[r.status]}`}>
                      {REQUEST_STATUS_LABELS[r.status]}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-faint">
                    <span className="flex items-center gap-1">
                      <IcoClock className="h-3 w-3" />
                      {new Date(r.createdAt).toLocaleString('uz-UZ')}
                    </span>
                    {r.reviewedAt && (
                      <span>
                        Ko'rib chiqildi: {new Date(r.reviewedAt).toLocaleDateString('uz-UZ')}
                        {r.reviewedBy ? ` · ${r.reviewedBy}` : ''}
                      </span>
                    )}
                  </div>

                  {r.response && (
                    <div className="mt-2.5 flex gap-2 rounded-lg border border-line bg-raised px-3 py-2 text-sm text-fg-2">
                      <IcoMessage className="mt-0.5 h-3.5 w-3.5 shrink-0 text-faint" />
                      <span className="whitespace-pre-line">{r.response}</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
