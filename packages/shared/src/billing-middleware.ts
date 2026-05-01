import { FastifyReply, FastifyRequest } from 'fastify';
import { prisma, verifyToken } from './index'; // assuming index exports these

export enum Plan {
  TRIAL = 'TRIAL',
  SOLO = 'SOLO',
  PRO = 'PRO',
  BUSINESS = 'BUSINESS',
  ENTERPRISE = 'ENTERPRISE'
}

export type LimitName = 'maxConcurrentSessions' | 'maxDevices' | 'sessionDurationMinutes' | 'fileTransfer' | 'sessionRecording' | 'teamMembers';

export async function getPlanLimits(userId: string) {
  // 1. Try to find user's personal subscription
  let sub = await (prisma as any).subscription.findUnique({
    where: { userId },
    include: { user: true }
  });

  // 2. If missing, and user is in an organization, fall back to the organization's SUPER_ADMIN subscription
  if (!sub) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true }
    });

    if (user?.organizationId) {
      const owner = await prisma.user.findFirst({
        where: { organizationId: user.organizationId, role: 'SUPER_ADMIN' },
        include: { subscription: true },
        orderBy: { createdAt: 'asc' }
      });
      if (owner?.subscription) {
        sub = owner.subscription as any;
      }
    }
  }

  const currentPlan = sub?.plan || 'TRIAL';

  const limits = await (prisma as any).planLimit.findUnique({
    where: { plan: currentPlan as any }
  });

  return { plan: currentPlan, limits, sub };
}

export function checkPlanLimit(limitName: LimitName) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    console.log(`[Billing-Middleware] Checking limit: ${limitName} for ${request.url}`);
    try {
      const authHeader = request.headers.authorization;
      if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });

      const token = authHeader.split(' ')[1];
      const decoded = verifyToken(token);
      if (!decoded || !decoded.userId) return reply.code(401).send({ error: 'Invalid token' });

      const userId = decoded.userId;
      const { plan: currentPlan, limits, sub } = await getPlanLimits(userId);

      if (!limits) {
        return reply.code(500).send({ error: 'Plan limits not configured' });
      }

      // --- 1. Lifetime Trial Check for TRIAL users who haven't paid ---
      const isTrial = currentPlan === 'TRIAL';

      if (isTrial) {
        // Enforce 5-minute trial from Subscription.currentPeriodEnd
        if (sub && sub.currentPeriodEnd && new Date() > sub.currentPeriodEnd) {
          return reply.code(403).send({
            error: 'Trial Expired: Your 5-minute testing period has ended. Please purchase a plan to continue using RemoteLink.',
            trialExpired: true,
            currentPeriodEnd: sub.currentPeriodEnd
          });
        }
      }

      const limitValue = (limits as any)[limitName];

      // --- 2. Dynamic checks based on limitName ---
      if (limitName === 'maxConcurrentSessions') {
        const activeSessions = await (prisma as any).session.count({
          where: { viewerId: userId, status: 'ACTIVE' }
        });
        if (activeSessions >= limitValue && limitValue !== -1) {
          return reply.code(403).send({
            error: `Plan limit reached: Max concurrent sessions for ${currentPlan} is ${limitValue}. Upgrade for more.`,
            limitReached: true,
            limitName
          });
        }
      }

      if (limitName === 'maxDevices') {
        const deviceCount = await (prisma as any).device.count({
          where: { ownerId: userId }
        });
        if (deviceCount >= limitValue && limitValue !== -1) {
          return reply.code(403).send({
            error: `Plan limit reached: Max devices for ${currentPlan} is ${limitValue}. Upgrade your plan to add more computers.`,
            limitReached: true,
            limitName
          });
        }
      }

      if (limitName === 'sessionRecording' || limitName === 'fileTransfer') {
        if (!limitValue) {
          return reply.code(403).send({
            error: `${limitName === 'sessionRecording' ? 'Session Recording' : 'File Transfer'} is not available on the ${currentPlan} plan. Please upgrade.`,
            limitReached: true,
            limitName
          });
        }
      }

      // If all checks pass, continue
    } catch (err) {
      console.error('[Billing Middleware Error]', err);
      // Fail open or closed? Usually closed for billing.
      return reply.code(500).send({ error: 'Failed to verify plan limits' });
    }
  };
}
