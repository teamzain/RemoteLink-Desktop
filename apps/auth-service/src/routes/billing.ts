import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { prisma, verifyToken } from '@remotelink/shared';

export const PLAN_CATALOG = [
  {
    id: 'FREE',
    name: 'Free',
    price: 0,
    priceLabel: '$0 / month',
    description: 'For individuals getting started',
    maxDevices: 1,
    maxUsers: 1,
    features: [
      'P2P remote access',
      'Basic file transfer',
      'Standard quality (720p)',
      'Community support',
    ],
  },
  {
    id: 'PRO',
    name: 'Pro',
    price: 29,
    priceLabel: '$29 / month',
    description: 'For small teams',
    maxDevices: 5,
    maxUsers: 5,
    features: [
      'Everything in Free',
      'HD streaming (1080p)',
      'Session recording',
      'Priority support',
      'Custom device tags',
    ],
  },
  {
    id: 'BUSINESS',
    name: 'Business',
    price: 99,
    priceLabel: '$99 / month',
    description: 'For growing organizations',
    maxDevices: 25,
    maxUsers: 25,
    features: [
      'Everything in Pro',
      '4K / 60fps streaming',
      'Team management',
      'Role-based access control',
      'Audit logs',
      'SSO integration',
    ],
  },
  {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    price: null,
    priceLabel: 'Custom pricing',
    description: 'For large-scale deployments',
    maxDevices: null,
    maxUsers: null,
    features: [
      'Everything in Business',
      'Dedicated relay servers',
      'SLA guarantee',
      'Custom branding',
      'On-premise deployment',
      'Dedicated account manager',
    ],
  },
];

export default async function billingRoutes(fastify: FastifyInstance) {

  // GET /api/billing/plans — public plan catalog
  fastify.get('/plans', async (_request, reply) => {
    return reply.send(PLAN_CATALOG);
  });

  // GET /api/billing/subscription — current user's subscription
  fastify.get('/subscription', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded?.userId) return reply.code(401).send({ error: 'Invalid token' });

    let sub = await prisma.subscription.findUnique({ where: { userId: decoded.userId } });

    // Auto-create FREE subscription if missing
    if (!sub) {
      sub = await prisma.subscription.create({
        data: { userId: decoded.userId, plan: 'FREE', status: 'ACTIVE' }
      });
    }

    const catalog = PLAN_CATALOG.find(p => p.id === sub!.plan) || PLAN_CATALOG[0];

    return reply.send({
      plan: sub.plan,
      status: sub.status,
      currentPeriodEnd: sub.currentPeriodEnd,
      catalog,
      testMode: true,
    });
  });

  // PATCH /api/billing/set-plan — SUPER_ADMIN assigns a plan to any user (test mode, no Stripe)
  fastify.patch('/set-plan', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded || decoded.role !== 'SUPER_ADMIN') {
      return reply.code(403).send({ error: 'Super Admin access required' });
    }

    const { userId, plan } = request.body as { userId: string; plan: string };
    const validPlans = ['FREE', 'PRO', 'BUSINESS', 'ENTERPRISE'];
    if (!userId || !validPlans.includes(plan)) {
      return reply.code(400).send({ error: 'userId and a valid plan are required' });
    }

    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) return reply.code(404).send({ error: 'User not found' });

    const sub = await prisma.subscription.upsert({
      where: { userId },
      update: { plan: plan as any, status: 'ACTIVE' },
      create: { userId, plan: plan as any, status: 'ACTIVE' },
    });

    return reply.send({ success: true, plan: sub.plan, userId });
  });

  // PATCH /api/billing/my-plan — SUB_ADMIN self-serves plan change (test mode)
  fastify.patch('/my-plan', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded?.userId) return reply.code(401).send({ error: 'Invalid token' });

    const { plan } = request.body as { plan: string };
    const validPlans = ['FREE', 'PRO', 'BUSINESS', 'ENTERPRISE'];
    if (!validPlans.includes(plan)) {
      return reply.code(400).send({ error: 'Invalid plan' });
    }

    const sub = await prisma.subscription.upsert({
      where: { userId: decoded.userId },
      update: { plan: plan as any, status: 'ACTIVE' },
      create: { userId: decoded.userId, plan: plan as any, status: 'ACTIVE' },
    });

    return reply.send({ success: true, plan: sub.plan });
  });
}
