import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import proxy from '@fastify/http-proxy';
import dotenv from 'dotenv';
import axios from 'axios';
// dashboardRoutes removed — dead code (routes never registered)

dotenv.config();

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';
const CORS_ORIGINS = process.env.CORS_ALLOWED_ORIGINS || '*';
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is required');
  process.exit(1);
}

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://auth-service:3001';
const TYPING_SERVICE_URL = process.env.TYPING_SERVICE_URL || 'http://typing-service:8000';
const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL || 'http://vm-orchestrator:8080';
const CREDENTIAL_MANAGER_URL = process.env.CREDENTIAL_MANAGER_URL || process.env.VCENTER_CONFIG_URL || 'http://credential-manager:8090';
const VCENTER_OPERATIONS_URL = process.env.VCENTER_OPERATIONS_URL || process.env.VCENTER_INTEGRATION_URL || 'http://vcenter-operations:8091';
const STATS_SERVICE_URL = process.env.STATS_SERVICE_URL || 'http://stats-service:8001';
const MONITORING_SERVICE_URL = process.env.MONITORING_SERVICE_URL || 'http://monitoring-service:8082';

export const createServer = async (options: any = {}): Promise<FastifyInstance> => {
    const server: FastifyInstance = Fastify({
        logger: options.logger !== false ? true : false
    });

    server.register(cors, {
        origin: true,
        credentials: true
    });

    await server.register(jwt, {
        secret: JWT_SECRET
    });

    server.setErrorHandler(async (error: any, request, reply) => {
        server.log.error({
            err: error,
            url: request.url,
            method: request.method,
            statusCode: error.statusCode
        }, 'Request error')

        const statusCode = error.statusCode >= 400 ? error.statusCode : 500
        reply.status(statusCode).send({
            error: error.name || 'Internal Server Error',
            message: error.message,
            url: request.url
        })
    })

    server.decorate('authenticate', async (request: any, reply: any) => {
        try {
            const authHeader = request.headers.authorization;
            
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                reply.code(401).send({ error: 'Unauthorized', details: 'Missing or invalid Authorization header' });
                return;
            }

            const token = authHeader.replace('Bearer ', '');
            
            try {
                const decoded = await request.server.jwt.verify(token);
                request.user = decoded;
            } catch (jwtErr) {
                reply.code(401).send({ error: 'Unauthorized', details: 'Invalid or expired token' });
            }
        } catch (err) {
            reply.code(401).send({ error: 'Unauthorized', details: 'Invalid or missing token' });
        }
    });

    server.get('/debug/jwt', async (req: any, reply) => {
        const result: any = {
            hasServerJwt: !!server.jwt,
            hasRequestJwt: !!req.server?.jwt,
            hasUser: !!req.user,
            url: req.url,
            authHeaderPresent: !!req.headers.authorization
        };

        if (req.headers.authorization) {
            try {
                const token = req.headers.authorization.replace('Bearer ', '');
                const decoded = await server.jwt.verify(token);
                result.tokenValid = true;
                result.decoded = decoded;
            } catch (err: any) {
                result.tokenValid = false;
                result.tokenError = err.message;
            }
        }

        return result;
    });

    server.register(proxy, {
        upstream: AUTH_SERVICE_URL,
        prefix: '/auth',
        rewritePrefix: '/',
        config: { proxyTimeout: 30000 }
    });



    const protectedRoutes = async (fastify: FastifyInstance) => {
        fastify.addHook('preHandler', async (request, reply) => {
            await (server as any).authenticate(request, reply);
        });

        fastify.get('/vm-classes', async () => {
            try {
                const response = await axios.get(`${TYPING_SERVICE_URL}/vm-classes`);
                return response.data;
            } catch (err) {
                throw new Error('Failed to fetch VM Classes');
            }
        });

        fastify.get('/api/vm-classes', async () => {
            try {
                const response = await axios.get(`${TYPING_SERVICE_URL}/vm-classes`);
                return response.data;
            } catch (err) {
                throw new Error('Failed to fetch VM Classes');
            }
        });

        fastify.register(proxy, {
            upstream: TYPING_SERVICE_URL,
            prefix: '/typing',
            rewritePrefix: '',
            config: { proxyTimeout: 30000 }
        });

        fastify.register(proxy, {
            upstream: ORCHESTRATOR_URL,
            prefix: '/provision',
            rewritePrefix: '',
            config: { proxyTimeout: 30000 }
        });

        // Typing routes are covered by '/typing' prefix above

        // Credential manager: all /vcenters/* routes pass through
        fastify.register(proxy, {
            upstream: CREDENTIAL_MANAGER_URL,
            prefix: '/vcenters',
            rewritePrefix: '/api/vcenters',
            config: { proxyTimeout: 30000 }
        });

        fastify.register(proxy, {
            upstream: VCENTER_OPERATIONS_URL,
            prefix: '/vcenter-data',
            rewritePrefix: '',
            config: { proxyTimeout: 30000 }
        });

        fastify.register(proxy, {
            upstream: STATS_SERVICE_URL,
            prefix: '/stats',
            rewritePrefix: '/stats',
            config: { proxyTimeout: 30000 }
        });

        // Monitoring service: automatic proxy (all /dashboard/monitoring/* routes pass through)
        fastify.register(proxy, {
            upstream: MONITORING_SERVICE_URL,
            prefix: '/dashboard/monitoring',
            rewritePrefix: '/api',
            config: { proxyTimeout: 30000 }
        });

        // Alias: /dashboard/monitoring/services-timeline → /api/services-timeseries
        // Frontend sends resolution=1m, backend expects interval=minute
        fastify.get('/dashboard/monitoring/services-timeline', async (request: any, reply: any) => {
            const { service, hours, resolution } = request.query as any;
            const intervalMap: Record<string, string> = {
                '1m': 'minute',
                '5m': 'minute',
                '1h': 'hour',
                '1d': 'day',
            };
            const interval = intervalMap[resolution as string] || 'hour';
            const params = new URLSearchParams();
            if (service) params.set('service', service);
            params.set('hours', String(hours || '24'));
            params.set('interval', interval);
            try {
                const res = await axios.get(`${MONITORING_SERVICE_URL}/api/services-timeseries`, { params });
                return reply.send(res.data);
            } catch (err: any) {
                reply.status(502).send({ error: 'Bad Gateway', message: `monitoring-service: ${err.message}` });
            }
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
