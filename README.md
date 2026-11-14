# Pratham Tiffin

Monorepo for the **student mobile app** (Expo) and **admin dashboard** (Next.js), backed by **plain PostgreSQL**.

## Stack

| Path | Role |
|------|------|
| `apps/admin` | Next.js UI + REST API (`/api/*`) |
| `apps/student` | Expo student app → calls admin API |
| `packages/shared` | Cutoffs, money helpers, types |
| `packages/db` | `pg` pool helper |
| `db/migrations` | Plain SQL schema |

## Product rules

- COD only (no online payments)
- Per-student credit limit; block orders when outstanding would exceed it
- Admin clears outstanding after cash collection
- Fixed plans + cancel-before-cutoff; ad-hoc extras with qty 1–10
- Cutoffs default IST: Breakfast 06:00, Lunch 11:00, Dinner 17:00
- Referral: invitee completes **X** delivered orders → inviter gets **Y** wallet credit
- Push via Expo Push API
- Audit log for balance / credit / settings / order status

## Setup (Docker recommended)

### 1. Start Postgres

```bash
npm run db:up
```

Uses `docker-compose.yml` → `postgres:16` on **`localhost:5434`** (avoids clash with local Windows Postgres on 5432), db/user/pass `pratham` / `postgres` / `postgres`.

### 2. Migrate + seed

```bash
# PowerShell
$env:DATABASE_URL="postgres://postgres:postgres@localhost:5434/pratham"
npm run db:migrate
npm run db:seed
```

Demo logins from seed:

- Admin: `admin@pratham.local` / `admin123`
- Students: `rahul@demo.local`, `aditi@demo.local`, `mohit@demo.local` / `password123`

### 3. Env

Copy:

- `apps/admin/.env.local.example` → `apps/admin/.env.local`
- `apps/student/.env.example` → `apps/student/.env`

Set at least:

```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/pratham
JWT_SECRET=change-me
CRON_SECRET=pratham-bootstrap
BOOTSTRAP_SECRET=pratham-bootstrap
```

### 4. Run apps

```bash
npm install
npm run admin      # http://localhost:3000
npm run student    # Expo (use EXPO_PUBLIC_API_URL=http://10.0.2.2:3000/api on Android emulator)
```

### 5. Fixed-plan cron

Call before each cutoff (05:45 / 10:45 / 16:45 IST):

```bash
curl -X POST http://localhost:3000/api/cron/generate-plans \
  -H "Authorization: Bearer pratham-bootstrap" \
  -H "Content-Type: application/json" \
  -d "{}"
```

### Bootstrap admin (dev only)

`/api/seed-admin` is blocked when `NODE_ENV=production` unless `ALLOW_BOOTSTRAP=true`.

```bash
curl -X POST http://localhost:3000/api/seed-admin \
  -H "Content-Type: application/json" \
  -d "{\"secret\":\"pratham-bootstrap\",\"email\":\"admin@pratham.local\",\"password\":\"admin123\",\"full_name\":\"Admin\"}"
```

## Verify locally

```bash
npm run admin          # http://localhost:3000
npm run test:e2e       # API + page smoke (52 checks)
npm run test:clicks    # Playwright mobile/desktop click-through
npm run admin:build    # production build (required for Vercel)
```

## Deploy admin to Vercel

The admin app (`apps/admin`) is the Vercel deployable surface — Next.js UI + `/api/*`.

1. Create a hosted Postgres DB (Neon recommended) and run migrations:
   ```bash
   $env:DATABASE_URL="postgres://...neon.tech/pratham?sslmode=require"
   npm run db:migrate
   npm run db:seed   # optional demo data
   ```
2. In Vercel → New Project → import this repo.
3. **Root Directory:** leave **repo root** (uses root `vercel.json`)  
   **or** set Root Directory to `apps/admin` (uses `apps/admin/vercel.json`).
4. Set environment variables:
   | Name | Notes |
   |------|--------|
   | `DATABASE_URL` | Hosted Postgres connection string |
   | `DATABASE_SSL` | `true` (auto on Vercel / Neon) |
   | `JWT_SECRET` | Long random secret |
   | `CRON_SECRET` | Required — Vercel Cron sends `Authorization: Bearer $CRON_SECRET` |
   | `BOOTSTRAP_SECRET` | Seed/bootstrap secret |
   | `ALLOW_BOOTSTRAP` | `false` in production |
   | `NEXT_PUBLIC_APP_URL` | Your Vercel URL, e.g. `https://pratham.vercel.app` |
5. Deploy. Point the student app’s `EXPO_PUBLIC_API_URL` at `https://your-app.vercel.app/api`.
6. Cron is declared in `vercel.json` (00:15 / 05:15 / 11:15 UTC ≈ 15 min before IST cutoffs). Requires a Vercel Pro plan for crons, or call the endpoint externally.

```bash
npm run admin:build
```

Student app ships via Expo / EAS, not Vercel.

## Daily menu & reminders

- **Admin → Menu:** add dishes for **tomorrow** (or today), then **Publish & notify students**.
- Day-specific items override catalog defaults for that meal; other meals still use catalog.
- **Automated pushes** (`/api/cron/reminders`, every 15 min on Vercel):
  - Closing soon — N minutes before each cutoff (Settings → closing reminder lead, default 30)
  - Opening — breakfast evening-before; lunch after breakfast cutoff; dinner after lunch cutoff
  - Tomorrow’s menu — 20:00 IST reminder if that day was published
- Fixed-plan generation remains on `/api/cron/generate-plans`.

## Mobile

- **Admin:** responsive drawer + bottom nav, cardified tables under 640px, 16px inputs, safe-area padding.
- **Student:** SafeAreaProvider, compact tab bar with home-indicator inset, 48px touch targets, profile links to invite/alerts.

## Figma

Figma MCP access is granted for this account. Make files are accessible. Payment/UPI screens from prototypes are intentionally omitted (COD-only).
# Pratham
