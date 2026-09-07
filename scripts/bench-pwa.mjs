/**
 * Ilova o'rnatiladigan holatga keltirilganini tekshiradi.
 * Ishga tushirish:  npm run bench:pwa   (avval `npm run build`)
 *
 * Brauzer ilovani o'rnatishga ruxsat berishi uchun quyidagilar kerak:
 *   · to'g'ri manifest (nom, start_url, display, 192 va 512 px ikonkalar)
 *   · `fetch` hodisasini eshitadigan service worker
 *   · index.html da manifestga havola
 * Shu shartlarning har biri shu yerda tekshiriladi.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(ROOT, 'dist')

let failures = 0
const ok = (cond, label, detail = '') => {
  console.log(`  ${cond ? '✓' : '✗'} ${label}${detail ? '  — ' + detail : ''}`)
  if (!cond) failures++
}

if (!existsSync(DIST)) {
  console.error("dist/ topilmadi. Avval `npm run build` ni bajaring.")
  process.exit(1)
}

const read = (p) => readFileSync(join(DIST, p))
const has = (p) => existsSync(join(DIST, p))

/** PNG sarlavhasidan o'lcham va rang turini o'qish */
function pngInfo(buf) {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10]
  for (let i = 0; i < 8; i++) if (buf[i] !== signature[i]) return null
  if (buf.toString('latin1', 12, 16) !== 'IHDR') return null
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    depth: buf[24],
    colorType: buf[25],
  }
}

/* ═══════════════════ 1. Manifest ═══════════════════ */

console.log('=== 1. MANIFEST ===')
let manifest = null
{
  ok(has('manifest.webmanifest'), 'manifest.webmanifest yig‘ilmaga tushdi')
  try {
    manifest = JSON.parse(read('manifest.webmanifest').toString('utf8'))
    ok(true, 'JSON to‘g‘ri o‘qildi')
  } catch (e) {
    ok(false, 'JSON to‘g‘ri o‘qildi', e.message)
  }
}

