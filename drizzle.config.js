export default {
    dialect: 'postgresql',  // Correct key (lowercase)
    schema: './utils/database/schema.ts',
    out: './drizzle',
    dbCredentials: {  // Correct key (plural)
        url: process.env.DATABASE_URL,  // Remove redundant key
    }
};
