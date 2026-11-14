-- Prefer: npm run db:seed
-- That script creates demo admin/students with known bcrypt passwords.
-- This file is intentionally a pointer so SQL-only workflows know where seeding lives.
select 'Run: npm run db:seed' as notice;
