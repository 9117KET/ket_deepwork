/**
 * lib/supabase.ts
 *
 * Supabase browser client for the Deepblock app.
 * Centralizes configuration so we have a single shared instance.
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!supabaseUrl || !supabaseAnonKey) {
  // In development this will surface a clear error instead of failing silently.
  // In production these should always be set via environment variables.
  // eslint-disable-next-line no-console
  console.warn(
    '[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Supabase features will be disabled until configured.',
  )
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '')

