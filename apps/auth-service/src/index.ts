import Fastify from 'fastify';
import cors from '@fastify/cors';
import { prisma, redisPublisher, EventChannel } from '@remotelink/shared';
import authRoutes from './routes/auth';
import oauthRoutes from './routes/oauth';
import mfaRoutes from './routes/2fa';
import passwordRoutes from './routes/password';
import deviceRoutes from './routes/devices';

const server = Fastify({ logger: true });

server.register(cors, {
  origin: '*' // Allow all local renderer origins
});

server.addHook('onRequest', async (request, reply) => {
  console.log(`[Auth-Service] ${request.method} ${request.url}`);
});

server.get('/health', async () => {
  return { status: 'ok', service: 'auth-service' };
});

server.register(authRoutes, { prefix: '/api/auth' });
server.register(oauthRoutes, { prefix: '/api/auth/oauth' });
server.register(mfaRoutes, { prefix: '/api/auth/2fa' });
server.register(passwordRoutes, { prefix: '/api/auth/password' });
server.register(deviceRoutes, { prefix: '/api/devices' });

server.setNotFoundHandler((request, reply) => {
  console.log(`[Auth-Service-Wildcard] 404: ${request.method} ${request.url}`);
  reply.code(404).send({ error: `Not Found: ${request.method} ${request.url}` });
});

server.setErrorHandler((error, request, reply) => {
  server.log.error(error);
  if (error.code === 'P2024') {
    return reply.status(503).send({ error: 'Database timeout, please try again' });
  }
  if (error.message.includes('Redis')) {
    return reply.status(503).send({ error: 'Session service temporarily unavailable' });
  }
  reply.status(error.statusCode || 500).send({ error: error.message || 'Internal Server Error' });
});

const start = async () => {
  try {
    await server.listen({ port: 3001, host: '0.0.0.0' });
    server.log.info('Auth service listening on port 3001');
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
