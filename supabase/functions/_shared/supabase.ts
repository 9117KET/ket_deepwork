import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export function createServiceClient(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!supabaseUrl || !serviceKey) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  const authHeader = req.headers.get('Authorization') ?? ''
  return createClient(supabaseUrl, serviceKey, {
    global: { headers: { Authorization: authHeader } },
  })
}

export async function requireUserId(req: Request): Promise<string> {
  const client = createServiceClient(req)
  const { data, error } = await client.auth.getUser()
  if (error || !data?.user?.id) throw new Error('Unauthorized')
  return data.user.id
}

