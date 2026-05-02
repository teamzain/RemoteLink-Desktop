import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { prisma, verifyToken, redisPublisher } from '@remotelink/shared';

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
            include: { user: { select: { id: true, name: true, email: true, avatar: true, role: true } } }
          },
          messages: {
            take: 1,
            orderBy: { createdAt: 'desc' }
          }
        },
        orderBy: { updatedAt: 'desc' }
      });

      console.log(`[Chat API] Fetched ${conversations.length} conversations for user ${userId}`);

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
      // Diagnostic logging
      const allParticipants = await (prisma as any).conversationParticipant.findMany({
        where: { conversationId: id },
        include: { user: { select: { id: true, email: true } } }
      });
      console.log(`[Chat API] GET messages for ${id}. Participants in DB:`, allParticipants.map((p: any) => p.userId));
      console.log(`[Chat API] Requesting User ID:`, userId);

      // Ensure the user is a participant
      const participant = await (prisma as any).conversationParticipant.findFirst({
        where: { conversationId: id, userId }
      });

      if (!participant) {
        console.warn(`[Chat API] Access denied: User ${userId} is not in conversation ${id}`);
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

      /* 
      if (targetUser.id === userId) {
        return reply.code(400).send({ error: 'Cannot start a conversation with yourself' });
      }
      */

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
          status: 'PENDING',
          participants: {
            create: userId === targetUser.id ? [{ userId }] : [{ userId }, { userId: targetUser.id }]
          }
        },
        include: {
          participants: {
            include: { user: { select: { id: true, name: true, email: true, avatar: true } } }
          }
        }
      });

      // Broadcast to signaling-service so the target user gets a live notification
      const payload = JSON.stringify({
        targetUserId: targetUser.id,
        conversation
      });
      redisPublisher.publish('chat:new-conversation', payload);

      return reply.send(conversation);
    } catch (err) {
      console.error('[Chat API] Failed to create conversation', err);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // 4. Rename a conversation (Updates NICKNAME for the requester)
  fastify.patch('/conversations/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId;
    const { id } = request.params as { id: string };
    const { name } = request.body as { name: string };

    try {
      // Diagnostic logging
      const allParticipants = await (prisma as any).conversationParticipant.findMany({
        where: { conversationId: id },
        include: { user: { select: { id: true, email: true } } }
      });
      console.log(`[Chat API] PATCH rename for ${id}. Participants in DB:`, allParticipants.map((p: any) => p.userId));
      console.log(`[Chat API] Requesting User ID:`, userId);

      // Update nickname for the participant
      await (prisma as any).conversationParticipant.update({
        where: { conversationId_userId: { conversationId: id, userId } },
        data: { nickname: name }
      });

      const updated = await (prisma as any).conversation.findUnique({
        where: { id },
        include: {
          participants: {
            include: { user: { select: { id: true, name: true, email: true, avatar: true, role: true } } }
          },
          messages: {
            take: 1,
            orderBy: { createdAt: 'desc' }
          }
        }
      });

      return reply.send(updated);
    } catch (err) {
      console.error('[Chat API] Failed to rename conversation', err);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // 5. Delete/Leave a conversation
  fastify.delete('/conversations/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId;
    const { id } = request.params as { id: string };

    try {
      console.log(`[Chat API] DELETE request for ${id} by user: ${userId}`);
      
      // Diagnostic logging
      const allParticipants = await (prisma as any).conversationParticipant.findMany({
        where: { conversationId: id },
        include: { user: { select: { id: true, email: true } } }
      });
      console.log(`[Chat API] Participants in DB for ${id}:`, allParticipants.map((p: any) => p.userId));

      // Check if user is a participant
      const participant = await (prisma as any).conversationParticipant.findFirst({
        where: { conversationId: id, userId }
      });

      if (!participant) {
        console.warn(`[Chat API] Delete failed: User ${userId} is NOT a participant of ${id}`);
        return reply.code(403).send({ error: 'Forbidden' });
      }

      // In a 1-on-1 chat, deleting usually means removing the conversation for BOTH if it's the only way to "clear" it.
      // But for now, we just delete the whole conversation since we added Cascade.
      await (prisma as any).conversation.delete({
        where: { id }
      });

      return reply.send({ success: true });
    } catch (err) {
      console.error('[Chat API] Failed to delete conversation', err);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // 6. Accept a conversation invite
  fastify.post('/conversations/:id/accept', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId;
    const { id } = request.params as { id: string };

    try {
      const participant = await (prisma as any).conversationParticipant.findFirst({
        where: { conversationId: id, userId }
      });

      if (!participant) return reply.code(403).send({ error: 'Forbidden' });

      const updated = await (prisma as any).conversation.update({
        where: { id },
        data: { status: 'ACCEPTED' },
        include: {
          participants: {
            include: { user: { select: { id: true, name: true, email: true, avatar: true, role: true } } }
          }
        }
      });

      return reply.send(updated);
    } catch (err) {
      console.error('[Chat API] Failed to accept invite', err);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // 7. Reject a conversation invite
  fastify.post('/conversations/:id/reject', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId;
    const { id } = request.params as { id: string };

    try {
      const participant = await (prisma as any).conversationParticipant.findFirst({
        where: { conversationId: id, userId }
      });

      if (!participant) return reply.code(403).send({ error: 'Forbidden' });

      await (prisma as any).conversation.delete({
        where: { id }
      });

      return reply.send({ success: true });
    } catch (err) {
      console.error('[Chat API] Failed to reject invite', err);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });
}
