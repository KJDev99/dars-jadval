import { useState } from 'react'
import { dismissInstall, promptInstall, useInstall } from '../lib/pwa'
import { Modal } from './ui'
import {
  IcoDownload, IcoClose, IcoOk, IcoSchedule, IcoInfo, IcoArrowUpRight, IcoPlus,
} from './icons'

/**
 * «Ilovani o'rnatish» tugmasi.
 * Brauzer o'rnatishni qo'llab-quvvatlamasa yoki ilova allaqachon o'rnatilgan
 * bo'lsa — hech narsa chizilmaydi.
 *
 *   variant="button" — odatiy tugma (menyu ichida)
 *   variant="link"   — yupqa yuqori qatorga mos ingichka havola
 */
export function InstallButton({
  className = '',
  variant = 'button',
}: {
  className?: string
  variant?: 'button' | 'link'
}) {
  const { canPrompt, installed, apple } = useInstall()
  const [howTo, setHowTo] = useState(false)

  if (installed) return null
  if (!canPrompt && !apple) return null

  const style =
    variant === 'link'
      ? 'inline-flex items-center gap-1.5 whitespace-nowrap font-medium text-indigo-600 transition-colors hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300'
      : 'btn-ghost'

  return (
    <>
      <button
        className={`${style} ${className}`}
        title="Ilovani qurilmaga o'rnatish"
        onClick={() => (apple && !canPrompt ? setHowTo(true) : void promptInstall())}
      >
        <IcoDownload className={variant === 'link' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
        Ilovani o'rnatish
      </button>

      <AppleHowTo open={howTo} onClose={() => setHowTo(false)} />
    </>
  )
}

/**
 * Pastki burchakdagi taklif — birinchi tashrifda bir marta chiqadi.
 * Yopilsa, boshqa ko'rsatilmaydi.
 */
export function InstallBanner() {
  const { canPrompt, installed, apple, dismissed } = useInstall()
  const [howTo, setHowTo] = useState(false)
  const [hidden, setHidden] = useState(false)

  if (installed || dismissed || hidden) return null
  if (!canPrompt && !apple) return null

  const close = () => {
    setHidden(true)
    dismissInstall()
  }

  return (
    <>
      <div className="no-print fixed inset-x-3 bottom-3 z-50 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[22rem]">
        <div className="card overflow-hidden shadow-lift">
          <div className="flex items-start gap-3 p-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
              <IcoSchedule className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-fg">Ilovani qurilmangizga o'rnating</h2>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Bosh ekranda ikonka paydo bo'ladi — bosishingiz bilan ochiladi. Internetsiz ham
                ishlaydi.
              </p>
            </div>
            <button className="btn-icon shrink-0" onClick={close} title="Yopish">
              <IcoClose className="h-4 w-4" />
            </button>
          </div>
          <div className="flex gap-2 border-t border-line bg-raised px-4 py-3">
            <button
              className="btn-primary flex-1"
              onClick={async () => {
                if (apple && !canPrompt) {
                  setHowTo(true)
                  return
                }
                const accepted = await promptInstall()
                if (accepted) setHidden(true)
              }}
            >
              <IcoDownload className="h-4 w-4" /> O'rnatish
            </button>
            <button className="btn-ghost" onClick={close}>
              Keyinroq
            </button>
          </div>
        </div>
      </div>

      <AppleHowTo open={howTo} onClose={() => setHowTo(false)} />
    </>
  )
}

/** iPhone va iPad da o'rnatish avtomatik emas — qadamlarni ko'rsatamiz */
function AppleHowTo({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="iPhone yoki iPad ga o'rnatish">
      <ol className="space-y-3 text-sm text-fg-2">
        <Step n={1} Icon={IcoArrowUpRight}>
          Safari pastidagi <b className="text-fg">Ulashish</b> tugmasini bosing.
        </Step>
        <Step n={2} Icon={IcoPlus}>
          Ro'yxatdan <b className="text-fg">«Bosh ekranga qo'shish»</b> ni tanlang.
        </Step>
        <Step n={3} Icon={IcoOk}>
          <b className="text-fg">Qo'shish</b> ni bosing — ikonka bosh ekranda paydo bo'ladi.
        </Step>
      </ol>
      <p className="mt-4 flex gap-2 rounded-lg border border-line bg-raised px-3 py-2 text-xs leading-relaxed text-muted">
        <IcoInfo className="mt-0.5 h-3.5 w-3.5 shrink-0 text-faint" />
        iOS da bu faqat Safari orqali ishlaydi. Chrome yoki boshqa brauzerda ochgan bo'lsangiz,
        avval sahifani Safari da oching.
      </p>
      <div className="mt-4 flex justify-end">
        <button className="btn-primary" onClick={onClose}>
          Tushunarli
        </button>
      </div>
    </Modal>
  )
}

function Step({
  n,
  Icon,
  children,
}: {
  n: number
  Icon: typeof IcoOk
  children: React.ReactNode
}) {
  return (
    <li className="flex items-start gap-3">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-indigo-500/15 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
        {n}
      </span>
      <span className="flex-1 pt-0.5 leading-relaxed">{children}</span>
      <Icon className="mt-1 h-4 w-4 shrink-0 text-faint" />
    </li>
  )
}
