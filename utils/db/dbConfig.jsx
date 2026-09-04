import "server-only";
import dotenv from "dotenv";
dotenv.config();

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

// The application's primary runtime database connection.
// After the Phase 2 switch, DATABASE_URL points to the Supabase PostgreSQL
// database. Connection uses the postgres.js driver + Drizzle ORM.
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error("No database connection string provided. Check your .env file.");
}

const sql = postgres(connectionString, { max: 1, onnotice: () => {} });

export const db = drizzle(sql, { schema });
