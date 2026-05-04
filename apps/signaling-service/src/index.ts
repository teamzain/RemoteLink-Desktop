import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env BEFORE any other imports
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { createHmac } from 'crypto';
import { redisPublisher, redisSubscriber, verifyToken, EventChannel, prisma } from '@remotelink/shared';

const PORT = parseInt(process.env.PORT || '3002', 10);

// In-memory map of active connections on this specific instance
const localClients = new Map<string, WebSocket>();
// Map 9-digit sessionId -> host's connectionId
const sessionRegistry = new Map<string, string>(); // sessionId -> hostConnectionId
const reverseRegistry = new Map<string, string>(); // hostConnectionId -> sessionId
const viewerRegistry = new Map<string, string>(); // viewerConnectionId -> sessionId
// Map meetingId -> Set of connectionIds
const meetingRooms = new Map<string, Set<string>>();
// connectionId -> meetingId (for cleanup)
const connectionToMeeting = new Map<string, string>();
// connectionId -> display metadata for meeting participants
const meetingParticipants = new Map<string, { id?: string; name?: string; avatar?: string | null }>();
// Pending connections waiting for host approval
const pendingJoins = new Map<string, { sessionId: string; viewerClientId?: string; timeout: NodeJS.Timeout }>();

// Chat connections: userId -> Set of connectionIds
const userConnections = new Map<string, Set<string>>();
// connectionId -> userId (for quick cleanup)
const connectionToUser = new Map<string, string>();

// --- STARTUP CLEANUP ---
// Clear all stale presence keys on service restart to prevent ghost online status
async function clearStalePresence() {
  try {
    const keys = await redisPublisher.keys('presence:*');
    if (keys.length > 0) {
      await redisPublisher.del(...keys);
      console.log(`[Signaling] Cleared ${keys.length} stale presence keys on startup.`);
    }
  } catch (err) {
    console.warn('[Signaling] Failed to clear stale presence keys:', err);
  }
}

// Map connectionId -> Set of accessKeys they are monitoring
const presenceSubscriptions = new Map<string, Set<string>>();
// Map connectionId -> organizationId they are monitoring
const orgSubscriptions = new Map<string, string>();

// Helper to broadcast status to all subscribers
async function broadcastPresence(sessionId: string, status: 'online' | 'offline') {
  const update = JSON.stringify({ type: 'presence-update', sessionId, status });
  const normalizedId = String(sessionId).toLowerCase();
  for (const [connId, keys] of presenceSubscriptions.entries()) {
    // Graceful match against both exact and normalized cases
    if (keys.has(sessionId) || keys.has(normalizedId)) {
      const clientWs = localClients.get(connId);
      if (clientWs && clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(update);
      }
    }
  }
}

async function canRegisterHost(accessKey: string, token?: string): Promise<{ ok: boolean; error?: string }> {
  const device = await (prisma as any).device.findUnique({
    where: { accessKey },
    select: { id: true, ownerId: true, organizationId: true }
  });

  if (!device) {
    return { ok: false, error: 'Device is not registered' };
  }

  if (!device.ownerId) {
    return { ok: true };
  }

  if (!token) {
    console.warn(`[Signaling] Legacy host registration without token for owned device: ${accessKey}`);
    return { ok: true };
  }

  const decoded = verifyToken(token);
  if (!decoded?.userId) {
    return { ok: false, error: 'Invalid host token' };
  }

  if (decoded.userId === device.ownerId) {
    return { ok: true };
  }

  const user = await (prisma as any).user.findUnique({
    where: { id: decoded.userId },
    select: { role: true, organizationId: true }
  });

  const canAdminDevice = user?.organizationId === device.organizationId &&
    ['SUPER_ADMIN', 'PLATFORM_OWNER', 'DEPARTMENT_MANAGER'].includes(user.role);

  return canAdminDevice
    ? { ok: true }
    : { ok: false, error: 'Not authorized to host this device' };
}

function canForwardRemoteSignal(senderId: string, targetId: string, messageType: string): boolean {
  const senderSessionId = reverseRegistry.get(senderId);
  const senderViewerSession = viewerRegistry.get(senderId);

  if (senderSessionId) {
    if (messageType === 'answer') return false;
    return viewerRegistry.get(targetId) === senderSessionId;
  }

  if (senderViewerSession) {
    const hostId = sessionRegistry.get(senderViewerSession);
    if (targetId !== hostId) return false;
    return ['request-offer', 'answer', 'ice-candidate'].includes(messageType);
  }

  return false;
}

