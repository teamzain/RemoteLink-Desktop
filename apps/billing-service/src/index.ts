import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env BEFORE any other imports to ensure Prisma finds DATABASE_URL
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import Fastify from 'fastify';
import Stripe from 'stripe';
import cron from 'node-cron';
import { prisma, verifyToken } from '@remotelink/shared';
import rawBody from 'fastify-raw-body';
import cors from '@fastify/cors';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || 'sk_test_dummy';
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_dummy';

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2024-04-10',
});

const server = Fastify({ logger: true });

server.register(rawBody, {
  field: 'rawBody',
  global: false,
  encoding: 'utf8',
  runFirst: true,
});

server.register(cors, {
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
});

server.get('/health', async () => {
  return { status: 'ok', service: 'billing-service' };
});

// 1. GET /billing/plans — Returns all four plans
server.get('/billing/plans', async (request, reply) => {
  const plans = [
    { 
      id: 'FREE', 
      name: 'Free', 
      price: 0, 
      priceId: process.env.STRIPE_PRICE_ID_FREE, 
      priceLabel: '$0 / month',
      description: 'Standard remote access for personal use',
      maxDevices: 1,
      maxUsers: 1,
      features: ['1 session', '1 device', '10 min sessions'] 
    },
    { 
      id: 'PRO', 
      name: 'Pro', 
      price: 19, 
      priceId: process.env.STRIPE_PRICE_ID_PRO, 
      priceLabel: '$19 / month',
      description: 'Advanced features for power users',
      maxDevices: 5,
      maxUsers: 1,
      features: ['3 sessions', '5 devices', '4 hr sessions', 'File transfer'] 
    },
    { 
      id: 'BUSINESS', 
      name: 'Business', 
      price: 49, 
      priceId: process.env.STRIPE_PRICE_ID_BUSINESS, 
      priceLabel: '$49 / month',
      description: 'Enterprise-grade control for teams',
      maxDevices: 50,
      maxUsers: null,
      features: ['10 sessions', 'Unlimited devices', 'Unlimited duration', 'Recording', 'Team management'] 
    },
    { 
      id: 'ENTERPRISE', 
      name: 'Enterprise', 
      price: 'Custom', 
      priceId: process.env.STRIPE_PRICE_ID_ENTERPRISE, 
      priceLabel: 'Custom pricing',
      description: 'Full infrastructure for large organizations',
      maxDevices: null,
      maxUsers: null,
      features: ['Unlimited everything', 'Dedicated support', 'Custom integration'] 
    },
  ];
  return {
    plans,
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY
  };
});

// 2. POST /billing/create-customer — Internal call after registration
server.post('/billing/create-customer', async (request, reply) => {
  const { userId, email } = request.body as any;
  if (!userId || !email) return reply.code(400).send({ error: 'userId and email required' });

  try {
    const customer = await stripe.customers.create({ email });
    
    await (prisma as any).subscription.create({
      data: {
        userId,
        stripeCustomerId: customer.id,
        plan: 'FREE',
        status: 'ACTIVE'
      }
    });

    return { success: true, stripeCustomerId: customer.id };
  } catch (err: any) {
    server.log.error(err);
    return reply.code(500).send({ error: 'Failed to create customer: ' + err.message });
  }
});

