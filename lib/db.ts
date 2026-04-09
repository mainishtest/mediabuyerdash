// Prisma client singleton.
// In development, Next.js hot-reload can create multiple instances.
// This pattern ensures a single shared client across the app.

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function normalizeSSLMode(url: string | undefined): string | undefined {
  if (!url) return url;
  try {
    const u = new URL(url);
    const mode = u.searchParams.get("sslmode");
    if (mode && ["prefer", "require", "verify-ca"].includes(mode)) {
      u.searchParams.set("sslmode", "verify-full");
    }
    return u.toString();
  } catch {
    return url;
  }
}

function createPrismaClient() {
  const pool = new pg.Pool({
    connectionString: normalizeSSLMode(process.env.DATABASE_URL),
  });
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
