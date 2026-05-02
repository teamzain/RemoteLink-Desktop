import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { prisma, verifyToken } from '@remotelink/shared';

export default async function chatRoutes(fastify: FastifyInstance) {
  // Middleware to authenticate user
  fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) return reply.code(401).send({ error: 'Invalid token' });

    (request as any).userId = decoded.userId;
  });

  // 1. Get all conversations for the user
  fastify.get('/conversations', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId;

    try {
      const conversations = await (prisma as any).conversation.findMany({
        where: {
          participants: {
            some: { userId }
          }
        },
        include: {
          participants: {
            include: { user: { select: { id: true, name: true, email: true, avatar: true } } }
          },
          messages: {
            take: 1,
            orderBy: { createdAt: 'desc' }
          }
        },
        orderBy: { updatedAt: 'desc' }
      });

      return reply.send(conversations);
    } catch (err) {
      console.error('[Chat API] Failed to fetch conversations', err);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // 2. Get messages for a specific conversation
  fastify.get('/conversations/:id/messages', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId;
    const { id } = request.params as { id: string };

    try {
      // Ensure the user is a participant
      const participant = await (prisma as any).conversationParticipant.findUnique({
        where: { conversationId_userId: { conversationId: id, userId } }
      });

      if (!participant) {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      const messages = await (prisma as any).message.findMany({
        where: { conversationId: id },
        orderBy: { createdAt: 'asc' },
        include: { sender: { select: { id: true, name: true, avatar: true } } }
      });

      return reply.send(messages);
    } catch (err) {
      console.error('[Chat API] Failed to fetch messages', err);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // 3. Create a new conversation (invite a contact by email)
  fastify.post('/conversations', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId;
    const { email } = request.body as { email: string };

    if (!email) {
      return reply.code(400).send({ error: 'Email is required' });
    }

    try {
      // Find the target user
      const targetUser = await (prisma as any).user.findUnique({ where: { email } });
      if (!targetUser) {
        return reply.code(404).send({ error: 'User not found' });
      }

      if (targetUser.id === userId) {
        return reply.code(400).send({ error: 'Cannot start a conversation with yourself' });
      }

      // Check if a direct conversation already exists
      const existingConversation = await (prisma as any).conversation.findFirst({
        where: {
          isGroup: false,
          participants: {
            every: {
              userId: { in: [userId, targetUser.id] }
            }
          }
        },
        include: {
          participants: {
            include: { user: { select: { id: true, name: true, email: true, avatar: true } } }
          }
        }
      });

      if (existingConversation) {
        return reply.send(existingConversation);
      }

      // Create new conversation
      const conversation = await (prisma as any).conversation.create({
        data: {
          isGroup: false,
          participants: {
            create: [
              { userId },
              { userId: targetUser.id }
            ]
          }
        },
        include: {
          participants: {
            include: { user: { select: { id: true, name: true, email: true, avatar: true } } }
          }
        }
      });

      return reply.send(conversation);
    } catch (err) {
      console.error('[Chat API] Failed to create conversation', err);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });
}