if (manifest) {
  ok(typeof manifest.name === 'string' && manifest.name.length > 2, 'name bor', manifest.name)
  ok(
    typeof manifest.short_name === 'string' && manifest.short_name.length <= 12,
    'short_name qisqa (bosh ekranda kesilmaydi)',
    `${manifest.short_name} (${manifest.short_name?.length} belgi)`,
  )
  ok(!!manifest.start_url, 'start_url bor', manifest.start_url)
  ok(
    ['standalone', 'fullscreen', 'minimal-ui'].includes(manifest.display),
    'display alohida oyna rejimida',
    manifest.display,
  )
  ok(/^#[0-9a-f]{6}$/i.test(manifest.theme_color ?? ''), 'theme_color belgilangan', manifest.theme_color)
  ok(
    /^#[0-9a-f]{6}$/i.test(manifest.background_color ?? ''),
    'background_color belgilangan (splash ekran)',
    manifest.background_color,
  )
  ok(manifest.lang === 'uz', 'til o‘zbekcha')
  ok(Array.isArray(manifest.shortcuts) && manifest.shortcuts.length > 0,
     'tez havolalar bor (ikonkani bosib turganda chiqadi)',
     `${manifest.shortcuts?.length ?? 0} ta`)
}

/* ═══════════════════ 2. Ikonkalar ═══════════════════ */

console.log('\n=== 2. IKONKALAR ===')
if (manifest) {
  const icons = manifest.icons ?? []
  const png = icons.filter((i) => i.type === 'image/png')

  for (const icon of icons) {
    if (!has(icon.src)) {
      ok(false, `${icon.src} mavjud`)
      continue
    }
    if (icon.type !== 'image/png') {
      ok(true, `${icon.src} mavjud`, icon.type)
      continue
    }
    const info = pngInfo(read(icon.src))
    if (!info) {
      ok(false, `${icon.src} — haqiqiy PNG`)
      continue
    }
    const [w, h] = icon.sizes.split('x').map(Number)
    ok(
      info.width === w && info.height === h,
      `${icon.src} o‘lchami mos`,
      `${info.width}×${info.height}, ${icon.purpose}`,
    )
  }

  const anySizes = png.filter((i) => i.purpose === 'any').map((i) => i.sizes)
  ok(anySizes.includes('192x192'), '192×192 (any) bor — o‘rnatish uchun shart')
  ok(anySizes.includes('512x512'), '512×512 (any) bor — splash ekran uchun shart')

  const maskable = png.filter((i) => i.purpose === 'maskable').map((i) => i.sizes)
  ok(maskable.includes('192x192') && maskable.includes('512x512'),
     'maskable ikonkalar bor — Android ikonkani kesib qo‘ymaydi')

  // Maskable ikonka to'liq to'ldirilgan bo'lishi kerak (shaffof burchak bo'lmasin)
  const m = read('icon-maskable-512.png')
  const mi = pngInfo(m)
  ok(mi?.colorType === 6, 'maskable ikonka RGBA formatda')
}

ok(has('apple-touch-icon.png'), 'apple-touch-icon.png bor — iPhone bosh ekrani uchun')
{
  const info = has('apple-touch-icon.png') ? pngInfo(read('apple-touch-icon.png')) : null
  ok(info?.width === 180 && info?.height === 180, 'apple-touch-icon 180×180',
     info ? `${info.width}×${info.height}` : '')
}
ok(has('favicon.png') && has('icon.svg'), 'brauzer yorlig‘i uchun favicon va SVG bor')

/* ═══════════════════ 3. Service worker ═══════════════════ */

console.log('\n=== 3. SERVICE WORKER ===')
{
  ok(has('sw.js'), 'sw.js yig‘ilmaga tushdi')
  const src = has('sw.js') ? read('sw.js').toString('utf8') : ''

  // Sintaksis xatosi bo'lsa brauzer service worker ni umuman o'rnatmaydi
  let parses = true
  try {
    new Function(src)
  } catch (e) {
    parses = false
    ok(false, 'sintaksis to‘g‘ri', e.message)
  }
  if (parses) ok(true, 'sintaksis to‘g‘ri')

  ok(/addEventListener\(\s*['"]fetch['"]/.test(src),
     'fetch hodisasi eshitiladi — o‘rnatish uchun shart')
  ok(/addEventListener\(\s*['"]install['"]/.test(src), 'install hodisasi bor')
  ok(/addEventListener\(\s*['"]activate['"]/.test(src), 'activate hodisasi bor')
  ok(/caches\.delete/.test(src), 'eski keshlar tozalanadi')
  ok(/skipWaiting/.test(src), 'yangi versiya darhol faollashadi')

  const version = src.match(/const VERSION = '([^']+)'/)?.[1]
  ok(!!version, 'kesh versiyasi belgilangan', version)
}

/* ═══════════════════ 4. index.html ═══════════════════ */

console.log('\n=== 4. INDEX.HTML ===')
{
  const html = read('index.html').toString('utf8')
  ok(/rel="manifest"/.test(html), 'manifestga havola bor')
  ok(/name="theme-color"/.test(html), 'theme-color meta tegi bor')
  ok(/rel="apple-touch-icon"/.test(html), 'apple-touch-icon havolasi bor')
  ok(/apple-mobile-web-app-capable/.test(html), 'iOS uchun to‘liq ekran rejimi yoqilgan')
  ok(/viewport-fit=cover/.test(html), 'viewport telefon «tirnog‘i» ostiga cho‘ziladi')
  ok(/<html lang="uz"/.test(html), 'sahifa tili o‘zbekcha')
}

/* ═══════════════════ 5. Ilova kodi ═══════════════════ */

console.log('\n=== 5. ILOVA KODI ===')
{
  const { readdirSync } = await import('node:fs')
  const assets = readdirSync(join(DIST, 'assets'))
  const main = assets.find((f) => f.startsWith('index-') && f.endsWith('.js'))
  const js = read(join('assets', main)).toString('utf8')
  ok(/serviceWorker/.test(js), 'service worker ro‘yxatdan o‘tkaziladi')
  ok(/beforeinstallprompt/.test(js), 'o‘rnatish taklifi ushlab olinadi')
  ok(/display-mode: standalone/.test(js), 'o‘rnatilgan holat aniqlanadi')

  const size = read(join('assets', main)).length
  console.log(`  asosiy paket: ${(size / 1024).toFixed(0)} KB`)
}

console.log(
  failures === 0
    ? '\n✓ Ilova Android va Windowsga o‘rnatishga tayyor'
    : `\n✗ ${failures} ta muammo`,
)
process.exit(failures === 0 ? 0 : 1)
