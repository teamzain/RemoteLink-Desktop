import Fastify from 'fastify';
import Stripe from 'stripe';
import { prisma } from '@remotelink/shared';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || 'sk_test_dummy';
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_dummy';

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2024-04-10',
});

const server = Fastify({ logger: true });

// For actual Stripe webhooks, we need the raw body. In production, we'd use fastify-raw-body plugin.
server.post('/webhooks/stripe', async (request, reply) => {
  const sig = request.headers['stripe-signature'];
  
  let event: Stripe.Event;
  
  // If we are doing local dummy testing, bypass signature verification so you can just send raw JSON requests (like from Postman)
  if (endpointSecret === 'whsec_dummy') {
    server.log.warn('Bypassing Stripe signature verification for dummy testing');
    event = (typeof request.body === 'string' ? JSON.parse(request.body) : request.body) as Stripe.Event;
  } else {
    try {
      // Note: request.body must be the raw string for Stripe signature to match.
      event = stripe.webhooks.constructEvent(request.body as any, sig as string, endpointSecret);
    } catch (err: any) {
      server.log.error(`Webhook signature verification failed: ${err.message}`);
      return reply.code(400).send(`Webhook Error: ${err.message}`);
    }
  }

  // Handle the event
  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      const subscription = event.data.object;
      server.log.info(`Subscription status: ${subscription.status}`);
      // TODO: Map Stripe customer ID to Prisma User ID, update their subscription tier
      break;
    default:
      server.log.info(`Unhandled event type ${event.type}`);
  }

  reply.send({ received: true });
});

server.get('/health', async () => {
  return { status: 'ok', service: 'billing-service' };
});

const start = async () => {
  try {
    await server.listen({ port: 3003, host: '0.0.0.0' });
    server.log.info('Billing service listening on port 3003');
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
