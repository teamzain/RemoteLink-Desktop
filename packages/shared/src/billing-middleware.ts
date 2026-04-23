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
  const sub = await (prisma as any).subscription.findUnique({
    where: { userId },
    include: { user: true }
  });

  const currentPlan = sub?.plan || 'TRIAL';

  const limits = await (prisma as any).planLimit.findUnique({
    where: { plan: currentPlan as any }
  });

  return { plan: currentPlan, limits };
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
      const { plan: currentPlan, limits } = await getPlanLimits(userId);

      if (!limits) {
        return reply.code(500).send({ error: 'Plan limits not configured' });
      }

      // --- 1. Lifetime Trial Check for TRIAL users who haven't paid ---
      const sub = await (prisma as any).subscription.findUnique({ where: { userId } });
      const isTrial = currentPlan === 'TRIAL';

      if (isTrial) {
        // Calculate total duration of all sessions for this viewer
        const sessions = await (prisma as any).session.findMany({
          where: { viewerId: userId, endTime: { not: null } }
        });

        const totalMinutes = sessions.reduce((acc: number, sess: any) => {
          const duration = (sess.endTime.getTime() - sess.startTime.getTime()) / 1000 / 60;
          return acc + duration;
        }, 0);

        if (totalMinutes >= 10) {
          return reply.code(403).send({
            error: 'Trial Expired: You has used your 10-minute testing period. Please purchase a plan to continue using RemoteLink.',
            trialExpired: true,
            totalMinutes
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
