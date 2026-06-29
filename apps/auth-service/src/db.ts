import knex from 'knex';
import dotenv from 'dotenv';

dotenv.config();

function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
        console.error(`FATAL: ${name} environment variable is required`);
        process.exit(1);
    }
    return value;
}

const DB_URL = requireEnv('DB_URL');

const db = knex({
    client: 'pg',
    connection: DB_URL,
    pool: {
        min: 2,
        max: 10,
    },
    acquireConnectionTimeout: 10000,
});

export async function waitForDb(maxRetries = 10, baseDelayMs = 500): Promise<void> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            await db.raw('SELECT 1');
            console.log('Database connection established');
            return;
        } catch (err: any) {
            const jitter = Math.random() * 200;
            const delay = Math.min(baseDelayMs * Math.pow(2, attempt) + jitter, 15000);
            console.warn(
                `DB connection attempt ${attempt + 1}/${maxRetries} failed` +
                ` (${err.code || err.message}), retrying in ${Math.round(delay)}ms...`
            );
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    throw new Error(`Failed to connect to database after ${maxRetries} attempts`);
}

export default db;

