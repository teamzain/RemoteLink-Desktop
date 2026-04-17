import { generateToken, prisma } from '@remotelink/shared';

export const ACCESS_TOKEN_EXPIRY = '24h';
export const REFRESH_TOKEN_EXPIRY = '7d';
export const EXPIRY_SECONDS = 86400;

export async function issueTokens(user: any) {
  // Ensure subscription row exists and fetch the plan
  let sub = await prisma.subscription.findUnique({ where: { userId: user.id } });
  if (!sub) {
    sub = await prisma.subscription.create({
      data: { userId: user.id, plan: 'SOLO', status: 'ACTIVE' }
    });
  }
  const plan = sub.plan || 'SOLO';

  const accessToken = generateToken({
    userId: user.id,
    role: user.role,
    orgId: user.organizationId
  }, ACCESS_TOKEN_EXPIRY);
  const refreshToken = generateToken({
    userId: user.id,
    role: user.role,
    orgId: user.organizationId,
    type: 'refresh'
  } as any, REFRESH_TOKEN_EXPIRY);

  return {
    accessToken,
    refreshToken,
    expiresIn: EXPIRY_SECONDS,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      plan,
      role: user.role,
      organizationId: user.organizationId,
      avatar: user.avatar || null
    }
  };
}
