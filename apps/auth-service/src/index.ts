import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { createServer } from './server.js';
import db, { waitForDb } from './db.js';

dotenv.config();

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';

const start = async () => {
    try {
        const server = await createServer();

        await server.listen({ port: PORT, host: HOST });
        console.log(`Auth Service listening at http://${HOST}:${PORT}`);

        await waitForDb();

        const adminSeedPassword = process.env.ADMIN_SEED_PASSWORD;
        if (adminSeedPassword) {
            try {
                const adminExists = await db('users').where({ username: 'admin' }).first();
                if (!adminExists) {
                    const password_hash = await bcrypt.hash(adminSeedPassword, 10);
                    await db('users').insert({
                        username: 'admin',
                        password_hash,
                        role: 'administrator'
                    });
                    console.log('Seed: Created default admin user');
                }
            } catch (seedErr: any) {
                console.warn(`Seed: Admin user creation skipped (${seedErr.code || seedErr.message})`);
            }
        }
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

const shutdown = async () => {
    console.log('Shutting down gracefully...');
    try {
        await db.destroy();
        console.log('Database pool closed');
    } catch (err) {
        console.warn('Database pool close error:', err);
    }
    process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start();
