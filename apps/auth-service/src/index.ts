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

server.get('/health', async () => {
  return { status: 'ok', service: 'auth-service' };
});

server.register(authRoutes, { prefix: '/api/auth' });
server.register(oauthRoutes, { prefix: '/api/auth/oauth' });
server.register(mfaRoutes, { prefix: '/api/auth/2fa' });
server.register(passwordRoutes, { prefix: '/api/auth/password' });
server.register(deviceRoutes, { prefix: '/api/devices' });

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
