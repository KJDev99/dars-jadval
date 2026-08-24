import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store'
import Select from '../components/Select'
import { Photo, PhotoInput } from '../components/Photo'
import { Empty, Field, Modal, Page, PageHeader } from '../components/ui'
import { LEVEL_LABELS } from '../types'
import type { AchievementLevel, Alumnus, NewsItem, StaffMember, StudentHighlight } from '../types'
import { SUBJECTS } from '../data/curriculum'
import {
  IcoGlobe, IcoPlus, IcoEdit, IcoTrash, IcoChevronUp, IcoChevronDown, IcoExternal,
  IcoBuilding, IcoTeachers, IcoStar, IcoGraduation, IcoNews, IcoOk,
} from '../components/icons'

type Tab = 'profil' | 'rahbariyat' | 'oquvchilar' | 'bitiruvchilar' | 'yangiliklar'

const TABS: { id: Tab; label: string; Icon: typeof IcoGlobe }[] = [
  { id: 'profil', label: 'Maktab ma\'lumoti', Icon: IcoBuilding },
  { id: 'rahbariyat', label: 'Rahbariyat', Icon: IcoTeachers },
  { id: 'oquvchilar', label: "A'lochi o'quvchilar", Icon: IcoStar },
  { id: 'bitiruvchilar', label: 'Faxriy bitiruvchilar', Icon: IcoGraduation },
  { id: 'yangiliklar', label: 'Yangiliklar', Icon: IcoNews },
]

