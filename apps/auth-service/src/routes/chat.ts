import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { prisma, verifyToken, redisPublisher } from '@remotelink/shared';
import nodemailer from 'nodemailer';

const SESSION_INVITE_PREFIX = '[[REMOTE365_SESSION_INVITE]]';

const getInviteInstallUrl = () => {
  return process.env.DESKTOP_DOWNLOAD_URL || 'http://159.65.84.190/downloads/desktop/';
};

const getSafeJoinLink = (sessionLink: string) => {
  try {
    const parsed = new URL(sessionLink);
    parsed.searchParams.delete('password');
    return parsed.toString();
  } catch {
    return sessionLink.replace(/([?&])password=[^&]*/i, '$1').replace(/[?&]$/, '');
  }
};

const sendSessionInviteEmail = async ({
  to,
  senderName,
  sessionName,
  sessionCode,
  sessionPassword,
  sessionLink,
  isExistingUser
}: {
  to: string;
  senderName: string;
  sessionName: string;
  sessionCode: string;
  sessionPassword?: string;
  sessionLink: string;
  isExistingUser: boolean;
}) => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log(`[Session Invite] SMTP not configured. Invite for ${to}: ${sessionLink}`);
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });

  const installUrl = getInviteInstallUrl();
  const installCopy = isExistingUser
    ? 'Open Remote 365 to join from your notification, or use the link below.'
    : 'Install Remote 365 first, then open this invite link to join the session.';

  await transporter.sendMail({
    from: `"Remote 365" <${process.env.SMTP_USER}>`,
    to,
    subject: `${senderName} invited you to a Remote 365 session`,
    text: `${senderName} invited you to ${sessionName}.\n\nJoin link: ${sessionLink}\nSession code: ${sessionCode}${sessionPassword ? `\nPassword: ${sessionPassword}` : ''}\n\n${installCopy}\nDownload: ${installUrl}`,
    html: `
      <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:28px;color:#172033">
        <h2 style="margin:0 0 12px">${senderName} invited you to a Remote 365 session</h2>
        <p style="color:#667085;margin:0 0 22px">${installCopy}</p>
        <div style="background:#f5f7fb;border:1px solid #e8edf5;border-radius:14px;padding:18px;margin-bottom:22px">
          <p style="margin:0 0 8px;color:#667085;font-size:13px">Session</p>
          <p style="margin:0 0 12px;font-size:18px;font-weight:700">${sessionName}</p>
          <p style="margin:0;color:#667085;font-size:13px">Code: <strong style="color:#172033">${sessionCode}</strong></p>
          ${sessionPassword ? `<p style="margin:6px 0 0;color:#667085;font-size:13px">Password: <strong style="color:#172033">${sessionPassword}</strong></p>` : ''}
        </div>
        <a href="${sessionLink}" style="display:inline-block;background:#1D6DF5;color:white;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700">Join session</a>
        <p style="margin-top:22px;color:#667085;font-size:13px">Need the app? Download it here: <a href="${installUrl}">${installUrl}</a></p>
      </div>
    `
  });
};

