import { useEffect, useState } from 'react'
import type { Settings } from '../types'

export type ThemeMode = Settings['theme']

const MEDIA = '(prefers-color-scheme: dark)'

export function isDark(mode: ThemeMode): boolean {
  if (mode === 'dark') return true
  if (mode === 'light') return false
  return typeof window !== 'undefined' && window.matchMedia(MEDIA).matches
}

function apply(mode: ThemeMode) {
  document.documentElement.classList.toggle('dark', isDark(mode))
}

/** Mavzuni <html> elementiga qo'llaydi va tizim mavzusi o'zgarishini kuzatadi */
export function useTheme(mode: ThemeMode) {
  useEffect(() => {
    apply(mode)
    if (mode !== 'system') return
    const mq = window.matchMedia(MEDIA)
    const onChange = () => apply('system')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [mode])
}

export const THEME_LABELS: Record<ThemeMode, string> = {
  light: 'Yorug‘',
  dark: 'Qorong‘i',
  system: 'Tizim',
}

/** Hozir qorong'i mavzu faolmi (tizim mavzusi o'zgarishini ham kuzatadi) */
export function useIsDark(mode: ThemeMode): boolean {
  const [dark, setDark] = useState(() => isDark(mode))
  useEffect(() => {
    setDark(isDark(mode))
    if (mode !== 'system') return
    const mq = window.matchMedia(MEDIA)
    const onChange = () => setDark(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [mode])
  return dark
}

/**
 * Fan rangidan mavzuga mos fon hosil qiladi.
 * Qorong'i mavzuda tiniqroq, yorug'ida yumshoqroq.
 */
export function tintOf(color: string, dark: boolean): string {
  return color + (dark ? '30' : '1f')
}
