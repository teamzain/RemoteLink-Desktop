import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding plan limits...');

  const plans = [
    {
      plan: 'FREE',
      maxConcurrentSessions: 1,
      maxDevices: 1,
      sessionDurationMinutes: 10,
      fileTransfer: false,
      sessionRecording: false,
      teamMembers: 1,
    },
    {
      plan: 'PRO',
      maxConcurrentSessions: 3,
      maxDevices: 5,
      sessionDurationMinutes: 240,
      fileTransfer: true,
      sessionRecording: false,
      teamMembers: 1,
    },
    {
      plan: 'BUSINESS',
      maxConcurrentSessions: 10,
      maxDevices: -1, // unlimited
      sessionDurationMinutes: -1, // unlimited
      fileTransfer: true,
      sessionRecording: true,
      teamMembers: -1, // unlimited
    },
    {
      plan: 'ENTERPRISE',
      maxConcurrentSessions: 100, // custom high value
      maxDevices: -1,
      sessionDurationMinutes: -1,
      fileTransfer: true,
      sessionRecording: true,
      teamMembers: -1,
    },
  ];

  for (const p of plans) {
    await prisma.planLimit.upsert({
      where: { plan: p.plan as any },
      update: p,
      create: p as any,
    });
  }

  console.log('Plan limits seeded successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
