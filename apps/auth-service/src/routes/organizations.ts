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

  // 3. Get my Org info (SUB_ADMIN / USER)
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
}