const newId = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`

export default function SitePage() {
  const [tab, setTab] = useState<Tab>('profil')

  return (
    <Page>
      <PageHeader
        title="Rasmiy sayt"
        subtitle="Saytda ko'rinadigan barcha ma'lumot shu bo'limdan boshqariladi: maktab haqida, rahbariyat, o'quvchilar yutuqlari, bitiruvchilar va yangiliklar."
        actions={
          <Link to="/" target="_blank" className="btn-ghost">
            <IcoExternal className="h-4 w-4" /> Saytni ochish
          </Link>
        }
      />

      <div className="mb-5 flex flex-wrap gap-1.5">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              tab === id
                ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300'
                : 'border-line bg-surface text-muted hover:bg-raised hover:text-fg'
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === 'profil' && <ProfileTab />}
      {tab === 'rahbariyat' && <StaffTab />}
      {tab === 'oquvchilar' && <StudentsTab />}
      {tab === 'bitiruvchilar' && <AlumniTab />}
      {tab === 'yangiliklar' && <NewsTab />}
    </Page>
  )
}

/* ═══════════════════════ Maktab ma'lumoti ═══════════════════════ */

function ProfileTab() {
  const { profile } = useStore((s) => s.site)
  const setProfile = useStore((s) => s.setProfile)
  const [saved, setSaved] = useState(false)

  const set = (patch: Partial<typeof profile>) => {
    setProfile(patch)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr] lg:items-start">
      <div className="space-y-4">
        <div className="card p-5">
          <h2 className="mb-4 font-semibold text-fg">Asosiy ma'lumot</h2>
          <div className="space-y-3">
            <Field label="To'liq rasmiy nom">
              <input className="input" value={profile.name} onChange={(e) => set({ name: e.target.value })} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Qisqa nom">
                <input className="input" value={profile.shortName} onChange={(e) => set({ shortName: e.target.value })} />
              </Field>
              <Field label="Tashkil etilgan yil">
                <input type="number" min={1900} max={2100} className="input" value={profile.foundedYear}
                  onChange={(e) => set({ foundedYear: +e.target.value })} />
              </Field>
              <Field label="Shior">
                <input className="input" value={profile.motto} onChange={(e) => set({ motto: e.target.value })} />
              </Field>
            </div>
            <Field label="Qisqa tanishtiruv" hint="Bosh sahifadagi katta matn ostida chiqadi">
              <textarea className="input min-h-[80px] resize-y" value={profile.intro}
                onChange={(e) => set({ intro: e.target.value })} />
            </Field>
            <Field label="Maktab haqida" hint="Paragraflar bo'sh qator bilan ajratiladi">
              <textarea className="input min-h-[200px] resize-y" value={profile.about}
                onChange={(e) => set({ about: e.target.value })} />
            </Field>
          </div>
        </div>

        <div className="card p-5">
          <h2 className="mb-4 font-semibold text-fg">Aloqa ma'lumotlari</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Viloyat / shahar">
              <input className="input" value={profile.region} onChange={(e) => set({ region: e.target.value })} />
            </Field>
            <Field label="Tuman">
              <input className="input" value={profile.district} onChange={(e) => set({ district: e.target.value })} />
            </Field>
            <Field label="Manzil">
              <input className="input" value={profile.address} onChange={(e) => set({ address: e.target.value })} />
            </Field>
            <Field label="Telefon">
              <input className="input" value={profile.phone} onChange={(e) => set({ phone: e.target.value })} />
            </Field>
            <Field label="Elektron pochta">
              <input className="input" value={profile.email} onChange={(e) => set({ email: e.target.value })} />
            </Field>
            <Field label="Veb-sayt">
              <input className="input" value={profile.website} onChange={(e) => set({ website: e.target.value })} />
            </Field>
            <Field label="Telegram havolasi">
              <input className="input" value={profile.telegram} onChange={(e) => set({ telegram: e.target.value })} />
            </Field>
            <Field label="Instagram havolasi">
              <input className="input" value={profile.instagram} onChange={(e) => set({ instagram: e.target.value })} />
            </Field>
            <Field label="YouTube havolasi">
              <input className="input" value={profile.youtube} onChange={(e) => set({ youtube: e.target.value })} />
            </Field>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="card p-5">
          <h2 className="mb-4 font-semibold text-fg">Rasmlar</h2>
          <div className="space-y-5">
            <div>
              <div className="mb-2 text-xs font-medium text-fg-2">Bosh sahifadagi katta rasm</div>
              <PhotoInput value={profile.heroPhoto} onChange={(v) => set({ heroPhoto: v })}
                name={profile.shortName} shape="rounded" size="h-24 w-32" />
            </div>
            <div>
              <div className="mb-2 text-xs font-medium text-fg-2">«Maktab haqida» rasmi</div>
              <PhotoInput value={profile.aboutPhoto} onChange={(v) => set({ aboutPhoto: v })}
                name={profile.shortName} shape="rounded" size="h-24 w-32" />
            </div>
            <div>
              <div className="mb-2 text-xs font-medium text-fg-2">Logotip</div>
              <PhotoInput value={profile.logo} onChange={(v) => set({ logo: v })}
                name={profile.shortName} shape="rounded" size="h-16 w-16" />
            </div>
          </div>
        </div>

        <div className="card p-5">
          <h2 className="mb-4 font-semibold text-fg">Ko'rsatkichlar</h2>
          <p className="mb-3 text-xs text-muted">
            O'quvchilar, o'qituvchilar va sinflar soni bazadan avtomatik olinadi. Quyidagilar qo'lda kiritiladi.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Bitiruvchilar soni">
              <input type="number" min={0} className="input" value={profile.graduatesCount}
                onChange={(e) => set({ graduatesCount: +e.target.value })} />
            </Field>
            <Field label="Yutuq va mukofotlar">
              <input type="number" min={0} className="input" value={profile.awardsCount}
                onChange={(e) => set({ awardsCount: +e.target.value })} />
            </Field>
          </div>
        </div>

        {saved && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
            <IcoOk className="h-4 w-4" /> O'zgarishlar saqlandi
          </div>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════ Rahbariyat ═══════════════════════ */

const blankStaff = (order: number): StaffMember => ({
  id: newId('st'),
  fullName: '',
  position: '',
  photo: undefined,
  phone: '',
  email: '',
  receptionHours: '',
  education: '',
  experienceYears: 0,
  startYear: new Date().getFullYear(),
  bio: '',
  awards: [],
  order,
})

function StaffTab() {
  const { staff } = useStore((s) => s.site)
  const { upsertStaff, removeStaff, moveStaff, teachers } = useStore()
  const [edit, setEdit] = useState<StaffMember | null>(null)

  const list = [...staff].sort((a, b) => a.order - b.order)

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted">{list.length} ta rahbariyat a'zosi</p>
        <button className="btn-primary" onClick={() => setEdit(blankStaff(list.length + 1))}>
          <IcoPlus className="h-4 w-4" /> Qo'shish
        </button>
      </div>

      {list.length === 0 ? (
        <Empty text="Rahbariyat ro'yxati bo'sh." />
      ) : (
        <div className="space-y-2">
          {list.map((m, i) => (
            <div key={m.id} className="card flex flex-wrap items-center gap-3 p-3">
              <Photo src={m.photo} name={m.fullName} className="h-12 w-12 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-fg">{m.fullName || '(nomsiz)'}</div>
                <div className="truncate text-sm text-indigo-600 dark:text-indigo-400">{m.position}</div>
                <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-muted">
                  {m.experienceYears > 0 && <span>{m.experienceYears} yil staj</span>}
                  {m.phone && <span>{m.phone}</span>}
                  {m.awards.length > 0 && <span>{m.awards.length} ta yutuq</span>}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <button className="btn-icon" disabled={i === 0} onClick={() => moveStaff(m.id, -1)} title="Yuqoriga">
                  <IcoChevronUp className="h-4 w-4" />
                </button>
                <button className="btn-icon" disabled={i === list.length - 1} onClick={() => moveStaff(m.id, 1)} title="Pastga">
                  <IcoChevronDown className="h-4 w-4" />
                </button>
                <button className="btn-ghost" onClick={() => setEdit(m)}>
                  <IcoEdit className="h-3.5 w-3.5" /> Tahrirlash
                </button>
                <button
                  className="btn-icon hover:bg-rose-500/10 hover:text-rose-600"
                  onClick={() => { if (confirm(`${m.fullName} ro'yxatdan o'chirilsinmi?`)) removeStaff(m.id) }}
                >
                  <IcoTrash className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!edit} onClose={() => setEdit(null)} wide title="Rahbariyat a'zosi">
        {edit && (
          <div className="space-y-4">
            <PhotoInput value={edit.photo} onChange={(v) => setEdit({ ...edit, photo: v })}
              name={edit.fullName} shape="rounded" size="h-28 w-28" />

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="F.I.Sh.">
                <input className="input" value={edit.fullName} onChange={(e) => setEdit({ ...edit, fullName: e.target.value })} />
              </Field>
              <Field label="Lavozimi">
                <input className="input" value={edit.position} onChange={(e) => setEdit({ ...edit, position: e.target.value })}
                  placeholder="Maktab direktori" />
              </Field>
              <Field label="Telefon">
                <input className="input" value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} />
              </Field>
              <Field label="Elektron pochta">
                <input className="input" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} />
              </Field>
              <Field label="Qabul vaqti">
                <input className="input" value={edit.receptionHours}
                  onChange={(e) => setEdit({ ...edit, receptionHours: e.target.value })}
                  placeholder="Dushanba–Juma, 09:00–11:00" />
              </Field>
              <Field label="Ma'lumoti">
                <input className="input" value={edit.education} onChange={(e) => setEdit({ ...edit, education: e.target.value })} />
              </Field>
              <Field label="Pedagogik staj (yil)">
                <input type="number" min={0} max={70} className="input" value={edit.experienceYears}
                  onChange={(e) => setEdit({ ...edit, experienceYears: +e.target.value })} />
              </Field>
              <Field label="Maktabda ishlay boshlagan yili">
                <input type="number" min={1900} max={2100} className="input" value={edit.startYear}
                  onChange={(e) => setEdit({ ...edit, startYear: +e.target.value })} />
              </Field>
            </div>

            <Field label="Bog'liq o'qituvchi" hint="Ixtiyoriy — o'qituvchilar ro'yxatidagi yozuv">
              <Select
                value={edit.teacherId ?? ''}
                onChange={(v) => setEdit({ ...edit, teacherId: v || undefined })}
                emptyLabel="— bog'lanmagan —"
                options={teachers.map((t) => ({ value: t.id, label: t.fullName, group: t.speciality }))}
              />
            </Field>

            <Field label="Tarjimai hol va faoliyati">
              <textarea className="input min-h-[110px] resize-y" value={edit.bio}
                onChange={(e) => setEdit({ ...edit, bio: e.target.value })} />
            </Field>

            <Field label="Yutuq va mukofotlar" hint="Har biri alohida qatorda">
              <textarea className="input min-h-[90px] resize-y" value={edit.awards.join('\n')}
                onChange={(e) => setEdit({ ...edit, awards: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })} />
            </Field>

            <div className="flex justify-end gap-2 border-t border-line pt-4">
              <button className="btn-ghost" onClick={() => setEdit(null)}>Bekor qilish</button>
              <button
                className="btn-primary"
                disabled={!edit.fullName.trim() || !edit.position.trim()}
                onClick={() => { upsertStaff(edit); setEdit(null) }}
              >
                <IcoOk className="h-4 w-4" /> Saqlash
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}

/* ═══════════════════════ A'lochi o'quvchilar ═══════════════════════ */

const blankStudent = (): StudentHighlight => ({
  id: newId('stu'),
  fullName: '',
  classId: '',
  photo: undefined,
  achievement: '',
  level: 'tuman',
  year: new Date().getFullYear(),
})

function StudentsTab() {
  const { students } = useStore((s) => s.site)
  const { upsertStudent, removeStudent, classes } = useStore()
  const [edit, setEdit] = useState<StudentHighlight | null>(null)

  const list = [...students].sort((a, b) => b.year - a.year || a.fullName.localeCompare(b.fullName))

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted">{list.length} ta yozuv</p>
        <button className="btn-primary" onClick={() => setEdit(blankStudent())}>
          <IcoPlus className="h-4 w-4" /> Qo'shish
        </button>
      </div>

      {list.length === 0 ? (
        <Empty text="A'lochi o'quvchilar ro'yxati bo'sh." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((s) => (
            <div key={s.id} className="card flex gap-3 p-3">
              <Photo src={s.photo} name={s.fullName} className="h-14 w-14 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-fg">{s.fullName}</div>
                <div className="mt-0.5 flex flex-wrap gap-1">
                  <span className="badge tint-indigo">{s.classId}</span>
                  <span className="badge tint-amber">{LEVEL_LABELS[s.level]}</span>
                  <span className="badge tint-slate">{s.year}</span>
                </div>
                <p className="mt-1.5 line-clamp-2 text-xs text-muted">{s.achievement}</p>
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                <button className="btn-icon" onClick={() => setEdit(s)}><IcoEdit className="h-3.5 w-3.5" /></button>
                <button className="btn-icon hover:bg-rose-500/10 hover:text-rose-600"
                  onClick={() => { if (confirm("O'chirilsinmi?")) removeStudent(s.id) }}>
                  <IcoTrash className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!edit} onClose={() => setEdit(null)} title="A'lochi o'quvchi">
        {edit && (
          <div className="space-y-4">
            <PhotoInput value={edit.photo} onChange={(v) => setEdit({ ...edit, photo: v })}
              name={edit.fullName} shape="rounded" size="h-24 w-24" />
            <Field label="F.I.Sh.">
              <input className="input" value={edit.fullName} onChange={(e) => setEdit({ ...edit, fullName: e.target.value })} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Sinf">
                <Select
                  value={edit.classId}
                  onChange={(v) => setEdit({ ...edit, classId: v })}
                  placeholder="Tanlang"
                  options={classes.map((c) => ({ value: c.id, label: `${c.grade}-${c.letter}`, group: `${c.grade}-sinflar` }))}
                />
              </Field>
              <Field label="Bosqich">
                <Select
                  value={edit.level}
                  onChange={(v) => setEdit({ ...edit, level: v as AchievementLevel })}
                  options={(Object.keys(LEVEL_LABELS) as AchievementLevel[]).map((l) => ({ value: l, label: LEVEL_LABELS[l] }))}
                />
              </Field>
              <Field label="Yil">
                <input type="number" min={1990} max={2100} className="input" value={edit.year}
                  onChange={(e) => setEdit({ ...edit, year: +e.target.value })} />
              </Field>
            </div>
            <Field label="Fan" hint="Ixtiyoriy">
              <Select
                value={edit.subjectId ?? ''}
                onChange={(v) => setEdit({ ...edit, subjectId: v || undefined })}
                emptyLabel="— fan tanlanmagan —"
                options={SUBJECTS.map((s) => ({ value: s.id, label: s.name, color: s.color, group: s.yonalish }))}
              />
            </Field>
            <Field label="Yutuq matni">
              <textarea className="input min-h-[80px] resize-y" value={edit.achievement}
                onChange={(e) => setEdit({ ...edit, achievement: e.target.value })}
                placeholder="Matematika fanidan viloyat olimpiadasi g'olibi" />
            </Field>
            <div className="flex justify-end gap-2 border-t border-line pt-4">
              <button className="btn-ghost" onClick={() => setEdit(null)}>Bekor qilish</button>
              <button className="btn-primary" disabled={!edit.fullName.trim() || !edit.classId}
                onClick={() => { upsertStudent(edit); setEdit(null) }}>
                <IcoOk className="h-4 w-4" /> Saqlash
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}

/* ═══════════════════════ Faxriy bitiruvchilar ═══════════════════════ */

const blankAlumnus = (): Alumnus => ({
  id: newId('al'),
  fullName: '',
  graduationYear: 2000,
  photo: undefined,
  occupation: '',
  description: '',
})

function AlumniTab() {
  const { alumni } = useStore((s) => s.site)
  const { upsertAlumnus, removeAlumnus } = useStore()
  const [edit, setEdit] = useState<Alumnus | null>(null)

  const list = [...alumni].sort((a, b) => a.graduationYear - b.graduationYear)

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted">{list.length} ta yozuv</p>
        <button className="btn-primary" onClick={() => setEdit(blankAlumnus())}>
          <IcoPlus className="h-4 w-4" /> Qo'shish
        </button>
      </div>

      {list.length === 0 ? (
        <Empty text="Faxriy bitiruvchilar ro'yxati bo'sh." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((a) => (
            <div key={a.id} className="card flex gap-3 p-3">
              <Photo src={a.photo} name={a.fullName} className="h-16 w-16 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-fg">{a.fullName}</span>
                  <span className="badge tint-indigo">{a.graduationYear}</span>
                </div>
                <div className="text-sm text-indigo-600 dark:text-indigo-400">{a.occupation}</div>
                <p className="mt-1 line-clamp-2 text-xs text-muted">{a.description}</p>
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                <button className="btn-icon" onClick={() => setEdit(a)}><IcoEdit className="h-3.5 w-3.5" /></button>
                <button className="btn-icon hover:bg-rose-500/10 hover:text-rose-600"
                  onClick={() => { if (confirm("O'chirilsinmi?")) removeAlumnus(a.id) }}>
                  <IcoTrash className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!edit} onClose={() => setEdit(null)} title="Faxriy bitiruvchi">
        {edit && (
          <div className="space-y-4">
            <PhotoInput value={edit.photo} onChange={(v) => setEdit({ ...edit, photo: v })}
              name={edit.fullName} shape="rounded" size="h-24 w-24" />
            <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
              <Field label="F.I.Sh.">
                <input className="input" value={edit.fullName} onChange={(e) => setEdit({ ...edit, fullName: e.target.value })} />
              </Field>
              <Field label="Bitirgan yili">
                <input type="number" min={1900} max={2100} className="input" value={edit.graduationYear}
                  onChange={(e) => setEdit({ ...edit, graduationYear: +e.target.value })} />
              </Field>
            </div>
            <Field label="Kasbi / lavozimi">
              <input className="input" value={edit.occupation} onChange={(e) => setEdit({ ...edit, occupation: e.target.value })} />
            </Field>
            <Field label="Ta'rif">
              <textarea className="input min-h-[100px] resize-y" value={edit.description}
                onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
            </Field>
            <div className="flex justify-end gap-2 border-t border-line pt-4">
              <button className="btn-ghost" onClick={() => setEdit(null)}>Bekor qilish</button>
              <button className="btn-primary" disabled={!edit.fullName.trim()}
                onClick={() => { upsertAlumnus(edit); setEdit(null) }}>
                <IcoOk className="h-4 w-4" /> Saqlash
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}

/* ═══════════════════════ Yangiliklar ═══════════════════════ */

const blankNews = (): NewsItem => ({
  id: newId('nw'),
  title: '',
  date: new Date().toISOString().slice(0, 10),
  summary: '',
  body: '',
  photo: undefined,
})

function NewsTab() {
  const { news } = useStore((s) => s.site)
  const { upsertNews, removeNews } = useStore()
  const [edit, setEdit] = useState<NewsItem | null>(null)

  const list = [...news].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted">{list.length} ta yangilik</p>
        <button className="btn-primary" onClick={() => setEdit(blankNews())}>
          <IcoPlus className="h-4 w-4" /> Qo'shish
        </button>
      </div>

      {list.length === 0 ? (
        <Empty text="Yangiliklar yo'q." />
      ) : (
        <div className="space-y-2">
          {list.map((n) => (
            <div key={n.id} className="card flex gap-3 p-3">
              <Photo src={n.photo} name={n.title} icon className="h-14 w-20 shrink-0" shape="rounded" />
              <div className="min-w-0 flex-1">
                <div className="text-xs text-faint">
                  {new Date(n.date).toLocaleDateString('uz-UZ', { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
                <div className="truncate font-medium text-fg">{n.title}</div>
                <p className="line-clamp-1 text-xs text-muted">{n.summary}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button className="btn-icon" onClick={() => setEdit(n)}><IcoEdit className="h-3.5 w-3.5" /></button>
                <button className="btn-icon hover:bg-rose-500/10 hover:text-rose-600"
                  onClick={() => { if (confirm("O'chirilsinmi?")) removeNews(n.id) }}>
                  <IcoTrash className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!edit} onClose={() => setEdit(null)} wide title="Yangilik">
        {edit && (
          <div className="space-y-4">
            <PhotoInput value={edit.photo} onChange={(v) => setEdit({ ...edit, photo: v })}
              name={edit.title} shape="rounded" size="h-24 w-32" />
            <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
              <Field label="Sarlavha">
                <input className="input" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
              </Field>
              <Field label="Sana">
                <input type="date" className="input" value={edit.date} onChange={(e) => setEdit({ ...edit, date: e.target.value })} />
              </Field>
            </div>
            <Field label="Qisqa mazmun" hint="Ro'yxatda ko'rinadi">
              <textarea className="input min-h-[70px] resize-y" value={edit.summary}
                onChange={(e) => setEdit({ ...edit, summary: e.target.value })} />
            </Field>
            <Field label="To'liq matn" hint="Paragraflar bo'sh qator bilan ajratiladi">
              <textarea className="input min-h-[160px] resize-y" value={edit.body}
                onChange={(e) => setEdit({ ...edit, body: e.target.value })} />
            </Field>
            <div className="flex justify-end gap-2 border-t border-line pt-4">
              <button className="btn-ghost" onClick={() => setEdit(null)}>Bekor qilish</button>
              <button className="btn-primary" disabled={!edit.title.trim()}
                onClick={() => { upsertNews(edit); setEdit(null) }}>
                <IcoOk className="h-4 w-4" /> Saqlash
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
