# Deploying to Vercel

This app is configured to build for Vercel via Nitro's `vercel` preset
(see `vite.config.ts` → `nitro: { preset: "vercel" }`). The build emits
`.vercel/output/` (Vercel Build Output API v3), which Vercel auto-detects.

## One-time setup

1. Push the repo to GitHub/GitLab/Bitbucket and import it on https://vercel.com/new.
2. **Framework Preset**: select **Other** (Vercel will detect the build output).
3. **Build Command**: `npm run build` (or `bun run build`).
4. **Output Directory**: leave empty — Nitro writes the Build Output API tree.
5. **Install Command**: default.

## Required environment variables

Set these in **Project Settings → Environment Variables** (Production + Preview):

| Name | Value |
| --- | --- |
| `SUPABASE_URL` | `https://qvdzgweruxrdgxbvtubj.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | (same anon key as `VITE_SUPABASE_PUBLISHABLE_KEY`) |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key from the backend dashboard |
| `VITE_SUPABASE_URL` | `https://qvdzgweruxrdgxbvtubj.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | publishable/anon key |
| `VITE_SUPABASE_PROJECT_ID` | `qvdzgweruxrdgxbvtubj` |

The `VITE_*` ones are inlined at build time; the unprefixed ones are read at
request time by server functions (`process.env.*`). On Lovable Cloud these are
injected automatically — on Vercel you must add them yourself.

## Notes

- The default Node.js runtime is used for server functions and SSR. No edge
  runtime config is required.
- If you later add custom server routes that you want to run on Vercel Edge,
  configure that per-route via Nitro route rules in `vite.config.ts`.
- `https://usamoney.lovable.app` (Lovable Cloud) continues to work
  independently — Lovable still builds with its own Cloudflare preset when
  the env var `NITRO_PRESET=cloudflare-module` is set in the sandbox.