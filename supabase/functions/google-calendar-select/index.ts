import { createServiceClient, requireUserId } from '../_shared/supabase.ts'
import { json, CORS_PREFLIGHT } from '../_shared/google.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return CORS_PREFLIGHT
  try {
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 })
    const userId = await requireUserId(req)
    const { calendarId, calendarSummary } = (await req.json()) as {
      calendarId?: string
      calendarSummary?: string
    }
    console.log('[calendar-select] user:', userId.slice(0, 8), '| calendarId:', calendarId, '| summary:', calendarSummary ?? '—')
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
    console.log('[calendar-select] update ok:', !error, error ? '| error: ' + error.message : '')
    if (error) throw new Error('Failed to save selection')
    return json({ ok: true })
  } catch (e) {
    console.error('[calendar-select] error:', (e as Error).message)
    return json({ error: (e as Error).message ?? 'Unknown error' }, { status: 400 })
  }
})

