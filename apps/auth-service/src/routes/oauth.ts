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

      // Search for user or create one
      let user = await prisma.user.findUnique({ where: { email: googleUser.email } });

      if (!user) {
        // SaaS ONBOARDING: Create Org + User as SUB_ADMIN
        const result = await prisma.$transaction(async (tx: any) => {
          const orgSlug = googleUser.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.random().toString(36).substring(2, 5);
          const org = await tx.organization.create({
            data: {
              name: googleUser.name ? `${googleUser.name}'s Workspace` : `${googleUser.email.split('@')[0]}'s Workspace`,
              slug: orgSlug
            }
          });

          return await tx.user.create({
            data: {
              email: googleUser.email,
              name: googleUser.name || googleUser.email.split('@')[0],
              role: 'SUB_ADMIN',
              organizationId: org.id
            }
          });
        });

        user = result;

        // Create initial subscription
        try {
          await prisma.subscription.create({
            data: { userId: user!.id, plan: 'FREE' },
          });
        } catch {}
      } else {
        // If user already exists but doesn't have an Org (legacy fix), promote them
        if (!user.organizationId) {
          user = await prisma.$transaction(async (tx: any) => {
            const orgSlug = user!.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.random().toString(36).substring(2, 5);
            const org = await tx.organization.create({
              data: {
                name: user!.name ? `${user!.name}'s Workspace` : `${user!.email.split('@')[0]}'s Workspace`,
                slug: orgSlug
              }
            });

            return await tx.user.update({
              where: { id: user!.id },
              data: { 
                role: 'SUB_ADMIN',
                organizationId: org.id
              }
            });
          });
        } else if (!user.name && googleUser.name) {
          // Normal name backfill
          user = await prisma.user.update({
            where: { id: user.id },
            data:  { name: googleUser.name },
          });
        }
      }

      // Issue our own JWT tokens
      const tokens = await issueTokens(user);

      // Redirect back to the client
      if (platform === 'desktop' || platform === 'mobile') {
        const deepLink = `remotelink://auth/callback?accessToken=${tokens.accessToken}&refreshToken=${tokens.refreshToken}`;
        
        // Return a professional landing page instead of a raw redirect
        return reply.type('text/html').send(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Login Successful | Connect-X</title>
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                  background-color: #060608;
                  color: #fff;
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  height: 100vh;
                  margin: 0;
                  text-align: center;
                }
                .container {
                  max-width: 400px;
                  padding: 40px;
                  background: rgba(255,255,255,0.03);
                  border-radius: 24px;
                  border: 1px solid rgba(255,255,255,0.1);
                  backdrop-filter: blur(10px);
                }
                .icon {
                  width: 64px;
                  height: 64px;
                  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                  border-radius: 20px;
                  margin-bottom: 24px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  box-shadow: 0 10px 25px -5px rgba(37, 99, 235, 0.4);
                }
                h1 { margin: 0 0 12px 0; font-size: 24px; font-weight: 600; }
                p { color: rgba(255,255,255,0.6); margin: 0 0 32px 0; line-height: 1.5; }
                .button {
                  display: inline-block;
                  padding: 14px 28px;
                  background-color: #fff;
                  color: #000;
                  text-decoration: none;
                  border-radius: 12px;
                  font-weight: 600;
                  transition: transform 0.2s, opacity 0.2s;
                }
                .button:active { transform: scale(0.95); }
                .loader {
                  margin-top: 24px;
                  width: 20px;
                  height: 20px;
                  border: 2px solid rgba(255,255,255,0.1);
                  border-top-color: #fff;
                  border-radius: 50%;
                  animation: spin 1s linear infinite;
                }
                @keyframes spin { to { transform: rotate(360deg); } }
              </style>
            </head>
            <body>
              <div class="container">
                <center><div class="icon">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                </div></center>
                <h1>Authentication Successful</h1>
                <p>Welcome back! We're redirecting you to the Connect-X app now.</p>
                <a href="${deepLink}" class="button">Open Connect-X</a>
                <center><div class="loader"></div></center>
              </div>
              <script>
                // Auto-trigger deep link after a small delay
                setTimeout(() => {
                  window.location.href = "${deepLink}";
                }, 1000);
              </script>
            </body>
          </html>
        `);
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
