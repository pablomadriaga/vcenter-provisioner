import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import db from './db.js';

const CORS_ORIGINS = process.env.CORS_ALLOWED_ORIGINS || '*';
const JWT_SECRET = process.env.JWT_SECRET || 'antigravity-tier0-secret';

// Validation Schemas
const AuthSchema = z.object({
    username: z.string().min(3),
    password: z.string().min(6),
});

export async function createServer(): Promise<FastifyInstance> {
    const server: FastifyInstance = Fastify({
        logger: process.env.NODE_ENV !== 'test'
    });

    // Register CORS
    await server.register(cors, {
        origin: CORS_ORIGINS === '*' ? '*' : CORS_ORIGINS.split(','),
    });

    // Health Check
    server.get('/health', async () => {
        return { status: 'ok' };
    });

    // Root endpoint
    server.get('/', async () => {
        return { message: 'vCenter Provisioner: Identity & Auth Service active.' };
    });

    // Register User
    server.post('/register', async (request, reply) => {
        const result = AuthSchema.safeParse(request.body);
        if (!result.success) {
            return reply.status(400).send({ error: 'Invalid input', details: result.error.format() });
        }

        const { username, password } = result.data;
        const password_hash = await bcrypt.hash(password, 10);

        try {
            const [user] = await db('users').insert({
                username,
                password_hash,
                role: 'operator'
            }).returning(['id', 'username', 'role']);

            return { message: 'User registered', user };
        } catch (err: any) {
            // Handle unique constraint violations for both PostgreSQL and SQLite
            if (err.code === '23505' || err.code === 'SQLITE_CONSTRAINT' || err.code === 'SQLITE_CONSTRAINT_UNIQUEKEY') {
                return reply.status(409).send({ error: 'Username already exists' });
            }
            server.log.error(err);
            return reply.status(500).send({ error: 'Internal server error' });
        }
    });

    // Login
    server.post('/login', async (request, reply) => {
        const result = AuthSchema.safeParse(request.body);
        if (!result.success) {
            return reply.status(400).send({ error: 'Invalid input' });
        }

        const { username, password } = result.data;

        const user = await db('users').where({ username }).first();
        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            return reply.status(401).send({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '8h' }
        );

        return { token, user: { id: user.id, username: user.username, role: user.role } };
    });

    // Verify Token (Used by Gateway) - accepts both GET/POST for flexibility
    server.route({
        method: ['GET', 'POST'],
        url: '/verify',
        handler: async (request, reply) => {
            let token: string | undefined;

            // Try Authorization header first (Bearer token)
            const authHeader = request.headers.authorization;
            if (authHeader) {
                token = authHeader.replace('Bearer ', '');
            } else if (request.body && (request.body as any).token) {
                // Fallback to token in body (for backward compatibility)
                token = (request.body as any).token;
            }

            if (!token) return reply.status(401).send({ error: 'No token provided' });

            try {
                const decoded = jwt.verify(token, JWT_SECRET);
                return { valid: true, payload: decoded };
            } catch (err) {
                return reply.status(401).send({ error: 'Invalid or expired token' });
            }
        }
    });

    return server;
}
