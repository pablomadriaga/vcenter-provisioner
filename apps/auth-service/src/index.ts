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

        // Seed: Ensure at least one admin exists
        const adminExists = await db('users').where({ username: 'admin' }).first();
        if (!adminExists) {
            const password_hash = await bcrypt.hash('password123', 10);
            await db('users').insert({
                username: 'admin',
                password_hash,
                role: 'administrator'
            });
            console.log('Seed: Created default admin user (admin/password123)');
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
