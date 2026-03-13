# AGENTS.md

## Cursor Cloud specific instructions

This is a **Next.js 14 + Prisma + SQLite** media buying dashboard. It is a single self-contained application with no external services or Docker dependencies.

### Quick reference

| Action | Command |
|--------|---------|
| Install deps | `npm install` (runs `prisma generate` via postinstall) |
| Create/sync DB schema | `npm run db:push` |
| Seed sample data | `npm run db:seed` |
| Dev server | `npm run dev` (port 3000) |
| Production build | `npm run build` |
| Type check | `npx tsc --noEmit` |
| DB GUI | `npm run db:studio` |

### Caveats

- **No ESLint config** is present; the only lint/type check available is `npx tsc --noEmit` and `next build` (which runs type checking).
- **No test framework** is configured (no Jest, Vitest, Playwright, etc.). There are no automated tests to run.
- The database is **SQLite** stored at `prisma/dev.db`. After `npm install`, you must run `npm run db:push` and `npm run db:seed` if the DB file doesn't already exist.
- Environment file: copy `.env.example` to `.env` if `.env` is missing. The only variable is `DATABASE_URL="file:./dev.db"`.
- There is no `package-lock.json` in the repo, so `npm install` will resolve versions fresh each time.
