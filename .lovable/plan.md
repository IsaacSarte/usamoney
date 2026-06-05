
# Budget Tracker (Cloud-synced, Multi-user)

A full budget tracker backed by Lovable Cloud (Supabase). Each user signs in, data syncs across devices, and a password-protected vault stores sensitive info encrypted client-side. Currency: Philippine Peso (₱).

## Auth
- Email/password sign in/up via Lovable Cloud
- `/auth` public route, all app routes under `_authenticated/`
- `profiles` table auto-created on signup (display name)

## Features

### 1. Dashboard (`/`)
- Totals: income, expenses, net balance (current month + all-time)
- Charts (Recharts):
  - Monthly income vs expense (bar, last 6 months)
  - Expense breakdown by category (donut)
- Budget progress bars (per-category spend vs limit)
- Recent transactions

### 2. Transactions (`/transactions`)
- Add / edit / delete; fields: type, amount, category, date, note
- Filters: month, type, category, search
- CSV export (filtered view) + CSV import

### 3. Categories (`/categories`)
- Separate lists for income & expense
- Add / rename / delete (delete reassigns to "Uncategorized")
- Seeded defaults on first login

### 4. Budgets (`/budgets`)
- Monthly limit per expense category (₱)
- Visual progress, over-budget warnings on dashboard

### 5. Recurring (`/recurring`)
- Define recurring income/expense (daily/weekly/monthly/yearly, start/end)
- Server function generates due transactions on dashboard load (idempotent via `next_run_at`)

### 6. Vault (`/vault`) — password protected, client-side encrypted
- Master password set on first vault visit (separate from account password)
- Items: bank accounts, loan numbers, card refs, free notes
- AES-GCM encryption in browser; only ciphertext stored in DB
- Cloud sync works because server only sees ciphertext
- Auto-locks on refresh / route leave; "cannot be recovered if forgotten" warning

## Technical Details

**Stack:** TanStack Start + Lovable Cloud (Supabase) + Tailwind + shadcn/ui + Recharts.

**Routes:**
- `src/routes/auth.tsx` (public)
- `src/routes/_authenticated/route.tsx` (gate — managed by Cloud integration)
- `src/routes/_authenticated/index.tsx` (dashboard)
- `src/routes/_authenticated/transactions.tsx`
- `src/routes/_authenticated/categories.tsx`
- `src/routes/_authenticated/budgets.tsx`
- `src/routes/_authenticated/recurring.tsx`
- `src/routes/_authenticated/vault.tsx`

**Database (all tables RLS-scoped to `auth.uid()`):**
- `profiles(id, display_name, created_at)` — auto-created via trigger
- `categories(id, user_id, name, kind enum:'income'|'expense', created_at)`
- `transactions(id, user_id, type, amount numeric(14,2), category_id, occurred_on, note, created_at)`
- `budgets(id, user_id, category_id, monthly_limit, created_at)` — unique (user_id, category_id)
- `recurring_rules(id, user_id, type, amount, category_id, frequency enum, interval_count, start_on, end_on, next_run_at, note)`
- `vault_items(id, user_id, label, item_type, ciphertext text, iv text, created_at, updated_at)`
- `vault_meta(user_id pk, salt text, verifier_ciphertext text, verifier_iv text)` — for password verification

Each table: `GRANT` to `authenticated` + `service_role`, RLS enabled, per-user policies using `auth.uid() = user_id`.

**Server functions (`src/lib/*.functions.ts`, all use `requireSupabaseAuth`):**
- `transactions.functions.ts` — list/create/update/delete + monthly aggregates
- `categories.functions.ts` — CRUD + seed defaults on first login
- `budgets.functions.ts` — upsert/delete + current-month spend join
- `recurring.functions.ts` — CRUD + `materializeDue()` (creates transactions for rules with `next_run_at <= today`)
- `vault.functions.ts` — list/upsert/delete ciphertext rows; set/verify password verifier

**Vault encryption (client-side, Web Crypto):**
- PBKDF2(SHA-256, 100k) derives AES-GCM key from master password + salt
- On setup: generate salt, encrypt a known plaintext (verifier), store `{salt, verifier_ciphertext, verifier_iv}` in `vault_meta`
- On unlock: derive key, decrypt verifier; success ⇒ key kept in React state until lock
- Each item encrypted individually with its own IV; server never sees plaintext or master password

**Data fetching:** TanStack Query (`ensureQueryData` in loaders, `useSuspenseQuery` in components). Invalidate on mutations.

**Design direction:** calm finance aesthetic — neutral surface, green for income, red for expense, single accent for primary actions. Charts use the same palette. Peso formatting via `Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })`.

## Setup steps (executed in order during build)
1. Enable Lovable Cloud
2. Create migrations: enums, tables, indexes, GRANTs, RLS policies, profile trigger
3. Build auth page + `_authenticated` gate (integration provides the layout)
4. Build server functions + routes + UI
5. Seed default categories on first login

Confirm to proceed and I'll start building.
