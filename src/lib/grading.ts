/**
 * Baholash yordamchilari (mijoz tomoni).
 *
 * Chorak = 100 ball:  BSB jami 50  +  ChSB 40  +  o'qituvchi bahosi 10.
 *
 * O'sish qoidasining o'zi serverda (supabase/03_logic.sql) — bu yerda
 * faqat ko'rsatish va avtomatik taklif qilish uchun hisoblar.
 */
import type { JournalRow, Mark } from './types'
import { makeRng } from './rng'

export const QUARTERS = [1, 2, 3, 4] as const
export const BSB_TOTAL = 50
export const CHSB_TOTAL = 40
export const EXTRA_TOTAL = 10

/** Foizdan 5 ballik bahoga */
export function markOf(pct: number | null): Mark | null {
  if (pct === null || !Number.isFinite(pct)) return null
  if (pct >= 86) return 5
  if (pct >= 71) return 4
  if (pct >= 56) return 3
  return 2
}

export const MARK_TINT: Record<Mark, string> = {
  5: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  4: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  3: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  2: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
}

/** 87,5% */
export const pct = (v: number | null | undefined): string =>
  v === null || v === undefined || !Number.isFinite(v)
    ? '—'
    : `${v.toFixed(1).replace(/[.,]0$/, '').replace('.', ',')}%`

/** 4,32 */
export const ball = (v: number | null | undefined, digits = 2): string =>
  v === null || v === undefined || !Number.isFinite(v)
    ? '—'
    : v.toFixed(digits).replace(/[.,]00$/, '').replace('.', ',')

/** O'sish belgisi: +2,4 / −1,1 */
export const delta = (v: number | null): string =>
  v === null || !Number.isFinite(v)
    ? '—'
    : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(1).replace('.', ',')}`

export const deltaTone = (v: number | null): string =>
  v === null || Math.abs(v) < 0.05
    ? 'text-muted'
    : v > 0
      ? 'text-emerald-600 dark:text-emerald-400'
      : 'text-rose-600 dark:text-rose-400'

/** Matndan barqaror son — avtomatik baholash bir xil natija berishi uchun */
function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export interface AutoOptions {
  /** Tarixi yo'q o'quvchiga boshlang'ich daraja, % */
  baseMin?: number
  baseMax?: number
  /** Har safar qancha o'sadi, % */
  stepMin?: number
  stepMax?: number
}

/**
 * Avtomatik baho taklifi.
 *
 * Har bir o'quvchiga o'z darajasidan (base_pct) kichik o'sish qo'shiladi.
 * Hamma o'quvchi o'sgani uchun sinf o'rtachasi ham o'sadi — server
 * tekshiruvi (sinf darajasida) birinchi martadan o'tadi.
 * Tasodif barqaror: bir xil ish uchun natija har safar bir xil chiqadi.
 */
export function autoPoints(
  row: Pick<JournalRow, 'student_id' | 'base_pct'>,
  maxPoints: number,
  seed: string,
  opt: AutoOptions = {},
): number {
  const { baseMin = 68, baseMax = 92, stepMin = 1, stepMax = 4 } = opt
  const rng = makeRng(hash(row.student_id + seed))
  const base = row.base_pct ?? 0

  let target: number
  if (base <= 0) {
    target = baseMin + rng() * (baseMax - baseMin)
  } else {
    const room = 100 - base
    const step = stepMin + rng() * (stepMax - stepMin)
    target = base + Math.min(step, room * 0.6)
  }
  target = Math.min(100, target)

  // Ballni butun songa yaxlitlaymiz, lekin o'z darajasidan pastga tushmasin
  const exact = (target * maxPoints) / 100
  const minSelf = Math.ceil(base * maxPoints) / 100
  let points = Math.round(exact)
  if (points < minSelf) points = Math.ceil(minSelf * 100) / 100
  if (points > maxPoints) points = maxPoints
  return points
}

/** Jurnal satrlari uchun avtomatik baholar */
export function autoFill(
  rows: JournalRow[],
  maxPoints: number,
  seed: string,
  opt?: AutoOptions,
): { student_id: string; points: number }[] {
  return rows
    .filter((r) => !r.locked)
    .map((r) => ({ student_id: r.student_id, points: autoPoints(r, maxPoints, seed, opt) }))
}

/** BSB nomi: «2-BSB» yoki «ChSB» */
export const workLabel = (kind: 'bsb' | 'chsb', idx: number): string =>
  kind === 'chsb' ? 'ChSB' : `${idx}-BSB`

/** Choraklarni qo'shib o'rtachasini topish: 1+2, 3+4, 1+3, 2+4 */
export const QUARTER_PAIRS: { label: string; a: 1 | 2 | 3 | 4; b: 1 | 2 | 3 | 4 }[] = [
  { label: '1+2 chorak', a: 1, b: 2 },
  { label: '3+4 chorak', a: 3, b: 4 },
  { label: '1+3 chorak', a: 1, b: 3 },
  { label: '2+4 chorak', a: 2, b: 4 },
]

/** Ikki chorak o'rtachasi (biri bo'lmasa — mavjudi) */
export function pairAvg(a: number | null, b: number | null): number | null {
  if (a === null && b === null) return null
  if (a === null) return b
  if (b === null) return a
  return (a + b) / 2
}
