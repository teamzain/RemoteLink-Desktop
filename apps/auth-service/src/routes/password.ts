import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import { prisma } from '@remotelink/shared';

function makeCode(len = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

async function sendResetEmail(to: string, code: string) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log(`[Password-Reset] SMTP not configured. Reset code for ${to}: ${code}`);
    return;
  }
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await transporter.sendMail({
    from: `"Connect-X" <${process.env.SMTP_USER}>`,
    to,
    subject: 'Your Password Reset Code',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
        <h2 style="font-size:20px;font-weight:800;color:#1C1C1C;margin-bottom:8px">Reset Your Password</h2>
        <p style="color:#666;font-size:14px;margin-bottom:24px">Use the code below in the Connect-X app. It expires in 15 minutes.</p>
        <div style="background:#F9F9FA;border-radius:16px;padding:24px;text-align:center;letter-spacing:0.3em;font-size:32px;font-weight:900;font-family:monospace;color:#1C1C1C;border:1px solid rgba(28,28,28,0.06)">
          ${code}
        </div>
        <p style="color:#999;font-size:12px;margin-top:24px">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  });
}

export default async function passwordRoutes(fastify: FastifyInstance) {
  // POST /api/auth/password/forgot
  fastify.post('/forgot', async (request: FastifyRequest, reply: FastifyReply) => {
    const { email } = request.body as any;
    if (!email) return reply.code(400).send({ error: 'Email is required' });

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });

    // Always respond the same to avoid user enumeration
    if (!user) return reply.send({ message: 'If that email exists, a reset code has been sent.' });

    const code = makeCode();
    const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 min

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordResetToken: code, passwordResetExpires: expires },
    });

    try {
      await sendResetEmail(email, code);
    } catch (err: any) {
      console.error('[Password-Reset] Email send failed:', err.message);
    }

    return reply.send({ message: 'If that email exists, a reset code has been sent.' });
  });

  // POST /api/auth/password/reset
  fastify.post('/reset', async (request: FastifyRequest, reply: FastifyReply) => {
    const { email, code, newPassword } = request.body as any;
    if (!email || !code || !newPassword)
      return reply.code(400).send({ error: 'Email, code, and new password are required' });

    if (newPassword.length < 8)
      return reply.code(400).send({ error: 'Password must be at least 8 characters' });

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });

    if (
      !user ||
      !user.passwordResetToken ||
      !user.passwordResetExpires ||
      user.passwordResetToken !== code.toUpperCase().trim() ||
      user.passwordResetExpires < new Date()
    ) {
      return reply.code(400).send({ error: 'Invalid or expired reset code' });
    }

    const hashed = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed, passwordResetToken: null, passwordResetExpires: null },
    });

    return reply.send({ message: 'Password updated successfully' });
  });
}
