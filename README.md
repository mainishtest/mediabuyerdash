# Media Buying Dashboard

A Next.js dashboard for media buying agencies to manage Facebook ad accounts, analyze campaigns, and reconcile Meta-reported data with CRM source-of-truth metrics.

## Prerequisites

- Node.js 18+
- npm

## Quick start

### 1. Install dependencies

```bash
npm install
```

### 2. Set up the database

Copy the example environment file and configure the database URL:

```bash
cp .env.example .env
```

The default `DATABASE_URL` uses SQLite at `file:./dev.db`.

### 3. Run Prisma migration

Create and apply the database schema:

```bash
npm run db:push
```

Or, to use Prisma Migrate with versioned migrations:

```bash
npm run db:migrate
```

### 4. Seed the database

Insert sample data (client accounts, campaigns, ad sets, ads, UTM rows, CRM rows, reconciliation results):

```bash
npm run db:seed
```

### 5. Start the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Database setup (reference)

| Command | Description |
|---------|-------------|
| `npm run db:push` | Push schema to database (no migration files) |
| `npm run db:migrate` | Create and apply migrations |
| `npm run db:seed` | Run the seed script |
| `npm run db:studio` | Open Prisma Studio (DB GUI) |

## Project structure

- `prisma/schema.prisma` — Database schema (Prisma)
- `prisma/seed.js` — Sample data seed
- `lib/db.ts` — Prisma client singleton
