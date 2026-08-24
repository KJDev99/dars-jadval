import type { CSSProperties } from 'react'

/**
 * Orqa fondagi to'r (kvadrat chiziqlar) va shu chiziqlar bo'ylab
 * yugurib o'tadigan yorug'lik nurlari.
 *
 * Nurlar to'rning aynan chiziqlari ustida turadi: katak o'lchami 46 px,
 * shuning uchun har bir nur `46 × indeks` masofada joylashadi.
 * Har biri o'z tezligi va kechikishi bilan harakatlanadi — vaqtning
 * atigi ~40% ida yuguradi, qolganida kutadi.
 */

interface Beam {
  /** To'r chizig'ining tartib raqami (46 px ga ko'paytiriladi) */
  at: number
  /** Bir tsikl davomiyligi (soniya) */
  dur: number
  /** Boshlanish surilishi (soniya, manfiy — o'rtasidan boshlanadi) */
  delay: number
}

const VERTICAL: Beam[] = [
  { at: 3, dur: 8.5, delay: 0 },
  { at: 8, dur: 11, delay: -3.5 },
  { at: 14, dur: 9.5, delay: -6.5 },
  { at: 21, dur: 12.5, delay: -1.8 },
  { at: 29, dur: 10, delay: -8.2 },
  { at: 36, dur: 13, delay: -4.4 },
]

const HORIZONTAL: Beam[] = [
  { at: 2, dur: 12, delay: -2.5 },
  { at: 6, dur: 10.5, delay: -7 },
  { at: 11, dur: 15, delay: -12 },
]

interface Props {
  /** To'r chiziqlarining ko'rinishi */
  opacity?: number
  /** Kichik bloklar uchun kamroq nur */
  compact?: boolean
  className?: string
}

export default function GridBeams({ opacity = 1, compact, className = '' }: Props) {
  const vertical = compact ? VERTICAL.slice(0, 4) : VERTICAL
  const horizontal = compact ? HORIZONTAL.slice(0, 2) : HORIZONTAL

  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      <div className="grid-pattern absolute inset-0" style={{ opacity }} />

      {vertical.map((b, i) => (
        <span
          key={`v${i}`}
          className="gbeam-v"
          style={
            {
              left: `${b.at * 46}px`,
              '--gb-duration': `${b.dur}s`,
              '--gb-delay': `${b.delay}s`,
            } as CSSProperties
          }
        />
      ))}

      {horizontal.map((b, i) => (
        <span
          key={`h${i}`}
          className="gbeam-h"
          style={
            {
              top: `${b.at * 46}px`,
              '--gb-duration': `${b.dur}s`,
              '--gb-delay': `${b.delay}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  )
}
