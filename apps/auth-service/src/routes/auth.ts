import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import bcrypt from 'bcryptjs';
import { prisma, publishEvent, EventChannel, generateToken, verifyToken } from '@remotelink/shared';

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/register', async (request: FastifyRequest, reply: FastifyReply) => {
    const { email, password, name } = request.body as any;
    
    if (!email || !password) {
      return reply.code(400).send({ error: 'Email and password are required' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return reply.code(400).send({ error: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await prisma.user.create({
      data: { email, password: hashedPassword, name }
    });

    // Notify other services that a user was created
    await publishEvent({
      channel: EventChannel.USER_CREATED,
      payload: { userId: user.id, email: user.email }
    });

    const token = generateToken({ userId: user.id, role: user.role });
    const refreshToken = generateToken({ userId: user.id, role: user.role, type: 'refresh' } as any);
    return reply.code(201).send({ token, refreshToken, user: { id: user.id, email: user.email, name: user.name } });
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

    const token = generateToken({ userId: user.id, role: user.role });
    const refreshToken = generateToken({ userId: user.id, role: user.role, type: 'refresh' } as any);
    return reply.send({ token, refreshToken, user: { id: user.id, email: user.email, name: user.name } });
  });

  fastify.post('/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    const { refreshToken } = request.body as any;
    if (!refreshToken) return reply.code(400).send({ error: 'Refresh token required' });
    
    // Verify the refresh token signature and extract userId, role
    const decoded = verifyToken(refreshToken);
    if (!decoded || !decoded.userId || decoded.type !== 'refresh') {
       return reply.code(401).send({ error: 'Invalid refresh token' });
    }

    const token = generateToken({ userId: decoded.userId, role: decoded.role });
    const newRefreshToken = generateToken({ userId: decoded.userId, role: decoded.role, type: 'refresh' } as any);
    return reply.send({ token, refreshToken: newRefreshToken });
  });
}
