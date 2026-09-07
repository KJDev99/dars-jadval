/**
 * Ilovani telefon va kompyuterga o'rnatish (PWA).
 *
 * Brauzer ilova o'rnatishga tayyor bo'lganda `beforeinstallprompt` hodisasini
 * yuboradi. U React ilgari yuklanishi mumkin, shuning uchun hodisa modul
 * darajasida — ilova chizilishidan oldin — ushlab olinadi.
 */
import { useSyncExternalStore } from 'react'

/** Brauzer taklifini keyinga qoldirish uchun hodisa turi */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'dars-jadval-ornatish-yopildi'

let deferred: InstallPromptEvent | null = null
let installed = false
let version = 0

const listeners = new Set<() => void>()
const emit = () => {
  version++
  for (const l of listeners) l()
}

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

const hasWindow = typeof window !== 'undefined'

if (hasWindow) {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Brauzerning o'z bannerini to'xtatamiz — taklifni o'zimiz ko'rsatamiz
    e.preventDefault()
    deferred = e as InstallPromptEvent
    emit()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    installed = true
    try {
      localStorage.removeItem(DISMISS_KEY)
    } catch {
      /* saqlagich yopiq bo'lsa muhim emas */
    }
    emit()
  })
}

/** Ilova alohida oynada (o'rnatilgan holatda) ochilganmi */
export function isStandalone(): boolean {
  if (!hasWindow) return false
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true
  if (window.matchMedia?.('(display-mode: minimal-ui)').matches) return true
  // iOS Safari o'zining eski bayrog'ini ishlatadi
  return (window.navigator as Navigator & { standalone?: boolean }).standalone === true
}

/** iPhone yoki iPad — u yerda o'rnatish faqat qo'lda qilinadi */
export function isApple(): boolean {
  if (!hasWindow) return false
  const ua = window.navigator.userAgent
  if (/iphone|ipad|ipod/i.test(ua)) return true
  // iPadOS 13 dan boshlab o'zini Mac deb tanishtiradi
  return /macintosh/i.test(ua) && window.navigator.maxTouchPoints > 1
}

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

/** Taklifni yopish — keyingi safar ko'rsatilmaydi */
export function dismissInstall() {
  try {
    localStorage.setItem(DISMISS_KEY, '1')
  } catch {
    /* saqlagich yopiq bo'lsa ham taklif shu seansda yopiladi */
  }
  emit()
}

/** O'rnatish oynasini ochish. `true` — foydalanuvchi rozi bo'ldi */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false
  const e = deferred
  // Taklifni ikki marta ishlatib bo'lmaydi
  deferred = null
  emit()
  await e.prompt()
  const { outcome } = await e.userChoice
  if (outcome === 'accepted') {
    installed = true
    emit()
  }
  return outcome === 'accepted'
}

export interface InstallState {
  /** Brauzer o'rnatishga tayyor — tugma bosilsa oyna chiqadi */
  canPrompt: boolean
  /** Ilova allaqachon o'rnatilgan yoki o'rnatilgan holatda ochilgan */
  installed: boolean
  /** Hozir alohida oynada ishlayaptimi */
  standalone: boolean
  /** iOS — qo'lda o'rnatish yo'riqnomasi ko'rsatiladi */
  apple: boolean
  /** Foydalanuvchi taklifni yopganmi */
  dismissed: boolean
}

/** O'rnatish holatini kuzatuvchi hook */
export function useInstall(): InstallState {
  useSyncExternalStore(
    subscribe,
    () => version,
    () => 0,
  )
  const standalone = isStandalone()
  return {
    canPrompt: deferred !== null,
    installed: installed || standalone,
    standalone,
    apple: isApple(),
    dismissed: readDismissed(),
  }
}

/**
 * Service worker ni ro'yxatdan o'tkazish.
 * Faqat yig'ilgan (production) ilovada — dev rejimida modullar keshlanib
 * qolmasligi uchun, aksincha, eski ro'yxatdan o'tish bekor qilinadi.
 */
export function registerServiceWorker(production: boolean) {
  if (!hasWindow || !('serviceWorker' in navigator)) return

  if (!production) {
    navigator.serviceWorker.getRegistrations?.().then((list) => {
      for (const reg of list) void reg.unregister()
    })
    return
  }

  window.addEventListener('load', () => {
    const base = import.meta.env.BASE_URL || '/'
    navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch(() => {
      // O'rnatilmasa ilova baribir ishlaydi — faqat oflayn rejim bo'lmaydi
    })
  })
}
