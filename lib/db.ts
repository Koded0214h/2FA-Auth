import { PrismaClient } from './generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

declare global {
  var _prisma: PrismaClient | undefined;
}

function createClient() {
  // @ts-ignore
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  // @ts-ignore
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export const db = global._prisma ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  global._prisma = db;
}
