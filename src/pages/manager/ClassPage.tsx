import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase, errText } from '../../lib/supabase'
import { useToast } from '../../ui/Toast'
import { Field, Loading, Page, PageHeader, TableWrap } from '../../ui/ui'
import { IcoPlus, IcoTrash, IcoEdit, IcoCheck, IcoClose } from '../../ui/icons'
import { pct, ball } from '../../lib/grading'
import type { Profile, SchoolClass, Student, StudentQuarterAvg, Subject } from '../../lib/types'

interface AssignmentRow {
  id: string
  subject_id: number
  teacher_id: string
  group_id: string | null
}

export default function ClassPage() {
  const { classId } = useParams()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [cls, setCls] = useState<SchoolClass | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [assignments, setAssignments] = useState<AssignmentRow[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [teachers, setTeachers] = useState<Profile[]>([])
  const [avgs, setAvgs] = useState<StudentQuarterAvg[]>([])
  const [newName, setNewName] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  const load = useCallback(async () => {
    if (!classId) return
    const [c, st, asg, sub, te, av] = await Promise.all([
      supabase.from('classes').select('*').eq('id', classId).maybeSingle(),
      supabase.from('students').select('*').eq('class_id', classId).order('order_no').order('full_name'),
      supabase.from('assignments').select('id, subject_id, teacher_id, group_id').eq('class_id', classId),
      supabase.from('subjects').select('*').order('name'),
      supabase.from('profiles').select('*').eq('role', 'teacher'),
      supabase.from('v_student_quarter_avg').select('*').eq('class_id', classId),
    ])
    setCls((c.data as SchoolClass) ?? null)
    setStudents((st.data as Student[]) ?? [])
    setAssignments((asg.data as AssignmentRow[]) ?? [])
    setSubjects((sub.data as Subject[]) ?? [])
    setTeachers((te.data as Profile[]) ?? [])
    setAvgs((av.data as StudentQuarterAvg[]) ?? [])
    setLoading(false)
  }, [classId])

  useEffect(() => {
    void load()
  }, [load])

  async function addStudent() {
    const name = newName.trim().replace(/\s+/g, ' ')
    if (name.length < 3 || !classId) return
    const order_no = (students.at(-1)?.order_no ?? 0) + 1
    const { data, error } = await supabase
      .from('students')
      .insert({ class_id: classId, full_name: name, order_no })
      .select()
      .single()
    if (error) return toast.err(errText(error))
    setStudents((l) => [...l, data as Student])
    setNewName('')
  }

  async function rename(s: Student) {
    const name = editName.trim().replace(/\s+/g, ' ')
    if (name.length < 3) return
    const { error } = await supabase.from('students').update({ full_name: name }).eq('id', s.id)
    if (error) return toast.err(errText(error))
    setStudents((l) => l.map((x) => (x.id === s.id ? { ...x, full_name: name } : x)))
    setEditing(null)
  }

  async function removeStudent(s: Student) {
    if (!confirm(`${s.full_name} va uning barcha baholari o‘chiriladi. Davom etasizmi?`)) return
    const { error } = await supabase.from('students').delete().eq('id', s.id)
    if (error) return toast.err(errText(error))
    setStudents((l) => l.filter((x) => x.id !== s.id))
    toast.ok('O‘quvchi o‘chirildi')
  }

  if (loading) return <Loading />
  if (!cls) return <Page>Sinf topilmadi</Page>

  const subjName = new Map(subjects.map((s) => [s.id, s.name]))
  const teacherName = new Map(teachers.map((t) => [t.id, `${t.last_name} ${t.first_name}`]))

  // O'quvchi bo'yicha choraklar o'rtachasi
  const byStudent = new Map<string, Record<number, number>>()
  for (const a of avgs) {
    const rec = byStudent.get(a.student_id) ?? {}
    rec[a.quarter] = a.avg_pct
    byStudent.set(a.student_id, rec)
  }

  return (
    <Page>
      <PageHeader
        title={`${cls.grade}${cls.letter} sinfi`}
        subtitle={`${students.length} o‘quvchi · ${assignments.length} fan biriktirilgan`}
        actions={
          <Link to="/classes" className="btn-ghost">
            ← Sinflar
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div>
          <TableWrap>
            <table className="w-full min-w-[640px]">
              <thead className="border-b border-line bg-raised">
                <tr>
                  <th className="th w-10">#</th>
                  <th className="th">F.I.Sh.</th>
                  <th className="th text-center">1-ch</th>
                  <th className="th text-center">2-ch</th>
                  <th className="th text-center">3-ch</th>
                  <th className="th text-center">4-ch</th>
                  <th className="th text-right">Amal</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s, i) => {
                  const q = byStudent.get(s.id) ?? {}
                  return (
                    <tr key={s.id} className="border-b border-line-soft last:border-0">
                      <td className="td text-faint">{i + 1}</td>
                      <td className="td">
                        {editing === s.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              className="input py-1"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') void rename(s)
                                if (e.key === 'Escape') setEditing(null)
                              }}
                              autoFocus
                            />
                            <button onClick={() => void rename(s)} className="btn-icon text-emerald-600">
                              <IcoCheck className="h-4 w-4" />
                            </button>
                            <button onClick={() => setEditing(null)} className="btn-icon">
                              <IcoClose className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <span className="font-medium text-fg">{s.full_name}</span>
                        )}
                      </td>
                      {[1, 2, 3, 4].map((n) => (
                        <td key={n} className="td text-center tabular-nums">
                          {q[n] !== undefined ? pct(q[n]) : <span className="text-faint">—</span>}
                        </td>
                      ))}
                      <td className="td">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              setEditing(s.id)
                              setEditName(s.full_name)
                            }}
                            className="btn-icon"
                            title="Nomini tahrirlash"
                          >
                            <IcoEdit className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => void removeStudent(s)}
                            className="btn-icon text-rose-500"
                            title="O‘chirish"
                          >
                            <IcoTrash className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </TableWrap>

          <div className="mt-3 flex items-end gap-2">
            <Field label="Yangi o‘quvchi">
              <input
                className="input"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void addStudent()}
                placeholder="Aliyev Vali Alievich"
              />
            </Field>
            <button onClick={() => void addStudent()} className="btn-primary mb-0.5">
              <IcoPlus className="h-4 w-4" /> Qo‘shish
            </button>
          </div>
        </div>

        <div className="card p-5">
          <h2 className="mb-3 text-sm font-semibold text-fg">Fanlar va o‘qituvchilar</h2>
          {assignments.length === 0 ? (
            <p className="text-sm text-faint">
              Hali hech bir o‘qituvchi bu sinfni o‘z jurnaliga qo‘shmagan. O‘qituvchi o‘zi tanlaydi.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {assignments
                .slice()
                .sort((a, b) =>
                  (subjName.get(a.subject_id) ?? '').localeCompare(subjName.get(b.subject_id) ?? ''),
                )
                .map((a) => (
                  <li key={a.id} className="flex items-start justify-between gap-3 border-b border-line-soft pb-2 last:border-0">
                    <div>
                      <div className="font-medium text-fg">{subjName.get(a.subject_id)}</div>
                      <div className="text-xs text-muted">{teacherName.get(a.teacher_id) ?? '—'}</div>
                    </div>
                    {a.group_id && <span className="badge border tint-indigo">guruh</span>}
                  </li>
                ))}
            </ul>
          )}

          <div className="mt-4 border-t border-line pt-3">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              Sinf o‘rtachasi
            </h3>
            <div className="grid grid-cols-4 gap-2 text-center">
              {[1, 2, 3, 4].map((n) => {
                const list = avgs.filter((a) => a.quarter === n)
                const v = list.length
                  ? list.reduce((s, a) => s + a.avg_pct, 0) / list.length
                  : null
                return (
                  <div key={n} className="rounded-lg bg-raised p-2">
                    <div className="text-[11px] text-muted">{n}-chorak</div>
                    <div className="text-sm font-semibold tabular-nums text-fg">{ball(v, 1)}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </Page>
  )
}
