import { useAuth, fullName, ROLE_LABEL } from '../store/auth'
import { IcoClock, IcoBan, IcoLogout } from '../ui/icons'

export default function PendingPage() {
  const { profile, signOut } = useAuth()
  const blocked = profile?.status === 'blocked'

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-4">
      <div className="card w-full max-w-md p-6 text-center">
        <div
          className={`mx-auto flex h-12 w-12 items-center justify-center rounded-xl ${
            blocked ? 'bg-rose-500/15 text-rose-600' : 'bg-amber-500/15 text-amber-600'
          }`}
        >
          {blocked ? <IcoBan className="h-6 w-6" /> : <IcoClock className="h-6 w-6" />}
        </div>

        <h1 className="mt-4 text-lg font-semibold text-fg">
          {blocked ? 'Akkaunt bloklangan' : 'Tasdiqlash kutilmoqda'}
        </h1>

        <p className="mt-2 text-sm leading-relaxed text-muted">
          {blocked ? (
            <>Akkauntingiz administrator tomonidan bloklangan. Iltimos, maktab administratoriga murojaat qiling.</>
          ) : (
            <>
              <b>{fullName(profile)}</b> ({profile && ROLE_LABEL[profile.role]}) sifatida ro‘yxatdan
              o‘tdingiz. Administrator akkauntingizni tasdiqlagandan keyin tizim ochiladi.
            </>
          )}
        </p>

        <div className="mt-5 flex items-center justify-center gap-2">
          <button onClick={() => location.reload()} className="btn-primary">
            Tekshirish
          </button>
          <button onClick={() => void signOut()} className="btn-ghost">
            <IcoLogout className="h-4 w-4" /> Chiqish
          </button>
        </div>
      </div>
    </div>
  )
}
