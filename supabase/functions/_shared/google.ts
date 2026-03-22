export const GOOGLE_AUTH_BASE = 'https://accounts.google.com/o/oauth2/v2/auth'
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
export const GOOGLE_CALENDAR_BASE = 'https://www.googleapis.com/calendar/v3'

export const GOOGLE_SCOPES = [
  // Full calendar access required for two-way create/update.
  'https://www.googleapis.com/auth/calendar',
]

export function buildRedirectUri(origin: string): string {
  return `${origin.replace(/\\/$/, '')}/calendar/callback`
}

export function json(resBody: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(resBody), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
    ...init,
  })
}

export async function getGoogleAccessToken(params: {
  refreshToken: string
  clientId: string
  clientSecret: string
}): Promise<{ accessToken: string; expiresIn: number }> {
  const body = new URLSearchParams({
    client_id: params.clientId,
    client_secret: params.clientSecret,
    refresh_token: params.refreshToken,
    grant_type: 'refresh_token',
  })
  const resp = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!resp.ok) throw new Error(`Token refresh failed (${resp.status})`)
  const data = (await resp.json()) as { access_token: string; expires_in: number }
  return { accessToken: data.access_token, expiresIn: data.expires_in }
}

