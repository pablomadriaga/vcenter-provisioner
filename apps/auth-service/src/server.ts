import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import crypto from 'crypto';
import db from './db.js';

const CORS_ORIGINS = process.env.CORS_ALLOWED_ORIGINS || '*';
const JWT_SECRET = process.env.JWT_SECRET || 'antigravity-tier0-secret';
const SESSION_DURATION_HOURS = 8;

interface Session {
    id: string;
    user_id: number;
    created_at: Date;
    expires_at: Date;
    ip_address: string | null;
    user_agent: string | null;
    is_active: boolean;
}

interface User {
    id: number;
    username: string;
    role: string;
}

// Validation Schemas
const AuthSchema = z.object({
    username: z.string().min(3),
    password: z.string().min(6),
});

function getClientIP(request: any): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }
    return request.ip || 'unknown';
}

async function createSession(userId: number, ipAddress: string | null, userAgent: string | null): Promise<Session> {
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000);

    const [session] = await db('sessions')
        .insert({
            id: sessionId,
            user_id: userId,
            expires_at: expiresAt,
            ip_address: ipAddress,
            user_agent: userAgent,
            is_active: true
        })
        .returning('*');

    return session;
}

async function validateSession(sessionId: string): Promise<{ user: User; session: Session } | null> {
    const session = await db('sessions')
        .where({ id: sessionId, is_active: true })
        .where('expires_at', '>', new Date())
        .first();

    if (!session) {
        return null;
    }

    const user = await db('users')
        .where({ id: session.user_id })
        .first(['id', 'username', 'role']);

    if (!user) {
        return null;
    }

    return { user, session };
}

async function invalidateSession(sessionId: string): Promise<void> {
    await db('sessions')
        .where({ id: sessionId })
        .update({ is_active: false });
}

async function invalidateAllUserSessions(userId: number): Promise<void> {
    await db('sessions')
        .where({ user_id: userId })
        .update({ is_active: false });
}

export async function createServer(): Promise<FastifyInstance> {
    const server: FastifyInstance = Fastify({
        logger: process.env.NODE_ENV !== 'test'
    });

    await server.register(cors, {
        origin: true,
        credentials: true
    });

    await server.register(cookie);

    server.get('/health', async () => {
        return { status: 'ok' };
    });

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
            if (err.code === '23505' || err.code === 'SQLITE_CONSTRAINT' || err.code === 'SQLITE_CONSTRAINT_UNIQUEKEY') {
                return reply.status(409).send({ error: 'Username already exists' });
            }
            server.log.error(err);
            return reply.status(500).send({ error: 'Internal server error' });
        }
    });

    // Login - Creates session with httpOnly cookie
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

        const ipAddress = getClientIP(request);
        const userAgent = request.headers['user-agent'] || null;

        const session = await createSession(user.id, ipAddress, userAgent);

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: `${SESSION_DURATION_HOURS}h` }
        );

        const cookieOptions = {
            httpOnly: true,
            secure: process.env.COOKIE_SECURE === 'true',
            sameSite: 'lax' as const,
            path: '/',
            maxAge: SESSION_DURATION_HOURS * 60 * 60 * 1000
        };

        reply.setCookie('session_id', session.id, cookieOptions);

        return {
            token,
            session_id: session.id,
            user: { id: user.id, username: user.username, role: user.role }
        };
    });

    // Logout - Invalidates session
    server.post('/logout', async (request, reply) => {
        const sessionId = request.cookies.session_id;

        if (sessionId) {
            await invalidateSession(sessionId);
        }

        reply.clearCookie('session_id', { path: '/' });

        return { message: 'Logged out successfully' };
    });

    // Logout All Sessions (for a user)
    server.post('/logout-all', async (request, reply) => {
        let token: string | undefined;
        const authHeader = request.headers.authorization;
        if (authHeader) {
            token = authHeader.replace('Bearer ', '');
        }

        if (token) {
            try {
                const decoded = jwt.verify(token, JWT_SECRET) as { id: number };
                await invalidateAllUserSessions(decoded.id);
            } catch (err) {
                return reply.status(401).send({ error: 'Invalid token' });
            }
        }

        reply.clearCookie('session_id', { path: '/' });

        return { message: 'All sessions logged out' };
    });

    // Get Current User (from session cookie or token)
    server.get('/me', async (request, reply) => {
        const sessionId = request.cookies.session_id;

        if (sessionId) {
            const result = await validateSession(sessionId);
            if (result) {
                return { user: result.user, session_id: sessionId };
            }
        }

        const authHeader = request.headers.authorization;
        if (authHeader) {
            const token = authHeader.replace('Bearer ', '');
            try {
                const decoded = jwt.verify(token, JWT_SECRET) as { id: number; username: string; role: string };
                return { user: { id: decoded.id, username: decoded.username, role: decoded.role } };
            } catch (err) {
                return reply.status(401).send({ error: 'Invalid or expired token' });
            }
        }

        return reply.status(401).send({ error: 'Not authenticated' });
    });

    // Verify Token - accepts both session cookie and Bearer token
    server.route({
        method: ['GET', 'POST'],
        url: '/verify',
        handler: async (request, reply) => {
            let sessionId = request.cookies.session_id;

            if (sessionId) {
                const result = await validateSession(sessionId);
                if (result) {
                    return {
                        valid: true,
                        payload: { id: result.user.id, username: result.user.username, role: result.user.role },
                        session_id: sessionId
                    };
                }
            }

            let token: string | undefined;
            const authHeader = request.headers.authorization;
            if (authHeader) {
                token = authHeader.replace('Bearer ', '');
            } else if (request.body && (request.body as any).token) {
                token = (request.body as any).token;
            }

            if (!token) {
                return reply.status(401).send({ error: 'No token or session provided' });
            }

            try {
                const decoded = jwt.verify(token, JWT_SECRET);
                return { valid: true, payload: decoded };
            } catch (err) {
                return reply.status(401).send({ error: 'Invalid or expired token' });
            }
        }
    });

    // Refresh Session (extend expiration)
    server.post('/refresh', async (request, reply) => {
        const sessionId = request.cookies.session_id;

        if (!sessionId) {
            return reply.status(401).send({ error: 'No session' });
        }

        const session = await db('sessions')
            .where({ id: sessionId, is_active: true })
            .first();

        if (!session || new Date(session.expires_at) < new Date()) {
            return reply.status(401).send({ error: 'Session expired or invalid' });
        }

        const newExpiresAt = new Date(Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000);

        await db('sessions')
            .where({ id: sessionId })
            .update({ expires_at: newExpiresAt });

        const cookieOptions = {
            httpOnly: true,
            secure: process.env.COOKIE_SECURE === 'true',
            sameSite: 'lax' as const,
            path: '/',
            maxAge: SESSION_DURATION_HOURS * 60 * 60 * 1000
        };

        reply.setCookie('session_id', sessionId, cookieOptions);

        return { message: 'Session refreshed', session_id: sessionId };
    });

    return server;
}
