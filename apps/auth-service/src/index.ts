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

// Root Onboarding Bridge Page (Web landing page for emails)
server.get('/onboard', async (request, reply) => {
  const { token } = request.query as { token: string };
  if (!token) return reply.code(400).send({ error: 'Token required' });

  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: { organization: { select: { name: true } } }
  });

  if (!invitation || invitation.expiresAt < new Date()) {
    return reply.type('text/html; charset=utf-8').send(`
      <!DOCTYPE html>
      <html>
        <head><title>Invalid Invitation | Connect-X</title><style>body{background:#060608;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;}</style></head>
        <body><div><h1>Invalid or Expired Invitation</h1><p>Please contact your administrator for a new invite.</p></div></body>
      </html>
    `);
  }

  return reply.type('text/html; charset=utf-8').send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Complete Your Account | Connect-X</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: -apple-system, system-ui, sans-serif; background: #060608; color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
          .card { width: 100%; max-width: 440px; padding: 48px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 32px; backdrop-filter: blur(20px); box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); text-align: center; }
          .icon { width: 64px; height: 64px; background: #fff; border-radius: 18px; margin: 0 auto 24px; display: flex; align-items: center; justify-content: center; }
          h1 { font-size: 28px; font-weight: 700; letter-spacing: -0.02em; margin-bottom: 8px; }
          p { color: rgba(255,255,255,0.5); font-size: 15px; margin-bottom: 32px; }
          .form-group { text-align: left; margin-bottom: 20px; }
          label { display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: rgba(255,255,255,0.4); margin-bottom: 8px; margin-left: 4px; }
          input { width: 100%; padding: 14px 18px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; color: #fff; font-size: 15px; box-sizing: border-box; outline: none; transition: border-color 0.2s, background 0.2s; }
          input:focus { border-color: rgba(255,255,255,0.3); background: rgba(255,255,255,0.08); }
          .btn { width: 100%; padding: 16px; background: #fff; color: #000; border: none; border-radius: 14px; font-weight: 600; font-size: 15px; cursor: pointer; transition: transform 0.2s, opacity 0.2s; margin-top: 12px; }
          .btn:hover { opacity: 0.9; }
          .btn:active { transform: scale(0.98); }
          .btn:disabled { opacity: 0.5; cursor: not-allowed; }
          .error { color: #ff4d4d; font-size: 13px; margin-top: 16px; display: none; }
          .loader { margin-top: 12px; width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.1); border-top-color: #fff; border-radius: 50%; display: none; animation: spin 1s linear infinite; margin-left: auto; margin-right: auto; }
          @keyframes spin { to { transform: rotate(360deg); } }
          .success-view { display: none; }
        </style>
      </head>
      <body>
        <div class="card" id="form-card">
          <div class="icon"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/><path d="m14 8 3 3-3 3"/></svg></div>
          <div id="setup-view">
            <h1>Join ${invitation.organization.name}</h1>
            <p>Set a password to complete your invitation and join the team.</p>
            
            <form id="onboard-form">
              <div class="form-group">
                <label>Full Name</label>
                <input type="text" id="name" placeholder="Enter your name" required>
              </div>
              <div class="form-group">
                <label>Set Password</label>
                <input type="password" id="password" placeholder="••••••••" required minlength="8">
              </div>
              <button type="submit" class="btn" id="submit-btn">Complete Setup</button>
            </form>
            <div class="loader" id="loader"></div>
            <div class="error" id="error-msg"></div>
          </div>

          <div id="success-view" class="success-view">
            <h1>Welcome Aboard!</h1>
            <p>Your account is ready. We are launching the Connect-X app for you now...</p>
            <div class="loader" style="display:inline-block"></div>
            <p style="margin-top: 24px;"><a href="#" id="manual-link" style="color:#fff; font-size: 13px; opacity: 0.6;">App didn't open? Click here to launch manually</a></p>
          </div>
        </div>

        <script>
          console.log("[Onboard] Bridge page loaded.");
          const form = document.getElementById('onboard-form');
          const setupView = document.getElementById('setup-view');
          const successView = document.getElementById('success-view');
          const errorMsg = document.getElementById('error-msg');
          const submitBtn = document.getElementById('submit-btn');
          const loader = document.getElementById('loader');

          form.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log("[Onboard] Form submitted.");
            
            errorMsg.style.display = 'none';
            submitBtn.disabled = true;
            loader.style.display = 'inline-block';

            const name = document.getElementById('name').value;
            const password = document.getElementById('password').value;
            const token = new URLSearchParams(window.location.search).get('token');

            console.log("[Onboard] Token from URL:", token);

            try {
              const response = await fetch('/api/auth/onboard', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, password, name })
              });

              const data = await response.json();
              console.log("[Onboard] Server response:", data);

              if (!response.ok) {
                throw new Error(data.error || 'Failed to complete setup');
              }

              // Handoff to Desktop App
              const deepLink = 'remotelink://auth/callback?accessToken=' + data.accessToken + '&refreshToken=' + data.refreshToken;
              console.log("[Onboard] Redirecting to app via:", deepLink);
              
              setupView.style.display = 'none';
              successView.style.display = 'block';
              document.getElementById('manual-link').href = deepLink;

              window.location.href = deepLink;
              
            } catch (err) {
              console.error("[Onboard] Processing error:", err);
              errorMsg.textContent = err.message;
              errorMsg.style.display = 'block';
              submitBtn.disabled = false;
              loader.style.display = 'none';
            }
          });
        </script>
      </body>
    </html>
  `);
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
