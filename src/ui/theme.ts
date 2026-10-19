/**
 * Yorug'/qorong'i mavzu.
 *
 * Boshlang'ich holat — doim YORUG'. Qurilma sozlamasi (prefers-color-scheme)
 * hisobga olinmaydi: foydalanuvchi o'zi tanlamaguncha sayt yorug' bo'ladi.
 * Tanlov localStorage'da saqlanadi.
 */
export type Theme = 'light' | 'dark'

const KEY = 'baholash.theme'

export function getTheme(): Theme {
  try {
    return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export function applyTheme(t: Theme): void {
  document.documentElement.classList.toggle('dark', t === 'dark')
  try {
    localStorage.setItem(KEY, t)
  } catch {
    /* maxfiy rejimda localStorage yopiq bo'lishi mumkin — mavzu baribir qo'llanadi */
  }
}

export function initTheme(): void {
  applyTheme(getTheme())
}
