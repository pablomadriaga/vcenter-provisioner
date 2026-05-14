import { FastifyRequest, FastifyReply } from 'fastify';

export interface AuthenticatedRequest extends FastifyRequest {
    user: {
        id: number;
        username: string;
        role: string;
    };
}

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://auth-service:3001';

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        reply.status(401).send({ error: 'Missing or invalid Authorization header' });
        return;
    }

    const token = authHeader.replace('Bearer ', '');

    // 1) Try INTERNAL_API_TOKEN first (service-to-service)
    const internalToken = process.env.INTERNAL_API_TOKEN;
    if (internalToken && token === internalToken) {
        (request as AuthenticatedRequest).user = {
            id: 0,
            username: 'internal-service',
            role: 'admin',
        };
        return;
    }

    // 2) Fallback to JWT verification via auth-service (user-facing)
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);

        const response = await fetch(`${AUTH_SERVICE_URL}/verify`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` },
            signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            reply.status(401).send({ error: 'Invalid or expired token' });
            return;
        }

        const data = await response.json() as any;
        (request as AuthenticatedRequest).user = data.payload;
    } catch (error: any) {
        if (error.name === 'AbortError') {
            reply.status(504).send({ error: 'Auth service timeout' });
            return;
        }
        console.error('Auth verification failed:', error);
        reply.status(500).send({ error: 'Auth service unavailable' });
    }
}

export async function requireInternalToken(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        reply.status(401).send({ error: 'Missing Authorization header' });
        return;
    }

    const token = authHeader.replace('Bearer ', '');
    const internalToken = process.env.INTERNAL_API_TOKEN;

    if (!internalToken || token !== internalToken) {
        reply.status(403).send({ error: 'Forbidden', message: 'Only internal services can access this endpoint' });
        return;
    }

    (request as AuthenticatedRequest).user = {
        id: 0,
        username: 'internal-service',
        role: 'admin',
    };
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await requireAuth(request, reply);
    if (reply.sent) return;

    const authenticatedReq = request as AuthenticatedRequest;
    if (!authenticatedReq.user || authenticatedReq.user.role !== 'admin') {
        reply.status(403).send({ error: 'Admin access required' });
        return;
    }
}
