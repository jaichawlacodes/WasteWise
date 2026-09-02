import "server-only";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

/**
 * Separate Drizzle connection for the TARGET database (Supabase).
 *
 * This is intentionally NOT wired into the application yet — the production
 * connection (utils/db/dbConfig.jsx) still uses Neon during Phase 1.
 * This module exists so that:
 *   1. We can recreate/verify the schema on the new database in parallel.
 *   2. Phase 2 (switch) can point the app at it with a one-line change.
 *
 * Credentials are read from TARGET_DATABASE_URL and never logged.
 */
const connectionString = process.env.TARGET_DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "No TARGET_DATABASE_URL provided. Add it to your local .env to use the target connection.",
  );
}

// postgres.js manages a connection pool internally.
const sql = postgres(connectionString, { max: 1, onnotice: () => {} });

export const targetDb = drizzle(sql, { schema });
