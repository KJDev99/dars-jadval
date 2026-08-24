/**
 * Kirish (autentifikatsiya) tizimi.
 *
 * Hozircha tekshiruv brauzerda bajariladi: ma'muriyat login/parol bilan,
 * o'qituvchi esa pasport seriyasi va raqami bilan kiradi.
 * Backendga ulanganda faqat shu fayldagi `loginAdmin` / `loginTeacher`
 * funksiyalari server so'roviga almashtiriladi — qolgan kod o'zgarmaydi.
 *
 * Seans `sessionStorage` da saqlanadi: brauzer oynasi yopilsa chiqib ketiladi.
 */
import { create } from 'zustand'
import type { Role, Session } from './types'
import { useStore } from './store'

const KEY = 'dars-jadval-seans'

/** Seansni saqlangan joydan o'qish — do'kon yaratilishidayoq bajariladi */
function readSession(): Session | null {
  try {
    const raw = globalThis.sessionStorage?.getItem(KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}

function writeSession(s: Session | null) {
  try {
    if (s) globalThis.sessionStorage?.setItem(KEY, JSON.stringify(s))
    else globalThis.sessionStorage?.removeItem(KEY)
  } catch {
    /* saqlash imkoni bo'lmasa ham ilova ishlayveradi */
  }
}

export interface LoginResult {
  ok: boolean
  error?: string
}

interface AuthState {
  session: Session | null
  loginAdmin: (login: string, password: string) => LoginResult
  loginTeacher: (series: string, number: string) => LoginResult
  logout: () => void
}

/** Pasport seriyasi: harflar, katta registrda */
export const normSeries = (v: string) => v.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 2)

/** Pasport raqami: faqat raqamlar */
export const normNumber = (v: string) => v.replace(/\D/g, '').slice(0, 7)

export const useAuth = create<AuthState>()((set) => ({
  session: readSession(),

  loginAdmin: (login, password) => {
    const users = useStore.getState().users
    const u = users.find((x) => x.login.trim().toLowerCase() === login.trim().toLowerCase())
    if (!u) return { ok: false, error: 'Bunday login topilmadi.' }
    if (!u.active) return { ok: false, error: 'Bu hisob vaqtincha faolsizlantirilgan.' }
    if (u.password !== password) return { ok: false, error: "Parol noto'g'ri." }

    const session: Session = { role: u.role, userId: u.id, fullName: u.fullName, startedAt: Date.now() }
    writeSession(session)
    set({ session })
    return { ok: true }
  },

  loginTeacher: (series, number) => {
    const s = normSeries(series)
    const n = normNumber(number)
    if (s.length !== 2) return { ok: false, error: 'Pasport seriyasi 2 ta harfdan iborat (masalan AA).' }
    if (n.length !== 7) return { ok: false, error: 'Pasport raqami 7 ta raqamdan iborat.' }

    const t = useStore
      .getState()
      .teachers.find((x) => (x.passportSeries ?? '').toUpperCase() === s && x.passportNumber === n)
    if (!t) {
      return { ok: false, error: "Bunday pasport ma'lumoti topilmadi. Ma'muriyatga murojaat qiling." }
    }

    const session: Session = { role: 'teacher', userId: t.id, fullName: t.fullName, startedAt: Date.now() }
    writeSession(session)
    set({ session })
    return { ok: true }
  },

  logout: () => {
    writeSession(null)
    set({ session: null })
  },
}))

/* ─────────────────────────── Ruxsatlar ─────────────────────────── */

/** Ma'muriyat paneliga kira oladimi */
export const isAdminRole = (r?: Role) => r === 'director' || r === 'zavuch'

/** Faqat direktorga ruxsat etilgan bo'limlar (foydalanuvchilar, sayt sozlamalari) */
export const isDirector = (r?: Role) => r === 'director'
