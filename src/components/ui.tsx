import type { ReactNode } from 'react'
import { IcoClose } from './icons'

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="no-print mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-fg">{title}</h1>
        {subtitle && <p className="mt-0.5 max-w-3xl text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Page({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-[1400px] p-6">{children}</div>
}

export function Stat({
  label,
  value,
  hint,
  tone = 'slate',
}: {
  label: string
  value: ReactNode
  hint?: string
  tone?: 'slate' | 'emerald' | 'amber' | 'rose' | 'indigo'
}) {
  const tones: Record<string, string> = {
    slate: 'text-fg',
    emerald: 'text-emerald-600 dark:text-emerald-400',
    amber: 'text-amber-600 dark:text-amber-400',
    rose: 'text-rose-600 dark:text-rose-400',
    indigo: 'text-indigo-600 dark:text-indigo-400',
  }
  return (
    <div className="card p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${tones[tone]}`}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-faint">{hint}</div>}
    </div>
  )
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  wide?: boolean
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/60 p-6">
      <div className={`card w-full ${wide ? 'max-w-4xl' : 'max-w-lg'} my-8`}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="font-semibold text-fg">{title}</h2>
          <button onClick={onClose} className="btn-icon" title="Yopish">
            <IcoClose className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-fg-2">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-faint">{hint}</span>}
    </label>
  )
}

export function Empty({ text }: { text: string }) {
  return (
    <div className="card flex items-center justify-center p-10 text-sm text-faint">{text}</div>
  )
}
