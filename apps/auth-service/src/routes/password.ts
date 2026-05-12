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

function renderPasswordResetEmail(code: string) {
  return `
    <div style="margin:0;padding:0;background:#f4f7fb;font-family:Inter,Segoe UI,Arial,sans-serif;color:#101828">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7fb;padding:32px 16px">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border:1px solid #e6ebf2;border-radius:20px;overflow:hidden;box-shadow:0 18px 45px rgba(16,24,40,.08)">
              <tr>
                <td style="background:#00193f;padding:28px 32px">
                  <div style="font-size:22px;font-weight:800;letter-spacing:-.02em;color:#ffffff">Remote 365</div>
                  <div style="font-size:13px;font-weight:600;color:#b8c7df;margin-top:6px">Password reset request</div>
                </td>
              </tr>
              <tr>
                <td style="padding:32px">
                  <h1 style="margin:0 0 10px;font-size:24px;line-height:1.25;color:#101828">Reset your password</h1>
                  <p style="margin:0 0 24px;font-size:14px;line-height:1.7;color:#667085">Enter this code in Remote 365 to choose a new password. The code expires in 15 minutes.</p>
                  <div style="background:#f8fafc;border:1px solid #e4eaf2;border-radius:16px;padding:22px;text-align:center">
                    <div style="font-size:34px;line-height:1;font-weight:800;letter-spacing:.16em;color:#00193f;font-family:Consolas,Menlo,monospace">${code}</div>
                  </div>
                  <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#98a2b3">If you did not request this reset, your password has not been changed.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `;
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
    from: `"Remote 365" <${process.env.SMTP_USER}>`,
    to,
    subject: 'Your Remote 365 password reset code',
    text: `Your Remote 365 password reset code is ${code}. It expires in 15 minutes.`,
    html: renderPasswordResetEmail(code),
  });
}

export default async function passwordRoutes(fastify: FastifyInstance) {
  // POST /api/auth/password/forgot
  fastify.post('/forgot', async (request: FastifyRequest, reply: FastifyReply) => {
    const { email } = request.body as any;
    if (!email) return reply.code(400).send({ error: 'Email is required' });

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });

    if (!user) return reply.code(404).send({ error: 'Account does not exist in the system' });

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

    return reply.send({ message: 'A reset code has been sent to your email.' });
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
