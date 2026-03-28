import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '@remotelink/shared';
import { issueTokens } from '../utils/token-utils';

export default async function oauthRoutes(fastify: FastifyInstance) {
  fastify.get('/google', async (request: FastifyRequest, reply: FastifyReply) => {
    // Placeholder to simulate start of Google OAuth
    return reply.send({ message: 'Redirecting to Google...' });
  });

  fastify.get('/google/callback', async (request: FastifyRequest, reply: FastifyReply) => {
    const { platform } = request.query as any;
    
    // Simulate finding/creating a user after successful Google OAuth
    let user = await prisma.user.findFirst(); // Mock user for demo
    if (!user) return reply.code(400).send({ error: 'No test user found for OAuth demo' });

    const tokens = await issueTokens(user);

    if (platform === 'desktop') {
      // Deep link redirection for Electron
      const redirectUrl = `remotelink://auth/callback?accessToken=${tokens.accessToken}&refreshToken=${tokens.refreshToken}`;
      return reply.redirect(redirectUrl);
    }

    // Default web redirection
    const webRedirectUrl = `${process.env.WEB_APP_URL || 'http://localhost:3000'}/dashboard?accessToken=${tokens.accessToken}&refreshToken=${tokens.refreshToken}`;
    return reply.redirect(webRedirectUrl);
  });

  fastify.get('/github', async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ message: 'Redirecting to GitHub...' });
  });

  fastify.get('/github/callback', async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ message: 'GitHub OAuth callback placeholder' });
  });
}
