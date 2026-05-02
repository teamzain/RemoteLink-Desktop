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
      client_id: clientId,
      redirect_uri: callbackUrl,
      response_type: 'code',
      scope: 'openid email profile',
      state: platform || 'web',        // carry platform through OAuth round-trip
      access_type: 'offline',
      prompt: 'select_account',
    });

    return reply.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  });

  // Step 2 — Google redirects back here with ?code=...&state=...
  fastify.get('/google/callback', async (request: FastifyRequest, reply: FastifyReply) => {
    const { code, state, error } = request.query as { code?: string; state?: string; error?: string };

    if (error || !code) {
      return reply.code(400).send({ error: error || 'No authorization code received from Google' });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const callbackUrl = process.env.GOOGLE_CALLBACK_URL || 'http://159.65.84.190/api/auth/oauth/google/callback';
    const platform = state || 'web';

    if (!clientId || !clientSecret) {
      return reply.code(500).send({ error: 'Google OAuth credentials not configured' });
    }

    try {
      // Exchange authorization code for Google tokens
      const tokenBody = new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: callbackUrl,
        grant_type: 'authorization_code',
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
        // SaaS ONBOARDING: Create Org + User as SUPER_ADMIN
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
              role: 'SUPER_ADMIN',
              organizationId: org.id
            }
          });
        });

        user = result;

        // Create initial subscription
        try {
          await prisma.subscription.create({
            data: { userId: user!.id, plan: 'TRIAL' },
          });
        } catch { }
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
                role: 'SUPER_ADMIN',
                organizationId: org.id
              }
            });
          });
        } else if (!user.name && googleUser.name) {
          // Normal name backfill
          user = await prisma.user.update({
            where: { id: user.id },
            data: { name: googleUser.name },
          });
        }
      }

      // ── 2FA Check ──
      if ((user as any).is2FAEnabled) {
        const { generateToken } = require('@remotelink/shared');
        const tempToken = generateToken({ userId: user!.id, type: '2fa-temp' }, '5m');

        if (platform === 'desktop' || platform === 'mobile') {
          const deepLink = `remotelink://auth/2fa?tempToken=${tempToken}`;
          return reply.type('text/html').send(`
            <!DOCTYPE html>
            <html>
              <head>
                <title>2FA Required | Remote 365</title>
                <style>
                  body {
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                    background: #f8fafc;
                    color: #0f172a;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 100vh;
                    margin: 0;
                    text-align: center;
                  }
                  .card {
                    background: white;
                    padding: 48px;
                    border-radius: 24px;
                    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 10px 10px -5px rgba(0, 0, 0, 0.02);
                    max-width: 400px;
                    animation: slideUp 0.6s ease-out;
                  }
                  .icon-box {
                    width: 72px;
                    height: 72px;
                    background: #eff6ff;
                    border-radius: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 24px;
                    color: #2563eb;
                  }
                  h1 { font-size: 24px; font-weight: 700; margin-bottom: 12px; letter-spacing: -0.02em; }
                  p { color: #64748b; line-height: 1.6; margin-bottom: 32px; }
                  .btn {
                    display: inline-block;
                    background: #2563eb;
                    color: white;
                    text-decoration: none;
                    padding: 14px 32px;
                    border-radius: 12px;
                    font-weight: 600;
                    transition: all 0.2s;
                  }
                  .btn:hover { background: #1d4ed8; transform: translateY(-1px); }
                  @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                </style>
              </head>
              <body>
                <div class="card">
                  <div class="icon-box">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                  </div>
                  <h1>2FA Required</h1>
                  <p>Please open the Remote 365 app to enter your security code.</p>
                  <a href="${deepLink}" class="btn">Open Remote 365</a>
                </div>
                <script>setTimeout(() => { window.location.href = "${deepLink}"; }, 1000);</script>
              </body>
            </html>
          `);
        }

        const webUrl = `${process.env.WEB_APP_URL || 'http://localhost:3000'}/auth/callback?tempToken=${tempToken}`;
        return reply.redirect(webUrl);
      }

      // Issue our own JWT tokens
      const tokens = await issueTokens(user!);

      // Redirect back to the client
      if (platform === 'desktop' || platform === 'mobile') {
        const deepLink = `remotelink://auth/callback?accessToken=${tokens.accessToken}&refreshToken=${tokens.refreshToken}`;

        // Return a professional landing page instead of a raw redirect
        return reply.type('text/html').send(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Launching Remote 365</title>
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                  background: #f8fafc;
                  color: #0f172a;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  height: 100vh;
                  margin: 0;
                  overflow: hidden;
                }
                .container {
                  text-align: center;
                  max-width: 440px;
                  padding: 40px;
                  animation: fadeIn 0.8s ease-out;
                }
                .logo-container {
                  position: relative;
                  width: 100px;
                  height: 100px;
                  margin: 0 auto 40px;
                }
                .logo-circle {
                  position: absolute;
                  top: 0; left: 0; right: 0; bottom: 0;
                  background: #2563eb;
                  border-radius: 30px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  box-shadow: 0 20px 40px -10px rgba(37, 99, 235, 0.3);
                  z-index: 2;
                }
                .pulse {
                  position: absolute;
                  top: 0; left: 0; right: 0; bottom: 0;
                  background: #2563eb;
                  border-radius: 30px;
                  opacity: 0.4;
                  animation: pulse 2s infinite;
                  z-index: 1;
                }
                h1 {
                  font-size: 28px;
                  font-weight: 700;
                  margin: 0 0 12px 0;
                  letter-spacing: -0.02em;
                }
                p {
                  color: #64748b;
                  font-size: 16px;
                  line-height: 1.6;
                  margin: 0 0 40px 0;
                }
                .button {
                  display: inline-block;
                  padding: 14px 32px;
                  background-color: #2563eb;
                  color: #fff;
                  text-decoration: none;
                  border-radius: 12px;
                  font-weight: 600;
                  font-size: 15px;
                  transition: all 0.2s;
                  box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);
                }
                .button:hover {
                  background-color: #1d4ed8;
                  transform: translateY(-1px);
                  box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.3);
                }
                .footer {
                  position: fixed;
                  bottom: 40px;
                  font-size: 13px;
                  color: #94a3b8;
                }
                @keyframes pulse {
                  0% { transform: scale(1); opacity: 0.4; }
                  70% { transform: scale(1.4); opacity: 0; }
                  100% { transform: scale(1.4); opacity: 0; }
                }
                @keyframes fadeIn {
                  from { opacity: 0; transform: translateY(10px); }
                  to { opacity: 1; transform: translateY(0); }
                }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="logo-container">
                  <div class="logo-circle">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                      <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                  </div>
                  <div class="pulse"></div>
                </div>
                <h1>Launching Remote 365</h1>
                <p>Allow your browser to launch the Remote 365 desktop app to complete your sign-in.</p>
                <a href="${deepLink}" class="button">Open Remote 365</a>
              </div>
              <div class="footer">
                &copy; 2026 Remote 365. All rights reserved.
              </div>
              <script>
                setTimeout(() => {
                  window.location.href = "${deepLink}";
                }, 1500);
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
