import { createServiceClient, requireUserId } from '../_shared/supabase.ts'
import { decryptFromEnvelope } from '../_shared/crypto.ts'
import { GOOGLE_CALENDAR_BASE, getGoogleAccessToken, json } from '../_shared/google.ts'

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

function toLocalIsoDay(d: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

function hhmmFromDate(d: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d)
  const h = parts.find((p) => p.type === 'hour')?.value ?? '00'
  const m = parts.find((p) => p.type === 'minute')?.value ?? '00'
  return `${h}:${m}`
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 })
    const userId = await requireUserId(req)
    const supabase = createServiceClient(req)

    const { data: conn } = await supabase
      .from('google_calendar_connections')
      .select('encrypted_refresh_token, selected_calendar_id')
      .eq('user_id', userId)
      .maybeSingle()

    console.log('[sync-pull] user:', userId.slice(0, 8), '| calendar:', conn?.selected_calendar_id ?? 'none')
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
    console.log('[sync-pull] timezone:', userTimezone, '| range:', start.toISOString().slice(0, 10), '→', end.toISOString().slice(0, 10))

    const url = new URL(`${GOOGLE_CALENDAR_BASE}/calendars/${encodeURIComponent(conn.selected_calendar_id)}/events`)
    url.searchParams.set('singleEvents', 'true')
    url.searchParams.set('orderBy', 'startTime')
    url.searchParams.set('timeMin', start.toISOString())
    url.searchParams.set('timeMax', end.toISOString())

    const resp = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } })
    console.log('[sync-pull] Google Events API status:', resp.status)
    if (!resp.ok) throw new Error(`Failed to fetch events (${resp.status})`)
    const data = (await resp.json()) as {
      items?: Array<{
        id: string
        summary?: string
        etag?: string
        start?: { dateTime?: string; date?: string }
        end?: { dateTime?: string; date?: string }
      }>
    }

    const items = data.items ?? []
    console.log('[sync-pull] events from Google:', items.length, '(all-day events will be skipped)')
    let imported = 0

    for (const ev of items) {
      // Skip all-day events for v1.
      const startDt = ev.start?.dateTime
      const endDt = ev.end?.dateTime
      if (!startDt || !endDt) continue

      const startDateObj = new Date(startDt)
      const endDateObj = new Date(endDt)
      const isoDay = toLocalIsoDay(startDateObj, userTimezone)
      const scheduledAt = hhmmFromDate(startDateObj, userTimezone)
      const durationMinutes = Math.max(1, Math.round((endDateObj.getTime() - startDateObj.getTime()) / 60000))

      // Check if already linked.
      const { data: link } = await supabase
        .from('calendar_event_links')
        .select('task_id')
        .eq('user_id', userId)
        .eq('google_calendar_id', conn.selected_calendar_id)
        .eq('google_event_id', ev.id)
        .maybeSingle()

      // Fetch existing day row (if any)
      const { data: dayRow } = await supabase
        .from('planner_days')
        .select('date, tasks, deep_work_sessions, habit_completions, sleep_hours, mood')
        .eq('user_id', userId)
        .eq('date', isoDay)
        .maybeSingle()

      const tasks = (dayRow?.tasks as PlannerTask[] | null) ?? []

      if (link?.task_id) {
        // Update linked task in-place.
        const next = tasks.map((t) =>
          t.id === link.task_id
            ? { ...t, title: ev.summary ?? t.title, scheduledAt, durationMinutes }
            : t,
        )
        await supabase.from('planner_days').upsert(
          {
            user_id: userId,
            date: isoDay,
            tasks: next,
            deep_work_sessions: dayRow?.deep_work_sessions ?? [],
            habit_completions: dayRow?.habit_completions ?? {},
            sleep_hours: dayRow?.sleep_hours ?? null,
            mood: dayRow?.mood ?? null,
          },
          { onConflict: 'user_id,date' },
        )
      } else {
        const taskId = crypto.randomUUID()
        const newTask: PlannerTask = {
          id: taskId,
          title: ev.summary ?? '(Calendar event)',
          sectionId: 'highPriority',
          date: isoDay,
          isDone: false,
          scheduledAt,
          durationMinutes,
        }
        const next = [...tasks, newTask]
        await supabase.from('planner_days').upsert(
          {
            user_id: userId,
            date: isoDay,
            tasks: next,
            deep_work_sessions: dayRow?.deep_work_sessions ?? [],
            habit_completions: dayRow?.habit_completions ?? {},
            sleep_hours: dayRow?.sleep_hours ?? null,
            mood: dayRow?.mood ?? null,
          },
          { onConflict: 'user_id,date' },
        )
        await supabase.from('calendar_event_links').upsert(
          {
            user_id: userId,
            task_id: taskId,
            task_date: isoDay,
            google_calendar_id: conn.selected_calendar_id,
            google_event_id: ev.id,
            etag: ev.etag ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,google_calendar_id,google_event_id' },
        )
        imported += 1
      }
    }

    console.log('[sync-pull] done | imported:', imported)
    return json({ ok: true, imported })
  } catch (e) {
    console.error('[sync-pull] error:', (e as Error).message)
    return json({ error: (e as Error).message ?? 'Unknown error' }, { status: 400 })
  }
})

