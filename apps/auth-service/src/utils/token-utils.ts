import { generateToken } from '@remotelink/shared';

export const ACCESS_TOKEN_EXPIRY = '24h';
export const REFRESH_TOKEN_EXPIRY = '7d';
export const EXPIRY_SECONDS = 86400;

export async function issueTokens(user: any) {
  const accessToken = generateToken({ userId: user.id, role: user.role }, ACCESS_TOKEN_EXPIRY);
  const refreshToken = generateToken({ userId: user.id, role: user.role, type: 'refresh' } as any, REFRESH_TOKEN_EXPIRY);

  return {
    accessToken,
    refreshToken,
    expiresIn: EXPIRY_SECONDS,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan || 'FREE',
      avatar: user.avatar || null
    }
  };
}
