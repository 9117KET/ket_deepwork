export const GOOGLE_AUTH_BASE = 'https://accounts.google.com/o/oauth2/v2/auth'
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
export const GOOGLE_CALENDAR_BASE = 'https://www.googleapis.com/calendar/v3'

export const GOOGLE_SCOPES = [
  // Full calendar access required for two-way create/update.
  'https://www.googleapis.com/auth/calendar',
]

export function buildRedirectUri(origin: string): string {
  const base = origin.endsWith('/') ? origin.slice(0, -1) : origin
  return `${base}/calendar/callback`
}

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function CORS_PREFLIGHT(): Response {
  return new Response('ok', { headers: CORS_HEADERS })
}

export function json(resBody: unknown, init?: ResponseInit): Response {
  const { headers: extraHeaders, ...rest } = init ?? {}
  return new Response(JSON.stringify(resBody), {
    headers: { 'content-type': 'application/json; charset=utf-8', ...CORS_HEADERS, ...(extraHeaders as Record<string, string> | undefined) },
    ...rest,
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

