# Authentication & Client Management

## Environment Variables

Add these to your `.env.local` (never commit this file):

```bash
# Database
DATABASE_URL="postgresql://user:password@host:5432/dbname?sslmode=require"

# NextAuth
NEXTAUTH_SECRET="<run: openssl rand -base64 32>"
NEXTAUTH_URL="https://your-app.vercel.app"   # use http://localhost:3000 locally
```

In Vercel, add all three under **Settings → Environment Variables**.

---

## How Login Works

The app uses **NextAuth v4** with the **Credentials provider** (email + password, JWT session strategy).

1. User visits any protected route → redirected to `/login`.
2. User enters email + password.
3. `authorize()` in `lib/auth.ts`:
   - Looks up the `User` record by email.
   - If no user exists, **creates a new user** (hashed password via bcryptjs, salt 12).
   - If user exists, verifies password hash.
   - Returns `{ id, email, name, workspaceId, workspaceName }`.
4. Session JWT stores `id`, `workspaceId`, `workspaceName`.
5. `session` callback exposes those fields on `session.user`.

The login page (`/login`) renders as a `fixed inset-0 z-50` overlay — it visually covers the AppShell sidebar without requiring a separate route group layout.

---

## Workspace Creation Flow

On first sign-in (no existing user):
1. A `User` record is created with hashed password.
2. A `Workspace` is created named `"<email>'s Workspace"`.
3. A `WorkspaceMembership` is created linking the user to the workspace with `role: "owner"`.

Subsequent sign-ins re-use the existing workspace (found via `WorkspaceMembership`).

**Current limitation:** One workspace per user. Multi-workspace support is not yet implemented.

---

## Client Creation Flow

From the `/clients` page:
1. Click **+ Add Client** → `CreateClientModal` opens.
2. Fill in: Client Name (required), Brand Name (optional), Status, Notes (optional).
3. On submit, the `createClientAction` server action:
   - Verifies the session has a `workspaceId`.
   - Creates a `ClientAccount` record scoped to that workspace.
   - Calls `revalidatePath("/clients")` to refresh the server-rendered list.

---

## Route Protection

`middleware.ts` uses NextAuth's `withAuth` to protect all routes except:
- `/login`
- `/api/auth/*`
- Next.js static assets

Any unauthenticated request to a protected route is redirected to `/login`.

---

## Schema Migration

After pulling this branch, run against your Supabase database:

```bash
npx prisma db push
```

This syncs the schema (User, Workspace, WorkspaceMembership, updated ClientAccount fields) without generating a migration file. Use `prisma migrate dev` if you need tracked migrations.

---

## Current Limitations

- No password reset flow.
- No email verification.
- One workspace per user (no workspace switching).
- Meta and Shopify connections are placeholders — not yet functional.
- Client detail page still shows sample campaign data (not DB-backed campaigns).
