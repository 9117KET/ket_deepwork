import { ConvexError } from "convex/values"

/** `ConvexError` code for a refresh token Google no longer accepts. */
export const GOOGLE_RECONNECT = "GOOGLE_RECONNECT"

export const GOOGLE_AUTH_BASE = "https://accounts.google.com/o/oauth2/v2/auth"
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
export const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke"
export const GOOGLE_CALENDAR_BASE = "https://www.googleapis.com/calendar/v3"

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar",
]

export function buildRedirectUri(origin: string): string {
  const base = origin.endsWith("/") ? origin.slice(0, -1) : origin
  return `${base}/calendar/callback`
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
    grant_type: "refresh_token",
  })
  const resp = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  })
  if (!resp.ok) {
    // invalid_grant means the refresh token is dead: revoked, or expired after
    // 7 days while the OAuth consent screen is in Testing. Only reconnecting
    // fixes it, so say so in a ConvexError — plain Errors reach a prod client
    // as an anonymous "Server Error".
    const body = (await resp.json().catch(() => ({}))) as { error?: string }
    if (body.error === "invalid_grant") {
      throw new ConvexError({ code: GOOGLE_RECONNECT, message: "Google Calendar access has expired. Reconnect to continue." })
    }
    throw new Error(`Token refresh failed (${resp.status})`)
  }
  const data = (await resp.json()) as { access_token: string; expires_in: number }
  return { accessToken: data.access_token, expiresIn: data.expires_in }
}

export function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      ...(init?.headers as Record<string, string> | undefined),
    },
    status: init?.status ?? 200,
  })
}
