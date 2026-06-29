import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import proxy from '@fastify/http-proxy';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';
const CORS_ORIGINS = process.env.CORS_ALLOWED_ORIGINS || '*';

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://auth-service:3001';
const TYPING_SERVICE_URL = process.env.TYPING_SERVICE_URL || 'http://typing-service:8000';
const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL || 'http://vm-orchestrator:8080';
const VCENTER_CONFIG_URL = process.env.VCENTER_CONFIG_URL || 'http://vcenter-config:8082';
const STATS_SERVICE_URL = process.env.STATS_SERVICE_URL || 'http://stats-service:8001';

export const createServer = async (options: any = {}): Promise<FastifyInstance> => {
    const server: FastifyInstance = Fastify({
        logger: options.logger !== false ? true : false
    });

    server.register(cors, {
        origin: CORS_ORIGINS === '*' ? '*' : CORS_ORIGINS.split(','),
    });

    server.decorate('authenticate', async (request: any, reply: any) => {
        try {
            const authHeader = request.headers.authorization;
            if (!authHeader) throw new Error('No token');

            const response = await axios.get(`${AUTH_SERVICE_URL}/verify`, {
                headers: { Authorization: authHeader }
            });
            request.user = response.data.decoded;
        } catch (err) {
            reply.code(401).send({ error: 'Unauthorized', details: 'Invalid or missing token' });
        }
    });

    server.register(proxy, {
        upstream: AUTH_SERVICE_URL,
        prefix: '/auth',
        rewritePrefix: ''
    });

    server.get('/vm-classes', async () => {
        try {
            const response = await axios.get(`${TYPING_SERVICE_URL}/vm-classes`);
            return response.data;
        } catch (err) {
            throw new Error('Failed to fetch VM Classes');
        }
    });

    server.get('/api/vm-classes', async () => {
        try {
            const response = await axios.get(`${TYPING_SERVICE_URL}/vm-classes`);
            return response.data;
        } catch (err) {
            throw new Error('Failed to fetch VM Classes');
        }
    });

    const protectedRoutes = async (fastify: FastifyInstance) => {
        fastify.addHook('preHandler', async (request, reply) => {
            await (server as any).authenticate(request, reply);
        });

        fastify.register(proxy, {
            upstream: TYPING_SERVICE_URL,
            prefix: '/typing',
            rewritePrefix: ''
        });

        fastify.register(proxy, {
            upstream: ORCHESTRATOR_URL,
            prefix: '/provision',
            rewritePrefix: ''
        });

        fastify.register(proxy, {
            upstream: TYPING_SERVICE_URL,
            prefix: '/api/typing/vm-classes',
            rewritePrefix: '/vm-classes'
        });

        fastify.register(proxy, {
            upstream: VCENTER_CONFIG_URL,
            prefix: '/api/vcenters',
            rewritePrefix: '/api/vcenters'
        });

        fastify.register(proxy, {
            upstream: STATS_SERVICE_URL,
            prefix: '/api/stats',
            rewritePrefix: ''
        });
    };

    server.register(protectedRoutes);

    server.get('/health', async () => {
        return { status: 'ok', service: 'gateway' };
    });

    server.get('/', async () => {
        return { message: 'vCenter Provisioner: API Gateway (Staff Grade) active.' };
    });

    return server;
};

const start = async () => {
    try {
        const server = await createServer();
        await server.listen({ port: PORT, host: HOST });
        console.log(`Gateway listening at http://${HOST}:${PORT}`);
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

if (import.meta.url === `file://${process.argv[1]}`) {
    start();
}
