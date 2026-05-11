import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import bcrypt from 'bcryptjs';
import { prisma, redisPublisher, generateToken, verifyToken, checkPlanLimit } from '@remotelink/shared';
import { randomInt } from 'crypto';

// Helper to generate 9-digit CSPRNG key
function generateAccessKey(): string {
  return randomInt(0, 1000000000).toString().padStart(9, '0');
}

function generateAccessPassword(): string {
  return randomInt(0, 100000000).toString().padStart(8, '0');
}

async function generateUniqueAccessKey(): Promise<string> {
  let accessKey = generateAccessKey();
  while (await prisma.device.findUnique({ where: { accessKey } })) {
    accessKey = generateAccessKey();
  }
  return accessKey;
}

async function mapDevice(device: any, userId: string): Promise<any> {
  const cleanKey = String(device.accessKey).replace(/\s/g, '');
  const presence = await redisPublisher.get(`presence:${cleanKey}`);

  // Handle nested organization info if present (from includes)
  const org = device.organization || device.owner?.organization || null;

  return {
    id: device.id,
    device_name: device.name,
    device_type: (device.deviceType || 'DESKTOP').toLowerCase(),
    access_key: device.accessKey,
    last_seen_at: device.lastSeenAt,
    is_online: presence === 'online',
    is_owned: device.ownerId === userId,
    has_password: !!device.accessPasswordHash,
    password_required: device.passwordRequired !== false,
    tags: device.tags || [],
    org_name: org?.name || null,
    org_slug: org?.slug || null,
    org_id: org?.id || null
  };
}

// Helper to check device access based on role/tags/deviceIds
function hasDevicePermission(user: any, device: any): boolean {
  if (user.role === 'PLATFORM_OWNER') return true;
  if (user.organizationId !== device.organizationId) return false;
  if (user.role === 'SUPER_ADMIN') return true;

  // Full org access granted explicitly
  if (user.allowedDeviceIds?.includes('__all__')) return true;

  // Tag-based access
  if (user.allowedTags?.length > 0) {
    if (user.allowedTags.some((tag: string) => device.tags.includes(tag))) return true;
  }

  // Specific device access
  if (user.allowedDeviceIds?.length > 0) {
    if (user.allowedDeviceIds.includes(device.id)) return true;
  }

  // No access granted — default deny
  return false;
}

