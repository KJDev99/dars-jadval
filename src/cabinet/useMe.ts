import { useMemo } from 'react'
import { useStore } from '../store'
import { useAuth } from '../authStore'
import { buildIndex } from '../lib/view'
import { resolveTeacherConstraints } from '../lib/rules'
import type { Teacher } from '../types'

/** Kabinetdagi o'qituvchi va unga tegishli hisob-kitoblar */
export function useMe() {
  const session = useAuth((s) => s.session)
  const { teachers, classes, settings, schedule, rules, requests } = useStore()

  const teacher = teachers.find((t) => t.id === session?.userId) as Teacher | undefined

  const idx = useMemo(
    () => buildIndex(schedule, classes, teachers, settings),
    [schedule, classes, teachers, settings],
  )

  const constraints = useMemo(
    () => resolveTeacherConstraints(teachers, rules, settings.pedagogicalDays),
    [teachers, rules, settings.pedagogicalDays],
  )

  const myRequests = useMemo(
    () => requests.filter((r) => r.teacherId === session?.userId).sort((a, b) => b.createdAt - a.createdAt),
    [requests, session],
  )

  return {
    teacher,
    idx,
    constraints: teacher ? constraints[teacher.id] : undefined,
    myRequests,
    classes,
    settings,
    schedule,
  }
}

/** Bugungi kun raqami (0 = dushanba ... 5 = shanba), yakshanba bo'lsa -1 */
export function todayIndex(): number {
  const d = new Date().getDay() // 0 = yakshanba
  return d === 0 ? -1 : d - 1
}
