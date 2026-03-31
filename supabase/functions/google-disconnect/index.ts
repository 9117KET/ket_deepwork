import { createServiceClient, requireUserId } from '../_shared/supabase.ts'
import { json } from '../_shared/google.ts'

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 })
    const userId = await requireUserId(req)
    const supabase = createServiceClient(req)

    // Remove calendar event links first, then the connection row.
    await supabase.from('calendar_event_links').delete().eq('user_id', userId)
    const { error } = await supabase
      .from('google_calendar_connections')
      .delete()
      .eq('user_id', userId)

    if (error) throw new Error(error.message)

    return json({ ok: true })
  } catch (e) {
    return json({ error: (e as Error).message ?? 'Unknown error' }, { status: 400 })
  }
})
