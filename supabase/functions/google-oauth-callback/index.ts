import { createServiceClient, requireUserId } from '../_shared/supabase.ts'
import { GOOGLE_TOKEN_URL, buildRedirectUri, json } from '../_shared/google.ts'
import { encryptToEnvelope } from '../_shared/crypto.ts'

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 })
    const userId = await requireUserId(req)

    const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')
    if (!clientId || !clientSecret) throw new Error('Missing GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET')

    const payload = await req.json()
    const code = String(payload.code ?? '')
    const origin = String(payload.origin ?? '')
    if (!code || !origin) throw new Error('Missing code/origin')

    const redirectUri = buildRedirectUri(origin)
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    })

    const resp = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    })
    if (!resp.ok) throw new Error(`Token exchange failed (${resp.status})`)
    const data = (await resp.json()) as { refresh_token?: string }
    const refreshToken = data.refresh_token
    if (!refreshToken) {
      // Google does not always return refresh_token if previously granted without prompt=consent.
      throw new Error('No refresh token returned. Try disconnecting and reconnecting with consent.')
    }

    const encrypted = await encryptToEnvelope(refreshToken)
    const supabase = createServiceClient(req)

    const { error } = await supabase.from('google_calendar_connections').upsert(
      {
        user_id: userId,
        encrypted_refresh_token: encrypted,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
    if (error) throw new Error('Failed to save connection')

    return json({ ok: true })
  } catch (e) {
    return json({ error: (e as Error).message ?? 'Unknown error' }, { status: 400 })
  }
})

