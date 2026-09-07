/**
 * Ilova ikonkalarini yaratadi (PNG).  Ishga tushirish:  npm run icons
 *
 * Tashqi kutubxona ishlatilmaydi: rasm piksel-piksel chiziladi va Node ning
 * o'z `zlib` moduli bilan PNG ga o'raladi. Chekkalar silliq chiqishi uchun
 * har piksel 3×3 nuqtada namuna olinadi (supersampling).
 *
 * Natija `public/` ga tushadi va `manifest.webmanifest` shularni ko'rsatadi.
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'public')

/* ─────────────────────────── PNG yozuvchi ─────────────────────────── */

const CRC_TABLE = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let c = ~0
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return ~c >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

/** RGBA baytlaridan PNG fayl yasaydi */
function encodePng(w, h, rgba) {
  const stride = w * 4
  const raw = Buffer.alloc((stride + 1) * h)
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0 // filtr turi: yo'q
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8 // bit chuqurligi
  ihdr[9] = 6 // rang turi: RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/* ─────────────────────────── Shakl chizish ─────────────────────────── */

/** Barcha o'lchamlar 512×512 maydonda hisoblanadi */
const U = 512

/** Nuqta yumaloq to'rtburchak ichidami */
function inRoundRect(x, y, rx, ry, rw, rh, r) {
  if (x < rx || y < ry || x > rx + rw || y > ry + rh) return false
  const dx = Math.max(rx + r - x, 0, x - (rx + rw - r))
  const dy = Math.max(ry + r - y, 0, y - (ry + rh - r))
  return dx * dx + dy * dy <= r * r
}

/** Indigo → binafsha o'tish rangi */
function gradient(x, y) {
  const t = Math.min(1, Math.max(0, (x + y) / (2 * U)))
  return [
    Math.round(79 + (124 - 79) * t), // #4f46e5 → #7c3aed
    Math.round(70 + (58 - 70) * t),
    Math.round(229 + (237 - 229) * t),
  ]
}

/**
 * Belgi — dars jadvali (kalendar): ikkita ilgak, oq kartochka,
 * ichida ochiq «oyna» va 3×2 katakcha.
 */
const DOTS = []
for (let c = 0; c < 3; c++) {
  for (let r = 0; r < 2; r++) {
    DOTS.push([160 + c * 74, 222 + r * 88])
  }
}

function inGlyph(x, y) {
  if (inRoundRect(x, y, 170, 92, 26, 58, 13)) return true // chap ilgak
  if (inRoundRect(x, y, 316, 92, 26, 58, 13)) return true // o'ng ilgak
  if (!inRoundRect(x, y, 104, 124, 304, 296, 44)) return false // kartochka
  if (!inRoundRect(x, y, 136, 196, 240, 192, 20)) return true // yuqori oq lenta va ramka
  for (const [dx, dy] of DOTS) if (inRoundRect(x, y, dx, dy, 44, 52, 12)) return true
  return false
}

/**
 * Bitta nuqtaning rangi.
 *   fullBleed — fon butun kvadratni to'ldiradi (maskable va iOS uchun)
 *   scale     — belgi kattaligi (maskable da xavfsiz zonaga sig'ishi kerak)
 */
function samplePoint(x, y, { fullBleed, scale }) {
  if (!fullBleed && !inRoundRect(x, y, 0, 0, U, U, 112)) return null
  const gx = (x - U / 2) / scale + U / 2
  const gy = (y - U / 2) / scale + U / 2
  if (inGlyph(gx, gy)) return [255, 255, 255]
  return gradient(x, y)
}

/** Ikonkani chizib, PNG buferini qaytaradi */
function draw(size, opts) {
  const SS = 3 // har pikselda 3×3 namuna
  const rgba = Buffer.alloc(size * size * 4)
  const step = U / size
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = (px + (sx + 0.5) / SS) * step
          const y = (py + (sy + 0.5) / SS) * step
          const c = samplePoint(x, y, opts)
          if (c) {
            r += c[0]
            g += c[1]
            b += c[2]
            a += 255
          }
        }
      }
      const n = SS * SS
      const i = (py * size + px) * 4
      // Shaffof qismlarda rang o'rtachasi faqat to'ldirilgan namunalardan olinadi
      const filled = a / 255
      rgba[i] = filled ? Math.round(r / filled) : 0
      rgba[i + 1] = filled ? Math.round(g / filled) : 0
      rgba[i + 2] = filled ? Math.round(b / filled) : 0
      rgba[i + 3] = Math.round(a / n)
    }
  }
  return encodePng(size, size, rgba)
}

/* ─────────────────────────── SVG (aniq favicon) ─────────────────────── */

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#4f46e5"/>
      <stop offset="1" stop-color="#7c3aed"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#g)"/>
  <g fill="#fff">
    <rect x="170" y="92" width="26" height="58" rx="13"/>
    <rect x="316" y="92" width="26" height="58" rx="13"/>
    <path fill-rule="evenodd" d="M148 124h216a44 44 0 0 1 44 44v208a44 44 0 0 1-44 44H148a44 44 0 0 1-44-44V168a44 44 0 0 1 44-44Zm-12 72v192h240V196H136Z"/>
${DOTS.map(([x, y]) => `    <rect x="${x}" y="${y}" width="44" height="52" rx="12"/>`).join('\n')}
  </g>
</svg>
`

/* ─────────────────────────────── Yozish ─────────────────────────────── */

mkdirSync(OUT, { recursive: true })

const FILES = [
  ['icon-192.png', 192, { fullBleed: false, scale: 1 }],
  ['icon-512.png', 512, { fullBleed: false, scale: 1 }],
  ['icon-maskable-192.png', 192, { fullBleed: true, scale: 0.76 }],
  ['icon-maskable-512.png', 512, { fullBleed: true, scale: 0.76 }],
  ['apple-touch-icon.png', 180, { fullBleed: true, scale: 0.86 }],
  ['favicon.png', 64, { fullBleed: false, scale: 1 }],
]

for (const [name, size, opts] of FILES) {
  const buf = draw(size, opts)
  writeFileSync(join(OUT, name), buf)
  console.log(`  ${name.padEnd(26)} ${size}×${size}  ${(buf.length / 1024).toFixed(1)} KB`)
}

writeFileSync(join(OUT, 'icon.svg'), svg)
console.log(`  ${'icon.svg'.padEnd(26)} vektor    ${(svg.length / 1024).toFixed(1)} KB`)
