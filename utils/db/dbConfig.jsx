import dotenv from "dotenv";
dotenv.config();

import {neon} from "@neondatabase/serverless"
import {drizzle} from "drizzle-orm/neon-http"
import * as schema from "./schema"

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error("No database connection string provided. Check your .env file.");
}

const sql = neon(connectionString)

export const db = drizzle(sql,{schema})