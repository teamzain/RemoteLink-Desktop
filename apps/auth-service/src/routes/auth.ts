import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import { OAuth2Client } from 'google-auth-library';
import { prisma, publishEvent, EventChannel, verifyToken, blacklistToken, isTokenBlacklisted, redisPublisher } from '@remotelink/shared';
import { issueTokens } from '../utils/token-utils';
import { TOTP, NobleCryptoPlugin, ScureBase32Plugin } from 'otplib';

const totp = new TOTP({
  crypto: new NobleCryptoPlugin(),
  base32: new ScureBase32Plugin()
});

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
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

    const existingInvite = await prisma.invitation.findFirst({
      where: { email, expiresAt: { gt: new Date() } }
    });
    if (existingInvite) {
      return reply.code(400).send({ error: 'You have a pending invitation. Please use the invite link to join your organization.' });
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

    const existingInvite = await prisma.invitation.findFirst({
      where: { email, expiresAt: { gt: new Date() } }
    });
    if (existingInvite) {
      return reply.code(400).send({ error: 'You have a pending invitation. Please use the invite link to join your organization.' });
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

      // 3. Create a 5-minute TRIAL subscription for the new owner
      const trialDurationMs = 5 * 60 * 1000;
      await tx.subscription.create({
        data: {
          userId: user.id,
          plan: 'TRIAL',
          status: 'ACTIVE',
          currentPeriodEnd: new Date(Date.now() + trialDurationMs)
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

    // Upsert: update existing user if email already exists, otherwise create
    const existingUser = await prisma.user.findUnique({ where: { email: invitation.email } });

    let user;
    if (existingUser) {
      user = await prisma.user.update({
        where: { email: invitation.email },
        data: {
          password: hashedPassword,
          name: name || existingUser.name || invitation.email.split('@')[0],
          role: invitation.role,
          organizationId: invitation.organizationId,
          departmentId: invitation.departmentId,
          allowedTags: invitation.allowedTags,
          allowedDeviceIds: (invitation as any).allowedDeviceIds || []
        }
      });
    } else {
      user = await prisma.user.create({
        data: {
          email: invitation.email,
          password: hashedPassword,
          name: name || invitation.email.split('@')[0],
          role: invitation.role,
          organizationId: invitation.organizationId,
          departmentId: invitation.departmentId,
          allowedTags: invitation.allowedTags,
          allowedDeviceIds: (invitation as any).allowedDeviceIds || []
        }
      });
    }

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
    } catch (err) { }

    // Notify signaling for real-time team update
    try {
      await redisPublisher.publish(EventChannel.ORG_UPDATES, JSON.stringify({
        type: 'member-onboarded',
        organizationId: invitation.organizationId
      }));
    } catch (err) {
      console.error('[Auth-Service] Failed to publish member-onboarded event:', err);
    }

    return reply.send(await issueTokens(user));
  });

  // Google Sign-In (Mobile & Web)
  fastify.post('/google', async (request: FastifyRequest, reply: FastifyReply) => {
    const { idToken } = request.body as any;
    if (!idToken) return reply.code(400).send({ error: 'ID token required' });

    try {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      if (!payload?.email) return reply.code(400).send({ error: 'Invalid Google token' });

      const { email, name } = payload;

      let user = await prisma.user.findUnique({ where: { email } });

      if (!user) {
        // Auto-create account for new Google users
        const orgSlug = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.random().toString(36).substring(2, 5);
        const result = await prisma.$transaction(async (tx: any) => {
          const org = await tx.organization.create({
            data: {
              name: `${name || email.split('@')[0]}'s Workspace`,
              slug: orgSlug,
            }
          });
          const newUser = await tx.user.create({
            data: {
              email,
              name: name || email.split('@')[0],
              role: 'SUB_ADMIN',
              organizationId: org.id,
            }
          });
          return { user: newUser };
        });
        user = result.user;

        await publishEvent({ channel: EventChannel.USER_CREATED, payload: { userId: user!.id, email: user!.email } });

        try {
          const billingUrl = process.env.BILLING_SERVICE_URL || 'http://localhost:3003';
          await fetch(`${billingUrl}/billing/create-customer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user!.id, email: user!.email })
          });
        } catch (err) { }
      }

      if ((user as any).is2FAEnabled) {
        const { generateToken } = require('@remotelink/shared');
        const tempToken = generateToken({ userId: user!.id, type: '2fa-temp' }, '5m');
        return reply.send({ twoFactorRequired: true, tempToken });
      }

      return reply.send(await issueTokens(user!));
    } catch (err: any) {
      console.error('[Auth] Google token verification failed:', err.message);
      return reply.code(401).send({ error: 'Google authentication failed' });
    }
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

    const isValid = totp.verify(code, { secret: (user as any).twoFactorSecret });
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
      plan: user.subscription?.plan || 'TRIAL',
      status: user.subscription?.status || 'ACTIVE',
      currentPeriodEnd: user.subscription?.currentPeriodEnd,
      role: user.role,
      organizationId: user.organizationId,
      allowedTags: user.allowedTags,
      avatar: null,
      is_2fa_enabled: (user as any).is2FAEnabled ?? false,
      notify_session_alert: (user as any).notifySessionAlert ?? true,
      notify_disconnect_alert: (user as any).notifyDisconnectAlert ?? true,
      notify_sound_effects: (user as any).notifySoundEffects ?? true
    });
  });

  // 5.1 List Active Sessions (Mocking from JWT for now, could be Prisma/Redis)
  fastify.get('/sessions', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) return reply.code(401).send({ error: 'Invalid token' });

    // In a real app, you'd fetch this from a Session table. 
    // For now, we return the current session as a single item list.
    return reply.send([
      {
        id: 'current',
        ip: request.ip,
        userAgent: request.headers['user-agent'] || 'Unknown',
        lastSeen: new Date().toISOString(),
        isCurrent: true
      }
    ]);
  });

  // 5.2 Revoke Session
  fastify.delete('/sessions/:sessionId', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });

    // For now, just a placeholder. If they revoke 'current', we can't easily logout 
    // without blacklisting the current token.
    return reply.send({ success: true });
  });


  // 6. Update Profile/Password
  fastify.patch('/me', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) return reply.code(401).send({ error: 'Invalid token' });

    const {
      name,
      current_password,
      password,
      notify_session_alert,
      notify_disconnect_alert,
      notify_sound_effects
    } = request.body as any;

    const updateData: any = {};

    if (name) updateData.name = name;

    if (notify_session_alert !== undefined) updateData.notifySessionAlert = notify_session_alert;
    if (notify_disconnect_alert !== undefined) updateData.notifyDisconnectAlert = notify_disconnect_alert;
    if (notify_sound_effects !== undefined) updateData.notifySoundEffects = notify_sound_effects;

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
        notify_session_alert: (updatedUser as any).notifySessionAlert ?? true,
        notify_disconnect_alert: (updatedUser as any).notifyDisconnectAlert ?? true,
        notify_sound_effects: (updatedUser as any).notifySoundEffects ?? true,
      }
    });
  });

  // 6.1 Close Account (Complete Wipe)
  fastify.delete('/me', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) return reply.code(401).send({ error: 'Invalid token' });

    const userId = decoded.userId;

    try {
      await prisma.$transaction(async (tx: any) => {
        const user = await tx.user.findUnique({
          where: { id: userId },
          include: { organization: true }
        });

        if (!user) throw new Error('User not found');

        // 1. If user is a SUB_ADMIN, they might own an organization.
        // If they are the only admin or we want to delete the whole workspace:
        if (user.role === 'SUB_ADMIN' && user.organizationId) {
          const orgId = user.organizationId;

          // Dissociate other users first (standard cleanup)
          // 1. Delete all other members of this organization
          const subordinates = await tx.user.findMany({
            where: { organizationId: orgId, NOT: { id: userId } },
            select: { id: true }
          });
          const subordinateIds = subordinates.map((s: any) => s.id);

          if (subordinateIds.length > 0) {
            // Clean up subordinate data
            const subDevices = await tx.device.findMany({ where: { ownerId: { in: subordinateIds } } });
            const subDeviceIds = subDevices.map((d: any) => d.id);

            await tx.trustedDevice.deleteMany({
              where: { OR: [{ viewerUserId: { in: subordinateIds } }, { hostDeviceId: { in: subDeviceIds } }] }
            });
            await tx.savedDevice.deleteMany({
              where: { OR: [{ userId: { in: subordinateIds } }, { deviceId: { in: subDeviceIds } }] }
            });
            await tx.session.deleteMany({
              where: { OR: [{ viewerId: { in: subordinateIds } }, { hostId: { in: subDeviceIds } }] }
            });
            await tx.device.deleteMany({ where: { ownerId: { in: subordinateIds } } });
            await tx.subscription.deleteMany({ where: { userId: { in: subordinateIds } } });
            await tx.supportTicket.deleteMany({ where: { userId: { in: subordinateIds } } });
            await tx.guideRequest.deleteMany({ where: { userId: { in: subordinateIds } } });

            // Delete the subordinate users themselves
            await tx.user.deleteMany({ where: { id: { in: subordinateIds } } });
          }

          // 2. Clean up org-level entities
          await tx.enrollmentToken.deleteMany({ where: { organizationId: orgId } });
          await tx.invitation.deleteMany({ where: { organizationId: orgId } });
          await tx.department.deleteMany({ where: { organizationId: orgId } });
        }

        // 2. Clean up user-specific data
        const userDevices = await tx.device.findMany({ where: { ownerId: userId } });
        const deviceIds = userDevices.map((d: any) => d.id);

        // Remove from Trust/Saved lists (both directions)
        await tx.trustedDevice.deleteMany({
          where: { OR: [{ viewerUserId: userId }, { hostDeviceId: { in: deviceIds } }] }
        });
        await tx.savedDevice.deleteMany({
          where: { OR: [{ userId: userId }, { deviceId: { in: deviceIds } }] }
        });

        // Delete Sessions
        await tx.session.deleteMany({
          where: { OR: [{ viewerId: userId }, { hostId: { in: deviceIds } }] }
        });

        // Delete Devices
        await tx.device.deleteMany({ where: { ownerId: userId } });

        // Delete Subscription & Support
        await tx.subscription.deleteMany({ where: { userId } });
        await tx.supportTicket.deleteMany({ where: { userId } });
        await tx.guideRequest.deleteMany({ where: { userId } });

        // 3. Delete the User
        await tx.user.delete({ where: { id: userId } });

        // 4. Finally delete the Org if they were a SUB_ADMIN
        if (user.role === 'SUB_ADMIN' && user.organizationId) {
          await tx.organization.delete({ where: { id: user.organizationId } });
        }
      });

      return reply.send({ success: true, message: 'Account closed and all data wiped.' });
    } catch (err: any) {
      console.error('[Auth-Service] Account closure failed:', err);
      return reply.code(500).send({ error: 'Failed to close account' });
    }
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
