import { createServiceClient, requireUserId } from '../_shared/supabase.ts'
import { decryptFromEnvelope } from '../_shared/crypto.ts'
import { GOOGLE_CALENDAR_BASE, getGoogleAccessToken, json } from '../_shared/google.ts'

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 })
    const userId = await requireUserId(req)
    const supabase = createServiceClient(req)

    console.log('[calendars-list] user:', userId.slice(0, 8))
    const { data: conn, error } = await supabase
      .from('google_calendar_connections')
      .select('encrypted_refresh_token')
      .eq('user_id', userId)
      .maybeSingle()
    console.log('[calendars-list] connection found:', Boolean(conn), error ? '| DB error: ' + error.message : '')
    if (error || !conn) throw new Error('Google Calendar not connected')

    const refreshToken = await decryptFromEnvelope(conn.encrypted_refresh_token as string)
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID') ?? ''
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET') ?? ''
    const { accessToken } = await getGoogleAccessToken({ refreshToken, clientId, clientSecret })

    const resp = await fetch(`${GOOGLE_CALENDAR_BASE}/users/me/calendarList`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    console.log('[calendars-list] Google API status:', resp.status)
    if (!resp.ok) throw new Error(`Failed to list calendars (${resp.status})`)
    const data = (await resp.json()) as { items?: Array<{ id: string; summary: string; primary?: boolean }> }

    const calendars = (data.items ?? []).map((c) => ({
      id: c.id,
      summary: c.summary,
      primary: Boolean(c.primary),
    }))
    console.log('[calendars-list] returned', calendars.length, 'calendars, primary:', calendars.find((c) => c.primary)?.summary ?? 'none')

    return json({ calendars })
  } catch (e) {
    console.error('[calendars-list] error:', (e as Error).message)
    return json({ error: (e as Error).message ?? 'Unknown error' }, { status: 400 })
  }
})

