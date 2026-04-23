import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from root .env
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding plan limits...');

  const plans = [
    {
      plan: 'TRIAL',
      maxConcurrentSessions: 1,
      maxDevices: 1,
      sessionDurationMinutes: 10,
      fileTransfer: false,
      sessionRecording: false,
      teamMembers: 0,
    },
    {
      plan: 'SOLO',
      maxConcurrentSessions: 1,
      maxDevices: 1,
      sessionDurationMinutes: -1,
      fileTransfer: true,
      sessionRecording: true,
      teamMembers: 1,
    },
    {
      plan: 'PRO', // PRO
      maxConcurrentSessions: 1,
      maxDevices: 10,
      sessionDurationMinutes: -1,
      fileTransfer: true,
      sessionRecording: true,
      teamMembers: 1,
    },
    {
      plan: 'BUSINESS', // TEAM
      maxConcurrentSessions: -1,
      maxDevices: 50,
      sessionDurationMinutes: -1,
      fileTransfer: true,
      sessionRecording: true,
      teamMembers: -1,
    },
    {
      plan: 'ENTERPRISE', // ENTERPRISE
      maxConcurrentSessions: -1,
      maxDevices: 100,
      sessionDurationMinutes: -1,
      fileTransfer: true,
      sessionRecording: true,
      teamMembers: -1,
    },
  ];

  for (const p of plans) {
    await (prisma as any).planLimit.upsert({
      where: { plan: p.plan as any },
      update: p,
      create: p as any,
    });
  }

  console.log('Plan limits seeded successfully.');

  // --- Initial Super Admin Provisioning ---
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@remotelink.io';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!';
  const orgName = process.env.ORG_NAME || 'RemoteLink Corporate';
  const orgSlug = process.env.ORG_SLUG || 'remotelink';

  console.log(`Checking for initial organization: ${orgName}...`);
  let org = await prisma.organization.findUnique({ where: { slug: orgSlug } });
  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: orgName,
        slug: orgSlug
      }
    });
    console.log(`Created Organization: ${org.name}`);
  }

  console.log(`Checking for Super Admin: ${adminEmail}...`);
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });

  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        password: hashedPassword,
        name: 'System Administrator',
        role: 'SUPER_ADMIN',
        organizationId: org.id,
        subscription: {
          create: {
            plan: 'ENTERPRISE',
            status: 'ACTIVE'
          }
        }
      }
    });
    console.log(`Successfully created Super Admin: ${admin.email}`);
    console.log(`CREDENTIALS: ${adminEmail} / ${adminPassword}`);
    console.log(`IMPORTANT: Please change this password after your first login!`);
  } else {
    console.log('Super Admin already exists. Skipping user creation.');
  }

  console.log('Seeding complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
