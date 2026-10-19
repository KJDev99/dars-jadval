import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { IcoOk, IcoError, IcoWarn, IcoClose } from './icons'

type Kind = 'ok' | 'err' | 'warn'

interface Item {
  id: number
  kind: Kind
  text: string
}

interface Api {
  ok: (text: string) => void
  err: (text: string) => void
  warn: (text: string) => void
}

const Ctx = createContext<Api>({ ok: () => {}, err: () => {}, warn: () => {} })

export const useToast = () => useContext(Ctx)

const STYLE: Record<Kind, string> = {
  ok: 'border-emerald-500/30 bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200',
  err: 'border-rose-500/30 bg-rose-50 text-rose-800 dark:bg-rose-500/10 dark:text-rose-200',
  warn: 'border-amber-500/30 bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200',
}

const ICON: Record<Kind, typeof IcoOk> = { ok: IcoOk, err: IcoError, warn: IcoWarn }

export function ToastHost({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([])
  const seq = useRef(0)

  const push = useCallback((kind: Kind, text: string) => {
    const id = ++seq.current
    setItems((list) => [...list.slice(-3), { id, kind, text }])
    // Xato xabari uzoqroq turadi — o'qituvchi o'qib olishi kerak
    window.setTimeout(() => {
      setItems((list) => list.filter((i) => i.id !== id))
    }, kind === 'ok' ? 2600 : 6000)
  }, [])

  const api = useMemo<Api>(
    () => ({
      ok: (t) => push('ok', t),
      err: (t) => push('err', t),
      warn: (t) => push('warn', t),
    }),
    [push],
  )

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:items-end">
        {items.map((i) => {
          const Icon = ICON[i.kind]
          return (
            <div
              key={i.id}
              role="status"
              className={`pointer-events-auto flex w-full max-w-md items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm font-medium shadow-lift ${STYLE[i.kind]}`}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="flex-1 leading-snug">{i.text}</span>
              <button
                onClick={() => setItems((list) => list.filter((x) => x.id !== i.id))}
                className="shrink-0 opacity-50 transition-opacity hover:opacity-100"
                title="Yopish"
              >
                <IcoClose className="h-3.5 w-3.5" />
              </button>
            </div>
          )
        })}
      </div>
    </Ctx.Provider>
  )
}
