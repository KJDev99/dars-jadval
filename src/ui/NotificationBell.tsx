import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { rpc } from '../lib/supabase'
import { useAuth } from '../store/auth'
import { workLabel } from '../lib/grading'
import { IcoBell, IcoWarn, IcoClock, IcoCheck, IcoClose } from './icons'
import type { FeedItem, Urgency } from '../lib/types'

const TONE: Record<Urgency, { box: string; text: string; label: (d: number) => string }> = {
  late: {
    box: 'border-rose-500/30 bg-rose-500/[0.07]',
    text: 'text-rose-700 dark:text-rose-300',
    label: (d) => `${Math.abs(d)} kun kechikdi`,
  },
  today: {
    box: 'border-amber-500/40 bg-amber-500/[0.08]',
    text: 'text-amber-700 dark:text-amber-300',
    label: () => 'Bugun',
  },
  soon: {
    box: 'border-line bg-raised',
    text: 'text-muted',
    label: (d) => (d === 1 ? 'Ertaga' : `${d} kundan keyin`),
  },
}

const fmtDate = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('uz-UZ', { day: '2-digit', month: 'short' })

/**
 * BSB/ChSB rejasi bo'yicha eslatmalar.
 *
 * O'qituvchi o'ziga tegishli (fan + sinf) ishlarni ko'radi, menejer va
 * admin — maktab bo'yicha hammasini. Bajarilgan ishlar ro'yxatga tushmaydi.
 */
export default function NotificationBell() {
  const { profile } = useAuth()
  const nav = useNavigate()
  const [items, setItems] = useState<FeedItem[]>([])
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    try {
      setItems(await rpc<FeedItem[]>('plan_feed', { p_soon: 7 }))
    } catch {
      /* reja jadvali hali yuklanmagan bo'lishi mumkin — jim o'tamiz */
    }
  }, [])

  useEffect(() => {
    void load()
    const t = window.setInterval(() => void load(), 5 * 60 * 1000)
    return () => window.clearInterval(t)
  }, [load])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const unread = items.filter((i) => !i.is_read)
  const staff = profile?.role !== 'teacher'

  async function markAll() {
    if (unread.length === 0) return
    try {
      await rpc('mark_feed_read', {
        p_plan_ids: unread.map((i) => i.plan_id),
        p_urgencies: unread.map((i) => i.urgency),
      })
      setItems((l) => l.map((i) => ({ ...i, is_read: true })))
    } catch {
      /* jim */
    }
  }

  function go(i: FeedItem) {
    setOpen(false)
    nav(staff ? '/plan' : `/journal?class=${i.class_id}&q=${i.quarter}`)
  }

  return (
    <div className="relative" ref={boxRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="btn-ghost relative"
        title="Eslatmalar"
      >
        <IcoBell className="h-4 w-4" />
        {unread.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold text-white">
            {unread.length > 9 ? '9+' : unread.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-[80] mt-2 w-[min(94vw,26rem)] overflow-hidden rounded-xl border border-line bg-surface shadow-lift">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <div className="text-sm font-semibold text-fg">
              Eslatmalar
              {items.length > 0 && <span className="ml-1.5 text-xs text-muted">({items.length})</span>}
            </div>
            <div className="flex items-center gap-1">
              {unread.length > 0 && (
                <button onClick={() => void markAll()} className="btn-ghost py-1 text-xs">
                  <IcoCheck className="h-3.5 w-3.5" /> O‘qildi
                </button>
              )}
              <button onClick={() => setOpen(false)} className="btn-icon">
                <IcoClose className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {items.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-faint">
              Yaqin kunlarda rejadagi ish yo‘q.
              <div className="mt-1 text-xs">
                Reja menejer tomonidan Excel'dan yuklanadi.
              </div>
            </div>
          ) : (
            <div className="max-h-[22rem] overflow-y-auto p-2">
              {items.map((i) => {
                const t = TONE[i.urgency]
                return (
                  <button
                    key={i.plan_id + i.urgency}
                    onClick={() => go(i)}
                    className={`mb-1.5 flex w-full items-start gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors last:mb-0 hover:border-line-strong ${t.box}`}
                  >
                    <span className={`mt-0.5 shrink-0 ${t.text}`}>
                      {i.urgency === 'soon' ? (
                        <IcoClock className="h-4 w-4" />
                      ) : (
                        <IcoWarn className="h-4 w-4" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-fg">
                        {i.class_name} · {i.subject_name}
                        <span className="ml-1.5 font-normal text-muted">
                          {workLabel(i.kind, i.idx)}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-xs text-muted">
                        {fmtDate(i.planned_on)} · <span className={t.text}>{t.label(i.days)}</span>
                        {i.state === 'partial' && ' · baholar to‘liq emas'}
                        {staff && i.teacher_name !== '—' && ` · ${i.teacher_name}`}
                      </span>
                    </span>
                    {!i.is_read && (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-500" />
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
