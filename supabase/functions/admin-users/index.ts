/**
 * admin-users — faqat admin uchun: parolni almashtirish va akkauntni o'chirish.
 *
 * Bu amallar service_role kaliti bilan bajariladi, shuning uchun brauzerda
 * qilish mumkin emas. Funksiya chaqiruvchining JWT sini tekshiradi va
 * profiles jadvalidan uning haqiqatan admin ekanini aniqlaydi.
 *
 * Deploy:  supabase functions deploy admin-users
 */
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'METHOD' }, 405)

  const auth = req.headers.get('Authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return json({ error: 'NO_TOKEN' }, 401)

  // 1. Chaqiruvchini aniqlaymiz
  const asUser = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  })
  const { data: me, error: meErr } = await asUser.auth.getUser()
  if (meErr || !me.user) return json({ error: 'BAD_TOKEN' }, 401)

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

  // 2. Admin ekanini tekshiramiz
  const { data: profile } = await admin
    .from('profiles')
    .select('role, status')
    .eq('id', me.user.id)
    .single()

  if (!profile || profile.role !== 'admin' || profile.status !== 'approved') {
    return json({ error: 'FORBIDDEN' }, 403)
  }

  let body: { action?: string; user_id?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'BAD_BODY' }, 400)
  }

  const { action, user_id, password } = body
  if (!action || !user_id) return json({ error: 'BAD_BODY' }, 400)

  // 3. Amal
  if (action === 'set_password') {
    if (!password || password.length < 6) return json({ error: 'SHORT_PASSWORD' }, 400)
    const { error } = await admin.auth.admin.updateUserById(user_id, { password })
    if (error) return json({ error: error.message }, 400)
    return json({ ok: true })
  }

  if (action === 'delete_user') {
    if (user_id === me.user.id) return json({ error: 'SELF_DELETE' }, 400)
    const { error } = await admin.auth.admin.deleteUser(user_id)
    if (error) return json({ error: error.message }, 400)
    return json({ ok: true })
  }

  return json({ error: 'UNKNOWN_ACTION' }, 400)
})
