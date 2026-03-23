import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { redisPublisher, redisSubscriber, EventChannel } from '@remotelink/shared';

const PORT = 3002;
// Use strict port to ensure signaling service binds correctly; in a real cluster we rely on k8s or Docker swarm
const wss = new WebSocketServer({ port: PORT, host: '0.0.0.0' });

// In-memory map of active connections on this specific instance
const localClients = new Map<string, WebSocket>();
// Map 9-digit sessionId -> host's connectionId
const sessionRegistry = new Map<string, string>(); // sessionId -> hostConnectionId
const reverseRegistry = new Map<string, string>(); // hostConnectionId -> sessionId
const viewerRegistry = new Map<string, string>(); // viewerConnectionId -> sessionId

wss.on('connection', (ws) => {
  const connectionId = uuidv4();
  localClients.set(connectionId, ws);
  
  console.log(`[Signaling] Client connected: ${connectionId}`);

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());

      // Basic protocol:
      // { type: 'register', deviceId: '...', token: '...' }
      // { type: 'offer', targetId: '...', sdp: '...' }
      // { type: 'answer', targetId: '...', sdp: '...' }
      // { type: 'ice-candidate', targetId: '...', candidate: '...' }

      switch (data.type) {
        case 'register':
          // TODO: Verify JWT token
          const sessionId = Math.floor(100000000 + Math.random() * 900000000).toString(); // 9-digit code
          sessionRegistry.set(sessionId, connectionId);
          reverseRegistry.set(connectionId, sessionId);
          console.log(`[Signaling] Registered Host session: ${sessionId}`);
          ws.send(JSON.stringify({ type: 'registered', sessionId, connectionId }));
          break;

        case 'join':
          const targetSessionId = data.sessionId;
          console.log(`[Signaling] Join attempt for session: ${targetSessionId}`);
          const hostId = sessionRegistry.get(targetSessionId);
          if (hostId) {
            viewerRegistry.set(connectionId, targetSessionId);
            ws.send(JSON.stringify({ type: 'joined', success: true }));
            console.log(`[Signaling] Viewer ${connectionId} joined session ${targetSessionId}`);
            
            // Notify the host that a viewer has joined
            const hostWs = localClients.get(hostId);
            if (hostWs && hostWs.readyState === WebSocket.OPEN) {
              hostWs.send(JSON.stringify({
                type: 'viewer-joined',
                viewerId: connectionId
              }));
            }
          } else {
            console.warn(`[Signaling] Session ${targetSessionId} not found in registry`);
            ws.send(JSON.stringify({ type: 'joined', success: false, error: 'Session not found' }));
          }
          break;

        case 'offer':
        case 'answer':
        case 'ice-candidate':
          let targetId = data.targetId;
          
          // If targetId is a 9-digit session code, resolve it to the host's connectionId
          if (targetId && /^\d{9}$/.test(targetId)) {
            const resolvedId = sessionRegistry.get(targetId);
            if (resolvedId) {
              targetId = resolvedId;
            }
          }

          const targetWs = localClients.get(targetId);
          if (targetWs && targetWs.readyState === WebSocket.OPEN) {
            targetWs.send(JSON.stringify({
              type: data.type,
              senderId: connectionId,
              ...data
            }));
          } else {
            console.warn(`[Signaling] Target client not found or closed: ${targetId}`);
          }
          break;

        default:
          console.warn(`[Signaling] Unknown message type: ${data.type}`);
      }
    } catch (err) {
      console.error('[Signaling] Failed to process message', err);
    }
  });

  ws.on('close', () => {
    console.log(`[Signaling] Client disconnected: ${connectionId}`);
    localClients.delete(connectionId);
    // TODO: Remove from Redis Registry
  });
});

console.log(`Signaling server listening on ws://0.0.0.0:${PORT}`);

// Subscribe to internal cluster events for horizontal scaling
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
