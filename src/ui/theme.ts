/** Yorug'/qorong'i mavzu — tanlov localStorage'da saqlanadi */
export type Theme = 'light' | 'dark' | 'system'

const KEY = 'baholash.theme'

export function getTheme(): Theme {
  const v = localStorage.getItem(KEY)
  return v === 'light' || v === 'dark' ? v : 'system'
}

export function applyTheme(t: Theme): void {
  const dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
  if (t === 'system') localStorage.removeItem(KEY)
  else localStorage.setItem(KEY, t)
}

export function initTheme(): void {
  applyTheme(getTheme())
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getTheme() === 'system') applyTheme('system')
  })
}
