import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "@/app/config/env";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const connectionString = env.DATABASE_URL;

const pool = new Pool({
  connectionString,
  max: 1, 
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  // Allow connections to be reused
  allowExitOnIdle: true,
});

const adapter = new PrismaPg(pool);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;