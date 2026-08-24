/**
 * Rasm bilan ishlash.
 *
 * Rasmlar hozircha brauzer xotirasida (localStorage) data URL ko'rinishida saqlanadi,
 * shuning uchun yuklashdan oldin kichraytiriladi va JPEG ga siqiladi.
 * Backendga ulanganda bu fayl faylni serverga yuborishga almashtiriladi.
 */

export const MAX_PHOTO_BYTES = 700 * 1024

/** Rasmni kichraytirib data URL ga aylantiradi */
export async function fileToDataUrl(file: File, maxSide = 900, quality = 0.82): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Faqat rasm fayllari qabul qilinadi.')

  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Brauzer rasmni qayta ishlay olmadi.')
  // Shaffof PNG lar uchun oq fon — JPEG shaffoflikni qo'llab-quvvatlamaydi
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close?.()

  let url = canvas.toDataURL('image/jpeg', quality)
  // Juda katta bo'lsa sifatni pasaytirib qayta urinamiz
  for (let q = quality - 0.15; url.length > MAX_PHOTO_BYTES && q >= 0.4; q -= 0.15) {
    url = canvas.toDataURL('image/jpeg', q)
  }
  return url
}

/** F.I.Sh. dan bosh harflar: «Karimov Sherzod» → «KS» */
export function initialsOf(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((p) => p.length > 1 && !/^(o'g'li|qizi|ogli|kizi)$/i.test(p))
  if (parts.length === 0) return '—'
  const first = parts[0][0] ?? ''
  const second = parts[1]?.[0] ?? ''
  return (first + second).toUpperCase()
}

/** Ismdan barqaror rang — o'rin egallagichlar bir xil bo'lib qolmasin */
export function hueOf(seed: string): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360
  return h
}