// 3. POST /billing/subscribe — Accept plan name and PM ID
server.post('/billing/subscribe', async (request, reply) => {
  const authHeader = request.headers.authorization;
  if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);
  if (!decoded || !decoded.userId) return reply.code(401).send({ error: 'Invalid token' });

  const { plan, paymentMethodId } = request.body as any;
  if (!plan) return reply.code(400).send({ error: 'Plan name is required' });

  try {
    let sub = await (prisma as any).subscription.findUnique({ where: { userId: decoded.userId } });
    if (!sub || !sub.stripeCustomerId) {
      const user = await (prisma as any).user.findUnique({ where: { id: decoded.userId } });
      if (!user) return reply.code(404).send({ error: 'User not found' });

      try {
        const customer = await stripe.customers.create({ email: user.email });
        sub = await (prisma as any).subscription.upsert({
          where: { userId: decoded.userId },
          create: {
            userId: decoded.userId,
            stripeCustomerId: customer.id,
            plan: 'FREE',
            status: 'ACTIVE'
          },
          update: {
            stripeCustomerId: customer.id
          }
        });
      } catch (stripeErr: any) {
        server.log.warn(`[Billing] Stripe unavailable during subscribe: ${stripeErr.message}`);
        sub = await (prisma as any).subscription.upsert({
          where: { userId: decoded.userId },
          create: {
            userId: decoded.userId,
            stripeCustomerId: `local_${decoded.userId}`,
            plan: 'FREE',
            status: 'ACTIVE'
          },
          update: { stripeCustomerId: `local_${decoded.userId}` }
        });
      }
    }

    if (plan === 'FREE') {
      await (prisma as any).subscription.update({
        where: { userId: decoded.userId },
        data: { plan: 'FREE', status: 'ACTIVE', stripeSubscriptionId: null }
      });
      return { success: true };
    }

    const priceId = process.env[`STRIPE_PRICE_ID_${plan.toUpperCase()}`];
    if (!priceId) return reply.code(400).send({ error: 'Invalid plan for subscription' });

    // If we only have a local (non-Stripe) customer ID, skip Stripe and record locally
    const isLocalCustomer = !sub.stripeCustomerId || sub.stripeCustomerId.startsWith('local_');
    if (isLocalCustomer) {
      server.log.warn(`[Billing] Local customer — recording plan ${plan} without Stripe.`);
      await (prisma as any).subscription.update({
        where: { userId: decoded.userId },
        data: {
          plan: plan.toUpperCase() as any,
          status: 'ACTIVE',
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        }
      });
      return { success: true, local: true };
    }

    const subscription = await stripe.subscriptions.create({
      customer: sub.stripeCustomerId,
      items: [{ price: priceId }],
      default_payment_method: paymentMethodId,
      expand: ['latest_invoice.payment_intent'],
    });

    const latestInvoice = subscription.latest_invoice as Stripe.Invoice;
    const paymentIntent = latestInvoice.payment_intent as Stripe.PaymentIntent;

    if (paymentIntent && paymentIntent.status === 'requires_action') {
      return { clientSecret: paymentIntent.client_secret, requiresAction: true };
    }

    await (prisma as any).subscription.update({
      where: { userId: decoded.userId },
      data: {
        plan: plan.toUpperCase() as any,
        status: 'ACTIVE',
        stripeSubscriptionId: subscription.id,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000)
      }
    });

    return { success: true, subscriptionId: subscription.id };
  } catch (err: any) {
    server.log.error(err);
    return reply.code(500).send({ error: 'Subscription failed: ' + err.message });
  }
});

// 3b. PATCH /billing/my-plan — Direct plan switch (Legacy/Test Mode support)
server.patch('/billing/my-plan', async (request, reply) => {
  const authHeader = request.headers.authorization;
  if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);
  if (!decoded || !decoded.userId) return reply.code(401).send({ error: 'Invalid token' });

  const { plan } = request.body as any;
  if (!plan) return reply.code(400).send({ error: 'Plan is required' });

  try {
    const sub = await (prisma as any).subscription.upsert({
      where: { userId: decoded.userId },
      update: { plan: plan.toUpperCase(), status: 'ACTIVE' },
      create: { userId: decoded.userId, plan: plan.toUpperCase(), status: 'ACTIVE' }
    });

    return { success: true, plan: sub.plan };
  } catch (err: any) {
    server.log.error(err);
    return reply.code(500).send({ error: 'Failed to update plan: ' + err.message });
  }
});

// 4. POST /billing/cancel — Cancel at end of period
server.post('/billing/cancel', async (request, reply) => {
  const authHeader = request.headers.authorization;
  if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);
  if (!decoded || !decoded.userId) return reply.code(401).send({ error: 'Invalid token' });

  try {
    const sub = await (prisma as any).subscription.findUnique({ where: { userId: decoded.userId } });
    if (!sub || !sub.stripeSubscriptionId) return reply.code(404).send({ error: 'No active subscription' });

    await stripe.subscriptions.update(sub.stripeSubscriptionId, { cancel_at_period_end: true });

    await (prisma as any).subscription.update({
      where: { userId: decoded.userId },
      data: { cancelAtPeriodEnd: true }
    });

    return { success: true };
  } catch (err: any) {
    server.log.error(err);
    return reply.code(500).send({ error: 'Cancellation failed: ' + err.message });
  }
});

