# Pratham Tiffin

Monorepo for the **admin desk + student web PWA** (Next.js) with plain PostgreSQL. One Vercel deploy serves both.

## Stack

| Path | Role |
|------|------|
| `apps/admin` | Next.js admin UI, student PWA at `/app`, REST API (`/api/*`) |
| `apps/student` | Legacy Expo app (optional; production students use `/app`) |
| `packages/shared` | Cutoffs, money helpers, types |
| `packages/db` | `pg` pool helper |
| `db/migrations` | Plain SQL schema |

## Product rules

- COD only (no online payments)
- Per-student credit limit; block orders when outstanding would exceed it
- Admin clears outstanding after cash collection
- Fixed plans + cancel-before-cutoff; ad-hoc extras with qty 1–10
- Cutoffs default IST: Breakfast 06:00, Lunch 11:00, Dinner 17:00 (admin-configurable)
- Referral: invitee completes **X** delivered orders → inviter gets **Y** wallet credit
- Web push (VAPID) for student + admin PWAs; Expo push still supported for legacy clients
- Audit log for balance / credit / settings / order status

## Setup (Docker recommended)

### 1. Start Postgres

```bash
npm run db:up
```

Uses `docker-compose.yml` → `postgres:16` on **`localhost:5434`** (avoids clash with local Windows Postgres on 5432), db/user/pass `pratham` / `postgres` / `postgres`.

### 2. Migrate + seed admin

```bash
# PowerShell
$env:DATABASE_URL="postgres://postgres:postgres@localhost:5434/pratham"
npm run db:migrate
npm run db:seed:admin
```

Default admin login:

- **Admin:** `admin@gmail.com` / `Admin@1234`

Override with `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` if needed.

Students are **not** seeded — they self-serve signup at `/app/signup`.

Optional demo students:

```bash
npm run db:seed:demo
# rahul@demo.local, aditi@demo.local / password123
```

### 3. Env

Copy:

- `apps/admin/.env.local.example` → `apps/admin/.env.local`

Set at least:

```env
DATABASE_URL=postgres://postgres:postgres@localhost:5434/pratham
JWT_SECRET=change-me
CRON_SECRET=pratham-bootstrap
BOOTSTRAP_SECRET=pratham-bootstrap
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

For web push, add VAPID keys (`npx web-push generate-vapid-keys`).

### 4. Run

```bash
npm install
npm run admin      # http://localhost:3000
# Admin desk: /login · Student PWA: /app
```

### 5. Fixed-plan cron

Call before each cutoff (or rely on Vercel Cron in production):

```bash
curl -X POST http://localhost:3000/api/cron/generate-plans \
  -H "Authorization: Bearer pratham-bootstrap" \
  -H "Content-Type: application/json" \
  -d "{}"
```

### Bootstrap admin (dev only)

`/api/seed-admin` is blocked when `NODE_ENV=production` unless `ALLOW_BOOTSTRAP=true`. It only **creates** a missing admin — it will not promote an existing user.

```bash
curl -X POST http://localhost:3000/api/seed-admin \
  -H "Content-Type: application/json" \
  -d "{\"secret\":\"pratham-bootstrap\",\"email\":\"admin@gmail.com\",\"password\":\"Admin@1234\",\"full_name\":\"Admin\"}"
```

## Verify locally

```bash
npm run admin          # http://localhost:3000
npm run test:all       # smoke + features + PWA
npm run test:clicks    # Playwright mobile/desktop click-through
npm run admin:build    # production build (required for Vercel)
```

## Deploy to Vercel

One deploy: admin desk + student PWA (`/app`) + `/api/*`.

1. Create hosted Postgres and run migrations:
   ```bash
   $env:DATABASE_URL="postgres://...neon.tech/pratham?sslmode=require"
   npm run db:migrate
   npm run db:seed:admin
   ```
2. Vercel → New Project → import this repo.
3. **Root Directory:** set to **`apps/admin`** (required — Next.js builds `.next` there).  
   Vercel → Project → Settings → General → Root Directory → `apps/admin`.  
   This uses [`apps/admin/vercel.json`](apps/admin/vercel.json) (installs from monorepo root, then builds the admin workspace).
4. Environment variables:

   | Name | Notes |
   |------|--------|
   | `DATABASE_URL` | Hosted Postgres connection string |
   | `DATABASE_SSL` | `true` (auto on Vercel / Neon) |
   | `JWT_SECRET` | Long random secret (required in production) |
   | `CRON_SECRET` | Required — Vercel Cron sends `Authorization: Bearer $CRON_SECRET` |
   | `BOOTSTRAP_SECRET` | Seed/bootstrap secret |
   | `ALLOW_BOOTSTRAP` | `false` in production |
   | `NEXT_PUBLIC_APP_URL` | Admin origin, e.g. `https://admin.yourdomain.com` (or the Vercel URL) |
   | `NEXT_PUBLIC_STUDENT_URL` | Optional student subdomain, e.g. `https://app.yourdomain.com` |
   | `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Web push public key |
   | `VAPID_PRIVATE_KEY` | Web push private key |
   | `VAPID_SUBJECT` | e.g. `mailto:admin@gmail.com` |

5. Deploy. Students open `/app` (Add to Home Screen). Admin opens `/login`.
6. **Optional subdomains** (same Vercel project, two domains → two installable PWAs):
   - Add `admin.yourdomain.com` and `app.yourdomain.com` in Vercel → Domains
   - Env: `NEXT_PUBLIC_APP_URL=https://admin.yourdomain.com`
   - Env: `NEXT_PUBLIC_STUDENT_URL=https://app.yourdomain.com`
   - Admin installs from the admin host; students from the app host (pretty URLs `/`, `/login`, `/signup`)
7. Cron is declared in `vercel.json` — **5 runs/day** so it fits **Vercel Hobby**:
   - `generate-plans` at 05:45 / 10:45 / 16:45 IST (also sweeps closing reminders)
   - `reminders` at 06:00 IST (lunch open) and 20:00 IST (tomorrow menu / breakfast)
   For denser reminder timing, call `/api/cron/reminders` from an external cron or upgrade to Pro.

## Daily menu & reminders

- **Admin → Menu:** add dishes for **tomorrow** (or today), then **Publish & notify students**.
- Students see **today** (orderable) and **tomorrow** (preview) on `/app`.
- **Automated pushes** (Hobby-friendly sparse crons; `generate-plans` also runs a reminder sweep):
  - Closing soon — around each pre-cutoff plan run (Settings → lead, default 30, min 10)
  - Opening — lunch at ~06:00 IST; dinner if a sweep lands in the post-lunch window
  - Tomorrow’s menu — 20:00 IST (preferred over breakfast-opening when that day was published)
- Fixed-plan generation: `/api/cron/generate-plans` before each meal cutoff.

## Mobile

- **Admin:** installable PWA, responsive drawer + bottom nav, safe-area padding.
- **Student:** installable PWA at `/app`, tab bar, web push opt-in, Install hint.

## Figma

Figma MCP access is granted for this account. Make files are accessible. Payment/UPI screens from prototypes are intentionally omitted (COD-only).
