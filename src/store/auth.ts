import { create } from 'zustand'
import type { Session } from '@supabase/supabase-js'
import { supabase, loginToEmail } from '../lib/supabase'
import type { Profile, Role } from '../lib/types'

interface SignUpInput {
  login: string
  password: string
  last_name: string
  first_name: string
  role: Extract<Role, 'teacher' | 'manager'>
  subject_id: number | null
}

interface AuthState {
  ready: boolean
  session: Session | null
  profile: Profile | null
  init: () => Promise<void>
  loadProfile: () => Promise<void>
  signIn: (login: string, password: string) => Promise<void>
  signUp: (input: SignUpInput) => Promise<void>
  signOut: () => Promise<void>
  changeOwnPassword: (password: string) => Promise<void>
}

export const useAuth = create<AuthState>((set, get) => ({
  ready: false,
  session: null,
  profile: null,

  async init() {
    const { data } = await supabase.auth.getSession()
    set({ session: data.session })
    if (data.session) await get().loadProfile()
    set({ ready: true })

    supabase.auth.onAuthStateChange((_event, session) => {
      const prev = get().session?.user.id
      set({ session })
      if (!session) set({ profile: null })
      else if (session.user.id !== prev) void get().loadProfile()
    })
  },

  async loadProfile() {
    const uid = get().session?.user.id
    if (!uid) return set({ profile: null })
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .maybeSingle()
    if (error) throw new Error(error.message)
    set({ profile: (data as Profile) ?? null })
  },

  async signIn(login, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginToEmail(login),
      password,
    })
    if (error) throw new Error(error.message)
    set({ session: data.session })
    await get().loadProfile()
  },

  async signUp(input) {
    const { data, error } = await supabase.auth.signUp({
      email: loginToEmail(input.login),
      password: input.password,
      options: {
        data: {
          login: input.login.trim().toLowerCase(),
          last_name: input.last_name.trim(),
          first_name: input.first_name.trim(),
          role: input.role,
          subject_id: input.subject_id ? String(input.subject_id) : '',
        },
      },
    })
    if (error) throw new Error(error.message)
    set({ session: data.session })
    if (data.session) await get().loadProfile()
  },

  async signOut() {
    await supabase.auth.signOut()
    set({ session: null, profile: null })
  },

  async changeOwnPassword(password) {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw new Error(error.message)
  },
}))

/** Rol nomlari */
export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Administrator',
  manager: 'Menejer',
  teacher: "O'qituvchi",
}

export const fullName = (p: Pick<Profile, 'last_name' | 'first_name'> | null): string =>
  p ? `${p.last_name} ${p.first_name}`.trim() : ''
