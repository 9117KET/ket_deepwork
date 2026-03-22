import { createServiceClient, requireUserId } from '../_shared/supabase.ts'
import { json } from '../_shared/google.ts'

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 })
    const userId = await requireUserId(req)
    const { calendarId, calendarSummary } = (await req.json()) as {
      calendarId?: string
      calendarSummary?: string
    }
    if (!calendarId) throw new Error('Missing calendarId')

    const supabase = createServiceClient(req)
    const { error } = await supabase
      .from('google_calendar_connections')
      .update({
        selected_calendar_id: calendarId,
        selected_calendar_summary: calendarSummary ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
    if (error) throw new Error('Failed to save selection')
    return json({ ok: true })
  } catch (e) {
    return json({ error: (e as Error).message ?? 'Unknown error' }, { status: 400 })
  }
})

