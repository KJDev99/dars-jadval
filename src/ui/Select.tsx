import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { IcoChevronDown, IcoCheck, IcoSearch } from './icons'

export interface SelectOption<T> {
  value: T
  label: string
  /** Yozuv ostidagi kichik izoh */
  hint?: string
  disabled?: boolean
}

interface Props<T> {
  value: T | null
  onChange: (v: T) => void
  options: SelectOption<T>[]
  placeholder?: string
  /** Ro'yxat uzun bo'lsa qidiruv maydoni (8 dan ko'p bo'lsa o'zi yoqiladi) */
  searchable?: boolean
  size?: 'md' | 'sm'
  disabled?: boolean
  className?: string
  emptyText?: string
}

interface Pos {
  left: number
  top: number
  width: number
  maxHeight: number
}

const GAP = 6
const MIN_W = 170

/**
 * Tanlagich — oddiy <select> o'rniga.
 *
 * Ro'yxat portal orqali chiziladi, shuning uchun jadval yoki modal ichida
 * ham kesilib qolmaydi. Klaviatura bilan ishlaydi: ↑ ↓ Enter Esc, uzun
 * ro'yxatda esa yozib qidirish mumkin.
 */
export function Select<T extends string | number>({
  value,
  onChange,
  options,
  placeholder = '— tanlang —',
  searchable,
  size = 'md',
  disabled,
  className = '',
  emptyText = 'Topilmadi',
}: Props<T>) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [hi, setHi] = useState(0)
  const [pos, setPos] = useState<Pos | null>(null)

  const triggerRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const withSearch = searchable ?? options.length > 8
  const selected = options.find((o) => o.value === value) ?? null

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || (o.hint ?? '').toLowerCase().includes(q),
    )
  }, [options, query])

  /** Ro'yxat joyini hisoblash — pastda joy bo'lmasa tepaga chiqadi */
  const place = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const below = window.innerHeight - r.bottom - GAP - 8
    const above = r.top - GAP - 8
    const useAbove = below < 180 && above > below
    const maxHeight = Math.min(320, Math.max(140, useAbove ? above : below))
    setPos({
      left: Math.min(Math.max(8, r.left), Math.max(8, window.innerWidth - Math.max(r.width, MIN_W) - 8)),
      top: useAbove ? r.top - GAP - maxHeight : r.bottom + GAP,
      width: Math.max(r.width, MIN_W),
      maxHeight,
    })
  }, [])

  useLayoutEffect(() => {
    if (open) place()
  }, [open, place])

  // Ochiq turganda sahifa yoki jadval siljisa — joyini qayta hisoblaymiz
  useEffect(() => {
    if (!open) return
    const onMove = () => place()
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => {
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
    }
  }, [open, place])

  // Tashqariga bosilsa yopiladi
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node
      if (!triggerRef.current?.contains(t) && !popRef.current?.contains(t)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
    }
  }, [open])

  // Ochilganda tanlanganga tushamiz va qidiruvga fokus beramiz
  useEffect(() => {
    if (!open) return
    setQuery('')
    const idx = options.findIndex((o) => o.value === value)
    setHi(idx >= 0 ? idx : 0)
    if (withSearch) window.setTimeout(() => searchRef.current?.focus(), 0)
  }, [open, options, value, withSearch])

  // Qidiruv o'zgarsa — belgilashni birinchi mos yozuvga olib kelamiz
  useEffect(() => {
    if (!open || !query) return
    if (shown.length > 0) setHi(options.indexOf(shown[0]))
  }, [open, query, shown, options])

  // Belgilangan yozuv ko'rinib turishi uchun
  useEffect(() => {
    if (!open) return
    listRef.current?.querySelector('[data-hi="1"]')?.scrollIntoView({ block: 'nearest' })
  }, [open, hi, shown])

  function choose(o: SelectOption<T>) {
    if (o.disabled) return
    onChange(o.value)
    setOpen(false)
    triggerRef.current?.focus()
  }

  function onKey(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        setOpen(true)
      }
      return
    }
    if (e.key === 'Escape' || e.key === 'Tab') {
      setOpen(false)
      return
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (shown.length === 0) return
      const cur = shown.findIndex((o) => o === options[hi]) // ko'rinayotgan ro'yxatdagi o'rni
      const start = cur >= 0 ? cur : 0
      const dir = e.key === 'ArrowDown' ? 1 : -1
      let i = start
      for (let n = 0; n < shown.length; n++) {
        i = (i + dir + shown.length) % shown.length
        if (!shown[i].disabled) break
      }
      setHi(options.indexOf(shown[i]))
      return
    }
    if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault()
      const o = e.key === 'Home' ? shown[0] : shown[shown.length - 1]
      if (o) setHi(options.indexOf(o))
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const o = options[hi]
      if (o && shown.includes(o)) choose(o)
      else if (shown.length === 1) choose(shown[0])
    }
  }

  const pad = size === 'sm' ? 'px-2 py-1 text-xs' : 'px-2.5 py-1.5 text-sm'

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        onKeyDown={onKey}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex w-full items-center gap-1.5 rounded-lg border bg-surface text-left
          outline-none transition-colors duration-150
          disabled:cursor-not-allowed disabled:opacity-50
          ${open
            ? 'border-indigo-500 ring-2 ring-indigo-500/20'
            : 'border-line hover:border-line-strong'}
          ${pad} ${className}`}
      >
        <span className={`flex-1 truncate ${selected ? 'text-fg' : 'text-faint'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <IcoChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-faint transition-transform duration-150 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={popRef}
            className="fixed z-[90] overflow-hidden rounded-xl border border-line bg-surface shadow-lift"
            style={{ left: pos.left, top: pos.top, width: pos.width }}
            role="listbox"
          >
            {withSearch && (
              <div className="flex items-center gap-1.5 border-b border-line-soft px-2.5 py-1.5">
                <IcoSearch className="h-3.5 w-3.5 shrink-0 text-faint" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onKey}
                  placeholder="Qidirish…"
                  className="w-full bg-transparent text-sm text-fg outline-none placeholder:text-faint"
                />
              </div>
            )}

            <div
              ref={listRef}
              className="overflow-y-auto overscroll-contain py-1"
              style={{ maxHeight: pos.maxHeight - (withSearch ? 38 : 0) }}
            >
              {shown.length === 0 ? (
                <div className="px-3 py-2.5 text-sm text-faint">{emptyText}</div>
              ) : (
                shown.map((o) => {
                  const isSel = o.value === value
                  const isHi = options[hi] === o
                  return (
                    <button
                      key={String(o.value)}
                      type="button"
                      data-hi={isHi ? '1' : undefined}
                      role="option"
                      aria-selected={isSel}
                      disabled={o.disabled}
                      onMouseEnter={() => setHi(options.indexOf(o))}
                      onClick={() => choose(o)}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm
                        transition-colors disabled:opacity-40
                        ${isHi ? 'bg-indigo-500/10' : ''}
                        ${isSel ? 'font-medium text-indigo-600 dark:text-indigo-300' : 'text-fg-2'}`}
                    >
                      <span className="flex-1 truncate">
                        {o.label}
                        {o.hint && (
                          <span className="ml-1.5 text-[11px] font-normal text-faint">{o.hint}</span>
                        )}
                      </span>
                      {isSel && <IcoCheck className="h-3.5 w-3.5 shrink-0" />}
                    </button>
                  )
                })
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
