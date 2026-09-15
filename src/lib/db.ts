import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/generated/prisma/client";

// Cached on globalThis so Next.js's dev-mode hot reload reuses the same
// client/connection pool instead of opening a new one on every file edit.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Prisma 7's generated client has no built-in engine binary — it requires an
// explicit driver adapter to actually connect (MySQL uses the MariaDB-driver adapter).
const adapter = new PrismaMariaDb(process.env.DATABASE_URL!);

export const db = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
