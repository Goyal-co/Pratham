# Ahariva

Breakfast, lunch & dinner ordering — admin desk + student web PWA (Next.js) with plain PostgreSQL. One Vercel deploy serves both.

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

Admin login comes from env (`ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` in `apps/admin/.env.local`).

```bash
npm run db:seed:admin
```

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
  -d "{\"secret\":\"pratham-bootstrap\",\"email\":\"titanscortex@gmail.com\",\"password\":\"Titans@$#123\",\"full_name\":\"Titans Cortex\"}"
```

## Verify locally

```bash
npm run admin          # http://localhost:3000
npm run test:all       # smoke + features + PWA
npm run test:clicks    # Playwright mobile/desktop click-through
npm run admin:build    # production build (required for Vercel)
```

## Deploy with Docker (AWS)

One image runs admin desk + student PWA (`/app`) + `/api/*`.

| File | Use |
|------|-----|
| `Dockerfile` | Production Next.js standalone image |
| `docker-compose.yml` | Local: Postgres **+** app on `:3000` |
| `docker-compose.aws.yml` | AWS: app only (point `DATABASE_URL` at **RDS**) |
| `.env.docker.example` | Env template for compose / ECS task def |

```bash
# Local full stack — reuse apps/admin/.env.local (no need to copy secrets into compose YAML)
ENV_FILE=apps/admin/.env.local npm run docker:up
# Compose overrides DATABASE_URL to postgres://...@postgres:5432 for the container network

# AWS (EC2 / ECS / App Runner)
# 1) Create RDS Postgres, run migrations once from CI or a one-shot task:
#    DATABASE_URL=postgres://...rds.../pratham?sslmode=require npm run db:migrate
# 2) Build with your public URLs (NEXT_PUBLIC_* are build-time):
docker build -t ahariva-admin \
  --build-arg NEXT_PUBLIC_APP_URL=https://admin.yourdomain.com \
  --build-arg NEXT_PUBLIC_STUDENT_URL=https://app.yourdomain.com \
  --build-arg NEXT_PUBLIC_VAPID_PUBLIC_KEY=... .
# 3) Push to ECR, run with docker-compose.aws.yml or an ECS task.
#    Health check: GET /api/health
#    ALB target: port 3000
```

On AWS prefer **RDS** (not the compose Postgres service), **S3** for media, and store secrets in **Secrets Manager** / SSM.

## Deploy to Vercel

One deploy: admin desk + student PWA (`/app`) + `/api/*`.

1. Create hosted Postgres and run migrations:
   ```bash
   $env:DATABASE_URL="postgres://...neon.tech/pratham?sslmode=require"
   npm run db:migrate
   npm run db:seed:admin
   ```
2. Vercel → New Project → import this repo.
3. **Root Directory** — pick one:
   - **Recommended:** leave **empty** (repo root). Root [`vercel.json`](vercel.json) runs `npm run vercel-build`, which builds the admin app and copies `apps/admin/.next` → `.next` for Vercel.
   - **Or** set Root Directory to **`apps/admin`** (uses [`apps/admin/vercel.json`](apps/admin/vercel.json)).
   - In Vercel → Settings → General, clear **Output Directory** if you set it (leave blank — do not set `.next` or `apps/admin/.next` manually).
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
