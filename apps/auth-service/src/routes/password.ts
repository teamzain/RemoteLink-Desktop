import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

export default async function passwordRoutes(fastify: FastifyInstance) {
  fastify.post('/forgot', async (request: FastifyRequest, reply: FastifyReply) => {
    // TODO: Generate password reset token, save to DB, and send email
    return reply.send({ message: 'Password reset email sent placeholder' });
  });

  fastify.post('/reset', async (request: FastifyRequest, reply: FastifyReply) => {
    // TODO: Verify reset token and update user password
    return reply.send({ message: 'Password updated placeholder' });
  });
}
