import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import bcrypt from 'bcryptjs';
import { prisma, redisPublisher } from '@remotelink/shared';
import { generateToken, verifyToken } from '../utils/jwt';
import { randomInt } from 'crypto';

// Helper to generate 9-digit CSPRNG key
function generateAccessKey(): string {
  // Generates a string like '012345678' or '987654321'
  return randomInt(0, 1000000000).toString().padStart(9, '0');
}

export default async function deviceRoutes(fastify: FastifyInstance) {
  
  // Register a new device for the current user
  fastify.post('/register', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authHeader = request.headers.authorization;
      if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });
      
      const token = authHeader.split(' ')[1];
      const decoded = verifyToken(token);
      if (!decoded || !decoded.userId) return reply.code(401).send({ error: 'Invalid token' });

      const { name } = request.body as any || {};
      const deviceName = name || 'Remote PC';

      // Check if this machine (by name) is already registered for this user
      const existing = await prisma.device.findFirst({
        where: { 
          ownerId: decoded.userId,
          name: deviceName
        }
      });

      if (existing) {
        return reply.code(200).send(existing);
      }

      // Generate strictly unique 9-digit key
      let accessKey = generateAccessKey();
      while (await prisma.device.findUnique({ where: { accessKey } })) {
        accessKey = generateAccessKey();
      }

      const device = await prisma.device.create({
        data: {
          accessKey,
          ownerId: decoded.userId,
          name: deviceName
        }
      });

      return reply.code(201).send(device);
    } catch (err: any) {
      console.error('[Device Registration Error]', err);
      return reply.code(500).send({ error: 'Failed to register device: ' + err.message });
    }
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

    return reply.send({ accessKey: updated.accessKey });
  });

  // Get all devices for the current user
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

    // Rate Limiting: 10 requests per minute per IP
    const ip = request.ip || 'unknown';
    const rlKey = `rl:status:${ip}`;
    const reqs = await redisPublisher.incr(rlKey);
    if (reqs === 1) await redisPublisher.expire(rlKey, 60);
    if (reqs > 10) return reply.code(429).send({ error: 'Too many requests' });

    const device = await prisma.device.findUnique({ where: { accessKey: key } });
    if (!device) return reply.code(404).send({ exists: false, error: 'Device not found' });

    // Check Presence Registry
    const presence = await redisPublisher.get(`presence:${key}`);
    const online = presence === 'online';

    return reply.send({ exists: true, online });
  });

  // Verify access key + password and return 60s JWT (Viewer Step 2)
  fastify.post('/verify-access', async (request: FastifyRequest, reply: FastifyReply) => {
    let { accessKey, password } = request.body as any;
    if (!accessKey || !password) return reply.code(400).send({ error: 'Access Key and password required' });
    accessKey = String(accessKey).replace(/\s/g, '');

    // Check Redis Lockout
    const lockoutKey = `lockout:${accessKey}`;
    const attempts = await redisPublisher.get(lockoutKey);
    if (attempts && parseInt(attempts) >= 5) {
      const ttl = await redisPublisher.ttl(lockoutKey);
      return reply.code(429).send({ error: 'Too many attempts', retryAfter: ttl });
    }

    const device = await prisma.device.findUnique({ where: { accessKey } });
    if (!device || !device.accessPasswordHash) {
      return reply.code(404).send({ error: 'Device not found or password not set' });
    }

    // Check online status
    const presence = await redisPublisher.get(`presence:${accessKey}`);
    if (presence !== 'online') {
      return reply.code(409).send({ error: 'Device is offline' });
    }

    const isMatch = await bcrypt.compare(password, device.accessPasswordHash);
    if (!isMatch) {
      // Increment failed attempts
      const fails = await redisPublisher.incr(lockoutKey);
      if (fails === 1) await redisPublisher.expire(lockoutKey, 300); // 5 mins
      return reply.code(401).send({ error: 'Incorrect password' });
    }

    // Success, clear lockout
    await redisPublisher.del(lockoutKey);

    // Generate short-lived token (60 seconds)
    const accessJWT = generateToken({ 
      type: 'remote-access', 
      deviceId: device.id, 
      accessKey: device.accessKey 
    }, '60s');

    return reply.send({ token: accessJWT, device: { id: device.id, name: device.name } });
  });
}
