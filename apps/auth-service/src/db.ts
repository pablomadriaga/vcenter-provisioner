import knex from 'knex';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

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
    pool: { min: 2, max: 10 },
    migrations: {
        directory: './migrations',
    },
    seeds: {
        directory: './seeds',
    },
});

async function runMigrations() {
    const migrationsDir = './migrations';
    if (!fs.existsSync(migrationsDir)) {
        console.log('No migrations directory found, skipping migrations');
        return;
    }

    try {
        await db.migrate.latest();
        console.log('Migrations completed');
    } catch (err) {
        console.error('Migration error:', err);
        throw err;
    }
}

async function runSeeds() {
    try {
        const seedsDir = './seeds';
        if (fs.existsSync(seedsDir)) {
            const files = fs.readdirSync(seedsDir).filter(f => f.endsWith('.sql')).sort();
            for (const file of files) {
                const sql = fs.readFileSync(path.join(seedsDir, file), 'utf8');
                const statements = sql.split(';').filter(s => s.trim());
                for (const stmt of statements) {
                    if (stmt.trim()) {
                        await db.raw(stmt);
                    }
                }
                console.log(`Executed seed: ${file}`);
            }
        }
    } catch (err) {
        console.error('Error running seeds:', err);
    }
}

// Run migrations and seeds for all environments
runMigrations()
    .then(() => runSeeds())
    .catch((err) => {
        console.error('Migration or seed error:', err);
    });

export default db;

