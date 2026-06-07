// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Deploy target is controlled by the NITRO_PRESET env var:
//   - unset (Lovable Cloud sandbox)     → defaults to "cloudflare-module"
//   - "vercel" (set in Vercel project)  → builds Vercel Build Output API v3
//   - any other Nitro preset works too ("node-server", "static", ...)
const nitroPreset = process.env.NITRO_PRESET;

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  // Forward an explicit preset when provided. Without it, the Lovable config
  // keeps its "cloudflare-module" default so Lovable Cloud builds keep working.
  nitro: nitroPreset ? { preset: nitroPreset } : undefined,
});
