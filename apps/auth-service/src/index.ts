import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env BEFORE any other imports to ensure Prisma finds DATABASE_URL
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { prisma, redisPublisher, EventChannel } from '@remotelink/shared';
import authRoutes from './routes/auth';
import oauthRoutes from './routes/oauth';
import mfaRoutes from './routes/2fa';
import passwordRoutes from './routes/password';
import deviceRoutes from './routes/devices';
import organizationRoutes from './routes/organizations';
import memberRoutes from './routes/members';

const server = Fastify({ logger: true });

server.register(cors, {
  origin: '*' // Allow all local renderer origins
});

server.addHook('onRequest', async (request, reply) => {
  console.log(`[Auth-Service] ${request.method} ${request.url}`);
});

server.get('/health', async () => {
  return { status: 'ok', service: 'auth-service' };
});

// Onboarding landing page ─ linked from invitation emails.
// Gmail and most web email clients block custom protocol (remotelink://) hrefs,
// so the email sends a plain HTTP link here. This page then auto-launches the
// desktop app via the deep-link. Works whether the app is already open or not.
server.get('/onboard', async (request, reply) => {
  const { token } = request.query as { token?: string };

  if (!token) {
    return reply.code(400).type('text/html').send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:60px">
        <h2 style="color:#e53e3e">Invalid Link</h2>
        <p>This invitation link is missing a token. Please ask your admin to resend the invite.</p>
      </body></html>
    `);
  }

  const deepLink = `remotelink://onboard?token=${token}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Join Organization – Connect-X</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#F8F9FA;min-height:100vh;display:flex;align-items:center;justify-content:center}
    .card{background:#fff;border-radius:32px;padding:52px 44px;max-width:420px;width:100%;text-align:center;box-shadow:0 24px 80px rgba(0,0,0,0.07),0 0 0 1px rgba(0,0,0,0.03)}
    .icon{width:68px;height:68px;background:#1C1C1C;border-radius:20px;display:flex;align-items:center;justify-content:center;margin:0 auto 28px;font-size:30px;box-shadow:0 8px 24px rgba(0,0,0,0.18)}
    h1{font-size:22px;font-weight:800;color:#1C1C1C;letter-spacing:-0.5px;margin-bottom:10px}
    .sub{font-size:14px;color:rgba(28,28,28,0.42);line-height:1.65;margin-bottom:36px}
    .btn{display:block;padding:15px 32px;background:#1C1C1C;color:#fff;border-radius:18px;text-decoration:none;font-weight:700;font-size:14px;letter-spacing:0.2px;transition:opacity .15s;border:none;width:100%;cursor:pointer}
    .btn:hover{opacity:.82}
    .hint{margin-top:20px;font-size:11px;color:rgba(28,28,28,0.28);line-height:1.6}
    .spinner{display:inline-block;width:14px;height:14px;border:2px solid rgba(28,28,28,0.12);border-top-color:#1C1C1C;border-radius:50%;animation:spin .75s linear infinite;vertical-align:middle;margin-right:7px}
    @keyframes spin{to{transform:rotate(360deg)}}
    .badge{display:inline-flex;align-items:center;gap:6px;padding:5px 12px;background:#EFF6FF;color:#2563EB;border-radius:99px;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-bottom:28px}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">⚡</div>
    <div class="badge">
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><circle cx="5" cy="5" r="5" fill="#2563EB" opacity=".15"/><circle cx="5" cy="5" r="2.5" fill="#2563EB"/></svg>
      Secure Corporate Invite
    </div>
    <h1>Join Your Organization</h1>
    <p class="sub" id="desc">Opening Connect-X Desktop to complete your account setup. This should only take a moment.</p>
    <button class="btn" onclick="openApp()">Open Connect-X Desktop</button>
    <p class="hint" id="hint"><span class="spinner"></span>Launching desktop app automatically…</p>
  </div>
  <script>
    var deepLink = ${JSON.stringify(deepLink)};
    function openApp() {
      window.location.href = deepLink;
      document.getElementById('hint').innerHTML =
        'If Connect-X did not open, make sure it is installed and try the button again.';
    }
    // Auto-attempt after a short delay so the page renders first
    setTimeout(openApp, 900);
  </script>
</body>
</html>`;

  reply.type('text/html').send(html);
});

server.register(authRoutes, { prefix: '/api/auth' });
server.register(oauthRoutes, { prefix: '/api/auth/oauth' });
server.register(mfaRoutes, { prefix: '/api/auth/2fa' });
server.register(passwordRoutes, { prefix: '/api/auth/password' });
server.register(deviceRoutes, { prefix: '/api/devices' });
server.register(organizationRoutes, { prefix: '/api/organizations' });
server.register(memberRoutes, { prefix: '/api/members' });

server.setNotFoundHandler((request, reply) => {
  console.log(`[Auth-Service-Wildcard] 404: ${request.method} ${request.url}`);
  reply.code(404).send({ error: `Not Found: ${request.method} ${request.url}` });
});

server.setErrorHandler((error, request, reply) => {
  server.log.error(error);
  if (error.code === 'P2024') {
    return reply.status(503).send({ error: 'Database timeout, please try again' });
  }
  if (error.message.includes('Redis')) {
    return reply.status(503).send({ error: 'Session service temporarily unavailable' });
  }
  reply.status(error.statusCode || 500).send({ error: error.message || 'Internal Server Error' });
});

const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3001', 10);
    await server.listen({ port, host: '0.0.0.0' });
    server.log.info(`Auth service listening on port ${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
