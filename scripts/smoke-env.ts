/**
 * Smoke sinovi uchun brauzer muhitini taqlid qiladi.
 *
 * Bu modul `authStore` dan OLDIN yuklanishi shart: seansni sessionStorage ga
 * yozib qo'yamiz, shunda do'kon yaratilishidayoq kirgan foydalanuvchi bilan
 * ishga tushadi (server renderi keyingi o'zgarishlarni ko'rmaydi).
 */
import { defaultClasses, defaultTeachers } from '../src/data/seed'
import { defaultUsers } from '../src/data/site-seed'

class MemoryStorage implements Storage {
  private map = new Map<string, string>()
  get length() {
    return this.map.size
  }
  clear() {
    this.map.clear()
  }
  getItem(k: string) {
    return this.map.get(k) ?? null
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null
  }
  removeItem(k: string) {
    this.map.delete(k)
  }
  setItem(k: string, v: string) {
    this.map.set(k, String(v))
  }
}

const g = globalThis as unknown as { sessionStorage?: Storage; localStorage?: Storage }
if (!g.sessionStorage) g.sessionStorage = new MemoryStorage()

const phase = process.env.SMOKE ?? 'public'

/** Sinovda ishlatiladigan o'qituvchi — kabinet bosqichida shu hisob bilan kiriladi */
export const SMOKE_TEACHER = defaultTeachers(defaultClasses())[3]

function session(role: string, userId: string, fullName: string) {
  g.sessionStorage!.setItem(
    'dars-jadval-seans',
    JSON.stringify({ role, userId, fullName, startedAt: 0 }),
  )
}

if (phase === 'cabinet') {
  session('teacher', SMOKE_TEACHER.id, SMOKE_TEACHER.fullName)
} else if (phase === 'admin' || phase === 'zavuch') {
  const want = phase === 'admin' ? 'director' : 'zavuch'
  const u = defaultUsers().find((x) => x.role === want)!
  session(u.role, u.id, u.fullName)
}
