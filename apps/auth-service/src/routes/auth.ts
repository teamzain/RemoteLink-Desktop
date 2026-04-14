import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import { prisma, publishEvent, EventChannel, verifyToken, blacklistToken, isTokenBlacklisted } from '@remotelink/shared';
import { issueTokens } from '../utils/token-utils';

const verificationCodes = new Map<string, { code: string; expiresAt: number }>();

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.get('/health', async () => {
    return { status: 'ok', service: 'auth-service' };
  });

  fastify.post('/request-verification', async (request: FastifyRequest, reply: FastifyReply) => {
    const { email } = request.body as any;
    if (!email) {
      return reply.code(400).send({ error: 'Email is required' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return reply.code(400).send({ error: 'User already exists' });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    verificationCodes.set(email, { code, expiresAt });

    try {
      // 1. ALWAYS Log the code to the terminal in development for easy access
      console.log('\n' + '='.repeat(50));
      console.log(`[AUTH-DEV] VERIFICATION CODE FOR ${email}: ${code}`);
      console.log('='.repeat(50) + '\n');

      if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587', 10),
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
          requireTLS: true,
          connectionTimeout: 8000, // Reduced to 8s for snappier fallback
        });

        try {
          await transporter.sendMail({
            from: `"Connect-X Auth" <${process.env.SMTP_USER}>`,
            to: email,
            subject: 'Your Connect-X Verification Code',
            text: `Your verification code is ${code}. It expires in 10 minutes.`,
            html: `<p>Your verification code is <strong>${code}</strong>. It expires in 10 minutes.</p>`,
          });
          console.log(`[Auth] Sent verification email successfully to ${email}`);
        } catch (mailErr: any) {
          // If mail fails but it's a timeout or network issue, we JUST LOG IT and don't fail the request.
          // This allows the user to use the code from the terminal.
          console.error(`[Auth] SMTP Delivery Failed (Bypassing for Dev): ${mailErr.message}`);
          return reply.send({ 
            success: true, 
            message: 'Verification code generated (Check server terminal for dev fallback).' 
          });
        }
      } else {
        console.log(`[Auth-Mock] SMTP not configured. Use terminal fallback code above.`);
      }
      return reply.send({ success: true, message: 'Verification code sent.' });
    } catch (err: any) {
      console.error('[Auth] Internal Request Error:', err.message);
      return reply.code(500).send({ error: `Verification failed: ${err.message}` });
    }
  });

  fastify.post('/register', async (request: FastifyRequest, reply: FastifyReply) => {
    const { email, password, name, verificationCode } = request.body as any;
    
    if (!email || !password || !verificationCode) {
      return reply.code(400).send({ error: 'Email, password, and verification code are required' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return reply.code(400).send({ error: 'User already exists' });
    }

    const record = verificationCodes.get(email);
    if (!record || record.code !== verificationCode) {
      return reply.code(400).send({ error: 'Invalid verification code' });
    }
    if (Date.now() > record.expiresAt) {
      verificationCodes.delete(email);
      return reply.code(400).send({ error: 'Verification code has expired' });
    }

    // Code is valid
    verificationCodes.delete(email);

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Use a transaction to ensure both user and org are created together
    const result = await prisma.$transaction(async (tx: any) => {
      // 1. Create a default Organization for the user
      const orgSlug = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.random().toString(36).substring(2, 5);
      const org = await tx.organization.create({
        data: {
          name: name ? `${name}'s Workspace` : `${email.split('@')[0]}'s Workspace`,
          slug: orgSlug
        }
      });

      // 2. Create User as SUB_ADMIN of that Org
      const user = await tx.user.create({
        data: { 
          email, 
          password: hashedPassword, 
          name,
          role: 'SUB_ADMIN',
          organizationId: org.id
        }
      });

      return { user, org };
    });

    const { user } = result;

    // Notify other services that a user was created
    await publishEvent({
      channel: EventChannel.USER_CREATED,
      payload: { userId: user.id, email: user.email }
    });

    // Create Stripe Customer
    try {
      const billingUrl = process.env.BILLING_SERVICE_URL || 'http://localhost:3003';
      await fetch(`${billingUrl}/billing/create-customer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, email: user.email })
      });
    } catch (err) {
      console.error('[Auth] Failed to trigger billing customer creation:', err);
    }

    return reply.send(await issueTokens(user));
  });

  // 5. Verify Invitation Token
  fastify.get('/invitation/:token', async (request: FastifyRequest, reply: FastifyReply) => {
    const { token } = request.params as { token: string };
    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: { organization: { select: { name: true } } }
    });

    if (!invitation || invitation.expiresAt < new Date()) {
      return reply.code(400).send({ error: 'Invalid or expired invitation' });
    }

    return reply.send({ email: invitation.email, role: invitation.role, orgName: invitation.organization.name });
  });

  // 6. Complete Onboarding (Set Password for Invited Member)
  fastify.post('/onboard', async (request: FastifyRequest, reply: FastifyReply) => {
    const { token, password, name } = request.body as any;
    if (!token || !password) return reply.code(400).send({ error: 'Token and password are required' });

    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: { organization: true }
    });

    if (!invitation || invitation.expiresAt < new Date()) {
      return reply.code(400).send({ error: 'Invalid or expired invitation' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create the user and link to original ORG
    const user = await prisma.user.create({
      data: {
        email: invitation.email,
        password: hashedPassword,
        name: name || invitation.email.split('@')[0],
        role: invitation.role,
        organizationId: invitation.organizationId,
        departmentId: invitation.departmentId,
        allowedTags: invitation.allowedTags
      }
    });

    // Delete used invitation
    await prisma.invitation.delete({ where: { id: invitation.id } });

    // Notify billing
    try {
      const billingUrl = process.env.BILLING_SERVICE_URL || 'http://localhost:3003';
      await fetch(`${billingUrl}/billing/create-customer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, email: user.email })
      });
    } catch (err) {}

    return reply.send(await issueTokens(user));
  });


  fastify.post('/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const { email, password } = request.body as any;

    if (!email || !password) {
      return reply.code(400).send({ error: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    if ((user as any).is2FAEnabled) {
      const tempToken = await publishEvent({ // Just mock a temp token for now or use JWT
        channel: EventChannel.USER_CREATED, // Placeholder
        payload: { userId: user.id, email: user.email }
      });
      // Better: sign a short-lived temp token
      const jwt = require('@remotelink/shared').generateToken({ userId: user.id, type: '2fa-temp' }, '5m');
      return reply.send({ twoFactorRequired: true, tempToken: jwt });
    }

    return reply.send(await issueTokens(user));
  });

  fastify.post('/verify-2fa', async (request: FastifyRequest, reply: FastifyReply) => {
    const { code, tempToken } = request.body as any;
    if (!code || !tempToken) return reply.code(400).send({ error: 'Code and tempToken required' });

    const decoded = verifyToken(tempToken);
    if (!decoded || !decoded.userId || decoded.type !== '2fa-temp') {
      return reply.code(401).send({ error: 'Invalid or expired 2FA session' });
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user || !(user as any).twoFactorSecret) return reply.code(400).send({ error: '2FA not set up' });

    const { authenticator } = require('otplib');
    const isValid = authenticator.verify({ token: code, secret: (user as any).twoFactorSecret });
    if (!isValid) return reply.code(401).send({ error: 'Invalid 2FA code' });

    return reply.send(await issueTokens(user));
  });

  fastify.post('/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    const { refreshToken } = request.body as any;
    if (!refreshToken) return reply.code(400).send({ error: 'Refresh token required' });
    
    // Check if blacklisted in Redis
    const isBlacklisted = await isTokenBlacklisted(refreshToken);
    if (isBlacklisted) {
      return reply.code(401).send({ error: 'Session expired or logged out' });
    }

    const decoded = verifyToken(refreshToken);
    if (!decoded || !decoded.userId || decoded.type !== 'refresh') {
       return reply.code(401).send({ error: 'Invalid refresh token' });
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) return reply.code(401).send({ error: 'User not found' });

    return reply.send(await issueTokens(user));
  });

  fastify.post('/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    const { refreshToken } = request.body as any;
    if (!refreshToken) return reply.code(400).send({ error: 'Refresh token required' });

    const decoded = verifyToken(refreshToken);
    if (decoded && decoded.exp) {
      const ttl = Math.max(0, decoded.exp - Math.floor(Date.now() / 1000));
      if (ttl > 0) {
        await blacklistToken(refreshToken, ttl);
      }
    }

    return reply.send({ success: true });
  });

  // 5. Get Current User (The missing /me endpoint)
  fastify.get('/me', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) return reply.code(401).send({ error: 'Invalid token' });

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { subscription: true }
    });

    if (!user) return reply.code(404).send({ error: 'User not found' });

    return reply.send({
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.subscription?.plan || 'FREE',
      role: user.role,
      organizationId: user.organizationId,
      allowedTags: user.allowedTags,
      avatar: null,
      is_2fa_enabled: (user as any).is2FAEnabled ?? false,
    });
  });

  // 6. Update Profile/Password
  fastify.patch('/me', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) return reply.code(401).send({ error: 'Invalid token' });

    const { name, current_password, password } = request.body as any;
    const updateData: any = {};

    if (name) updateData.name = name;

    if (password) {
      if (!current_password) return reply.code(400).send({ error: 'Current password required to set new password' });
      
      const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
      if (!user || !user.password) return reply.code(401).send({ error: 'Unauthorized' });

      const isMatch = await bcrypt.compare(current_password, user.password);
      if (!isMatch) return reply.code(401).send({ error: 'Incorrect current password' });

      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(password, salt);
    }

    const updatedUser = await prisma.user.update({
      where: { id: decoded.userId },
      data: updateData,
      include: { subscription: true }
    });

    return reply.send({
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        plan: updatedUser.subscription?.plan || 'FREE',
        avatar: null,
        is_2fa_enabled: (updatedUser as any).is2FAEnabled ?? false,
      }
    });
  });

  // 7. Get ICE Servers (STUN/TURN) for WebRTC
  fastify.get('/ice-servers', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });

    const serverIP = process.env.SERVER_IP || '159.65.84.190';
    const turnUser = process.env.TURN_USER || 'admin';
    const turnPass = process.env.TURN_PASSWORD || 'password';

    return reply.send({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { 
          urls: `turn:${serverIP}:3478`,
          username: turnUser,
          credential: turnPass
        }
      ]
    });
  });
}
