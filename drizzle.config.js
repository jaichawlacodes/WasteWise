export default {
    dialect: 'postgresql',          // Correct key (lowercase)
    // NOTE: no explicit 'driver' here — this drizzle-kit version auto-detects the
    // postgres driver from installed packages (postgres.js 'postgres' is installed).
    schema: './utils/db/schema.ts', // Actual schema location (was incorrectly './utils/database/schema.ts')
    out: './drizzle',
    dbCredentials: {
        // During preparation we push to the new target DB (Supabase).
        // Falls back to the existing Neon DATABASE_URL if TARGET_DATABASE_URL is unset.
        url: process.env.TARGET_DATABASE_URL ?? process.env.DATABASE_URL,
    }
};
