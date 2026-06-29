import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import dotenv from 'dotenv';
import { createVCenterConfigService } from './services/index.js';
import { vCenterRoutes } from './routes/index.js';

dotenv.config();

const PORT = parseInt(process.env.PORT || '8082', 10);
const MASTER_KEY = process.env.VCENTER_MASTER_KEY || 'default-master-key-change-in-production!';

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

    fastify.get('/health', async () => ({ status: 'ok', service: 'vcenter-config' }));

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
        fastify.log.info({ port: PORT, service: 'vcenter-config' }, 'Service started');
    } catch (error) {
        fastify.log.error(error);
        process.exit(1);
    }
}

main();
