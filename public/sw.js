/*
 * Service worker — ilovani telefon va kompyuterga o'rnatish hamda
 * internetsiz ishlashi uchun.
 *
 * Strategiya:
 *   · sahifa so'rovlari (navigate) — avval tarmoq, ulanmasa keshdagi qobiq
 *   · /assets/… (nomida xesh bor, hech qachon o'zgarmaydi) — avval kesh
 *   · qolgan o'z domenidagi fayllar — avval kesh, orqa fonda yangilanadi
 *
 * Yangi versiya chiqarilganda `VERSION` ni o'zgartirish kifoya: eski keshlar
 * `activate` bosqichida o'chiriladi.
 */
const VERSION = 'v1'
const SHELL = `dars-jadval-shell-${VERSION}`
const ASSETS = `dars-jadval-assets-${VERSION}`

/** Ilova qobig'i — o'rnatilganda darhol keshlanadi */
const SHELL_FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './favicon.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      // Bitta fayl topilmasa ham o'rnatish to'xtab qolmasin
      .then((cache) => Promise.allSettled(SHELL_FILES.map((f) => cache.add(f))))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== SHELL && k !== ASSETS).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  )
})

/** Sahifani ochish: yangi versiyani olishga urinamiz, bo'lmasa keshdagisi */
async function handlePage(request) {
  try {
    const fresh = await fetch(request)
    const cache = await caches.open(SHELL)
    cache.put('./index.html', fresh.clone())
    return fresh
  } catch {
    const cache = await caches.open(SHELL)
    return (await cache.match('./index.html')) ?? (await cache.match('./')) ?? Response.error()
  }
}

/** Xeshlangan fayllar — bir marta keshlansa yetarli */
async function handleAsset(request) {
  const cache = await caches.open(ASSETS)
  const hit = await cache.match(request)
  if (hit) return hit
  const fresh = await fetch(request)
  if (fresh.ok) cache.put(request, fresh.clone())
  return fresh
}

/** Qolgan fayllar — keshdan beramiz, orqa fonda yangilaymiz */
async function handleOther(request) {
  const cache = await caches.open(SHELL)
  const hit = await cache.match(request)
  const network = fetch(request)
    .then((res) => {
      if (res.ok) cache.put(request, res.clone())
      return res
    })
    .catch(() => hit)
  return hit ?? network
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(handlePage(request))
    return
  }
  if (url.pathname.includes('/assets/')) {
    event.respondWith(handleAsset(request))
    return
  }
  event.respondWith(handleOther(request))
})

/** Sahifa «yangilanishni hoziroq qo'llash» deb so'rasa */
self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting()
})
