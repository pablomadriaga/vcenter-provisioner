import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import dotenv from 'dotenv';
import { createVCenterConfigService } from './services/index.js';
import { vCenterRoutes } from './routes/index.js';

dotenv.config();

const PORT = parseInt(process.env.PORT || '8090', 10);
const MASTER_KEY = process.env.VCENTER_MASTER_KEY || 'default-master-key-change-in-production!';

// Graceful shutdown handler (Factor IX - Disposability)
const shutdown = async () => {
    console.log('Shutting down gracefully...');
    // Close any open connections here
    process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

async function main() {
    const fastify = Fastify({
        logger: {
            level: process.env.LOG_LEVEL || 'info',
            transport: process.env.NODE_ENV !== 'production' ? {
                target: 'pino-pretty',
                options: {
                    colorize: true,
                },
            } : undefined,
        },
    });

    await fastify.register(cors, {
        origin: process.env.CORS_ORIGINS || '*',
    });

    await fastify.register(rateLimit, {
        max: 100,
        timeWindow: '1 minute',
    });

    const vCenterService = createVCenterConfigService(MASTER_KEY);

    fastify.get('/health', async () => ({ status: 'ok', service: 'credential-manager' }));

    fastify.addHook('onRequest', async (request) => {
        fastify.log.info({
            method: request.method,
            url: request.url,
            ip: request.ip,
            userAgent: request.headers['user-agent'],
        });
    });

    await vCenterRoutes(fastify, vCenterService);

    try {
        await fastify.listen({ port: PORT, host: '0.0.0.0' });
        console.log(`Credential Manager listening on port ${PORT}`);
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
}

main();
