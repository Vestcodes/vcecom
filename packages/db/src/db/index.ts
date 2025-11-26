import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../schema/index";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });

export type Database = typeof db;

// Re-export commonly used drizzle functions
export { and, asc, desc, eq, not, or, sql } from "drizzle-orm";
