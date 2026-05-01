import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";
import { env } from "@/config/env";

const isRemote =
  !env.DATABASE_URL.includes("localhost") &&
  !env.DATABASE_URL.includes("127.0.0.1");

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: isRemote ? { rejectUnauthorized: false } : false,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

export { prisma };
