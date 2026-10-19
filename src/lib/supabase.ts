import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

/** Sozlamalar yo'q bo'lsa — ilova ochilganda tushunarli xabar chiqadi */
export const configured = Boolean(url && key)

export const supabase = createClient(url || 'http://localhost', key || 'anon', {
  auth: { persistSession: true, autoRefreshToken: true },
})

/** Login uchun ichki email: `aliyev` → `aliyev@maktab.local` */
export const LOGIN_DOMAIN = import.meta.env.VITE_LOGIN_DOMAIN || 'maktab.local'

export const loginToEmail = (login: string) =>
  `${login.trim().toLowerCase()}@${LOGIN_DOMAIN}`

/** Supabase xatolarini o'zbekcha matnga */
export function errText(e: unknown): string {
  const msg = typeof e === 'string' ? e : (e as { message?: string })?.message || ''
  if (/Invalid login credentials/i.test(msg)) return 'Login yoki parol xato'
  if (/User already registered/i.test(msg)) return 'Bu login allaqachon band'
  if (/duplicate key.*profiles_login_key/i.test(msg)) return 'Bu login allaqachon band'
  if (/Password should be at least/i.test(msg)) return 'Parol kamida 6 belgidan bo‘lsin'
  if (/Email address .* is invalid/i.test(msg)) return 'Login faqat lotin harf va raqamlardan bo‘lsin'
  if (/BSB_LIMIT:(-?[\d.]+)/.test(msg)) {
    const left = msg.match(/BSB_LIMIT:(-?[\d.]+)/)![1]
    return `BSB lar jami 50 balldan oshmasligi kerak — yana ${left} ball qoldi`
  }
  if (/CHSB_EXISTS/.test(msg)) return 'Bu chorakda ChSB allaqachon kiritilgan'
  if (/CHSB_POINTS/.test(msg)) return 'ChSB doim 40 ballik bo‘ladi'
  if (/FORBIDDEN/.test(msg)) return 'Bu amal uchun ruxsat yo‘q'
  if (/Failed to fetch|NetworkError/i.test(msg)) return 'Internet yoki server bilan aloqa yo‘q'
  return msg || 'Xatolik yuz berdi'
}

/** RPC chaqiruvi — xatoni istisnoga aylantiradi */
export async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw new Error(error.message)
  return data as T
}
