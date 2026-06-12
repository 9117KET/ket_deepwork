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

4. **Data migration note** — first sign-in on the new prod starts with an empty
   server account; the device's localStorage (`deepblock_state_v1`) uploads
   everything on first sync. Sign in first from the device holding the most
   complete data. Old server-side data, if needed, can be exported from
   `dapper-crab-847` / `knowing-gopher-377` via the Convex dashboard.

## Verify what the live site points at

```bash
BUNDLE=$(curl -s https://ket-deepwork.vercel.app | grep -oE 'assets/index-[^"]+\.js' | head -1)
curl -s "https://ket-deepwork.vercel.app/$BUNDLE" | grep -oE '[a-z]+-[a-z]+-[0-9]+[a-z0-9.-]*\.convex\.cloud' | sort -u
# Expect: nautical-wolf-453.convex.cloud
# (happy-otter-123.convex.cloud is a placeholder string inside the Convex library — ignore)
```
