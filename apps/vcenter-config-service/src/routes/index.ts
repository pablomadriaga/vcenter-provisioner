import { FastifyInstance } from 'fastify';
import { VCenterConfigService } from '../services/index.js';

export async function vCenterRoutes(fastify: FastifyInstance, service: VCenterConfigService): Promise<void> {
    fastify.get('/api/vcenters', async (_request, reply) => {
        try {
            const connections = await service.listConnections(true);
            return connections;
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: 'Failed to list connections' });
        }
    });

    fastify.get('/api/vcenters/:id', async (request: any, reply) => {
        const id = parseInt(request.params.id, 10);
        if (isNaN(id)) {
            return reply.status(400).send({ error: 'Invalid ID' });
        }

        try {
            const connection = await service.getConnection(id);
            if (!connection) {
                return reply.status(404).send({ error: 'Connection not found' });
            }
            return connection;
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: 'Failed to get connection' });
        }
    });

    fastify.post('/api/vcenters', async (request: any, reply) => {
        try {
            const { credential, ...data } = request.body || {};
            if (!data.name || !data.url || !credential) {
                return reply.status(400).send({ error: 'Missing required fields' });
            }
            const connection = await service.createConnection(
                { ...data, credential },
                request.user?.id || 1
            );
            return reply.status(201).send(connection);
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: 'Failed to create connection' });
        }
    });

    fastify.put('/api/vcenters/:id', async (request: any, reply) => {
        const id = parseInt(request.params.id, 10);
        if (isNaN(id)) {
            return reply.status(400).send({ error: 'Invalid ID' });
        }

        try {
            const { credential, ...data } = request.body || {};
            const updateData: any = { ...data };
            if (credential) {
                updateData.credential = credential;
            }
            const connection = await service.updateConnection(id, updateData, request.user?.id || 1);
            if (!connection) {
                return reply.status(404).send({ error: 'Connection not found' });
            }
            return connection;
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: 'Failed to update connection' });
        }
    });

    fastify.delete('/api/vcenters/:id', async (request: any, reply) => {
        const id = parseInt(request.params.id, 10);
        if (isNaN(id)) {
            return reply.status(400).send({ error: 'Invalid ID' });
        }

        try {
            const deleted = await service.deleteConnection(id, request.user?.id || 1);
            if (!deleted) {
                return reply.status(404).send({ error: 'Connection not found' });
            }
            return reply.status(204).send();
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: 'Failed to delete connection' });
        }
    });

    fastify.post('/api/vcenters/:id/test', async (request: any, reply) => {
        const id = parseInt(request.params.id, 10);
        if (isNaN(id)) {
            return reply.status(400).send({ error: 'Invalid ID' });
        }

        try {
            const allowInsecure = request.body.allowInsecure ?? false;
            return await service.testConnection(id, { allowInsecure });
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: 'Failed to test connection' });
        }
    });

    fastify.post('/api/vcenters/test-temp', async (request: any, reply) => {
        try {
            const { url, credential, allowInsecure } = request.body || {};
            if (!url || !credential) {
                return reply.status(400).send({ error: 'Missing required fields: url and credential' });
            }
            
            const result = await service.testConnectionWithCredentials(url, credential, { allowInsecure: allowInsecure ?? false });
            return result;
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: 'Failed to test connection', message: error.message });
        }
    });

    fastify.post('/api/vcenters/discover/datacenters', async (request: any, reply) => {
        try {
            const { url, credential, allowInsecure } = request.body || {};
            if (!url || !credential) {
                return reply.status(400).send({ error: 'Missing required fields: url and credential' });
            }
            
            const datacenters = await service.getDatacenters(url, credential, { allowInsecure: allowInsecure ?? false });
            return { datacenters };
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: 'Failed to get datacenters', message: error.message });
        }
    });

    fastify.post('/api/vcenters/discover/clusters', async (request: any, reply) => {
        try {
            const { url, credential, datacenter, allowInsecure } = request.body || {};
            if (!url || !credential) {
                return reply.status(400).send({ error: 'Missing required fields: url and credential' });
            }
            
            const clusters = await service.getClusters(url, credential, datacenter, { allowInsecure: allowInsecure ?? false });
            return { clusters };
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: 'Failed to get clusters', message: error.message });
        }
    });

    fastify.get('/api/vcenters/:id/audit', async (request: any, reply) => {
        const id = parseInt(request.params.id, 10);
        if (isNaN(id)) {
            return reply.status(400).send({ error: 'Invalid ID' });
        }

        try {
            return await service.getAuditLog(id);
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: 'Failed to get audit log' });
        }
    });
}
