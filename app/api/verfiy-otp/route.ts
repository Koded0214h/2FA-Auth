import { NextRequest, NextResponse } from 'next/server';
import redisClient from '@/lib/redis';
import { generateOtp, hashOtp } from '@/lib/otp';

// Rate limiting keys
const RATE_LIMIT_PREFIX = 'rate:';
const OTP_PREFIX = 'otp:';

export async function POST(req: NextRequest) {
  try {
    const { accountId, phoneNumber } = await req.json();

    // Basic validation
    if (!accountId || !phoneNumber) {
      return NextResponse.json({ error: 'accountId and phoneNumber required' }, { status: 400 });
    }

    // --- Rate limiting ---
    const rateKey = `${RATE_LIMIT_PREFIX}${accountId}`;
    const currentCount = await redisClient.incr(rateKey);
    if (currentCount === 1) {
      // first request, set expiry
      await redisClient.expire(rateKey, Number(process.env.RATE_LIMIT_WINDOW));
    }
    if (currentCount > Number(process.env.RATE_LIMIT_MAX_REQUESTS)) {
      return NextResponse.json({ error: 'Too many OTP requests. Try later.' }, { status: 429 });
    }

    // --- Generate OTP ---
    const otp = generateOtp();

    // --- Hash OTP ---
    const hashedOtp = hashOtp(accountId, otp);

    // --- Store in Redis with expiration and attempts counter ---
    const otpKey = `${OTP_PREFIX}${accountId}`;
    await redisClient.hSet(otpKey, {
      hash: hashedOtp,
      attempts: 0,
    });
    await redisClient.expire(otpKey, Number(process.env.OTP_EXPIRY_SECONDS));

    // --- Call VoicePass API ---
    const voicepassResponse = await fetch(process.env.VOICEPASS_API_URL!, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.VOICEPASS_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: phoneNumber,
        message: `Your verification code is ${otp}`,
        // Additional VoicePass parameters as per their API
      }),
    });

    if (!voicepassResponse.ok) {
      // Optionally delete stored OTP if voice call fails
      await redisClient.del(otpKey);
      const errorData = await voicepassResponse.text();
      throw new Error(`VoicePass API error: ${errorData}`);
    }

    // --- Success ---
    return NextResponse.json({ success: true, message: 'OTP sent via voice call' });
  } catch (error) {
    console.error('Send OTP error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}