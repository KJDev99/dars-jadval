import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { LuCheck, LuChevronDown, LuSearch } from 'react-icons/lu'

export interface SelectOption {
  value: string
  label: string
  /** O'ng tomonda kulrang matn */
  hint?: string
  /** Chap tomonda rangli nuqta */
  color?: string
  /** Nishon (badge) matni */
  badge?: string
  disabled?: boolean
  /** Guruh sarlavhasi */
  group?: string
}

interface Props {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  /** Bo'sh qiymat uchun band — tanlansa `''` qaytadi */
  emptyLabel?: string
  className?: string
  disabled?: boolean
  /** Qidiruv maydonini majburiy ko'rsatish/yashirish (default: 8 tadan ko'p bo'lsa) */
  searchable?: boolean
  /** Xato holati — chegara qizil bo'ladi */
  invalid?: boolean
  size?: 'sm' | 'md'
  title?: string
}

/**
 * Mavzuga moslashuvchi maxsus tanlagich.
 * Ro'yxat `document.body` ga portal orqali chiziladi — jadval yoki modal ichida ham kesilmaydi.
 */
export default function Select({
  value,
  onChange,
  options,
  placeholder = '— tanlang —',
  emptyLabel,
  className = '',
  disabled,
  searchable,
  invalid,
  size = 'md',
  title,
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)

  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const all = useMemo<SelectOption[]>(
    () => (emptyLabel !== undefined ? [{ value: '', label: emptyLabel }, ...options] : options),
    [options, emptyLabel],
  )

  const showSearch = searchable ?? all.length > 8

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return all
    return all.filter(
      (o) => o.label.toLowerCase().includes(q) || (o.hint ?? '').toLowerCase().includes(q),
    )
  }, [all, query])

  const selected = all.find((o) => o.value === value)

  /* ── Joylashuvni hisoblash ─────────────────────────────────────── */
  const measure = () => {
    const el = triggerRef.current
    if (el) setRect(el.getBoundingClientRect())
  }

  useLayoutEffect(() => {
    if (!open) return
    measure()
    const onScroll = () => measure()
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [open])

  /* ── Tashqariga bosilganda yopish ──────────────────────────────── */
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  /* ── Ochilganda faol elementga o'tish ──────────────────────────── */
  useEffect(() => {
    if (!open) {
      setQuery('')
      return
    }
    const i = filtered.findIndex((o) => o.value === value)
    setActive(i >= 0 ? i : 0)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  const commit = (o: SelectOption) => {
    if (o.disabled) return
    onChange(o.value)
    setOpen(false)
    triggerRef.current?.focus()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault()
        setOpen(true)
      }
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      triggerRef.current?.focus()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(filtered.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(0, i - 1))
    } else if (e.key === 'Home') {
      e.preventDefault()
      setActive(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      setActive(filtered.length - 1)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const o = filtered[active]
      if (o) commit(o)
    }
  }

  /* ── Panel joylashuvi: pastga sig'masa tepaga ochiladi ─────────── */
  const panelStyle = (): React.CSSProperties => {
    if (!rect) return { display: 'none' }
    const maxH = 288
    const below = window.innerHeight - rect.bottom - 8
    const above = rect.top - 8
    const openUp = below < 180 && above > below
    const height = Math.min(maxH, openUp ? above : below)
    return {
      position: 'fixed',
      left: rect.left,
      width: Math.max(rect.width, 180),
      ...(openUp ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
      maxHeight: height,
    }
  }

  const pad = size === 'sm' ? 'px-2 py-1 text-xs' : 'px-2.5 py-1.5 text-sm'

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        title={title}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onKeyDown}
        className={`group flex w-full items-center gap-1.5 rounded-lg border bg-surface text-left
                    outline-none transition-colors duration-150
                    disabled:cursor-not-allowed disabled:opacity-50
                    ${pad}
                    ${
                      invalid
                        ? 'border-rose-500/50 bg-rose-500/[0.06]'
                        : open
                          ? 'border-indigo-500 ring-2 ring-indigo-500/20'
                          : 'border-line hover:border-line-strong'
                    }
                    ${className}`}
      >
        {selected?.color && (
          <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: selected.color }} />
        )}
        <span className={`min-w-0 flex-1 truncate ${selected ? 'text-fg' : 'text-faint'}`}>
          {selected ? selected.label : placeholder}
        </span>
        {selected?.hint && <span className="shrink-0 text-xs text-faint">{selected.hint}</span>}
        <LuChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-faint transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            style={panelStyle()}
            className="z-[100] flex flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-lg
                       shadow-slate-900/10 dark:shadow-black/40"
          >
            {showSearch && (
              <div className="relative shrink-0 border-b border-line-soft p-1.5">
                <LuSearch className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
                <input
                  autoFocus
                  className="w-full rounded-md border border-line bg-raised py-1 pl-7 pr-2 text-sm text-fg
                             outline-none placeholder:text-faint focus:border-indigo-500"
                  placeholder="Qidirish..."
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setActive(0)
                  }}
                  onKeyDown={onKeyDown}
                />
              </div>
            )}

            <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto p-1">
              {filtered.length === 0 && (
                <div className="px-2 py-3 text-center text-xs text-faint">Hech narsa topilmadi</div>
              )}
              {filtered.map((o, i) => {
                const isSel = o.value === value
                const isActive = i === active
                const prevGroup = i > 0 ? filtered[i - 1].group : undefined
                return (
                  <div key={o.value || `__empty__${i}`}>
                    {o.group && o.group !== prevGroup && (
                      <div className="px-2 pb-0.5 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-faint">
                        {o.group}
                      </div>
                    )}
                    <button
                      type="button"
                      data-idx={i}
                      disabled={o.disabled}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => commit(o)}
                      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm
                                  transition-colors duration-75 disabled:opacity-40
                                  ${isActive ? 'bg-indigo-500/10' : ''}
                                  ${isSel ? 'font-medium text-indigo-700 dark:text-indigo-300' : 'text-fg-2'}`}
                    >
                      {o.color && (
                        <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: o.color }} />
                      )}
                      <span className="min-w-0 flex-1 truncate">{o.label}</span>
                      {o.badge && (
                        <span className="badge shrink-0 bg-line-soft text-muted">{o.badge}</span>
                      )}
                      {o.hint && <span className="shrink-0 text-xs text-faint">{o.hint}</span>}
                      {isSel && <LuCheck className="h-3.5 w-3.5 shrink-0 text-indigo-600 dark:text-indigo-400" />}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
