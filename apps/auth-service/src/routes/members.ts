import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { prisma, verifyToken } from '@remotelink/shared';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

export default async function memberRoutes(fastify: FastifyInstance) {
  
  // Helper to verify Org Admin (SUB_ADMIN)
  const requireOrgAdmin = async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });
    
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    
    if (!decoded || (decoded.role !== 'SUB_ADMIN' && decoded.role !== 'SUPER_ADMIN')) {
      return reply.code(403).send({ error: 'Org Admin access required' });
    }
    
    return decoded;
  };

  // 1. Invite a Member (SUB_ADMIN ONLY)
  fastify.post('/invite', async (request: FastifyRequest, reply: FastifyReply) => {
    const decoded = await requireOrgAdmin(request, reply);
    if (!decoded) return;

    const { email, role, departmentId, allowedTags } = request.body as any;
    if (!email || !role) return reply.code(400).send({ error: 'Email and Role are required' });

    // Ensure they can't invite a Super Admin
    if (role === 'SUPER_ADMIN' && decoded.role !== 'SUPER_ADMIN') {
      return reply.code(403).send({ error: 'Cannot invite Super Admins' });
    }

    const orgId = decoded.orgId; // Taken from JWT
    if (!orgId) return reply.code(400).send({ error: 'Admin must belong to an organization to invite members' });

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    try {
      const invitation = await prisma.invitation.create({
        data: {
          email,
          token,
          role: role as any,
          organizationId: orgId,
          departmentId,
          allowedTags: allowedTags || [],
          expiresAt
        }
      });

      // Send Invitation Email
      if (process.env.SMTP_HOST) {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587', 10),
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          }
        });

        // In a real app, this URL would point to your frontend onboarding page
        const inviteLink = `remotelink://onboard?token=${token}`;

        await transporter.sendMail({
          from: `"Connect-X Team" <${process.env.SMTP_USER}>`,
          to: email,
          subject: 'You have been invited to join an organization on Connect-X',
          html: `
            <h1>Hello!</h1>
            <p>You have been invited to join your team on Connect-X as a <strong>${role}</strong>.</p>
            <p>Tap the link below to set your password and get started:</p>
            <a href="${inviteLink}" style="padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 5px;">Join Organization</a>
            <p>This link expires in 7 days.</p>
          `
        });
      }

      console.log(`[Auth] Invitation sent to ${email} with token: ${token}`);
      return reply.send({ success: true, invitationId: invitation.id });
    } catch (err: any) {
      console.error('[Auth] Failed to create invitation:', err);
      return reply.code(500).send({ error: 'Failed to send invitation' });
    }
  });

  // 2. List all Members (SUB_ADMIN ONLY)
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const decoded = await requireOrgAdmin(request, reply);
    if (!decoded) return;

    const members = await prisma.user.findMany({
      where: { organizationId: decoded.orgId },
      select: {
          id: true,
          email: true,
          name: true,
          role: true,
          department: { select: { name: true } },
          createdAt: true
      }
    });

    const pendingInvites = await prisma.invitation.findMany({
        where: { organizationId: decoded.orgId, expiresAt: { gt: new Date() } }
    });

    return reply.send({ members, pendingInvites });
  });

  // 3. Remove a Member
  fastify.delete('/:userId', async (request: FastifyRequest, reply: FastifyReply) => {
     const decoded = await requireOrgAdmin(request, reply);
     if (!decoded) return;

     const { userId } = request.params as { userId: string };

     // Block self-deletion
     if (userId === decoded.userId) return reply.code(400).send({ error: 'Cannot remove yourself' });

     await prisma.user.update({
         where: { id: userId, organizationId: decoded.orgId },
         data: { organizationId: null, role: 'USER' } // Reset to generic user
     });

     return reply.send({ success: true });
  });

  // 4. Cancel/Delete Invitation
  fastify.delete('/invitation/:invitationId', async (request: FastifyRequest, reply: FastifyReply) => {
    const decoded = await requireOrgAdmin(request, reply);
    if (!decoded) return;

    const { invitationId } = request.params as { invitationId: string };

    await prisma.invitation.deleteMany({
      where: { id: invitationId, organizationId: decoded.orgId }
    });

    return reply.send({ success: true });
  });
}
