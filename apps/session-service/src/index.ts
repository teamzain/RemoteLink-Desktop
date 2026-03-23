import { prisma, redisSubscriber, EventChannel } from '@remotelink/shared';

console.log('[Session Service] Starting up...');

redisSubscriber.subscribe(EventChannel.SESSION_STARTED, (err: Error | null | undefined) => {
  if (err) console.error('[Session Service] Failed to subscribe to SESSION_STARTED', err);
});

redisSubscriber.subscribe(EventChannel.SESSION_ENDED, (err: Error | null | undefined) => {
  if (err) console.error('[Session Service] Failed to subscribe to SESSION_ENDED', err);
});

redisSubscriber.on('message', async (channel: string, message: string) => {
  if (channel === EventChannel.SESSION_STARTED) {
    try {
      const data = JSON.parse(message);
      console.log(`[Session Service] Session started for Host: ${data.hostId}, Viewer: ${data.viewerId}`);
      
      // Enforce plan limits
      const activeSessions = await prisma.session.count({
        where: { viewerId: data.viewerId, status: 'ACTIVE' }
      });
      
      if (activeSessions >= 3) {
        // Rigid plan enforcement: max 3 concurrent sessions
        console.warn(`[Session Service] User ${data.viewerId} reached max concurrent sessions`);
        // TODO: Publish event back to Signaling server to force disconnect the WebSocket
      } else {
        await prisma.session.create({
          data: {
            hostId: data.hostId,
            viewerId: data.viewerId,
            status: 'ACTIVE'
          }
        });
      }
    } catch (e) {
      console.error('[Session Service] Failed to process SESSION_STARTED', e);
    }
  }

  if (channel === EventChannel.SESSION_ENDED) {
    try {
      const { sessionId } = JSON.parse(message);
      console.log(`[Session Service] Session ended: ${sessionId}`);
      
      await prisma.session.update({
        where: { id: sessionId },
        data: {
          status: 'COMPLETED',
          endTime: new Date()
        }
      });
    } catch (e) {
      console.error('[Session Service] Failed to process SESSION_ENDED', e);
    }
  }
});

console.log('[Session Service] Listening for Redis events...');
