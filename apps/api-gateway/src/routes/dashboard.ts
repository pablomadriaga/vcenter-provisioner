import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

const MONITORING_SERVICE_URL = process.env.MONITORING_SERVICE_URL || 'http://monitoring-service:8082';

export default async function dashboardRoutes(fastify: FastifyInstance) {
  // Proxy interno a monitoring-service (sin exponer directamente)
  fastify.get('/monitoring/services-status', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const response = await fetch(`${MONITORING_SERVICE_URL}/api/services-status`);
      if (!response.ok) {
        reply.status(response.status).send({ error: 'Failed to fetch services status' });
        return;
      }
      return response.json();
    } catch (error) {
      reply.status(500).send({ error: 'Internal server error' });
    }
  });

  fastify.get('/monitoring/services-history', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { service, hours } = request.query as { service?: string; hours?: string };
      const queryParams = new URLSearchParams();
      if (service) queryParams.append('service', service);
      if (hours) queryParams.append('hours', hours);
      
      const url = `${MONITORING_SERVICE_URL}/api/services-history${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        reply.status(response.status).send({ error: 'Failed to fetch services history' });
        return;
      }
      return response.json();
    } catch (error) {
      reply.status(500).send({ error: 'Internal server error' });
    }
  });

  fastify.get('/monitoring/connectivity-matrix', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const response = await fetch(`${MONITORING_SERVICE_URL}/api/connectivity-matrix`);
      if (!response.ok) {
        reply.status(response.status).send({ error: 'Failed to fetch connectivity matrix' });
        return;
      }
      return response.json();
    } catch (error) {
      reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
