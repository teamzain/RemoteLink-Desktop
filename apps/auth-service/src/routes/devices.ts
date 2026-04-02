import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import bcrypt from 'bcryptjs';
import { prisma, redisPublisher, generateToken, verifyToken, checkPlanLimit } from '@remotelink/shared';
import { randomInt } from 'crypto';

// Helper to generate 9-digit CSPRNG key
function generateAccessKey(): string {
  return randomInt(0, 1000000000).toString().padStart(9, '0');
}

async function mapDevice(device: any, userId: string): Promise<any> {
    const cleanKey = String(device.accessKey).replace(/\s/g, '');
    const presence = await redisPublisher.get(`presence:${cleanKey}`);
    return {
      id: device.id,
      device_name: device.name,
      device_type: (device.deviceType || 'DESKTOP').toLowerCase(),
      access_key: device.accessKey, // keep formatted key for display if needed
      last_seen_at: device.lastSeenAt,
      is_online: presence === 'online',
      is_owned: device.ownerId === userId
    };
}

export default async function deviceRoutes(fastify: FastifyInstance) {
  
  // 0. Add Existing Device (Moved to top for matching priority)
  fastify.post('/add-existing', { preHandler: [checkPlanLimit('maxDevices')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });
    
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) return reply.code(401).send({ error: 'Invalid token' });

    let { accessKey, password } = request.body as any;
    if (!accessKey || !password) return reply.code(400).send({ error: 'accessKey and password required' });
    accessKey = String(accessKey).replace(/\s/g, '');
    console.log(`[Device-Debug] Attempting to add existing device: ${accessKey}`);

    const device = await prisma.device.findUnique({ where: { accessKey } });
    if (!device) {
      console.log(`[Device-Debug] Device not found in DB for key: ${accessKey}`);
      return reply.code(404).send({ error: 'Device not found' });
    }
    
    if (!device.accessPasswordHash) {
      console.log(`[Device-Debug] Device found but has no accessPasswordHash: ${accessKey}`);
      return reply.code(404).send({ error: 'Device has no access password set yet' });
    }

    const isMatch = await bcrypt.compare(password, device.accessPasswordHash);
    if (!isMatch) {
      console.log(`[Device-Debug] Password mismatch for device: ${accessKey}`);
      return reply.code(401).send({ error: 'Incorrect password' });
    }

    // Safe to link
    const existingLink = await prisma.savedDevice.findUnique({
      where: { userId_deviceId: { userId: decoded.userId, deviceId: device.id } }
    });

    if (!existingLink) {
      await prisma.savedDevice.create({
        data: { userId: decoded.userId, deviceId: device.id }
      });
    }

    const mapped = await mapDevice(device, decoded.userId);
    return reply.send({ success: true, device: mapped });
  });
  
  // 1. Verify access key + password and return 60s JWT (Viewer Step 2)
  fastify.post('/verify-access', async (request: FastifyRequest, reply: FastifyReply) => {
    let { accessKey, password } = request.body as any;
    if (!accessKey) return reply.code(400).send({ error: 'Access Key required' });
    accessKey = String(accessKey).replace(/\s/g, '');
    console.log(`[Device-Debug] verify-access attempt for: ${accessKey}`);

    const device = await prisma.device.findUnique({ where: { accessKey } });
    if (!device) {
      console.log(`[Device-Debug] verify-access: Device not found in DB for key: ${accessKey}`);
      return reply.code(404).send({ error: 'Device not found' });
    }
    
    if (!device.accessPasswordHash) {
      console.log(`[Device-Debug] verify-access: Device found but has no accessPasswordHash: ${accessKey}`);
      return reply.code(404).send({ error: 'Device has no access password set yet. Go to host settings and set one.' });
    }

    const presence = await redisPublisher.get(`presence:${accessKey}`);
    if (presence !== 'online') {
      return reply.code(409).send({ error: 'Device is offline' });
    }

    // Check if user is trusted (Passwordless bypass)
    let isTrusted = false;
    const authHeader = request.headers.authorization;
    if (authHeader) {
      const token = authHeader.split(' ')[1];
      const decodedUser = verifyToken(token);
      if (decodedUser && decodedUser.userId) {
        if (device.ownerId === decodedUser.userId) {
          isTrusted = true; // Auto-trust owned devices
        } else {
          const trustCheck = await prisma.trustedDevice.findUnique({
            where: { viewerUserId_hostDeviceId: { viewerUserId: decodedUser.userId, hostDeviceId: device.id } }
          });
          if (trustCheck) isTrusted = true;
        }
      }
    }

    if (!isTrusted) {
      if (!password) return reply.code(401).send({ error: 'Password required for untrusted device connections' });

      const lockoutKey = `lockout:${accessKey}`;
      const attempts = await redisPublisher.get(lockoutKey);
      if (attempts && parseInt(attempts) >= 20) {
        const ttl = await redisPublisher.ttl(lockoutKey);
        return reply.code(429).send({ error: 'Too many attempts', retryAfter: ttl });
      }

      const isMatch = await bcrypt.compare(password, device.accessPasswordHash);
      if (!isMatch) {
        const fails = await redisPublisher.incr(lockoutKey);
        if (fails === 1) await redisPublisher.expire(lockoutKey, 300);
        return reply.code(401).send({ error: 'Incorrect password' });
      }

      await redisPublisher.del(lockoutKey);

      // Persist trust for future passwordless connections
      const authHeader = request.headers.authorization;
      if (authHeader) {
        const token = authHeader.split(' ')[1];
        const decodedUser = verifyToken(token);
        if (decodedUser && decodedUser.userId) {
          try {
            await prisma.trustedDevice.upsert({
              where: { viewerUserId_hostDeviceId: { viewerUserId: decodedUser.userId, hostDeviceId: device.id } },
              update: {},
              create: { viewerUserId: decodedUser.userId, hostDeviceId: device.id }
            });
            isTrusted = true;
          } catch (e) {
            console.warn('[Device-Debug] Failed to persist trust relationship', e);
          }
        }
      }
    }

    const accessJWT = generateToken({ 
      type: 'remote-access', 
      deviceId: device.id, 
      accessKey: device.accessKey 
    }, '5m');

    return reply.send({ token: accessJWT, device: { id: device.id, name: device.name, isTrusted } });
  });
  
  // 1. Register a new device for the current user
  fastify.post('/register', { preHandler: [checkPlanLimit('maxDevices')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    console.log(`[Device-Debug] Registration attempt received`);
    try {
      const authHeader = request.headers.authorization;
      if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });
      
      const token = authHeader.split(' ')[1];
      const decoded = verifyToken(token);
      if (!decoded || !decoded.userId) return reply.code(401).send({ error: 'Invalid token' });
      console.log(`[Device-Debug] Registration for userId: ${decoded.userId}`);

      const { name, deviceType } = request.body as any || {};
      const deviceName = name || 'Remote PC';
      const validDeviceType = ['WINDOWS', 'MACOS', 'LINUX', 'IOS', 'ANDROID'].includes(deviceType?.toUpperCase()) ? deviceType.toUpperCase() : 'WINDOWS';

      let accessKey = (request.body as any)?.accessKey;
      if (accessKey) accessKey = String(accessKey).replace(/\s/g, ''); // Standardize
      
      let password = (request.body as any)?.password;
 
      let existing = null;
      if (accessKey) {
        existing = await prisma.device.findUnique({ where: { accessKey } });
      }

      if (!existing) {
        existing = await prisma.device.findFirst({
          where: { ownerId: decoded.userId, name: deviceName }
        });
      }

      if (existing) {
        let updateData: any = {};
        
        // Always sync the name if provided and different
        if (deviceName && deviceName !== existing.name) {
          updateData.name = deviceName;
        }

        if (accessKey && accessKey !== existing.accessKey) {
           // Ensure the new deterministic key doesn't clash
           const clash = await prisma.device.findUnique({ where: { accessKey } });
           if (!clash) updateData.accessKey = accessKey;
        }
        if (password) {
           const bcrypt = require('bcrypt');
           updateData.accessPasswordHash = await bcrypt.hash(password, 10);
        }
        
        if (Object.keys(updateData).length > 0) {
           existing = await prisma.device.update({ where: { id: existing.id }, data: updateData });
        }
        
        const mapped = await mapDevice(existing, decoded.userId);
        return reply.code(200).send(mapped);
      }

      if (!accessKey || (await prisma.device.findUnique({ where: { accessKey } }))) {
        accessKey = generateAccessKey();
        while (await prisma.device.findUnique({ where: { accessKey } })) {
          accessKey = generateAccessKey();
        }
      }

      const device = await prisma.device.create({
        data: {
          accessKey,
          ownerId: decoded.userId,
          name: deviceName,
          deviceType: validDeviceType as any
        }
      });

      const mapped = await mapDevice(device, decoded.userId);
      return reply.code(201).send(mapped);
    } catch (err: any) {
      console.error('[Device Registration Error]', err);
      return reply.code(500).send({ error: 'Failed to register device: ' + err.message });
    }
  });

  // 2. Format devices including online status
  fastify.get('/mine', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });
    
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) return reply.code(401).send({ error: 'Invalid token' });

    // Fetch owned devices
    const ownedDevices = await prisma.device.findMany({
      where: { ownerId: decoded.userId }
    });

    // Fetch saved devices
    const savedRelations = await prisma.savedDevice.findMany({
      where: { userId: decoded.userId },
      include: { device: true }
    });
    const savedDevices = savedRelations.map((s: any) => s.device);

    // Combine them
    const allDevicesMap = new Map();
    [...ownedDevices].forEach(d => allDevicesMap.set(d.id, { ...d, _isOwned: true }));
    [...savedDevices].forEach(d => {
      if (!allDevicesMap.has(d.id)) allDevicesMap.set(d.id, { ...d, _isOwned: false });
    });
    
    let allDevices = Array.from(allDevicesMap.values());

    // Look up redis presence
    const enrichedDevices = await Promise.all(allDevices.map(async (device) => {
      return mapDevice(device, decoded.userId);
    }));

    // Sort: Online first, then by lastSeenAt DESC
    enrichedDevices.sort((a, b) => {
      if (a.is_online && !b.is_online) return -1;
      if (!a.is_online && b.is_online) return 1;
      return new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime();
    });

    return reply.send(enrichedDevices);
  });

  // Maintain backward compatibility for older GET /
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });
    
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) return reply.code(401).send({ error: 'Invalid token' });

    const devices = await prisma.device.findMany({
      where: { ownerId: decoded.userId }
    });
    return reply.send(devices);
  });

  // 3. Rename Device
  fastify.patch('/:id/name', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });
    
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) return reply.code(401).send({ error: 'Invalid token' });

    const { id } = request.params as { id: string };
    const { device_name } = request.body as any;
    
    if (!device_name) return reply.code(400).send({ error: 'device_name is required' });

    const device = await prisma.device.findUnique({ where: { id } });
    if (!device) return reply.code(404).send({ error: 'Not found' });
    
    // Check if owner
    if (device.ownerId === decoded.userId) {
      const updated = await prisma.device.update({
        where: { id },
        data: { name: device_name }
      });
      return reply.send({ success: true, device: updated });
    } else {
      return reply.code(403).send({ error: 'Only the owner can rename the device globally' });
    }
  });

  // 4. Delete Device (Remove from account)
  fastify.delete('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });
    
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) return reply.code(401).send({ error: 'Invalid token' });

    const { id } = request.params as { id: string };
    const device = await prisma.device.findUnique({ where: { id } });
    if (!device) return reply.code(404).send({ error: 'Not found' });

    if (device.ownerId === decoded.userId) {
      // Delete all related records first
      await prisma.savedDevice.deleteMany({ where: { deviceId: id } });
      await prisma.trustedDevice.deleteMany({ where: { hostDeviceId: id } });
      // Delete the device itself
      await prisma.device.delete({ where: { id } });
      return reply.send({ success: true });
    } else {
      // Unlink saved device
      await prisma.savedDevice.deleteMany({ where: { userId: decoded.userId, deviceId: id } });
      return reply.send({ success: true });
    }
  });


  // 6. Trust Device
  fastify.post('/:id/trust', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });
    
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) return reply.code(401).send({ error: 'Invalid token' });

    const { id } = request.params as { id: string };

    const device = await prisma.device.findUnique({ where: { id } });
    if (!device) return reply.code(404).send({ error: 'Device not found' });

    const existing = await prisma.trustedDevice.findUnique({
      where: { viewerUserId_hostDeviceId: { viewerUserId: decoded.userId, hostDeviceId: id } }
    });

    if (!existing) {
      await prisma.trustedDevice.create({
        data: { viewerUserId: decoded.userId, hostDeviceId: id }
      });
    }

    return reply.send({ success: true });
  });

  // 7. Revoke Trust
  fastify.delete('/:id/trust', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });
    
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) return reply.code(401).send({ error: 'Invalid token' });

    const { id } = request.params as { id: string };
    
    await prisma.trustedDevice.deleteMany({
      where: { viewerUserId: decoded.userId, hostDeviceId: id }
    });

    return reply.send({ success: true });
  });

  // Regenerate Access Key
  fastify.post('/regenerate-key', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });
    
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) return reply.code(401).send({ error: 'Invalid token' });

    const { deviceId } = request.body as any;
    const device = await prisma.device.findUnique({ where: { id: deviceId } });
    if (!device || device.ownerId !== decoded.userId) {
      return reply.code(403).send({ error: 'Not authorized for this device' });
    }

    let accessKey = generateAccessKey();
    while (await prisma.device.findUnique({ where: { accessKey } })) {
      accessKey = generateAccessKey();
    }

    const updated = await prisma.device.update({
      where: { id: deviceId },
      data: { accessKey }
    });

    return reply.send({ access_key: updated.accessKey });
  });

  // Set/Update machine password
  fastify.post('/set-password', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });
    
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    const { deviceId, password } = request.body as any;

    if (!deviceId || !password) return reply.code(400).send({ error: 'DeviceID and password required' });

    const device = await prisma.device.findUnique({ where: { id: deviceId } });
    if (!device || device.ownerId !== decoded.userId) {
      return reply.code(403).send({ error: 'Not authorized for this device' });
    }

    const salt = await bcrypt.genSalt(12);
    const hash = await bcrypt.hash(password, salt);

    await prisma.device.update({
      where: { id: deviceId },
      data: { accessPasswordHash: hash }
    });

    return reply.send({ success: true });
  });

  // Status Check (Unauthenticated Viewer Step 1)
  fastify.get('/status', async (request: FastifyRequest, reply: FastifyReply) => {
    let { key } = request.query as any;
    if (!key) return reply.code(400).send({ error: 'Access Key required' });
    key = String(key).replace(/\s/g, ''); // Strip spaces

    const ip = request.ip || 'unknown';
    const rlKey = `rl:status:${ip}`;
    const reqs = await redisPublisher.incr(rlKey);
    if (reqs === 1) await redisPublisher.expire(rlKey, 60);
    if (reqs > 10) return reply.code(429).send({ error: 'Too many requests' });

    const device = await prisma.device.findUnique({ where: { accessKey: key } });
    if (!device) return reply.code(404).send({ exists: false, error: 'Device not found' });

    const presence = await redisPublisher.get(`presence:${key}`);
    const online = presence === 'online';

    return reply.send({ exists: true, online });
  });



}
