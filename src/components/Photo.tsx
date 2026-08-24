import { useRef, useState } from 'react'
import { fileToDataUrl, hueOf, initialsOf } from '../lib/image'
import { IcoImage, IcoUpload, IcoTrash } from './icons'

type Shape = 'circle' | 'rounded' | 'square'

const SHAPE: Record<Shape, string> = {
  circle: 'rounded-full',
  rounded: 'rounded-2xl',
  square: 'rounded-none',
}

interface PhotoProps {
  src?: string
  /** Rasm bo'lmasa shu ismdan bosh harflar chiziladi */
  name?: string
  alt?: string
  shape?: Shape
  className?: string
  /** Bosh harflar o'rniga ikonka ko'rsatiladi (bino, tadbir rasmlari uchun) */
  icon?: boolean
}

/**
 * Rasm yoki chiroyli o'rin egallagich.
 * Rasm yo'q bo'lsa ismdan olingan bosh harflar va ismga bog'liq rang ko'rsatiladi.
 */
export function Photo({ src, name = '', alt, shape = 'circle', className = '', icon }: PhotoProps) {
  const [broken, setBroken] = useState(false)
  const shapeCls = SHAPE[shape]

  if (src && !broken) {
    return (
      <img
        src={src}
        alt={alt ?? name}
        loading="lazy"
        onError={() => setBroken(true)}
        className={`${shapeCls} object-cover ${className}`}
      />
    )
  }

  const hue = hueOf(name || 'maktab')
  return (
    <div
      aria-label={alt ?? name}
      className={`${shapeCls} grid place-items-center overflow-hidden ${className}`}
      style={{
        background: `linear-gradient(140deg, hsl(${hue} 62% 62% / 0.9), hsl(${(hue + 55) % 360} 68% 48% / 0.9))`,
      }}
    >
      {icon || !name ? (
        <IcoImage className="h-1/3 w-1/3 text-white/70" />
      ) : (
        <span className="select-none text-[clamp(0.7rem,32%,3rem)] font-semibold tracking-wide text-white/95">
          {initialsOf(name)}
        </span>
      )}
    </div>
  )
}

interface PhotoInputProps {
  value?: string
  onChange: (v: string | undefined) => void
  name?: string
  shape?: Shape
  /** Ko'rinish o'lchami (tailwind klasslari) */
  size?: string
  hint?: string
}

/** Rasm tanlash maydoni — fayl kichraytirilib data URL sifatida saqlanadi */
export function PhotoInput({
  value,
  onChange,
  name = '',
  shape = 'rounded',
  size = 'h-24 w-24',
  hint,
}: PhotoInputProps) {
  const ref = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const pick = async (file?: File) => {
    if (!file) return
    setBusy(true)
    setError('')
    try {
      onChange(await fileToDataUrl(file))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
      if (ref.current) ref.current.value = ''
    }
  }

  return (
    <div className="flex items-start gap-3">
      <Photo src={value} name={name} shape={shape} className={`${size} shrink-0 border border-line`} />
      <div className="min-w-0 flex-1">
        <input
          ref={ref}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => pick(e.target.files?.[0])}
        />
        <div className="flex flex-wrap gap-1.5">
          <button type="button" className="btn-ghost" onClick={() => ref.current?.click()} disabled={busy}>
            <IcoUpload className="h-3.5 w-3.5" /> {busy ? 'Yuklanmoqda…' : value ? "Almashtirish" : 'Rasm yuklash'}
          </button>
          {value && (
            <button type="button" className="btn-danger" onClick={() => onChange(undefined)}>
              <IcoTrash className="h-3.5 w-3.5" /> O'chirish
            </button>
          )}
        </div>
        <p className="mt-1.5 text-[11px] leading-relaxed text-faint">
          {hint ?? 'JPG yoki PNG. Rasm avtomatik kichraytiriladi (900 px gacha).'}
        </p>
        {error && <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">{error}</p>}
      </div>
    </div>
  )
}
