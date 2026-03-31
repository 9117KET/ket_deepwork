import { createServiceClient, requireUserId } from '../_shared/supabase.ts'
import { decryptFromEnvelope } from '../_shared/crypto.ts'
import { GOOGLE_CALENDAR_BASE, getGoogleAccessToken, json, CORS_PREFLIGHT } from '../_shared/google.ts'

type PlannerTask = {
  id: string
  title: string
  sectionId: string
  date: string
  isDone: boolean
  parentId?: string
  scheduledAt?: string
  durationMinutes?: number
}

function localEndDateTime(isoDay: string, hhmm: string, durationMins: number): string {
  const [hh, mm] = hhmm.split(':').map(Number)
  const endTotal = (hh ?? 0) * 60 + (mm ?? 0) + durationMins
  const endH = Math.floor(endTotal / 60) % 24
  const endM = endTotal % 60
  const overflowDays = Math.floor(endTotal / (24 * 60))
  if (overflowDays > 0) {
    const d = new Date(`${isoDay}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() + overflowDays)
    const newDay = d.toISOString().slice(0, 10)
    return `${newDay}T${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:00`
  }
  return `${isoDay}T${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:00`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return CORS_PREFLIGHT
  try {
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 })
    const userId = await requireUserId(req)
    const supabase = createServiceClient(req)

    const { data: conn } = await supabase
      .from('google_calendar_connections')
      .select('encrypted_refresh_token, selected_calendar_id')
      .eq('user_id', userId)
      .maybeSingle()
    console.log('[sync-push] user:', userId.slice(0, 8), '| calendar:', conn?.selected_calendar_id ?? 'none')
    if (!conn?.selected_calendar_id) throw new Error('No calendar selected')

    const refreshToken = await decryptFromEnvelope(conn.encrypted_refresh_token as string)
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID') ?? ''
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET') ?? ''
    const { accessToken } = await getGoogleAccessToken({ refreshToken, clientId, clientSecret })

    const { startDate, endDate, timezone } = (await req.json().catch(() => ({}))) as {
      startDate?: string
      endDate?: string
      timezone?: string
    }
    const userTimezone = timezone ?? 'UTC'
    const now = new Date()
    const start = startDate ? new Date(`${startDate}T00:00:00`) : new Date(now)
    const end = endDate ? new Date(`${endDate}T23:59:59`) : new Date(now.getTime() + 14 * 864e5)
    console.log('[sync-push] timezone:', userTimezone, '| range:', start.toISOString().slice(0, 10), '→', end.toISOString().slice(0, 10))

    // Pull planner days in window.
    const { data: dayRows, error } = await supabase
      .from('planner_days')
      .select('date, tasks')
      .eq('user_id', userId)
      .gte('date', start.toISOString().slice(0, 10))
      .lte('date', end.toISOString().slice(0, 10))
      .order('date', { ascending: true })
    if (error) throw new Error('Failed to load planner days')
    console.log('[sync-push] planner days found:', dayRows?.length ?? 0)

    let created = 0
    let updated = 0
    let skipped = 0

    for (const row of (dayRows ?? []) as Array<{ date: string; tasks: unknown }>) {
      const isoDay = row.date
      const tasks = (row.tasks as PlannerTask[] | null) ?? []
      const schedulable = tasks.filter((t) => !t.parentId && t.scheduledAt && t.durationMinutes && t.durationMinutes > 0)
      console.log('[sync-push] day:', isoDay, '| total tasks:', tasks.length, '| schedulable:', schedulable.length)

      for (const t of tasks) {
        if (t.parentId) continue
        if (!t.scheduledAt || !t.durationMinutes || t.durationMinutes <= 0) continue

        const startDateTime = `${isoDay}T${t.scheduledAt}:00`
        const endDateTime = localEndDateTime(isoDay, t.scheduledAt, t.durationMinutes)

        const { data: link } = await supabase
          .from('calendar_event_links')
          .select('google_event_id, etag')
          .eq('user_id', userId)
          .eq('task_date', isoDay)
          .eq('task_id', t.id)
          .maybeSingle()

        const eventBody = {
          summary: t.title,
          start: { dateTime: startDateTime, timeZone: userTimezone },
          end: { dateTime: endDateTime, timeZone: userTimezone },
        }

        console.log('[sync-push] task:', t.title.slice(0, 40), '| start:', startDateTime, '| existing link:', Boolean(link?.google_event_id))
        if (!link?.google_event_id) {
          const resp = await fetch(
            `${GOOGLE_CALENDAR_BASE}/calendars/${encodeURIComponent(conn.selected_calendar_id)}/events`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'content-type': 'application/json',
              },
              body: JSON.stringify(eventBody),
            },
          )
          console.log('[sync-push] CREATE status:', resp.status, 'task:', t.title.slice(0, 30))
          if (!resp.ok) {
            skipped += 1
            continue
          }
          const createdEv = (await resp.json()) as { id: string; etag?: string }
          await supabase.from('calendar_event_links').upsert(
            {
              user_id: userId,
              task_id: t.id,
              task_date: isoDay,
              google_calendar_id: conn.selected_calendar_id,
              google_event_id: createdEv.id,
              etag: createdEv.etag ?? null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,google_calendar_id,google_event_id' },
          )
          created += 1
        } else {
          const url = `${GOOGLE_CALENDAR_BASE}/calendars/${encodeURIComponent(conn.selected_calendar_id)}/events/${encodeURIComponent(link.google_event_id)}`
          const resp = await fetch(url, {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'content-type': 'application/json',
              ...(link.etag ? { 'If-Match': String(link.etag) } : {}),
            },
            body: JSON.stringify(eventBody),
          })
          console.log('[sync-push] UPDATE status:', resp.status, 'task:', t.title.slice(0, 30))
          if (resp.status === 412) {
            // Precondition failed: event changed on Google; v1 skips and reports.
            console.log('[sync-push] 412 conflict — skipping task:', t.title.slice(0, 40))
            skipped += 1
            continue
          }
          if (!resp.ok) {
            skipped += 1
            continue
          }
          const updatedEv = (await resp.json()) as { etag?: string }
          await supabase
            .from('calendar_event_links')
            .update({ etag: updatedEv.etag ?? null, updated_at: new Date().toISOString() })
            .eq('user_id', userId)
            .eq('google_calendar_id', conn.selected_calendar_id)
            .eq('google_event_id', link.google_event_id)
          updated += 1
        }
      }
    }

    console.log('[sync-push] done | created:', created, 'updated:', updated, 'skipped:', skipped)
    return json({ ok: true, created, updated, skipped })
  } catch (e) {
    console.error('[sync-push] error:', (e as Error).message)
    return json({ error: (e as Error).message ?? 'Unknown error' }, { status: 400 })
  }
})

