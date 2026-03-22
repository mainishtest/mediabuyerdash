// Prisma client singleton.
// In development, Next.js hot-reload can create multiple instances.
// This pattern ensures a single shared client across the app.

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  // Append sslmode=verify-full if not already specified to silence the
  // pg v9 deprecation warning about SSL mode semantics changing.
  const url = connectionString && !connectionString.includes("sslmode=")
    ? `${connectionString}${connectionString.includes("?") ? "&" : "?"}sslmode=verify-full`
    : connectionString;
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
