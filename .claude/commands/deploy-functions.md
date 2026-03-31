# Deploy Supabase Edge Functions

Deploy or update the Google Calendar integration Edge Functions.

## Prerequisites
```bash
# Install Supabase CLI if not present
npm install -g supabase

# Login and link project
supabase login
supabase link --project-ref <your-project-ref>
```

## Deploy all functions
```bash
supabase functions deploy google-oauth-start
supabase functions deploy google-oauth-callback
supabase functions deploy google-calendars-list
supabase functions deploy google-calendar-select
supabase functions deploy google-sync-pull
supabase functions deploy google-sync-push
```

## Deploy a single function
```bash
supabase functions deploy <function-name>
```

## Required secrets (set once per project)
```bash
supabase secrets set GOOGLE_CLIENT_ID=<your-google-client-id>
supabase secrets set GOOGLE_CLIENT_SECRET=<your-google-client-secret>
supabase secrets set GOOGLE_REDIRECT_URI=https://<your-project>.supabase.co/functions/v1/google-oauth-callback
```

## Function locations
```
supabase/functions/
├── _shared/          ← shared helpers (crypto, Google API, Supabase service client)
├── google-oauth-start/
├── google-oauth-callback/
├── google-calendars-list/
├── google-calendar-select/
├── google-sync-pull/
└── google-sync-push/
```

## Architecture notes
- All functions use the **service role** Supabase client (`_shared/supabase.ts`) — they bypass RLS
- `requireUserId()` in `_shared/supabase.ts` validates the user's JWT from the `Authorization` header
- Google OAuth tokens are stored encrypted in `google_calendar_connections` — never sent to the client
- The `_shared/` folder is not a deployable function — it's imported by the other functions

## Testing locally
```bash
supabase functions serve google-oauth-start --env-file .env.local
```
