import { createServiceClient, requireUserId } from '../_shared/supabase.ts'
import { json, CORS_PREFLIGHT } from '../_shared/google.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return CORS_PREFLIGHT
  try {
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 })
    const userId = await requireUserId(req)
    const supabase = createServiceClient(req)

    console.log('[disconnect] user:', userId.slice(0, 8))
    // Remove calendar event links first, then the connection row.
    await supabase.from('calendar_event_links').delete().eq('user_id', userId)
    const { error } = await supabase
      .from('google_calendar_connections')
      .delete()
      .eq('user_id', userId)

    console.log('[disconnect] ok:', !error, error ? '| error: ' + error.message : '')
    if (error) throw new Error(error.message)

    return json({ ok: true })
  } catch (e) {
    console.error('[disconnect] error:', (e as Error).message)
    return json({ error: (e as Error).message ?? 'Unknown error' }, { status: 400 })
  }
})
