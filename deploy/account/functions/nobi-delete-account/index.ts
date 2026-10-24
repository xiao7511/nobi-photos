// Deploy only in the isolated NOBI Photos Supabase project. Never bundle this server secret in Vite.
import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
const allowed = (Deno.env.get('NOBI_ALLOWED_ORIGINS') ?? '').split(',').filter(Boolean)
Deno.serve(async (request: Request) => {
  const origin = request.headers.get('origin') ?? ''
  const headers = {
    'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : '',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json',
  }
  const response = (status: number, message: string) =>
    new Response(JSON.stringify({ message }), { status, headers })
  if (!allowed.includes(origin)) return response(403, 'Origin not allowed')
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (request.method !== 'POST') return response(405, 'Method not allowed')
  const authorization = request.headers.get('authorization') ?? ''
  if (!authorization.startsWith('Bearer ')) return response(401, 'Authentication required')
  const url = Deno.env.get('SUPABASE_URL')!,
    key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  try {
    const { data, error } = await admin.auth.getUser(authorization.slice(7))
    if (error || !data.user?.email_confirmed_at) return response(401, 'Verified account required')
    // Derive the identity exclusively from server-verified JWT; no supplied user id is accepted.
    const deleted = await admin.auth.admin.deleteUser(data.user.id)
    if (deleted.error) return response(503, 'Deletion unavailable')
    return response(200, 'Account deleted')
  } catch {
    return response(503, 'Account service unavailable')
  }
})
