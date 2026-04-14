import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Pre-load environment variables from the root .env file
const envPath = path.resolve(process.cwd(), '../../.env');
console.log(`[Shared-DB] Loading .env from: ${envPath}`);
dotenv.config({ path: envPath });

console.log(`[Shared-DB] DATABASE_URL present: ${!!process.env.DATABASE_URL}`);

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient({
    datasources: {
        db: {
            url: process.env.DATABASE_URL
        }
    }
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
