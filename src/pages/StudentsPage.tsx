import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { Empty, Field, Modal, Page, PageHeader, Stat } from '../components/ui'
import {
  IcoStudents, IcoPlus, IcoTrash, IcoAuto, IcoWarn, IcoInfo, IcoCheck, IcoSearch, IcoEye,
  IcoClose, IcoUpload,
} from '../components/icons'

export default function StudentsPage() {
  const {
    classes, students, teachers, addStudent, updateStudent, removeStudent, setRoster,
    fillMissingRosters, updateClass,
  } = useStore()

  const [picked, setPicked] = useState<string>(classes[0]?.id ?? '')
  const [name, setName] = useState('')
  const [q, setQ] = useState('')
  const [bulk, setBulk] = useState<string | null>(null)
  const [showInactive, setShowInactive] = useState(true)

  const byClass = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of students) if (s.active) m.set(s.classId, (m.get(s.classId) ?? 0) + 1)
    return m
  }, [students])

  const cls = classes.find((c) => c.id === picked) ?? classes[0]

  const roster = useMemo(
    () =>
      students
        .filter((s) => s.classId === cls?.id && (showInactive || s.active))
        .filter((s) => !q.trim() || s.fullName.toLowerCase().includes(q.trim().toLowerCase()))
        .sort((a, b) => a.order - b.order),
    [students, cls, q, showInactive],
  )

  const homeroom = teachers.find((t) => t.homeroomClassId === cls?.id)
  const missing = classes.filter((c) => !byClass.get(c.id)).length
  const active = students.filter((s) => s.active).length

  const add = () => {
    const v = name.trim()
    if (!v || !cls) return
    addStudent(cls.id, v)
    setName('')
  }

  const applyBulk = () => {
    if (bulk === null || !cls) return
    const names = bulk
      .split('\n')
      .map((l) => l.replace(/^\s*\d+[.)]?\s*/, '').trim())
      .filter(Boolean)
    if (names.length === 0) {
      alert('Birorta ism topilmadi.')
      return
    }
    if (
      !confirm(
        `${cls.id} sinf ro'yxati ${names.length} ta o'quvchi bilan almashtirilsinmi?\n\n` +
          `Ismi mos keladigan o'quvchilarning ballari saqlanadi, qolganlariniki o'chadi.`,
      )
    )
      return
    setRoster(cls.id, names)
    setBulk(null)
  }

  return (
    <Page>
      <PageHeader
        title="O'quvchilar"
        subtitle="Sinf jurnallari. BSB va ChSB natijalari shu ro'yxatga bog'lanadi, shuning uchun ismlarni to'g'ri kiriting."
        actions={
          missing > 0 ? (
            <button className="btn-ghost" onClick={fillMissingRosters}>
              <IcoAuto className="h-4 w-4" /> Bo'sh sinflarga ro'yxat ({missing})
            </button>
          ) : undefined
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Jami o'quvchilar" value={active} hint={`${classes.length} ta sinfda`} tone="indigo" />
        <Stat
          label="O'rtacha sinf"
          value={classes.length ? Math.round(active / classes.length) : 0}
          hint="o'quvchi"
        />
        <Stat
          label="Ro'yxati yo'q"
          value={missing}
          hint="sinf"
          tone={missing > 0 ? 'amber' : 'emerald'}
        />
        <Stat
          label="Chiqib ketgan"
          value={students.length - active}
          hint="ro'yxatda qolgan"
          tone={students.length - active > 0 ? 'amber' : 'slate'}
        />
      </div>

      {classes.length === 0 ? (
        <Empty text="Avval «Sinflar» bo'limida sinf qo'shing." />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
          {/* ── Sinflar ro'yxati ─────────────────────────────────────── */}
          <div className="card overflow-hidden">
            <div className="border-b border-line bg-raised px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted">
              Sinflar
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-2">
              {classes.map((c) => {
                const n = byClass.get(c.id) ?? 0
                const on = c.id === cls?.id
                return (
                  <button
                    key={c.id}
                    onClick={() => setPicked(c.id)}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      on ? 'bg-indigo-500/10 font-medium text-indigo-700 dark:text-indigo-300' : 'text-fg-2 hover:bg-raised'
                    }`}
                  >
                    <span className="flex-1">{c.grade}-{c.letter}</span>
                    <span className={`badge ${n === 0 ? 'tint-amber' : 'tint-slate'}`}>{n}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── Sinf jurnali ─────────────────────────────────────────── */}
          {!cls ? null : (
            <div className="space-y-4">
              <div className="card">
                <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="font-semibold text-fg">{cls.grade}-{cls.letter} sinf</h2>
                    <p className="mt-0.5 text-xs text-muted">
                      {roster.filter((s) => s.active).length} o'quvchi
                      {homeroom ? ` · sinf rahbari: ${homeroom.fullName}` : " · sinf rahbari tayinlanmagan"}
                    </p>
                  </div>
                  <div className="relative">
                    <IcoSearch className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
                    <input
                      className="input w-44 pl-8"
                      placeholder="Qidirish…"
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                    />
                  </div>
                  <button
                    className="btn-ghost"
                    onClick={() => setShowInactive((v) => !v)}
                    title="Chiqib ketganlarni ko'rsatish"
                  >
                    <IcoEye className="h-4 w-4" />
                    <span className="hidden lg:inline">{showInactive ? 'Hammasi' : 'Faollar'}</span>
                  </button>
                  <button
                    className="btn-ghost"
                    onClick={() =>
                      setBulk(
                        students
                          .filter((s) => s.classId === cls.id)
                          .sort((a, b) => a.order - b.order)
                          .map((s) => s.fullName)
                          .join('\n'),
                      )
                    }
                  >
                    <IcoUpload className="h-4 w-4" />
                    <span className="hidden lg:inline">Ro'yxatni kiritish</span>
                  </button>
                </div>

                {/* Qo'shish */}
                <div className="flex flex-wrap gap-2 px-4 py-3">
                  <input
                    className="input max-w-xs flex-1"
                    placeholder="Familiya Ism"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') add()
                    }}
                  />
                  <button className="btn-primary" onClick={add} disabled={!name.trim()}>
                    <IcoPlus className="h-4 w-4" /> Qo'shish
                  </button>
                </div>
              </div>

              {/* Soni mos kelmasa ogohlantirish */}
              {cls.studentsCount !== undefined &&
                (byClass.get(cls.id) ?? 0) > 0 &&
                cls.studentsCount !== (byClass.get(cls.id) ?? 0) && (
                  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-700 dark:text-amber-300">
                    <IcoWarn className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1">
                      Sinf kartochkasida {cls.studentsCount} ta o'quvchi ko'rsatilgan, jurnalda esa{' '}
                      {byClass.get(cls.id)} ta.
                    </span>
                    <button
                      className="btn-ghost shrink-0"
                      onClick={() => updateClass(cls.id, { studentsCount: byClass.get(cls.id) ?? 0 })}
                    >
                      <IcoCheck className="h-3.5 w-3.5" /> Jurnalga moslash
                    </button>
                  </div>
                )}

              {roster.length === 0 ? (
                <Empty text="Bu sinfda o'quvchi yo'q. Yuqoridagi maydondan qo'shing yoki ro'yxatni bir yo'la kiriting." />
              ) : (
                <div className="card overflow-hidden">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-line bg-raised">
                        <th className="th w-12 text-center">№</th>
                        <th className="th">F.I.Sh.</th>
                        <th className="th w-32 text-center">Holati</th>
                        <th className="th w-16 text-center" />
                      </tr>
                    </thead>
                    <tbody>
                      {roster.map((s) => (
                        <tr
                          key={s.id}
                          className={`border-b border-line-soft last:border-0 ${s.active ? '' : 'opacity-60'}`}
                        >
                          <td className="td text-center text-xs text-faint">{s.order}</td>
                          <td className="td">
                            <input
                              className="input border-transparent bg-transparent hover:border-line focus:border-indigo-500"
                              value={s.fullName}
                              onChange={(e) => updateStudent(s.id, { fullName: e.target.value })}
                            />
                          </td>
                          <td className="td text-center">
                            <button
                              className={`badge ${
                                s.active
                                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                  : 'bg-slate-500/15 text-slate-600 dark:text-slate-300'
                              }`}
                              onClick={() => updateStudent(s.id, { active: !s.active })}
                              title={s.active ? 'Chiqib ketgan deb belgilash' : "Ro'yxatga qaytarish"}
                            >
                              {s.active ? "O'qiyapti" : 'Chiqib ketgan'}
                            </button>
                          </td>
                          <td className="td text-center">
                            <button
                              className="btn-icon"
                              title="O'chirish"
                              onClick={() => {
                                if (
                                  confirm(
                                    `${s.fullName} ro'yxatdan butunlay o'chirilsinmi?\n` +
                                      `Uning barcha BSB va ChSB ballari ham o'chadi.`,
                                  )
                                )
                                  removeStudent(s.id)
                              }}
                            >
                              <IcoTrash className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <p className="flex gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-xs leading-relaxed text-muted">
                <IcoInfo className="mt-0.5 h-4 w-4 shrink-0 text-faint" />
                Maktabdan ketgan o'quvchini o'chirish o'rniga «Chiqib ketgan» deb belgilang — shunda
                oldingi choraklardagi natijalari saqlanib qoladi, lekin yangi hisob-kitoblarga
                qo'shilmaydi.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Ro'yxatni bir yo'la kiritish ────────────────────────────── */}
      <Modal open={bulk !== null} onClose={() => setBulk(null)} title={`${cls?.id ?? ''} sinf ro'yxati`}>
        <div className="space-y-3">
          <Field label="Har qatorda bitta o'quvchi" hint="Tartib raqamlari avtomatik olib tashlanadi">
            <textarea
              className="input min-h-[260px] resize-y font-mono text-xs"
              value={bulk ?? ''}
              onChange={(e) => setBulk(e.target.value)}
              placeholder={'1. Abdullayev Aziz\n2. Karimova Nigora\n…'}
            />
          </Field>
          <p className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            <IcoWarn className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Ro'yxat to'liq almashtiriladi. Ismi aynan mos keladigan o'quvchilarning ballari saqlanadi.
          </p>
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setBulk(null)}>
              <IcoClose className="h-4 w-4" /> Bekor qilish
            </button>
            <button className="btn-primary" onClick={applyBulk}>
              <IcoCheck className="h-4 w-4" /> Qo'llash
            </button>
          </div>
        </div>
      </Modal>

      <p className="mt-4 flex items-center justify-center gap-2 text-xs text-faint">
        <IcoStudents className="h-3.5 w-3.5" />
        Ro'yxat o'zgarsa, BSB va ChSB natijalari darhol qayta hisoblanadi.
      </p>
    </Page>
  )
}
