import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../schema/index";

function createPool(): Pool {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL environment variable is not set. Please set it to a valid PostgreSQL connection string.",
    );
  }
  return new Pool({
    connectionString: databaseUrl,
  });
}

// Create pool lazily - only when first accessed
// This allows environment variables to be loaded before the pool is created
let poolInstance: Pool | null = null;

function getPool(): Pool {
  if (!poolInstance) {
    poolInstance = createPool();
  }
  return poolInstance;
}

// Use a getter to ensure pool is created lazily
const pool = new Proxy({} as Pool, {
  get(_target, prop) {
    return getPool()[prop as keyof Pool];
  },
});

export const db = drizzle(pool, { schema });

export type Database = typeof db;

// Re-export commonly used drizzle functions
export {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lte,
  not,
  notInArray,
  or,
  sql,
} from "drizzle-orm";