const normalizeMeetingId = (meetingId: string) => String(meetingId || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

const base64Url = (payload: Buffer | string) =>
  Buffer.from(payload).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

function createLiveKitJoinConfig(room: string, userId: string, name: string) {
  const livekitUrl = process.env.LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!livekitUrl || !apiKey || !apiSecret) return null;

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const claims = {
    iss: apiKey,
    sub: userId,
    name,
    nbf: now - 10,
    exp: now + 60 * 60,
    video: {
      room,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true
    }
  };

  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claims))}`;
  const signature = createHmac('sha256', apiSecret).update(unsigned).digest();

  return {
    provider: 'livekit',
    url: livekitUrl,
    room,
    token: `${unsigned}.${base64Url(signature)}`
  };
}

const leaveMeetingRoom = (connectionId: string) => {
  const meetingId = connectionToMeeting.get(connectionId);
  if (!meetingId) return;

  const room = meetingRooms.get(meetingId);
  if (room) {
    room.delete(connectionId);
    if (room.size === 0) {
      meetingRooms.delete(meetingId);
    } else {
      const leaveNotification = JSON.stringify({
        type: 'meeting-participant-left',
        meetingId,
        participantConnectionId: connectionId
      });
      for (const pId of room) {
        const pWs = localClients.get(pId);
        if (pWs && pWs.readyState === WebSocket.OPEN) {
          pWs.send(leaveNotification);
        }
      }
    }
  }

  connectionToMeeting.delete(connectionId);
  meetingParticipants.delete(connectionId);
};

// Broadcast total active viewer sessions to all connected clients
function broadcastGlobalStats() {
  const activeSessions = new Set(viewerRegistry.values()).size;
  const statsUpdate = JSON.stringify({ type: 'global-stats', activeSessions });

  for (const ws of localClients.values()) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(statsUpdate);
    }
  }
}

async function startServer() {
  console.log('[Signaling] Starting services...');

  // 1. Run Redis cleanup in background (don't block server start if Redis is slow/down)
  clearStalePresence().then(() => {
    console.log('[Signaling] Background cleanup finished.');
  }).catch(err => {
    console.warn('[Signaling] Background cleanup failed:', err);
  });

  // 2. Start WebSocket Server
  const wss = new WebSocketServer({ port: PORT, host: '0.0.0.0' });
  console.log(`[Signaling] WebSocket server listening on ws://0.0.0.0:${PORT}`);

  wss.on('connection', (ws: WebSocket) => {
    const connectionId = uuidv4();
    localClients.set(connectionId, ws);

    console.log(`[Signaling] Client connected: ${connectionId}`);

    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());

        switch (data.type) {
          case 'subscribe-presence':
            const keysToWatch = Array.isArray(data.accessKeys)
              ? data.accessKeys.map((k: any) => String(k).toLowerCase())
              : [];
            presenceSubscriptions.set(connectionId, new Set(keysToWatch));
            console.log(`[Signaling] Client ${connectionId} subscribed to ${keysToWatch.length} keys.`);
            break;

          case 'subscribe-org':
            const orgId = data.organizationId;
            if (orgId) {
              orgSubscriptions.set(connectionId, orgId);
              console.log(`[Signaling] Client ${connectionId} subscribed to org: ${orgId}`);
              ws.send(JSON.stringify({ type: 'subscribed-org', organizationId: orgId }));
            }
            break;

          case 'authenticate-chat': {
            const token = data.token;
            if (!token) break;
            const decoded = verifyToken(token);
            if (decoded && decoded.userId) {
              const userId = decoded.userId;
              connectionToUser.set(connectionId, userId);
              
              if (!userConnections.has(userId)) {
                userConnections.set(userId, new Set());
              }
              userConnections.get(userId)!.add(connectionId);
              console.log(`[Signaling] Chat authenticated for user: ${userId}`);
            }
            break;
          }

          case 'send-chat-message': {
            const senderId = connectionToUser.get(connectionId);
            if (!senderId) {
              ws.send(JSON.stringify({ type: 'chat-error', error: 'Unauthenticated' }));
              break;
            }

            const { conversationId, content } = data;
            if (!conversationId || !content) break;

            try {
              // 0. Verify sender membership and accepted state before any DB write.
              const conv = await (prisma as any).conversation.findFirst({
                where: {
                  id: conversationId,
                  status: 'ACCEPTED',
                  participants: { some: { userId: senderId } }
                }
              });
              if (!conv) {
                ws.send(JSON.stringify({ type: 'chat-error', error: 'Conversation is not available for messaging' }));
                break;
              }

              // 1. Save to DB
              const message = await (prisma as any).message.create({
                data: {
                  conversationId,
                  senderId,
                  content
                },
                include: {
                  sender: { select: { id: true, name: true, avatar: true } }
                }
              });

              // Update the conversation updatedAt
              await (prisma as any).conversation.update({
                where: { id: conversationId },
                data: { updatedAt: new Date() }
              });

              // 2. Fetch participants to broadcast
              const participants = await (prisma as any).conversationParticipant.findMany({
                where: { conversationId },
                select: { userId: true }
              });

              const targetUserIds = participants.map((p: any) => p.userId);

              // 3. Publish to Redis cluster
              await redisPublisher.publish('chat:new-message', JSON.stringify({
                type: 'chat-message-received',
                message,
                conversationId,
                targetUserIds
              }));

            } catch (err) {
              console.error('[Signaling] Failed to process send-chat-message', err);
            }
            break;
          }

          case 'register':
            let sessionId = data.accessKey;
            // Standardize and ensure case-insensitivity at the perimeter
            if (sessionId) sessionId = String(sessionId).replace(/\s/g, '').toLowerCase();

            if (!sessionId || sessionId.trim() === '') {
              ws.send(JSON.stringify({ type: 'registration-error', error: 'Access key required' }));
              break;
            }

            const authResult = await canRegisterHost(sessionId, data.token);
            if (!authResult.ok) {
              ws.send(JSON.stringify({ type: 'registration-error', error: authResult.error || 'Host registration denied' }));
              break;
            }

            sessionRegistry.set(sessionId, connectionId);
            reverseRegistry.set(connectionId, sessionId);

            // Set presence with 90s TTL (1.5 minutes) for faster offline detection
            await redisPublisher.set(`presence:${sessionId}`, 'online', 'EX', 90);

            console.log(`[Signaling] Registered Host session: ${sessionId}`);
            ws.send(JSON.stringify({ type: 'registered', sessionId, connectionId }));

            // Broadcast "Online" to all subscribers
            broadcastPresence(sessionId, 'online');
            break;

          case 'heartbeat':
            const heartbeatSessionId = reverseRegistry.get(connectionId);
            if (heartbeatSessionId) {
              // Refresh presence with 90s window
              await redisPublisher.expire(`presence:${heartbeatSessionId}`, 90);
              // console.log(`[Signaling] Pulse ACK: ${heartbeatSessionId}`);
            }
            break;

          case 'pong':
            // Explicit response to server-side ping
            // console.log(`[Signaling] Pong from ${connectionId}`);
            break;

          case 'join': {
            let targetSessionId = data.sessionId;
            if (targetSessionId) targetSessionId = String(targetSessionId).replace(/\s/g, '').toLowerCase();
            const token = data.token;

            console.log(`[Signaling] Join attempt for session: ${targetSessionId}`);

            if (!token) {
              ws.send(JSON.stringify({ type: 'joined', success: false, error: 'Authentication token required' }));
              break;
            }

            const decoded = verifyToken(token);
            if (!decoded || decoded.type !== 'remote-access') {
              ws.send(JSON.stringify({ type: 'joined', success: false, error: 'Invalid or expired access token' }));
              break;
            }

            const hostId = sessionRegistry.get(targetSessionId);
            if (!hostId) {
              ws.send(JSON.stringify({ type: 'joined', success: false, error: 'Session not found' }));
              break;
            }

            // Hold the join — ask the host to approve first.
            // Auto-deny after 30 s if the host doesn't respond.
            const requestTimeout = setTimeout(() => {
              if (!pendingJoins.has(connectionId)) return;
              pendingJoins.delete(connectionId);
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'joined', success: false, error: 'The host did not respond. Try again.' }));
              }
            }, 30000);

            pendingJoins.set(connectionId, {
              sessionId: targetSessionId,
              viewerClientId: data.viewerClientId,
              timeout: requestTimeout,
            });

            const hostWs = localClients.get(hostId);
            if (hostWs && hostWs.readyState === WebSocket.OPEN) {
              hostWs.send(JSON.stringify({
                type: 'viewer-request',
                viewerId: connectionId,
                viewerClientId: data.viewerClientId || connectionId,
              }));
            }
            break;
          }

          case 'join-approve': {
            const pendingViewerId = data.viewerId;
            const pending = pendingJoins.get(pendingViewerId);
            if (!pending) break;

            clearTimeout(pending.timeout);
            pendingJoins.delete(pendingViewerId);

            const viewerWs = localClients.get(pendingViewerId);
            if (viewerWs && viewerWs.readyState === WebSocket.OPEN) {
              viewerRegistry.set(pendingViewerId, pending.sessionId);
              viewerWs.send(JSON.stringify({ type: 'joined', success: true }));
              // Now tell the host to kick off WebRTC
              ws.send(JSON.stringify({
                type: 'viewer-joined',
                viewerId: pendingViewerId,
                viewerClientId: pending.viewerClientId || pendingViewerId,
              }));
              broadcastGlobalStats();
            }
            break;
          }

          case 'join-deny': {
            const pendingViewerId = data.viewerId;
            const pending = pendingJoins.get(pendingViewerId);
            if (!pending) break;

            clearTimeout(pending.timeout);
            pendingJoins.delete(pendingViewerId);

            const viewerWs = localClients.get(pendingViewerId);
            if (viewerWs && viewerWs.readyState === WebSocket.OPEN) {
              viewerWs.send(JSON.stringify({ type: 'joined', success: false, error: 'Connection request was denied by the host.' }));
            }
            break;
          }

          case 'unregister':
            const unregSessionId = reverseRegistry.get(connectionId);
            if (unregSessionId) {
              console.log(`[Signaling] Unregistering Session: ${unregSessionId}`);
              if (sessionRegistry.get(unregSessionId) === connectionId) {
                sessionRegistry.delete(unregSessionId);
                await redisPublisher.del(`presence:${unregSessionId}`);
                broadcastPresence(unregSessionId, 'offline');
              }
              reverseRegistry.delete(connectionId);
            }
            break;

          case 'request-offer':
          case 'offer':
          case 'answer':
          case 'ice-candidate':
          case 'host-stopped':
            let targetId = data.targetId;
            if (targetId && /^\d{9}$/.test(targetId)) {
              const resolvedId = sessionRegistry.get(targetId);
              if (resolvedId) targetId = resolvedId;
            }

            if (!targetId || !canForwardRemoteSignal(connectionId, targetId, data.type)) {
              ws.send(JSON.stringify({ type: 'signal-error', error: 'Signal target is not authorized for this session' }));
              break;
            }

            const targetWs = localClients.get(targetId);
            if (targetWs && targetWs.readyState === WebSocket.OPEN) {
              targetWs.send(JSON.stringify({
                type: data.type,
                senderId: connectionId,
                ...data
              }));
            }
            break;

          case 'meeting-join': {
            const meetingId = normalizeMeetingId(data.meetingId);
            const { user, token } = data;
            if (!meetingId) break;

            const decoded = token ? verifyToken(token) : null;
            if (!decoded?.userId) {
              ws.send(JSON.stringify({ type: 'meeting-error', error: 'Authentication is required to join this meeting.' }));
              break;
            }

            const meeting = await (prisma as any).remoteSession.findFirst({
              where: {
                sessionCode: meetingId,
                type: 'VIDEO_MEETING',
                status: 'ACTIVE'
              },
              select: { id: true, name: true, sessionCode: true }
            });

            if (!meeting) {
              ws.send(JSON.stringify({ type: 'meeting-error', error: 'Meeting not found or already ended.' }));
              break;
            }

            console.log(`[Signaling] User ${user?.name || connectionId} joining meeting: ${meetingId}`);

            leaveMeetingRoom(connectionId);
            
            if (!meetingRooms.has(meetingId)) {
              meetingRooms.set(meetingId, new Set());
            }
            
            const room = meetingRooms.get(meetingId)!;
            const participantUser = {
              id: decoded.userId,
              name: user?.name || 'Participant',
              avatar: user?.avatar || null
            };
            meetingParticipants.set(connectionId, participantUser);
            
            // Notify others in the room
            const joinNotification = JSON.stringify({
              type: 'meeting-participant-joined',
              meetingId,
              participant: {
                connectionId,
                user: participantUser
              }
            });

            for (const participantId of room) {
              const pWs = localClients.get(participantId);
              if (pWs && pWs.readyState === WebSocket.OPEN) {
                pWs.send(joinNotification);
              }
            }

            room.add(connectionId);
            connectionToMeeting.set(connectionId, meetingId);

            // Send current participants to the new joiner
            const participants = [];
            for (const pId of room) {
              if (pId !== connectionId) {
                participants.push({ connectionId: pId, user: meetingParticipants.get(pId) });
              }
            }

            ws.send(JSON.stringify({
              type: 'meeting-joined',
              meetingId,
              participants,
              meeting: { id: meeting.id, name: meeting.name, sessionCode: meeting.sessionCode },
              sfu: createLiveKitJoinConfig(meetingId, decoded.userId, participantUser.name)
            }));
            break;
          }

          case 'meeting-signal': {
            const { targetConnectionId, signal, meetingId } = data;
            if (!targetConnectionId || !signal) break;

            const currentMeetingId = connectionToMeeting.get(connectionId);
            if (!currentMeetingId || normalizeMeetingId(meetingId) !== currentMeetingId) break;

            const room = meetingRooms.get(currentMeetingId);
            if (!room?.has(targetConnectionId)) break;

            const tWs = localClients.get(targetConnectionId);
            if (tWs && tWs.readyState === WebSocket.OPEN) {
              tWs.send(JSON.stringify({
                type: 'meeting-signal',
                senderConnectionId: connectionId,
                signal,
                meetingId
              }));
            }
            break;
          }

          case 'meeting-leave': {
            leaveMeetingRoom(connectionId);
            break;
          }
        }
      } catch (err) {
        console.error('[Signaling] Failed to process message', err);
      }
    });

    ws.on('close', async () => {
      localClients.delete(connectionId);
      presenceSubscriptions.delete(connectionId);
      orgSubscriptions.delete(connectionId);

      const chatUserId = connectionToUser.get(connectionId);
      if (chatUserId) {
        const set = userConnections.get(chatUserId);
        if (set) {
          set.delete(connectionId);
          if (set.size === 0) userConnections.delete(chatUserId);
        }
        connectionToUser.delete(connectionId);
      }

      // If this viewer disconnected while still pending approval, cancel the request
      if (pendingJoins.has(connectionId)) {
        const pending = pendingJoins.get(connectionId)!;
        clearTimeout(pending.timeout);
        pendingJoins.delete(connectionId);
        const hostId = sessionRegistry.get(pending.sessionId);
        if (hostId) {
          const hostWs = localClients.get(hostId);
          if (hostWs && hostWs.readyState === WebSocket.OPEN) {
            hostWs.send(JSON.stringify({ type: 'viewer-request-cancelled', viewerId: connectionId }));
          }
        }
      }

      const sessionId = reverseRegistry.get(connectionId);
      if (sessionId) {
        if (sessionRegistry.get(sessionId) === connectionId) {
          sessionRegistry.delete(sessionId);
          await redisPublisher.del(`presence:${sessionId}`).catch(() => { });
          broadcastPresence(sessionId, 'offline');
        }
        reverseRegistry.delete(connectionId);
      }

      if (viewerRegistry.has(connectionId)) {
        const sessionId = viewerRegistry.get(connectionId);
        if (sessionId) {
          const hostId = sessionRegistry.get(sessionId);
          if (hostId) {
            const hostWs = localClients.get(hostId);
            if (hostWs && hostWs.readyState === WebSocket.OPEN) {
              hostWs.send(JSON.stringify({
                type: 'viewer-left',
                viewerId: connectionId
              }));
            }
          }
        }
        viewerRegistry.delete(connectionId);
        broadcastGlobalStats();
      }

      // Meeting cleanup
      leaveMeetingRoom(connectionId);
    });

    let pingsMissed = 0;
    const heartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        if (pingsMissed > 2) {
          console.log(`[Signaling] Terminating unresponsive client: ${connectionId}`);
          ws.terminate();
          clearInterval(heartbeat);
          return;
        }
        pingsMissed++;
        ws.send(JSON.stringify({ type: 'ping' }));
      } else {
        clearInterval(heartbeat);
      }
    }, 15000); // 15s ping

    ws.on('message', async (msg) => {
      try {
        const data = JSON.parse(msg.toString());
        if (data.type === 'pong' || data.type === 'heartbeat') {
          pingsMissed = 0; // Reset on any active pulse

          // EXTEND PRESENCE TTL:
          // If this is a host, refresh their 'Online' status in Redis (90s TTL)
          const sessionId = reverseRegistry.get(connectionId);
          if (sessionId && sessionRegistry.get(sessionId) === connectionId) {
            await redisPublisher.set(`presence:${sessionId}`, 'online', 'EX', 90).catch(() => { });
          }
        }
      } catch { }
    });
  });

  // Redis Messaging for Clustering
  redisSubscriber.subscribe('signaling:forward', (err: any) => {
    if (err) console.error('[Signaling] Redis cluster subscribe failed', err);
  });

  redisSubscriber.on('message', (channel: string, message: string) => {
    if (channel === 'signaling:forward') {
      const data = JSON.parse(message);
      const targetWs = localClients.get(data.targetConnectionId);
      if (targetWs && targetWs.readyState === WebSocket.OPEN) {
        targetWs.send(JSON.stringify(data.payload));
      }
    }
  });

  redisPublisher.on('error', (err) => console.error('[Signaling] Redis Publisher Error:', err));
  redisSubscriber.on('error', (err) => console.error('[Signaling] Redis Subscriber Error:', err));

  // Listen for Chat Messages across the cluster
  redisSubscriber.subscribe('chat:new-message', (err) => {
    if (err) console.error('[Signaling] Failed to subscribe to chat:new-message', err);
  });

  redisSubscriber.subscribe('chat:new-conversation', (err) => {
    if (err) console.error('[Signaling] Failed to subscribe to chat:new-conversation', err);
  });

  redisSubscriber.subscribe('chat:conversation-updated', (err) => {
    if (err) console.error('[Signaling] Failed to subscribe to chat:conversation-updated', err);
  });

  redisSubscriber.subscribe('chat:session-invite', (err) => {
    if (err) console.error('[Signaling] Failed to subscribe to chat:session-invite', err);
  });

  // Listen for Organization Updates
  redisSubscriber.subscribe(EventChannel.ORG_UPDATES, (err) => {
    if (err) console.error('[Signaling] Failed to subscribe to ORG_UPDATES', err);
  });

  redisSubscriber.on('message', (channel, message) => {
    if (channel === EventChannel.ORG_UPDATES) {
      try {
        const payload = JSON.parse(message);
        const { organizationId, type } = payload;
        console.log(`[Signaling] Received Org Update: ${type} for ${organizationId}`);
        // Broadcast to all clients subscribed to this organization
        const updateMsg = JSON.stringify({ type: 'team-update', payload });
        for (const [connId, subOrgId] of orgSubscriptions.entries()) {
          if (subOrgId === organizationId) {
            const clientWs = localClients.get(connId);
            if (clientWs && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(updateMsg);
            }
          }
        }
      } catch (err) {
        console.error('[Signaling] Failed to process Org Update:', err);
      }
    } else if (channel === 'chat:new-message') {
      try {
        const payload = JSON.parse(message);
        const { targetUserIds } = payload;
        // Broadcast to all active connections for the target users
        targetUserIds.forEach((userId: string) => {
          const conns = userConnections.get(userId);
          if (conns) {
            conns.forEach(connId => {
              const clientWs = localClients.get(connId);
              if (clientWs && clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify(payload));
              }
            });
          }
        });
      } catch (err) {
        console.error('[Signaling] Failed to process chat:new-message:', err);
      }
    } else if (channel === 'chat:new-conversation') {
      try {
        const payload = JSON.parse(message);
        const { targetUserId, conversation } = payload;
        const conns = userConnections.get(targetUserId);
        if (conns) {
          conns.forEach(connId => {
            const clientWs = localClients.get(connId);
            if (clientWs && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({
                type: 'chat-invite',
                conversation
              }));
            }
          });
        }
      } catch (err) {
        console.error('[Signaling] Failed to process chat:new-conversation:', err);
      }
    } else if (channel === 'chat:conversation-updated') {
      try {
        const payload = JSON.parse(message);
        const { targetUserIds } = payload;
        targetUserIds.forEach((userId: string) => {
          const conns = userConnections.get(userId);
          if (conns) {
            conns.forEach(connId => {
              const clientWs = localClients.get(connId);
              if (clientWs && clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify(payload));
              }
            });
          }
        });
      } catch (err) {
        console.error('[Signaling] Failed to process chat:conversation-updated:', err);
      }
    } else if (channel === 'chat:session-invite') {
      try {
        const payload = JSON.parse(message);
        const { targetUserIds } = payload;
        targetUserIds.forEach((userId: string) => {
          const conns = userConnections.get(userId);
          if (conns) {
            conns.forEach(connId => {
              const clientWs = localClients.get(connId);
              if (clientWs && clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify(payload));
              }
            });
          }
        });
      } catch (err) {
        console.error('[Signaling] Failed to process chat:session-invite:', err);
      }
    }
  });
}

startServer().catch(err => {
  console.error('[Signaling] CRITICAL: Server failed to start:', err);
  process.exit(1);
});
