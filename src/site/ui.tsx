import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Photo } from '../components/Photo'
import { IcoArrowRight } from '../components/icons'
import type { IconType } from '../components/icons'

/* ─────────────────────────── Bo'lim sarlavhasi ─────────────────────────── */

export function SectionHead({
  eyebrow,
  title,
  text,
  center,
  action,
}: {
  eyebrow?: string
  title: string
  text?: string
  center?: boolean
  action?: ReactNode
}) {
  return (
    <div className={`mb-8 flex flex-wrap items-end gap-4 sm:mb-10 ${center ? 'flex-col text-center' : 'justify-between'}`}>
      <div className={center ? 'max-w-2xl' : 'max-w-2xl'}>
        {eyebrow && <span className="eyebrow mb-3">{eyebrow}</span>}
        <h2 className="h-section">{title}</h2>
        {text && <p className="lede mt-3">{text}</p>}
      </div>
      {action}
    </div>
  )
}

/* ──────────────────────────── Ko'rsatkich ────────────────────────────── */

export function BigStat({
  value,
  label,
  hint,
  Icon,
}: {
  value: ReactNode
  label: string
  hint?: string
  Icon?: IconType
}) {
  return (
    <div className="card p-5 text-center sm:p-6">
      {Icon && (
        <span className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
          <Icon className="h-5 w-5" />
        </span>
      )}
      <div className="text-3xl font-bold tracking-tight text-fg sm:text-4xl">{value}</div>
      <div className="mt-1 text-sm font-medium text-fg-2">{label}</div>
      {hint && <div className="mt-0.5 text-xs text-faint">{hint}</div>}
    </div>
  )
}

/* ───────────────────────────── Shaxs kartasi ─────────────────────────── */

export function PersonCard({
  photo,
  name,
  role,
  meta,
  tags,
  to,
  wide,
}: {
  photo?: string
  name: string
  role: string
  meta?: string
  tags?: string[]
  to?: string
  wide?: boolean
}) {
  const body = (
    <>
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-raised">
        <Photo src={photo} name={name} shape="square" className="h-full w-full" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-slate-950/70 to-transparent" />
      </div>
      <div className="p-4">
        <h3 className="truncate font-semibold text-fg" title={name}>{name}</h3>
        <p className="mt-0.5 text-sm text-indigo-600 dark:text-indigo-400">{role}</p>
        {meta && <p className="mt-1 text-xs text-muted">{meta}</p>}
        {tags && tags.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1">
            {tags.slice(0, 3).map((t, i) => (
              <span key={i} className="badge tint-slate">{t}</span>
            ))}
          </div>
        )}
      </div>
    </>
  )

  const cls = `card-lift group block ${wide ? '' : ''}`
  return to ? (
    <Link to={to} className={cls}>{body}</Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}

/* ─────────────────────── Ko'rinishda paydo bo'lish ────────────────────── */

/** Elementni ekranga kirganda yumshoq ko'rsatadi */
export function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      setShown(true)
      return
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShown(true)
          io.disconnect()
        }
      },
      { rootMargin: '0px 0px -60px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-[opacity,transform] duration-700 ease-out motion-reduce:transition-none ${
        shown ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
      }`}
    >
      {children}
    </div>
  )
}

/* ─────────────────────────── Sahifa sarlavhasi ───────────────────────── */

/** Ichki sahifalarning yuqoridagi rangli qismi */
export function PageHero({
  eyebrow,
  title,
  text,
  children,
}: {
  eyebrow?: string
  title: string
  text?: string
  children?: ReactNode
}) {
  return (
    <section className="relative overflow-hidden border-b border-line bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800">
      <div className="grid-pattern absolute inset-0" />
      <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
      <div className="site-wrap relative py-12 sm:py-16">
        {eyebrow && (
          <span className="inline-flex items-center rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/90">
            {eyebrow}
          </span>
        )}
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">{title}</h1>
        {text && <p className="mt-3 max-w-3xl text-base leading-relaxed text-indigo-100/90">{text}</p>}
        {children}
      </div>
    </section>
  )
}

/* ───────────────────────────── Havola tugma ──────────────────────────── */

export function MoreLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="group inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-500 dark:text-indigo-400"
    >
      {children}
      <IcoArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
    </Link>
  )
}

export function EmptyBlock({ text }: { text: string }) {
  return (
    <div className="card grid place-items-center p-12 text-center text-sm text-faint">{text}</div>
  )
}
