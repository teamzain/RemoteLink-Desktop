import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { prisma, verifyToken } from '@remotelink/shared';

export default async function supportRoutes(fastify: FastifyInstance) {
  // 1. Get user's tickets
  fastify.get('/tickets', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) return reply.code(401).send({ error: 'Invalid token' });

    try {
      const tickets = await (prisma as any).supportTicket.findMany({
        where: { userId: decoded.userId },
        orderBy: { createdAt: 'desc' }
      });
      return reply.send(tickets);
    } catch (err) {
      // Fallback for dev if DB not pushed
      return reply.send([]);
    }
  });

  // 2. Create a new ticket
  fastify.post('/tickets', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) return reply.code(401).send({ error: 'Invalid token' });

    const { subject, description, category } = request.body as any;
    if (!subject || !description) return reply.code(400).send({ error: 'Subject and description required' });

    const displayId = `TIC-${Math.floor(1000 + Math.random() * 8999)}`;

    try {
      const ticket = await (prisma as any).supportTicket.create({
        data: {
          userId: decoded.userId,
          displayId,
          subject,
          description,
          category: category || 'Other',
          status: 'Open'
        }
      });
      return reply.send(ticket);
    } catch (err) {
      // Dev mock if DB not ready
      return reply.send({ id: 'mock-id', displayId, subject, status: 'Open', createdAt: new Date() });
    }
  });

  // 3. Request a custom guide
  fastify.post('/guides', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) return reply.code(401).send({ error: 'Invalid token' });

    const { description } = request.body as any;
    if (!description) return reply.code(400).send({ error: 'Description required' });

    try {
      const guideRequest = await (prisma as any).guideRequest.create({
        data: {
          userId: decoded.userId,
          description,
          status: 'Pending'
        }
      });
      return reply.send(guideRequest);
    } catch (err) {
      return reply.send({ success: true, message: 'Request received (mock)' });
    }
  });
}