export default async function deviceRoutes(fastify: FastifyInstance) {

  // 0. Add Existing Device (Moved to top for matching priority)
  fastify.post('/add-existing', { preHandler: [checkPlanLimit('maxDevices')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) return reply.code(401).send({ error: 'Invalid token' });

    let { accessKey, password, name, tags } = request.body as any;
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

    // Update device name/tags if provided
    if (name || (tags && Array.isArray(tags))) {
      await prisma.device.update({
        where: { id: device.id },
        data: {
          name: name || undefined,
          tags: (tags && Array.isArray(tags)) ? { set: tags } : undefined
        }
      });
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

    const passwordRequired = device.passwordRequired !== false;

    if (passwordRequired && !device.accessPasswordHash) {
      console.log(`[Device-Debug] verify-access: Device found but has no accessPasswordHash: ${accessKey}`);
      return reply.code(404).send({ error: 'Device has no access password set yet. Go to host settings and set one.' });
    }

    // Role-based check
    const authHeader = request.headers.authorization;
    if (authHeader) {
      const token = authHeader.split(' ')[1];
      const decodedUser = verifyToken(token);
      if (decodedUser) {
        if (decodedUser.role === 'VIEWER') {
          return reply.code(403).send({ error: 'Viewer accounts are not allowed to connect to devices' });
        }
        // Remote support: do not gate on org/device ACL here — password + trust + rate limits apply below.
      }
    }

    const presence = await redisPublisher.get(`presence:${accessKey}`);
    if (presence !== 'online') {
      return reply.code(409).send({ error: 'Device is offline' });
    }

    // Check if user is trusted (Passwordless bypass)
    let isTrusted = false;
    let viewerUserId: string | null = null;
    if (authHeader) {
      const token = authHeader.split(' ')[1];
      const decodedUser = verifyToken(token);
      if (decodedUser && decodedUser.userId) {
        viewerUserId = decodedUser.userId;
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

    if (!isTrusted && passwordRequired) {
      if (!password) return reply.code(401).send({ error: 'Password required for untrusted device connections' });
      if (!device.accessPasswordHash) {
        return reply.code(404).send({ error: 'Device has no access password set yet. Go to host settings and set one.' });
      }

      const lockoutKey = `lockout:${accessKey}`;
      const attempts = await redisPublisher.get(lockoutKey);
      if (attempts && parseInt(attempts) >= 5) {
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

    }

    const accessJWT = generateToken({
      type: 'remote-access',
      deviceId: device.id,
      accessKey: device.accessKey,
      viewerUserId,
      isTrusted
    }, '5m');

    return reply.send({ token: accessJWT, device: { id: device.id, name: device.name, isTrusted, passwordRequired } });
  });

  // 1. Register a new device for the current user or organization
  fastify.post('/register', { preHandler: [checkPlanLimit('maxDevices')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    console.log(`[Device-Debug] Registration attempt received`);
    try {
      const authHeader = request.headers.authorization;
      if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });

      const token = authHeader.split(' ')[1];
      const decoded = verifyToken(token);
      if (!decoded || !decoded.userId) return reply.code(401).send({ error: 'Invalid token' });

      const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
      if (!user) return reply.code(401).send({ error: 'User not found' });

      const { name, deviceType, enrollmentToken } = request.body as any || {};
      const deviceName = name || 'Remote PC';
      const validDeviceType = ['WINDOWS', 'MACOS', 'LINUX', 'IOS', 'ANDROID'].includes(deviceType?.toUpperCase()) ? deviceType.toUpperCase() : 'WINDOWS';

      let organizationId = user.organizationId;
      let departmentId = user.departmentId;

      // Handle Enrollment Token
      if (enrollmentToken) {
        const et = await prisma.enrollmentToken.findUnique({ where: { token: enrollmentToken } });
        if (!et) return reply.code(400).send({ error: 'Invalid enrollment token' });
        if (et.expiresAt && et.expiresAt < new Date()) return reply.code(400).send({ error: 'Enrollment token expired' });

        organizationId = et.organizationId;
        departmentId = et.departmentId || departmentId;
        console.log(`[Device-Debug] Enrolling device into Org: ${organizationId}`);
      }

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
        // If the access key belongs to another user, do not take it over.
        // Unowned self-registered devices can be claimed by the signed-in installer.
        if (existing.ownerId && existing.ownerId !== decoded.userId) {
          console.warn(`[Device-Debug] Conflict: Access key ${accessKey} is already owned by another user (${existing.ownerId}). Generating a new one for user ${decoded.userId}.`);
          existing = null; // Proceed as if not found to generate a new key
        } else {
          let updateData: any = {};
          if (!existing.ownerId) {
            updateData.ownerId = decoded.userId;
            updateData.organizationId = organizationId;
            updateData.departmentId = departmentId;
          }

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
            updateData.accessPasswordHash = await bcrypt.hash(password, 10);
          }

          if (Object.keys(updateData).length > 0) {
            existing = await prisma.device.update({ where: { id: existing.id }, data: updateData });
          }

          const mapped = await mapDevice(existing, decoded.userId);
          return reply.code(200).send(mapped);
        }
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
          organizationId,
          departmentId,
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

    // 1. Fetch devices owned by Organization (for Org Admins/Super Admins)
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) return reply.code(401).send({ error: 'User not found' });

    const deviceInclude = {
      organization: { select: { id: true, name: true, slug: true } },
      owner: {
        select: {
          organization: { select: { id: true, name: true, slug: true } }
        }
      }
    };

    let orgDevices: any[] = [];
    if (user.role === 'SUPER_ADMIN') {
      orgDevices = await prisma.device.findMany({ include: deviceInclude });
    } else if (user.organizationId) {
      // Find devices in org that match user's permissions
      const allOrgDevices = await prisma.device.findMany({
        where: { organizationId: user.organizationId },
        include: deviceInclude
      });
      orgDevices = allOrgDevices.filter((d: any) => hasDevicePermission(user, d));
    }

    // 2. Fetch devices personally owned (legacy/personal fallback)
    const ownedDevices = await prisma.device.findMany({
      where: { ownerId: decoded.userId },
      include: deviceInclude
    });

    // Fetch saved devices
    const savedRelations = await prisma.savedDevice.findMany({
      where: { userId: decoded.userId },
      include: {
        device: {
          include: deviceInclude
        }
      }
    });
    const savedDevices = savedRelations.map((s: any) => s.device);

    // Combine them
    const allDevicesMap = new Map();
    [...orgDevices].forEach(d => allDevicesMap.set(d.id, { ...d, _isOwned: d.ownerId === decoded.userId }));
    [...ownedDevices].forEach(d => {
      if (!allDevicesMap.has(d.id)) allDevicesMap.set(d.id, { ...d, _isOwned: true });
    });
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

  // Super Admin: all devices across all organizations (with org context)
  fastify.get('/all', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded || decoded.role !== 'SUPER_ADMIN') {
      return reply.code(403).send({ error: 'Super Admin access required' });
    }

    const devices = await prisma.device.findMany({
      include: {
        organization: { select: { id: true, name: true, slug: true } },
        owner: {
          select: {
            organization: { select: { id: true, name: true, slug: true } }
          }
        }
      },
      orderBy: { lastSeenAt: 'desc' }
    });

    const enrichedDevices = await Promise.all(devices.map(async (device: any) => {
      return mapDevice(device, decoded.userId);
    }));

    enrichedDevices.sort((a: any, b: any) => {
      if (a.is_online && !b.is_online) return -1;
      if (!a.is_online && b.is_online) return 1;
      return 0;
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
    const { deviceId, password, passwordRequired } = request.body as any;

    if (!deviceId || (!password && typeof passwordRequired !== 'boolean')) {
      return reply.code(400).send({ error: 'DeviceID and password or passwordRequired setting required' });
    }

    const device = await prisma.device.findUnique({ where: { id: deviceId } });
    if (!device || (device.ownerId !== decoded.userId && decoded.role !== 'SUPER_ADMIN')) {
      return reply.code(403).send({ error: 'Not authorized for this device' });
    }

    const updateData: any = {};
    if (password) {
      const salt = await bcrypt.genSalt(12);
      updateData.accessPasswordHash = await bcrypt.hash(password, salt);
    }
    if (typeof passwordRequired === 'boolean') {
      updateData.passwordRequired = passwordRequired;
    }

    await prisma.device.update({
      where: { id: deviceId },
      data: updateData
    });

    return reply.send({ success: true });
  });

  // 8. Update Device Tags (Grouping)
  fastify.patch('/:id/tags', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) return reply.code(401).send({ error: 'Invalid token' });

    const { id } = request.params as { id: string };
    const { tags } = request.body as { tags: string[] };

    if (!Array.isArray(tags)) return reply.code(400).send({ error: 'tags must be an array of strings' });

    const device = await prisma.device.findUnique({ where: { id } });
    if (!device) return reply.code(404).send({ error: 'Device not found' });

    // Only owner or admin can update tags
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) return reply.code(401).send({ error: 'User not found' });

    if (device.ownerId !== user.id && user.role !== 'SUPER_ADMIN' && user.role !== 'PLATFORM_OWNER') {
      return reply.code(403).send({ error: 'Not authorized to manage tags for this device' });
    }

    const updated = await prisma.device.update({
      where: { id },
      data: { tags }
    });

    return reply.send({ success: true, tags: updated.tags });
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

    return reply.send({ exists: true, online, password_required: device.passwordRequired !== false });
  });

  // POST /connect/lookup (Guest Viewer Step 1)
  fastify.post('/connect/lookup', async (request: FastifyRequest, reply: FastifyReply) => {
    const { accessKey } = request.body as any;
    if (!accessKey) return reply.code(400).send({ error: 'Access Key required' });
    const key = String(accessKey).replace(/\s/g, '');

    const device = await prisma.device.findUnique({ where: { accessKey: key }, select: { id: true, name: true, accessKey: true, passwordRequired: true, ownerId: true } });
    if (!device) return reply.code(404).send({ exists: false, error: 'No machine found with that access key' });

    const presence = await redisPublisher.get(`presence:${key}`);
    const online = presence === 'online';
    if (!online) return reply.code(409).send({ exists: true, online: false, error: 'That machine is offline. Ask the owner to open RemoteLink and check their connection.' });

    let isTrusted = false;
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const decoded = verifyToken(authHeader.replace('Bearer ', ''));
      if (decoded?.userId) {
        if (device.ownerId === decoded.userId) {
          isTrusted = true;
        } else {
          const trustCheck = await prisma.trustedDevice.findUnique({
            where: { viewerUserId_hostDeviceId: { viewerUserId: decoded.userId, hostDeviceId: device.id } }
          });
          isTrusted = Boolean(trustCheck);
        }
      }
    }

    return reply.send({ exists: true, online: true, name: device.name, password_required: !isTrusted && device.passwordRequired !== false, trusted: isTrusted });
  });

  // POST /self-register — unauthenticated host bootstrap
  // Registers this machine in the DB so viewers can look it up.
  // Idempotent: safe to call on every app start.
  fastify.post('/self-register', async (request: FastifyRequest, reply: FastifyReply) => {
    let { accessKey, name, password, passwordRequired } = request.body as any;
    accessKey = accessKey ? String(accessKey).replace(/\s/g, '') : '';
    const machineName = String(name || 'Unknown Machine').slice(0, 64);
    let installerUser: any = null;
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const decoded = verifyToken(authHeader.replace('Bearer ', ''));
      if (decoded?.userId) {
        installerUser = await prisma.user.findUnique({ where: { id: decoded.userId } });
      }
    }

    const existing = accessKey
      ? await prisma.device.findUnique({ where: { accessKey } })
      : null;

    if (existing) {
      const updateData: any = {};
      let autoPassword: string | undefined;
      if (!existing.ownerId && installerUser) {
        updateData.ownerId = installerUser.id;
        updateData.organizationId = installerUser.organizationId;
        updateData.departmentId = installerUser.departmentId;
      }
      if (machineName && machineName !== existing.name) updateData.name = machineName;
      if (typeof passwordRequired === 'boolean') {
        updateData.passwordRequired = passwordRequired;
      }
      if (password) {
        updateData.accessPasswordHash = await bcrypt.hash(String(password), 10);
      } else if (!existing.accessPasswordHash && existing.passwordRequired !== false) {
        autoPassword = generateAccessPassword();
        updateData.accessPasswordHash = await bcrypt.hash(autoPassword, 10);
      }
      const updated = Object.keys(updateData).length > 0
        ? await prisma.device.update({ where: { id: existing.id }, data: updateData })
        : existing;
      return reply.send({
        id: updated.id,
        access_key: updated.accessKey,
        name: updated.name,
        has_password: !!updated.accessPasswordHash,
        password_required: updated.passwordRequired !== false,
        auto_password: !password ? autoPassword : undefined,
      });
    }

    if (!accessKey) {
      accessKey = await generateUniqueAccessKey();
    } else if (await prisma.device.findUnique({ where: { accessKey } })) {
      accessKey = await generateUniqueAccessKey();
    }

    // New device: server issues a reusable access password when the app has none yet.
    const requiresPassword = typeof passwordRequired === 'boolean' ? passwordRequired : true;
    const autoPassword = password ? String(password) : (requiresPassword ? generateAccessPassword() : '');
    const passwordHash = autoPassword ? await bcrypt.hash(autoPassword, 10) : null;

    const device = await prisma.device.create({
      data: {
        accessKey,
        name: machineName,
        accessPasswordHash: passwordHash,
        passwordRequired: requiresPassword,
        ownerId: installerUser?.id,
        organizationId: installerUser?.organizationId,
        departmentId: installerUser?.departmentId,
      },
    });

    return reply.code(201).send({
      id: device.id,
      access_key: device.accessKey,
      name: device.name,
      has_password: !!device.accessPasswordHash,
      password_required: device.passwordRequired !== false,
      // Only returned on first registration so the app can display it to the user
      auto_password: !password && autoPassword ? autoPassword : undefined,
    });
  });

}
