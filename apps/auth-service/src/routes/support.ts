import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { prisma, verifyToken } from '@remotelink/shared';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const SUPPORT_EMAIL = 'zainulabidden769@gmail.com';

export default async function supportRoutes(fastify: FastifyInstance) {
  // 1. Get user's tickets
  fastify.get('/tickets', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) return reply.code(401).send({ error: 'Invalid token' });

    try {
      const tickets = await (prisma as any).supportTicket.findMany({
        where: { userId: decoded.userId },
        orderBy: { createdAt: 'desc' }
      });
      return reply.send(tickets);
    } catch (err) {
      return reply.send([]);
    }
  });

  // 2. Create a new ticket
  fastify.post('/tickets', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) return reply.code(401).send({ error: 'Invalid token' });

    const { subject, description, category } = request.body as any;
    if (!subject || !description) return reply.code(400).send({ error: 'Subject and description required' });

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    const userEmail = user?.email || 'Unknown User';

    const displayId = `TIC-${Math.floor(1000 + Math.random() * 8999)}`;

    try {
      const ticket = await (prisma as any).supportTicket.create({
        data: {
          userId: decoded.userId,
          displayId,
          subject,
          description,
          category: category || 'Other',
          status: 'Open'
        }
      });

      // Send Email
      await transporter.sendMail({
        from: `"RemoteLink Support" <${process.env.SMTP_USER}>`,
        to: SUPPORT_EMAIL,
        subject: `[New Ticket] ${displayId}: ${subject}`,
        text: `New Support Ticket Created:\n\nUser: ${userEmail}\nID: ${displayId}\nCategory: ${category}\nSubject: ${subject}\n\nDescription:\n${description}`,
        html: `<h2>New Support Ticket</h2>
               <p><strong>User:</strong> ${userEmail}</p>
               <p><strong>ID:</strong> ${displayId}</p>
               <p><strong>Category:</strong> ${category}</p>
               <p><strong>Subject:</strong> ${subject}</p>
               <hr/>
               <p><strong>Description:</strong></p>
               <p>${description.replace(/\n/g, '<br/>')}</p>`
      });

      return reply.send(ticket);
    } catch (err) {
      return reply.send({ id: 'mock-id', displayId, subject, status: 'Open', createdAt: new Date() });
    }
  });

  // 3. Request a custom guide
  fastify.post('/guides', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) return reply.code(401).send({ error: 'Invalid token' });

    const { description } = request.body as any;
    if (!description) return reply.code(400).send({ error: 'Description required' });

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    const userEmail = user?.email || 'Unknown User';

    try {
      const guideRequest = await (prisma as any).guideRequest.create({
        data: {
          userId: decoded.userId,
          description,
          status: 'Pending'
        }
      });

      // Send Email
      await transporter.sendMail({
        from: `"RemoteLink Support" <${process.env.SMTP_USER}>`,
        to: SUPPORT_EMAIL,
        subject: `[Guide Request] New Custom Guide Requested`,
        text: `New Custom Guide Requested:\n\nUser: ${userEmail}\n\nDescription:\n${description}`,
        html: `<h2>New Custom Guide Request</h2>
               <p><strong>User:</strong> ${userEmail}</p>
               <hr/>
               <p><strong>Use Case Description:</strong></p>
               <p>${description.replace(/\n/g, '<br/>')}</p>`
      });

      return reply.send(guideRequest);
    } catch (err) {
      return reply.send({ success: true, message: 'Request received (mock)' });
    }
  });

  // 4. Technical Report
  fastify.post('/report', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) return reply.code(401).send({ error: 'Invalid token' });

    const { subject, description } = request.body as any;
    if (!subject || !description) return reply.code(400).send({ error: 'Subject and description required' });

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    const userEmail = user?.email || 'Unknown User';

    try {
      // Send Email
      await transporter.sendMail({
        from: `"RemoteLink Reports" <${process.env.SMTP_USER}>`,
        to: SUPPORT_EMAIL,
        subject: `[Technical Report] ${subject}`,
        text: `New Technical Report Submitted:\n\nUser: ${userEmail}\nSubject: ${subject}\n\nReport Details:\n${description}`,
        html: `<h2>New Technical Report</h2>
               <p><strong>User:</strong> ${userEmail}</p>
               <p><strong>Subject:</strong> ${subject}</p>
               <hr/>
               <p><strong>Report Details:</strong></p>
               <p>${description.replace(/\n/g, '<br/>')}</p>`
      });

      return reply.send({ success: true });
    } catch (err) {
      return reply.send({ error: 'Failed to send report' });
    }
  });
}
