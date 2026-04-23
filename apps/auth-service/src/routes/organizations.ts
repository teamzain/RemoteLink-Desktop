import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { prisma, verifyToken } from '@remotelink/shared';

export default async function organizationRoutes(fastify: FastifyInstance) {

  // Helper to verify Super Admin
  const requireSuperAdmin = async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      reply.code(401).send({ error: 'Unauthorized' });
      return false;
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    if (!decoded || decoded.role !== 'SUPER_ADMIN') {
      reply.code(403).send({ error: 'Super Admin access required' });
      return false;
    }

    return decoded;
  };

  // 1. Create Organization (SUPER_ADMIN ONLY)
  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const decoded = await requireSuperAdmin(request, reply);
    if (!decoded) return;

    const { name, slug } = request.body as { name: string; slug: string };
    if (!name || !slug) {
      return reply.code(400).send({ error: 'Name and slug are required' });
    }

    try {
      const org = await prisma.organization.create({
        data: { name, slug }
      });

      return reply.code(201).send(org);
    } catch (err: any) {
      if (err.code === 'P2002') {
        return reply.code(400).send({ error: 'Organization slug already exists' });
      }
      throw err;
    }
  });

  // 2. List all Organizations (SUPER_ADMIN ONLY)
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const decoded = await requireSuperAdmin(request, reply);
    if (!decoded) return;

    const orgs = await prisma.organization.findMany({
      include: {
        _count: {
          select: { users: true, devices: true }
        }
      }
    });

    return reply.send(orgs);
  });

  // 3. Get single Org detail (SUPER_ADMIN ONLY) — members, devices, plan
  fastify.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const decoded = await requireSuperAdmin(request, reply);
    if (!decoded) return;

    const { id } = request.params as { id: string };

    const org = await prisma.organization.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            createdAt: true,
            subscription: { select: { plan: true, status: true } }
          },
          orderBy: { createdAt: 'asc' }
        },
        devices: {
          select: {
            id: true,
            name: true,
            deviceType: true,
            status: true,
            lastSeenAt: true,
            accessKey: true,
            tags: true
          },
          orderBy: { lastSeenAt: 'desc' }
        },
        _count: { select: { users: true, devices: true } }
      }
    });

    if (!org) return reply.code(404).send({ error: 'Organization not found' });

    // Derive plan from the org owner (SUB_ADMIN) subscription
    const admin = org.users.find((u: any) => u.role === 'SUB_ADMIN');
    const plan = (admin as any)?.subscription?.plan || 'FREE';

    return reply.send({ ...org, plan });
  });

  // 4. Delete Organization (SUPER_ADMIN ONLY)
  fastify.delete('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const decoded = await requireSuperAdmin(request, reply);
    if (!decoded) return;

    const { id } = request.params as { id: string };

    try {
      await prisma.$transaction(async (tx: any) => {
        // 1. Dissociate users from this organization
        await tx.user.updateMany({
          where: { organizationId: id },
          data: { organizationId: null, role: 'USER' }
        });

        // 2. Dissociate devices from this organization
        await tx.device.updateMany({
          where: { organizationId: id },
          data: { organizationId: null }
        });

        // 3. Delete related entities that cannot exist without an organization
        await tx.enrollmentToken.deleteMany({ where: { organizationId: id } });
        await tx.invitation.deleteMany({ where: { organizationId: id } });
        await tx.department.deleteMany({ where: { organizationId: id } });

        // 4. Finally delete the organization itself
        await tx.organization.delete({ where: { id } });
      });

      return reply.send({ success: true });
    } catch (err: any) {
      const server = (fastify as any).log || console;
      server.error(`[Auth-Service] Failed to delete organization ${id}:`, err);
      return reply.code(500).send({ error: 'Failed to delete organization' });
    }
  });

  // 5. Update Organization name/slug (SUPER_ADMIN ONLY)
  fastify.patch('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const decoded = await requireSuperAdmin(request, reply);
    if (!decoded) return;

    const { id } = request.params as { id: string };
    const { name, slug } = request.body as any;

    try {
      const org = await prisma.organization.update({
        where: { id },
        data: { ...(name && { name }), ...(slug && { slug }) }
      });
      return reply.send(org);
    } catch (err: any) {
      if (err.code === 'P2002') return reply.code(400).send({ error: 'Slug already taken' });
      return reply.code(500).send({ error: 'Failed to update organization' });
    }
  });

  // 6. Get my Org info (SUB_ADMIN / USER)
  fastify.get('/mine', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) return reply.code(401).send({ error: 'Invalid token' });

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        organization: {
          include: {
            departments: true,
            _count: { select: { users: true, devices: true } }
          }
        }
      }
    });

    if (!user?.organization) {
      return reply.code(404).send({ error: 'No organization joined yet' });
    }

    return reply.send(user.organization);
  });

  // 7. Update my Org settings (SUB_ADMIN ONLY)
  fastify.patch('/mine', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded || (decoded.role !== 'SUB_ADMIN' && decoded.role !== 'SUPER_ADMIN')) {
      return reply.code(403).send({ error: 'Org Admin access required' });
    }

    const { defaultMemberRole, require2FA } = request.body as any;
    const updateData: any = {};
    if (defaultMemberRole) updateData.defaultMemberRole = defaultMemberRole;
    if (require2FA !== undefined) updateData.require2FA = require2FA;

    const org = await prisma.organization.update({
      where: { id: decoded.orgId },
      data: updateData
    });

    return reply.send(org);
  });
}
