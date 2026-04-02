import https from 'https';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '@remotelink/shared';
import { issueTokens } from '../utils/token-utils';

// ── Helpers ────────────────────────────────────────────────────────────────

function httpsPost(hostname: string, path: string, body: string, headers: Record<string, string>): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname, path, method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body), ...headers } },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try { resolve(JSON.parse(data)); } catch { reject(new Error(`Bad JSON: ${data}`)); }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function httpsGet(hostname: string, path: string, accessToken: string): Promise<any> {
  return new Promise((resolve, reject) => {
    https.get(
      { hostname, path, headers: { Authorization: `Bearer ${accessToken}` } },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try { resolve(JSON.parse(data)); } catch { reject(new Error(`Bad JSON: ${data}`)); }
        });
      }
    ).on('error', reject);
  });
}

// ── Routes ─────────────────────────────────────────────────────────────────

export default async function oauthRoutes(fastify: FastifyInstance) {

  // Step 1 — Redirect user to Google consent screen
  fastify.get('/google', async (request: FastifyRequest, reply: FastifyReply) => {
    const { platform } = request.query as { platform?: string };

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const callbackUrl = process.env.GOOGLE_CALLBACK_URL || 'http://159.65.84.190/api/auth/oauth/google/callback';

    if (!clientId) {
      return reply.code(500).send({ error: 'Google OAuth is not configured. Set GOOGLE_CLIENT_ID in environment.' });
    }

    const params = new URLSearchParams({
      client_id:     clientId,
      redirect_uri:  callbackUrl,
      response_type: 'code',
      scope:         'openid email profile',
      state:         platform || 'web',        // carry platform through OAuth round-trip
      access_type:   'offline',
      prompt:        'select_account',
    });

    return reply.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  });

  // Step 2 — Google redirects back here with ?code=...&state=...
  fastify.get('/google/callback', async (request: FastifyRequest, reply: FastifyReply) => {
    const { code, state, error } = request.query as { code?: string; state?: string; error?: string };

    if (error || !code) {
      return reply.code(400).send({ error: error || 'No authorization code received from Google' });
    }

    const clientId     = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const callbackUrl  = process.env.GOOGLE_CALLBACK_URL || 'http://159.65.84.190/api/auth/oauth/google/callback';
    const platform     = state || 'web';

    if (!clientId || !clientSecret) {
      return reply.code(500).send({ error: 'Google OAuth credentials not configured' });
    }

    try {
      // Exchange authorization code for Google tokens
      const tokenBody = new URLSearchParams({
        code,
        client_id:     clientId,
        client_secret: clientSecret,
        redirect_uri:  callbackUrl,
        grant_type:    'authorization_code',
      }).toString();

      const googleTokens = await httpsPost('oauth2.googleapis.com', '/token', tokenBody, {});

      if (googleTokens.error) {
        fastify.log.error(`Google token exchange failed: ${googleTokens.error_description}`);
        return reply.code(400).send({ error: `Google error: ${googleTokens.error_description}` });
      }

      // Fetch user profile from Google
      const googleUser = await httpsGet('www.googleapis.com', '/oauth2/v2/userinfo', googleTokens.access_token);

      if (!googleUser.email) {
        return reply.code(400).send({ error: 'Could not retrieve email from Google account' });
      }

      // Upsert user in our database
      let user = await prisma.user.findUnique({ where: { email: googleUser.email } });

      if (!user) {
        user = await prisma.user.create({
          data: {
            email: googleUser.email,
            name:  googleUser.name || googleUser.email.split('@')[0],
            // No password — social auth user
          },
        });

        // Create free subscription for new user
        try {
          await prisma.subscription.create({
            data: { userId: user.id, plan: 'FREE' },
          });
        } catch {}
      } else if (!user.name && googleUser.name) {
        // Backfill name if missing
        user = await prisma.user.update({
          where: { id: user.id },
          data:  { name: googleUser.name },
        });
      }

      // Issue our own JWT tokens
      const tokens = await issueTokens(user);

      // Redirect back to the client
      if (platform === 'desktop' || platform === 'mobile') {
        const deepLink = `remotelink://auth/callback?accessToken=${tokens.accessToken}&refreshToken=${tokens.refreshToken}`;
        return reply.redirect(deepLink);
      }

      // Web fallback
      const webUrl = `${process.env.WEB_APP_URL || 'http://localhost:3000'}/dashboard?accessToken=${tokens.accessToken}&refreshToken=${tokens.refreshToken}`;
      return reply.redirect(webUrl);

    } catch (err: any) {
      fastify.log.error(`Google OAuth callback error: ${err.message}`);
      return reply.code(500).send({ error: 'Authentication failed. Please try again.' });
    }
  });

  fastify.get('/github', async (_request, reply) => {
    return reply.send({ message: 'GitHub OAuth coming soon' });
  });

  fastify.get('/github/callback', async (_request, reply) => {
    return reply.send({ message: 'GitHub OAuth callback coming soon' });
  });
}
