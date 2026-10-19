import { useCallback, useEffect, useState } from 'react'
import { supabase, errText } from '../../lib/supabase'
import { useToast } from '../../ui/Toast'
import { Field, Loading, Modal } from '../../ui/ui'
import { IcoPlus, IcoTrash } from '../../ui/icons'
import type { Group, Student } from '../../lib/types'

/**
 * Bo'linadigan fanlar (ingliz, rus tili) uchun guruhlar.
 * O'qituvchi sinfni guruhlarga ajratadi va faqat o'z guruhini baholaydi.
 */
export default function GroupsModal({
  open,
  onClose,
  classId,
  subjectId,
  className,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  classId: string
  subjectId: number
  className: string
  onSaved: () => void
}) {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [groups, setGroups] = useState<Group[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [members, setMembers] = useState<Record<string, string[]>>({}) // group_id → student_id[]
  const [name, setName] = useState('')

  const load = useCallback(async () => {
    if (!open) return
    setLoading(true)
    const [g, s] = await Promise.all([
      supabase
        .from('groups')
        .select('*')
        .eq('class_id', classId)
        .eq('subject_id', subjectId)
        .order('name'),
      supabase.from('students').select('*').eq('class_id', classId).order('order_no').order('full_name'),
    ])
    const gl = (g.data as Group[]) ?? []
    setGroups(gl)
    setStudents((s.data as Student[]) ?? [])

    if (gl.length > 0) {
      const gs = await supabase
        .from('group_students')
        .select('*')
        .in('group_id', gl.map((x) => x.id))
      const map: Record<string, string[]> = {}
      for (const row of (gs.data as { group_id: string; student_id: string }[]) ?? []) {
        ;(map[row.group_id] ??= []).push(row.student_id)
      }
      setMembers(map)
    } else {
      setMembers({})
    }
    setLoading(false)
  }, [open, classId, subjectId])

  useEffect(() => {
    void load()
  }, [load])

  async function addGroup() {
    const n = name.trim() || `${groups.length + 1}-guruh`
    const { data, error } = await supabase
      .from('groups')
      .insert({ class_id: classId, subject_id: subjectId, name: n })
      .select()
      .single()
    if (error)
      return toast.err(/duplicate/i.test(error.message) ? 'Bu nomli guruh bor' : errText(error))
    setGroups((l) => [...l, data as Group])
    setName('')
    onSaved()
  }

  async function removeGroup(g: Group) {
    if (!confirm(`«${g.name}» guruhi va unga qo‘yilgan baholar o‘chiriladi. Davom etasizmi?`)) return
    const { error } = await supabase.from('groups').delete().eq('id', g.id)
    if (error) return toast.err(errText(error))
    setGroups((l) => l.filter((x) => x.id !== g.id))
    onSaved()
  }

  async function toggle(groupId: string, studentId: string, on: boolean) {
    if (on) {
      const { error } = await supabase
        .from('group_students')
        .insert({ group_id: groupId, student_id: studentId })
      if (error) return toast.err(errText(error))
      setMembers((m) => ({ ...m, [groupId]: [...(m[groupId] ?? []), studentId] }))
    } else {
      const { error } = await supabase
        .from('group_students')
        .delete()
        .eq('group_id', groupId)
        .eq('student_id', studentId)
      if (error) return toast.err(errText(error))
      setMembers((m) => ({ ...m, [groupId]: (m[groupId] ?? []).filter((x) => x !== studentId) }))
    }
  }

  /** O'quvchi boshqa guruhda bormi */
  const otherGroup = (studentId: string, exclude: string) =>
    groups.find((g) => g.id !== exclude && (members[g.id] ?? []).includes(studentId))

  return (
    <Modal open={open} onClose={onClose} title={`${className} — guruhlar`} wide>
      {loading ? (
        <Loading />
      ) : (
        <div className="space-y-4">
          <div className="flex items-end gap-2">
            <Field label="Yangi guruh nomi">
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={`${groups.length + 1}-guruh`}
                onKeyDown={(e) => e.key === 'Enter' && void addGroup()}
              />
            </Field>
            <button onClick={() => void addGroup()} className="btn-primary mb-0.5">
              <IcoPlus className="h-4 w-4" /> Qo‘shish
            </button>
          </div>

          {groups.length === 0 ? (
            <p className="text-sm text-faint">
              Guruh yo‘q. Sinfni ikkiga bo‘lish uchun ikkita guruh qo‘shing va o‘quvchilarni
              belgilang.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {groups.map((g) => (
                <div key={g.id} className="card p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="font-medium text-fg">
                      {g.name}
                      <span className="ml-1.5 text-xs text-muted">
                        ({(members[g.id] ?? []).length})
                      </span>
                    </div>
                    <button
                      onClick={() => void removeGroup(g)}
                      className="btn-icon text-rose-500"
                      title="Guruhni o‘chirish"
                    >
                      <IcoTrash className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="max-h-60 space-y-1 overflow-y-auto">
                    {students.map((s) => {
                      const on = (members[g.id] ?? []).includes(s.id)
                      const other = otherGroup(s.id, g.id)
                      return (
                        <label
                          key={s.id}
                          className={`flex items-center gap-2 rounded px-1.5 py-1 text-sm ${
                            other ? 'opacity-40' : 'hover:bg-raised'
                          }`}
                          title={other ? `${other.name}da` : undefined}
                        >
                          <input
                            type="checkbox"
                            checked={on}
                            disabled={!!other}
                            onChange={(e) => void toggle(g.id, s.id, e.target.checked)}
                          />
                          <span className="flex-1 truncate text-fg-2">{s.full_name}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end">
            <button onClick={onClose} className="btn-primary">
              Tayyor
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
