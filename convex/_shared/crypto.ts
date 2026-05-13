const encoder = new TextEncoder()
const decoder = new TextDecoder()

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function bytesToB64(bytes: Uint8Array): string {
  let bin = ""
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

async function importKeyFromEnv(): Promise<CryptoKey> {
  const keyB64 = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY_B64
  if (!keyB64) throw new Error("Missing GOOGLE_TOKEN_ENCRYPTION_KEY_B64")
  const raw = b64ToBytes(keyB64)
  if (raw.length !== 32) throw new Error("GOOGLE_TOKEN_ENCRYPTION_KEY_B64 must be 32 bytes (base64)")
  return globalThis.crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"])
}

export async function encryptToEnvelope(plaintext: string): Promise<string> {
  const key = await importKeyFromEnv()
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12))
  const ct = await globalThis.crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(plaintext))
  return JSON.stringify({ v: 1, iv: bytesToB64(iv), ct: bytesToB64(new Uint8Array(ct)) })
}

export async function decryptFromEnvelope(envelopeJson: string): Promise<string> {
  const key = await importKeyFromEnv()
  const parsed = JSON.parse(envelopeJson) as { v: number; iv: string; ct: string }
  if (!parsed || parsed.v !== 1) throw new Error("Unsupported envelope")
  const iv = b64ToBytes(parsed.iv)
  const ct = b64ToBytes(parsed.ct)
  const pt = await globalThis.crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct)
  return decoder.decode(pt)
}