export default async function chatRoutes(fastify: FastifyInstance) {
  const conversationInclude = {
    participants: {
      include: { user: { select: { id: true, name: true, email: true, avatar: true, role: true } } }
    },
    messages: {
      take: 1,
      orderBy: { createdAt: 'desc' as const }
    }
  };

  const publishConversationEvent = async (event: string, conversation: any, extra: Record<string, any> = {}) => {
    const targetUserIds = conversation?.participants?.map((p: any) => p.userId) || [];
    if (targetUserIds.length === 0) return;

    await redisPublisher.publish('chat:conversation-updated', JSON.stringify({
      type: event,
      conversation,
      conversationId: conversation.id,
      targetUserIds,
      ...extra
    }));
  };

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
        include: conversationInclude,
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
          AND: [
            { participants: { every: { userId: { in: [userId, targetUser.id] } } } },
            { participants: { some: { userId } } },
            { participants: { some: { userId: targetUser.id } } }
          ]
        },
        include: { participants: { include: { user: { select: { id: true, name: true, email: true, avatar: true, role: true } } } } }
      });

      if (existingConversation) {
        if (existingConversation.status === 'BLOCKED') {
          return reply.code(403).send({ error: 'This contact is blocked' });
        }
        return reply.send(existingConversation);
      }

      // Create new conversation
      const conversation = await (prisma as any).conversation.create({
        data: {
          isGroup: false,
          status: 'PENDING',
          requestedById: userId,
          participants: {
            create: userId === targetUser.id ? [{ userId }] : [{ userId }, { userId: targetUser.id }]
          }
        },
        include: { participants: { include: { user: { select: { id: true, name: true, email: true, avatar: true, role: true } } } } }
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

  // 3b. Create a Meet/Zoom-style remote session invite. If sent inside a chat,
  // the invite is stored as a structured chat message so it appears instantly.
  fastify.post('/session-invites', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId;
    const {
      conversationId,
      email,
      sessionName,
      sessionCode,
      sessionPassword,
      sessionLink
    } = request.body as {
      conversationId?: string;
      email?: string;
      sessionName?: string;
      sessionCode?: string;
      sessionPassword?: string;
      sessionLink?: string;
    };

    const cleanEmail = email?.trim().toLowerCase();
    const cleanCode = String(sessionCode || '').replace(/\s/g, '');
    const cleanName = (sessionName || 'Remote support session').trim();

    if (!cleanCode || !sessionLink) {
      return reply.code(400).send({ error: 'Session code and link are required' });
    }
    try {
      const sender = await (prisma as any).user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true }
      });
      const senderName = sender?.name || sender?.email || 'Someone';

      let conversation: any = null;
      let targetEmails: string[] = cleanEmail ? [cleanEmail] : [];
      let targetUserIds: string[] = [];

      if (conversationId) {
        conversation = await (prisma as any).conversation.findFirst({
          where: {
            id: conversationId,
            status: 'ACCEPTED',
            participants: { some: { userId } }
          },
          include: {
            participants: {
              include: { user: { select: { id: true, name: true, email: true, avatar: true, role: true } } }
            }
          }
        });

        if (!conversation) {
          return reply.code(403).send({ error: 'Only accepted chats can receive session invites' });
        }

        const otherParticipants = conversation.participants.filter((p: any) => p.userId !== userId);
        if (!cleanEmail) {
          targetEmails = otherParticipants.map((p: any) => p.user.email).filter(Boolean);
        }
        targetUserIds = otherParticipants.map((p: any) => p.userId);
      }

      const targetUser = cleanEmail
        ? await (prisma as any).user.findUnique({ where: { email: cleanEmail }, select: { id: true, email: true } })
        : null;
      if (targetUser && !targetUserIds.includes(targetUser.id)) targetUserIds.push(targetUser.id);

      const collaboratorUsers = conversationId
        ? conversation.participants
            .filter((p: any) => p.userId !== userId)
            .map((p: any) => ({ userId: p.userId, email: p.user.email, name: p.user.name }))
        : [];

      if (targetUser && cleanEmail && !collaboratorUsers.some((c: any) => c.email === cleanEmail)) {
        collaboratorUsers.push({ userId: targetUser.id, email: targetUser.email, name: null });
      } else if (cleanEmail && !collaboratorUsers.some((c: any) => c.email === cleanEmail)) {
        collaboratorUsers.push({ userId: null, email: cleanEmail, name: null });
      }

      const remoteSession = await (prisma as any).remoteSession.create({
        data: {
          name: cleanName,
          sessionCode: cleanCode,
          joinLink: getSafeJoinLink(sessionLink),
          conversationId: conversationId || null,
          createdById: userId,
          collaborators: {
            create: collaboratorUsers.map((collaborator: any) => ({
              userId: collaborator.userId || null,
              email: collaborator.email,
              name: collaborator.name || null
            }))
          }
        },
        include: {
          collaborators: {
            include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
            orderBy: { createdAt: 'asc' as const }
          },
          createdBy: { select: { id: true, name: true, email: true } }
        }
      });

      const invitePayload = {
        kind: 'remote-session-invite',
        remoteSessionId: remoteSession.id,
        sessionName: cleanName,
        sessionCode: cleanCode,
        sessionPassword: sessionPassword || '',
        sessionLink,
        senderName,
        createdAt: new Date().toISOString()
      };

      let message = null;
      if (conversationId) {
        message = await (prisma as any).message.create({
          data: {
            conversationId,
            senderId: userId,
            content: `${SESSION_INVITE_PREFIX}${JSON.stringify(invitePayload)}`
          },
          include: {
            sender: { select: { id: true, name: true, email: true, avatar: true } }
          }
        });

        await (prisma as any).conversation.update({
          where: { id: conversationId },
          data: { updatedAt: new Date() }
        });

        await redisPublisher.publish('chat:new-message', JSON.stringify({
          type: 'chat-message-received',
          message,
          conversationId,
          targetUserIds: conversation.participants.map((p: any) => p.userId)
        }));
      }

      if (!conversationId && targetUserIds.length > 0) {
        await redisPublisher.publish('chat:session-invite', JSON.stringify({
          type: 'chat-session-invite',
          invite: invitePayload,
          targetUserIds
        }));
      }

      await Promise.all(Array.from(new Set(targetEmails)).map((to) =>
        sendSessionInviteEmail({
          to,
          senderName,
          sessionName: cleanName,
          sessionCode: cleanCode,
          sessionPassword,
          sessionLink,
          isExistingUser: Boolean(targetUserIds.length)
        }).catch((err: any) => {
          console.error(`[Session Invite] Email failed for ${to}:`, err.message);
        })
      ));

      return reply.send({
        success: true,
        existingUser: Boolean(targetUser || targetUserIds.length > 0),
        message,
        remoteSession
      });
    } catch (err) {
      console.error('[Chat API] Failed to create session invite', err);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  fastify.get('/remote-sessions', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId;

    try {
      const currentUser = await (prisma as any).user.findUnique({
        where: { id: userId },
        select: { email: true }
      });

      const visibilityFilters: any[] = [
        { createdById: userId },
        { collaborators: { some: { userId } } }
      ];
      if (currentUser?.email) {
        visibilityFilters.push({ collaborators: { some: { email: currentUser.email } } });
      }

      const sessions = await (prisma as any).remoteSession.findMany({
        where: {
          OR: visibilityFilters
        },
        include: {
          collaborators: {
            include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
            orderBy: { createdAt: 'asc' as const }
          },
          createdBy: { select: { id: true, name: true, email: true } }
        },
        orderBy: { createdAt: 'desc' }
      });

      return reply.send(sessions);
    } catch (err) {
      console.error('[Chat API] Failed to fetch remote sessions', err);
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
        include: conversationInclude
      });

      return reply.send(updated);
    } catch (err) {
      console.error('[Chat API] Failed to rename conversation', err);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // 4b. Create a group conversation
  fastify.post('/groups', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId;
    const { name, emails } = request.body as { name: string; emails: string[] };

    const cleanName = (name || '').trim();
    const cleanEmails = Array.isArray(emails)
      ? Array.from(new Set(emails.map((email) => email.trim().toLowerCase()).filter(Boolean)))
      : [];

    if (!cleanName) return reply.code(400).send({ error: 'Group name is required' });
    if (cleanEmails.length === 0) return reply.code(400).send({ error: 'Add at least one member email' });

    try {
      const users = await (prisma as any).user.findMany({
        where: { email: { in: cleanEmails } },
        select: { id: true, email: true }
      });

      if (users.length !== cleanEmails.length) {
        const found = new Set(users.map((u: any) => u.email.toLowerCase()));
        const missing = cleanEmails.filter((email) => !found.has(email));
        return reply.code(404).send({ error: `Users not found: ${missing.join(', ')}` });
      }

      const memberIds = Array.from(new Set([userId, ...users.map((u: any) => u.id)]));
      const conversation = await (prisma as any).conversation.create({
        data: {
          isGroup: true,
          name: cleanName,
          status: 'ACCEPTED',
          requestedById: userId,
          participants: {
            create: memberIds.map((memberId) => ({ userId: memberId }))
          }
        },
        include: conversationInclude
      });

      await publishConversationEvent('chat-conversation-updated', conversation, {
        actorUserId: userId,
        reason: 'group-created'
      });

      return reply.send(conversation);
    } catch (err) {
      console.error('[Chat API] Failed to create group', err);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // 4c. Add people to an existing group
  fastify.post('/conversations/:id/members', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId;
    const { id } = request.params as { id: string };
    const { emails } = request.body as { emails: string[] };

    const cleanEmails = Array.isArray(emails)
      ? Array.from(new Set(emails.map((email) => email.trim().toLowerCase()).filter(Boolean)))
      : [];

    if (cleanEmails.length === 0) return reply.code(400).send({ error: 'Add at least one member email' });

    try {
      const group = await (prisma as any).conversation.findFirst({
        where: { id, isGroup: true, participants: { some: { userId } } },
        include: { participants: true }
      });

      if (!group) return reply.code(403).send({ error: 'Only group members can add people' });

      const users = await (prisma as any).user.findMany({
        where: { email: { in: cleanEmails } },
        select: { id: true, email: true }
      });

      if (users.length !== cleanEmails.length) {
        const found = new Set(users.map((u: any) => u.email.toLowerCase()));
        const missing = cleanEmails.filter((email) => !found.has(email));
        return reply.code(404).send({ error: `Users not found: ${missing.join(', ')}` });
      }

      const existingIds = new Set(group.participants.map((participant: any) => participant.userId));
      const newUsers = users.filter((member: any) => !existingIds.has(member.id));

      if (newUsers.length > 0) {
        await (prisma as any).conversationParticipant.createMany({
          data: newUsers.map((member: any) => ({ conversationId: id, userId: member.id })),
          skipDuplicates: true
        });
      }

      const updated = await (prisma as any).conversation.findUnique({
        where: { id },
        include: conversationInclude
      });

      await publishConversationEvent('chat-conversation-updated', updated, {
        actorUserId: userId,
        reason: 'members-added',
        addedUserIds: newUsers.map((member: any) => member.id)
      });

      return reply.send(updated);
    } catch (err) {
      console.error('[Chat API] Failed to add group members', err);
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

      const conversation = await (prisma as any).conversation.findUnique({
        where: { id },
        include: conversationInclude
      });

      if (conversation?.isGroup) {
        await (prisma as any).conversationParticipant.delete({
          where: { conversationId_userId: { conversationId: id, userId } }
        });

        const remainingCount = await (prisma as any).conversationParticipant.count({
          where: { conversationId: id }
        });

        if (remainingCount === 0) {
          await (prisma as any).conversation.delete({ where: { id } });
        } else {
          const updated = await (prisma as any).conversation.findUnique({
            where: { id },
            include: conversationInclude
          });

          await publishConversationEvent('chat-conversation-updated', updated, {
            actorUserId: userId,
            reason: 'member-left'
          });
        }

        return reply.send({ success: true });
      }

      await (prisma as any).conversation.delete({ where: { id } });

      if (conversation) {
        await publishConversationEvent('chat-conversation-removed', conversation, {
          actorUserId: userId,
          reason: 'deleted'
        });
      }

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
      const conversation = await (prisma as any).conversation.findFirst({
        where: {
          id,
          status: 'PENDING',
          OR: [{ requestedById: { not: userId } }, { requestedById: null }],
          participants: { some: { userId } }
        }
      });

      if (!conversation) return reply.code(403).send({ error: 'Only the invited recipient can accept this request' });

      const updated = await (prisma as any).conversation.update({
        where: { id },
        data: { status: 'ACCEPTED' },
        include: conversationInclude
      });

      await publishConversationEvent('chat-conversation-updated', updated, {
        actorUserId: userId,
        reason: 'accepted'
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
      const conversation = await (prisma as any).conversation.findFirst({
        where: {
          id,
          status: 'PENDING',
          OR: [{ requestedById: { not: userId } }, { requestedById: null }],
          participants: { some: { userId } }
        }
      });

      if (!conversation) return reply.code(403).send({ error: 'Only the invited recipient can ignore this request' });

      const fullConversation = await (prisma as any).conversation.findUnique({
        where: { id },
        include: conversationInclude
      });

      await (prisma as any).conversation.delete({
        where: { id }
      });

      if (fullConversation) {
        await publishConversationEvent('chat-conversation-removed', fullConversation, {
          actorUserId: userId,
          reason: 'rejected'
        });
      }

      return reply.send({ success: true });
    } catch (err) {
      console.error('[Chat API] Failed to reject invite', err);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // 8. Unfriend/remove a direct chat for both people
  fastify.post('/conversations/:id/unfriend', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId;
    const { id } = request.params as { id: string };

    try {
      const conversation = await (prisma as any).conversation.findFirst({
        where: { id, isGroup: false, participants: { some: { userId } } },
        include: conversationInclude
      });

      if (!conversation) return reply.code(403).send({ error: 'Forbidden' });

      await (prisma as any).conversation.delete({ where: { id } });
      await publishConversationEvent('chat-conversation-removed', conversation, {
        actorUserId: userId,
        reason: 'unfriended'
      });

      return reply.send({ success: true });
    } catch (err) {
      console.error('[Chat API] Failed to unfriend contact', err);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // 9. Block a direct chat. Keeps a blocked record so the other person cannot re-invite.
  fastify.post('/conversations/:id/block', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId;
    const { id } = request.params as { id: string };

    try {
      const participant = await (prisma as any).conversationParticipant.findFirst({
        where: { conversationId: id, userId }
      });
      if (!participant) return reply.code(403).send({ error: 'Forbidden' });

      const conversation = await (prisma as any).conversation.findUnique({ where: { id } });
      if (conversation?.status === 'BLOCKED' && conversation.blockedById !== userId) {
        return reply.code(403).send({ error: 'This chat is already blocked' });
      }

      const updated = await (prisma as any).conversation.update({
        where: { id },
        data: { status: 'BLOCKED', blockedById: userId },
        include: conversationInclude
      });

      await publishConversationEvent('chat-conversation-updated', updated, {
        actorUserId: userId,
        reason: 'blocked'
      });

      return reply.send(updated);
    } catch (err) {
      console.error('[Chat API] Failed to block contact', err);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // 10. Unblock a contact and return to a pending invite so the recipient can accept again.
  fastify.post('/conversations/:id/unblock', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId;
    const { id } = request.params as { id: string };

    try {
      const conversation = await (prisma as any).conversation.findFirst({
        where: { id, status: 'BLOCKED', blockedById: userId, participants: { some: { userId } } }
      });
      if (!conversation) return reply.code(403).send({ error: 'Only the person who blocked this contact can unblock' });

      const updated = await (prisma as any).conversation.update({
        where: { id },
        data: { status: 'PENDING', blockedById: null, requestedById: userId },
        include: conversationInclude
      });

      await publishConversationEvent('chat-conversation-updated', updated, {
        actorUserId: userId,
        reason: 'unblocked'
      });

      return reply.send(updated);
    } catch (err) {
      console.error('[Chat API] Failed to unblock contact', err);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });
}
