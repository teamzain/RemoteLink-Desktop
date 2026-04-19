import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { prisma, verifyToken } from '@remotelink/shared';

export default async function adminSettingsRoutes(fastify: FastifyInstance) {
  // Middleware to ensure user is SUPER_ADMIN
  fastify.addHook('preHandler', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded || decoded.role !== 'SUPER_ADMIN') {
      return reply.code(403).send({ error: 'Forbidden: Admin access required' });
    }
    (request as any).user = decoded;
  });

  // GET /api/admin/settings
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    let settings = await prisma.platformSettings.findFirst();
    if (!settings) {
      // Initialize with defaults if not exists
      settings = await prisma.platformSettings.create({
        data: {} // Uses schema defaults
      });
    }
    return reply.send(settings);
  });

  // PATCH /api/admin/settings
  fastify.patch('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const data = request.body as any;
    
    // Clean data to match schema
    const updateData: any = {};
    const allowedFields = [
      'defaultRelayUrl', 'maxSessionDuration', 'maintenanceMode', 
      'maintenanceMessage', 'forceSubAdmin2FA', 'globalTokenLifetime', 
      'minPasswordLength', 'maxPasswordLength', 'defaultOrgPlan', 'restrictPlanChanges'
    ];

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        updateData[field] = data[field];
      }
    }

    const settings = await prisma.platformSettings.upsert({
      where: { id: 1 },
      update: updateData,
      create: { ...updateData, id: 1 }
    });

    return reply.send(settings);
  });
}
