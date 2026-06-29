import { FastifyRequest, FastifyReply } from 'fastify';

export interface AuthenticatedRequest extends FastifyRequest {
    user: {
        id: number;
        username: string;
        role: 'admin' | 'operator';
    };
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        reply.status(401).send({ error: 'Missing or invalid Authorization header' });
        return;
    }

    const token = authHeader.replace('Bearer ', '');

    try {
        const response = await fetch('http://auth-service:3001/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
        });

        if (!response.ok) {
            reply.status(401).send({ error: 'Invalid or expired token' });
            return;
        }

        const data = await response.json();
        (request as AuthenticatedRequest).user = data.payload;
    } catch (error) {
        console.error('Auth verification failed:', error);
        reply.status(500).send({ error: 'Auth service unavailable' });
    }
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await requireAuth(request, reply);

    const authenticatedReq = request as AuthenticatedRequest;
    if (!authenticatedReq.user || authenticatedReq.user.role !== 'admin') {
        reply.status(403).send({ error: 'Admin access required' });
    }
}
