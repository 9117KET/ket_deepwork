import { requireUserId } from '../_shared/supabase.ts'
import { GOOGLE_AUTH_BASE, GOOGLE_SCOPES, buildRedirectUri, json, CORS_PREFLIGHT } from '../_shared/google.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return CORS_PREFLIGHT
  try {
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 })
    const userId = await requireUserId(req)

    const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
    if (!clientId) throw new Error('Missing GOOGLE_CLIENT_ID')

    const { origin } = await req.json().catch(() => ({ origin: '' }))
    if (!origin) throw new Error('Missing origin')

    const redirectUri = buildRedirectUri(origin)
    console.log('[oauth-start] user:', userId.slice(0, 8), '| origin:', origin, '| redirectUri:', redirectUri)
    const state = crypto.randomUUID()

    const url = new URL(GOOGLE_AUTH_BASE)
    url.searchParams.set('client_id', clientId)
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope', GOOGLE_SCOPES.join(' '))
    url.searchParams.set('access_type', 'offline')
    url.searchParams.set('prompt', 'consent')
    url.searchParams.set('include_granted_scopes', 'true')
    url.searchParams.set('state', state)

    console.log('[oauth-start] consent URL built ok')
    return json({ url: url.toString(), state })
  } catch (e) {
    console.error('[oauth-start] error:', (e as Error).message)
    return json({ error: (e as Error).message ?? 'Unknown error' }, { status: 400 })
  }
})

