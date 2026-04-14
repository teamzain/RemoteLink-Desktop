import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env BEFORE any other imports
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { redisPublisher, redisSubscriber, verifyToken } from '@remotelink/shared';

const PORT = parseInt(process.env.PORT || '3002', 10);

// In-memory map of active connections on this specific instance
const localClients = new Map<string, WebSocket>();
// Map 9-digit sessionId -> host's connectionId
const sessionRegistry = new Map<string, string>(); // sessionId -> hostConnectionId
const reverseRegistry = new Map<string, string>(); // hostConnectionId -> sessionId
const viewerRegistry = new Map<string, string>(); // viewerConnectionId -> sessionId

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
  
  // 1. Wait for Redis cleanup to finish sequentially
  await clearStalePresence();
  
  // 2. Start WebSocket Server ONLY after cleanup
  const wss = new WebSocketServer({ port: PORT, host: '0.0.0.0' });
  console.log(`[Signaling] Cleanup finished. Ready for connections on ws://0.0.0.0:${PORT}`);

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

          case 'register':
            let sessionId = data.accessKey;
            // Standardize and ensure case-insensitivity at the perimeter
            if (sessionId) sessionId = String(sessionId).replace(/\s/g, '').toLowerCase(); 
            
            if (!sessionId || sessionId.trim() === '') {
              sessionId = Math.floor(100000000 + Math.random() * 900000000).toString();
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

          case 'join':
            let targetSessionId = data.sessionId;
            if (targetSessionId) targetSessionId = String(targetSessionId).replace(/\s/g, '').toLowerCase(); 
            const token = data.token;

            console.log(`[Signaling] Join attempt for session: ${targetSessionId}`);
            
            if (!token) {
              return ws.send(JSON.stringify({ type: 'joined', success: false, error: 'Authentication token required' }));
            }

            const decoded = verifyToken(token);
            if (!decoded || decoded.type !== 'remote-access') {
              return ws.send(JSON.stringify({ type: 'joined', success: false, error: 'Invalid or expired access token' }));
            }

            const hostId = sessionRegistry.get(targetSessionId);
            if (hostId) {
              viewerRegistry.set(connectionId, targetSessionId);
              ws.send(JSON.stringify({ type: 'joined', success: true }));
              
              const hostWs = localClients.get(hostId);
              if (hostWs && hostWs.readyState === WebSocket.OPEN) {
                hostWs.send(JSON.stringify({
                  type: 'viewer-joined',
                  viewerId: connectionId,
                  viewerClientId: data.viewerClientId || connectionId // Use clientId if provided, fallback to socketId
                }));
              }
              broadcastGlobalStats();
            } else {
              ws.send(JSON.stringify({ type: 'joined', success: false, error: 'Session not found' }));
            }
            break;

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

            const targetWs = localClients.get(targetId);
            if (targetWs && targetWs.readyState === WebSocket.OPEN) {
              targetWs.send(JSON.stringify({
                type: data.type,
                senderId: connectionId,
                ...data
              }));
            }
            break;
        }
      } catch (err) {
        console.error('[Signaling] Failed to process message', err);
      }
    });

    ws.on('close', async () => {
      localClients.delete(connectionId);
      presenceSubscriptions.delete(connectionId);
      const sessionId = reverseRegistry.get(connectionId);
      if (sessionId) {
        if (sessionRegistry.get(sessionId) === connectionId) {
          sessionRegistry.delete(sessionId);
          await redisPublisher.del(`presence:${sessionId}`).catch(() => {});
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
               await redisPublisher.set(`presence:${sessionId}`, 'online', 'EX', 90).catch(() => {});
            }
         }
       } catch {}
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
}

startServer().catch(err => {
  console.error('[Signaling] CRITICAL: Server failed to start:', err);
  process.exit(1);
});
