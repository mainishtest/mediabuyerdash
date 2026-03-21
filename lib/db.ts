// Prisma client singleton.
// In development, Next.js hot-reload can create multiple instances.
// This pattern ensures a single shared client across the app.

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  // Ensure sslmode=verify-full to silence the pg deprecation warning about
  // weaker SSL aliases ("require", "prefer", "verify-ca").
  const connStr = process.env.DATABASE_URL ?? "";
  const url = (() => {
    try {
      const u = new URL(connStr);
      const mode = u.searchParams.get("sslmode");
      if (mode && mode !== "verify-full") {
        u.searchParams.set("sslmode", "verify-full");
      }
      return u.toString();
    } catch {
      return connStr; // not a valid URL — pass through as-is
    }
  })();
  const pool = new pg.Pool({ connectionString: url });
  // eslint-disable-next-line -- @types/pg version mismatch between pg and @prisma/adapter-pg
  const adapter = new PrismaPg(pool as any);
  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