// 5. GET /billing/current — Current plan status
server.get('/billing/current', async (request, reply) => {
  const authHeader = request.headers.authorization;
  if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);
  if (!decoded || !decoded.userId) return reply.code(401).send({ error: 'Invalid token' });

  let sub = await (prisma as any).subscription.findUnique({ where: { userId: decoded.userId } });
  if (!sub) {
    const user = await (prisma as any).user.findUnique({ where: { id: decoded.userId } });
    if (!user) return reply.code(404).send({ error: 'User not found' });
    
    try {
      const customer = await stripe.customers.create({ email: user.email });
      sub = await (prisma as any).subscription.upsert({
        where: { userId: decoded.userId },
        create: {
          userId: decoded.userId,
          stripeCustomerId: customer.id,
          plan: 'FREE',
          status: 'ACTIVE'
        },
        update: { stripeCustomerId: customer.id }
      });
    } catch (err: any) {
      server.log.warn(`[Billing] Stripe unavailable, creating local subscription: ${err.message}`);
      try {
        sub = await (prisma as any).subscription.upsert({
          where: { userId: decoded.userId },
          create: {
            userId: decoded.userId,
            stripeCustomerId: `local_${decoded.userId}`,
            plan: 'FREE',
            status: 'ACTIVE'
          },
          update: {}
        });
      } catch (dbErr: any) {
        server.log.error(dbErr);
        return reply.code(500).send({ error: 'Failed to create subscription record' });
      }
    }
  }

  // Fetch card details if Stripe customer exists
  let cardInfo = {};
  if (sub.stripeCustomerId && !sub.stripeCustomerId.startsWith('local_')) {
    try {
      const customer = await stripe.customers.retrieve(sub.stripeCustomerId, {
        expand: ['invoice_settings.default_payment_method']
      }) as Stripe.Customer;

      if (customer.invoice_settings?.default_payment_method) {
        const pm = customer.invoice_settings.default_payment_method as Stripe.PaymentMethod;
        cardInfo = {
          card_brand: pm.card?.brand,
          card_last4: pm.card?.last4,
          card_exp_month: pm.card?.exp_month,
          card_exp_year: pm.card?.exp_year,
        };
      }
    } catch (err) {
      server.log.warn(`Failed to fetch card info for customer ${sub.stripeCustomerId}`);
    }
  }

  // Fetch recent invoices
  let invoices: any[] = [];
  if (sub.stripeCustomerId && !sub.stripeCustomerId.startsWith('local_')) {
    try {
      const invList = await stripe.invoices.list({ customer: sub.stripeCustomerId, limit: 5 });
      invoices = invList.data.map(inv => ({
        id: inv.id,
        number: inv.number,
        created: inv.created,
        total: inv.total,
        status: inv.status,
        invoice_pdf: inv.invoice_pdf
      }));
    } catch (err) {
      server.log.warn(`Failed to fetch invoices for customer ${sub.stripeCustomerId}`);
    }
  }

  return {
    plan: sub.plan,
    status: sub.status,
    currentPeriodEnd: sub.currentPeriodEnd,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    ...cardInfo,
    invoices
  };
});

// 5b. POST /billing/portal — Create Stripe Customer Portal session
server.post('/billing/portal', async (request, reply) => {
  const authHeader = request.headers.authorization;
  if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);
  if (!decoded || !decoded.userId) return reply.code(401).send({ error: 'Invalid token' });

  try {
    const sub = await (prisma as any).subscription.findUnique({ where: { userId: decoded.userId } });
    if (!sub || !sub.stripeCustomerId) return reply.code(404).send({ error: 'Customer not found' });

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: process.env.WEB_APP_URL || 'http://localhost:5173/billing',
    });

    return { url: portalSession.url };
  } catch (err: any) {
    server.log.error(err);
    return reply.code(500).send({ error: 'Failed to create portal session: ' + err.message });
  }
});

