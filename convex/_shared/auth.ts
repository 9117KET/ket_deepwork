// @convex-dev/auth encodes `identity.subject` as `<userId>|<sessionId>`.
// The session segment differs per sign-in, so it must be stripped before
// using the subject as a stable per-user database key.
export function getUserId(subject: string): string {
  return subject.split("|")[0]
}
