import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { createServer } from './server.js';
import db from './db.js';

dotenv.config();

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';

const start = async () => {
    try {
        const server = await createServer();

        await server.listen({ port: PORT, host: HOST });
        console.log(`Auth Service listening at http://${HOST}:${PORT}`);

        // Seed: admin user only if ADMIN_SEED_PASSWORD env var is set
        const adminSeedPassword = process.env.ADMIN_SEED_PASSWORD;
        if (adminSeedPassword) {
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
        }
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

const shutdown = async () => {
    process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start();
