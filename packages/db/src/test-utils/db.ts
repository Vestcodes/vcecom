import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../schema/index";

/**
 * Creates a test database connection
 * Uses a separate test database to avoid conflicts with development data
 */
export function createTestDb(connectionString: string) {
  const pool = new Pool({
    connectionString,
    max: 1, // Use single connection for tests to avoid connection pool issues
  });

  const db = drizzle(pool, { schema });

  return { db, pool };
}

/**
 * Cleans up test database connection
 */
export async function closeTestDb(pool: Pool) {
  await pool.end();
}

/**
 * Truncates all tables in the test database
 * Useful for cleaning up between tests
 */
export async function truncateTables(
  _db: ReturnType<typeof createTestDb>["db"],
) {
  // This will be implemented after we have all tables
  // For now, it's a placeholder
  const _tables = Object.values(schema);
  // Note: Drizzle doesn't have a built-in truncate, so we'll use raw SQL
  // This will be implemented per table as we add them
}