// 6. GET /billing/invoices — Fetch invoice history
server.get('/billing/invoices', async (request, reply) => {
  const authHeader = request.headers.authorization;
  if (!authHeader) return reply.code(401).send({ error: 'Unauthorized' });

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);
  if (!decoded || !decoded.userId) return reply.code(401).send({ error: 'Invalid token' });

  try {
    const sub = await (prisma as any).subscription.findUnique({ where: { userId: decoded.userId } });
    if (!sub || !sub.stripeCustomerId) return reply.code(404).send({ error: 'Customer not found' });

    const invoices = await stripe.invoices.list({ customer: sub.stripeCustomerId });
    
    return invoices.data.map(inv => ({
      amount: inv.total / 100,
      date: new Date(inv.created * 1000).toISOString(),
      status: inv.status,
      pdfUrl: inv.invoice_pdf
    }));
  } catch (err: any) {
    server.log.error(err);
    return reply.code(500).send({ error: 'Failed to fetch invoices: ' + err.message });
  }
});

// 7. POST /billing/webhook — Handle Stripe events
server.post('/billing/webhook', { config: { rawBody: true } }, async (request: any, reply) => {
  const sig = request.headers['stripe-signature'];
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(request.rawBody, sig as string, endpointSecret);
  } catch (err: any) {
    server.log.error(`Webhook signature verification failed: ${err.message}`);
    return reply.code(400).send(`Webhook Error: ${err.message}`);
  }

  const data = event.data.object as any;

  switch (event.type as string) {
    case 'customer.subscription.updated':
      // Map back to plan
      const planMap: Record<string, any> = {
        [process.env.STRIPE_PRICE_ID_PRO!]: 'PRO',
        [process.env.STRIPE_PRICE_ID_BUSINESS!]: 'BUSINESS',
        [process.env.STRIPE_PRICE_ID_ENTERPRISE!]: 'ENTERPRISE'
      };
      const newPlan = planMap[data.items.data[0].price.id] || 'FREE';
      
      await (prisma as any).subscription.update({
        where: { stripeSubscriptionId: data.id },
        data: { 
          plan: newPlan, 
          status: data.status.toUpperCase() as any,
          currentPeriodEnd: new Date(data.current_period_end * 1000)
        }
      });
      break;

    case 'customer.subscription.deleted':
      await (prisma as any).subscription.update({
        where: { stripeSubscriptionId: data.id },
        data: { status: 'CANCELLED', plan: 'FREE' }
      });
      break;

    case 'invoice.payment_succeeded':
      if (data.subscription) {
        const sub = await stripe.subscriptions.retrieve(data.subscription);
        await (prisma as any).subscription.update({
          where: { stripeSubscriptionId: data.subscription },
          data: { currentPeriodEnd: new Date(sub.current_period_end * 1000) }
        });
      }
      break;

    case 'invoice.payment_failed':
      await (prisma as any).subscription.update({
        where: { stripeSubscriptionId: data.subscription },
        data: { status: 'PAST_DUE' }
      });
      console.warn(`Payment failed for customer ${data.customer}. Notifying user...`);
      // TODO: Call email service to notify payment failure
      break;

    case 'customer.subscription.trial_ending':
      console.info(`Trial ending for customer ${data.customer}. Notifying user...`);
      // TODO: Call email service to notify trial ending in 3 days
      break;
  }

  return { received: true };
});

// Daily cleanup job: Midnight
cron.schedule('0 0 * * *', async () => {
  console.log('[Cron] Checking for expired past_due subscriptions...');
  const now = new Date();
  
  const expired = await (prisma as any).subscription.findMany({
    where: {
      status: 'PAST_DUE',
      currentPeriodEnd: { lt: now }
    }
  });

  for (const sub of expired) {
    await (prisma as any).subscription.update({
      where: { id: sub.id },
      data: { plan: 'FREE', status: 'CANCELLED' }
    });
    console.info(`[Cron] Downgraded user ${sub.userId} due to expired past_due status`);
    // TODO: Send final email notification
  }
});

const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3003', 10);
    await server.listen({ port, host: '0.0.0.0' });
    server.log.info(`Billing service listening on port ${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
