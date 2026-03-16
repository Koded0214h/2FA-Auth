import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import redisClient from '@/lib/redis';
import { hashOtp } from '@/lib/otp';

const OTP_PREFIX = 'otp:';
const MAX_ATTEMPTS = 5;

export async function POST(req: NextRequest) {
  try {
    const apiKey = req.headers.get('authorization')?.replace('Bearer ', '').trim();
    if (!apiKey) {
      return NextResponse.json({ error: 'Missing API key' }, { status: 401 });
    }

    const dbUser = await db.vp_user.findFirst({
      where: { api_key: apiKey },
      select: { id: true },
    });

    if (!dbUser) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const { otp } = await req.json();
    if (!otp) {
      return NextResponse.json({ error: 'OTP is required' }, { status: 400 });
    }

    const otpKey = `${OTP_PREFIX}${dbUser.id}`;
    const stored = await redisClient.hGetAll(otpKey);

    if (!stored || !stored.hash) {
      return NextResponse.json(
        { error: 'OTP expired or not found. Please request a new one.' },
        { status: 400 }
      );
    }

    const attempts = parseInt(stored.attempts ?? '0', 10);
    if (attempts >= MAX_ATTEMPTS) {
      await redisClient.del(otpKey);
      return NextResponse.json(
        { error: 'Too many failed attempts. Please request a new OTP.' },
        { status: 429 }
      );
    }

    const hashedInput = hashOtp(dbUser.id.toString(), otp);
    if (hashedInput !== stored.hash) {
      await redisClient.hSet(otpKey, { attempts: attempts + 1 });
      const remaining = MAX_ATTEMPTS - (attempts + 1);
      return NextResponse.json(
        { error: `Invalid OTP. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.` },
        { status: 400 }
      );
    }

    await redisClient.del(otpKey);
    return NextResponse.json({ success: true, message: 'OTP verified successfully' });
  } catch (error) {
    console.error('Verify OTP error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
