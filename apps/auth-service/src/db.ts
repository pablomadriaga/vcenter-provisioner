import knex from 'knex';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const isTest = process.env.NODE_ENV === 'test';
const isIntegration = process.env.NODE_ENV === 'integration';

const db = knex({
    client: isTest ? 'sqlite3' : 'pg',
    connection: isTest ? ':memory:' : (process.env.DB_URL || 'postgresql://antigravity:password123@db:5432/vcenter_provisioner'),
    pool: isTest ? { min: 1, max: 1 } : { min: 2, max: 10 },
    useNullAsDefault: isTest,
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
    if (isTest) return;

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

runMigrations()
    .then(() => runSeeds())
    .catch((err) => {
        console.error('Migration or seed error:', err);
    });

// Initialize tables for SQLite in test mode
if (isTest) {
    db.schema
        .createTableIfNotExists('users', (table) => {
            table.increments('id').primary();
            table.string('username', 50).notNullable().unique();
            table.text('password_hash').notNullable();
            table.string('role', 50).notNullable().defaultTo('operator');
            table.timestamps(true, true);
        })
        .then(() => console.log('SQLite in-memory DB initialized for tests'))
        .catch((err) => console.error('Error initializing test DB:', err));
}

export default db;

