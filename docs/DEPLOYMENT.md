# Deployment setup & pending steps

_Last updated: 2026-06-11_

## Architecture

| Piece | Name / URL | Notes |
|---|---|---|
| **Live site** | https://ket-deepwork.vercel.app | Vercel project `kinlo-ets-projects/ket-deepwork`, auto-deploys on push to `main` |
| **Convex prod** | `nautical-wolf-453` → `https://nautical-wolf-453.convex.cloud` | Serves the live site. Deploy with `npx convex deploy` |
| **Convex dev** | `knowing-gopher-377` → `https://knowing-gopher-377.eu-west-1.convex.cloud` | Local development (`npx convex dev`). Also used by Vercel **Preview** builds |
| **Vercel env vars** | `VITE_CONVEX_URL`: Production → prod URL, Preview → dev URL | Set 2026-06-11. Client URL is baked in at build time — changing it requires a redeploy |

### Legacy deployments (do not reuse)

- **`deepblock.vercel.app`** — an old Vercel project on a **different Vercel account**
  serving a stale pre-Convex build. Not connected to this repo.
- **`dapper-crab-847.convex.cloud`** — old Convex deployment that the live site
  pointed at until 2026-06-11. Any data synced from the old live site lives there.

## ⏳ Pending next steps

1. ~~**Prod auth keys**~~ — done (2026-06-12). `nautical-wolf-453` now has
   `JWT_PRIVATE_KEY`, `JWKS`, and `SITE_URL=https://ket-deepwork.vercel.app`
   set, and sign-up/sign-in on the live site work end-to-end.

   Note: the `npx @convex-dev/auth --prod` CLI crashes on Windows when
   writing `JWT_PRIVATE_KEY` (it shells out via `cmd.exe` with a quoted
   multi-line value, which `cmd.exe` mangles). If this ever needs to be
   regenerated, generate the RS256 key pair manually (see
   `node_modules/@convex-dev/auth/dist/bin.cjs` `generateKeys()` for the
   exact format) and set both vars via
   `npx convex env set --prod --from-file <file>`, which handles quoting
   correctly.

   **2026-06-14 — dev deployment auth keys were corrupted & fixed.** Local
   `npm run dev` sign-in succeeded server-side but never authenticated the
   client (endless refresh loop, `isAuthenticated` stuck false). Root cause:
   the **dev** deployment's `JWKS` env var contained literal newlines/spaces
   inside the base64url modulus (same Windows `cmd.exe` mangling), so
   `…/.well-known/jwks.json` served invalid JSON and the backend could not
   verify JWT signatures. Fixed by regenerating an RS256 pair in the exact
   `generateKeys()` format — `JWT_PRIVATE_KEY` = PKCS8 PEM with newlines
   replaced by spaces (single line); `JWKS` = compact `JSON.stringify` — and
   setting **each var from a file**:
   ```bash
   # Do NOT pass these as CLI args on Windows — npx→cmd.exe strips the JSON
   # quotes and splits the PEM on spaces. Always use --from-file:
   npx convex env set JWKS --from-file jwks.txt
   npx convex env set JWT_PRIVATE_KEY --from-file jwtkey.txt
   ```
   Verify the fix: `curl …/.well-known/jwks.json | python -c 'import json,sys;json.load(sys.stdin)'`
   must parse, and the served modulus `n` must equal the public key derived
   from `JWT_PRIVATE_KEY`. (`SITE_URL` on dev is still the prod URL; harmless
   for password auth, but revisit if dev ever needs its own OAuth redirects.)

2. **Google Calendar on prod** — copy these env vars from the dev deployment to
   Production in the Convex dashboard:
   `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_TOKEN_ENCRYPTION_KEY_B64`.
   Also add the prod callback (`https://nautical-wolf-453.convex.site/...`,
   mirroring the dev entry) to the Google Cloud OAuth client's authorized
   redirect URIs.

3. **Reclaim `deepblock.vercel.app`** (optional) — log into the old Vercel
   account that owns it, delete that project (or detach the domain), then attach
   it to `ket-deepwork`:
   ```bash
   npx vercel domains add deepblock.vercel.app
   ```
   If done, update `SITE_URL` on Convex prod to the new domain.

4. ~~**Data migration note**~~ — corrected 2026-09-02. There is **no** blanket
   "uploads everything on first sync": the write path only sends days marked
   dirty by a local edit (that is what keeps read/write I/O bounded). Two things
   cover the rest:
   - the **reconcile** on hydration queues any day this device holds that the
     server has never received, draining in capped batches;
   - **`/restore`** re-uploads this device's entire localStorage in paced
     batches, for a deliberate bulk migration.

   Still sign in first from the device holding the most complete data. Old
   server-side data can be exported from `dapper-crab-847` /
   `knowing-gopher-377` via the Convex dashboard.

## ⚠ Deploys are gated on a TypeScript check

`convex deploy` and `convex dev` typecheck everything matched by
`convex/tsconfig.json` **before** pushing, and a failure aborts the deploy.

This bit hard once. `convex/calendar.test.ts` uses `import.meta.glob` (a Vite
global that the Convex tsconfig has no types for), so every deploy failed on a
file the deployment does not even ship. Test files are now excluded from that
config. If a deploy ever stops with *"TypeScript typecheck via `tsc` failed"*,
check whether the offending file actually belongs in the deployment before
reaching for `--typecheck=disable`.

## Sync outage, 2026-06-15 → 2026-09-02 (resolved)

**Symptom:** nothing synced to any device for ~2.5 months. Convex prod held 110
planner days ending 2026-06-16 and never grew.

**Cause:** commit `63bd753` (2026-06-15) added `updatedAt` to the day payload and
to the `plannerDays` validator. The client shipped via Vercel; the **backend was
never deployed**, so every write was rejected:

```
ArgumentValidationError: Object contains extra field `updatedAt`
  that is not in the validator.  Path: .days[0]
```

Prod's newest row is dated one day after that commit. `focusBlockMinutes` /
`focusBreakMinutes` on `userSettings.upsert` were stale the same way. The
deploy had been blocked by the typecheck gate above.

**Not** the June I/O quota incident, which was a separate (and by then already
fixed) problem — though the read amplification behind it was still live and
would have re-blown the quota once writes resumed. See the sync section in
`CLAUDE.md` for the hot/cold split that fixes it.

**Lesson:** a client-side change to a Convex payload is a **two-sided** deploy.
Vercel ships the client on push to `main`; the backend only moves when someone
runs `npx convex deploy`. Verify both agree:

```bash
npx convex function-spec --prod | grep -A2 upsertMany   # does the validator have the new field?
```

## Verify what the live site points at

```bash
BUNDLE=$(curl -s https://ket-deepwork.vercel.app | grep -oE 'assets/index-[^"]+\.js' | head -1)
curl -s "https://ket-deepwork.vercel.app/$BUNDLE" | grep -oE '[a-z]+-[a-z]+-[0-9]+[a-z0-9.-]*\.convex\.cloud' | sort -u
# Expect: nautical-wolf-453.convex.cloud
# (happy-otter-123.convex.cloud is a placeholder string inside the Convex library — ignore)
```
