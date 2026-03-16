import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import redisClient from '@/lib/redis';
import { generateOtp, hashOtp } from '@/lib/otp';

const RATE_LIMIT_PREFIX = 'rate:';
const OTP_PREFIX = 'otp:';
const CALL_COST = 3.5;

export async function POST(req: NextRequest) {
  try {
    const apiKey = req.headers.get('authorization')?.replace('Bearer ', '').trim();
    if (!apiKey) {
      return NextResponse.json({ error: 'Missing API key' }, { status: 401 });
    }

    const dbUser = await db.vp_user.findFirst({
      where: { api_key: apiKey },
      select: { id: true, balance: true, api_key: true },
    });

    if (!dbUser) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const { phoneNumber } = await req.json();
    if (!phoneNumber) {
      return NextResponse.json({ error: 'phoneNumber is required' }, { status: 400 });
    }

    let formattedPhone = String(phoneNumber).replace(/\s/g, '').replace(/^\+/, '');
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '234' + formattedPhone.slice(1);
    } else if (!formattedPhone.startsWith('234')) {
      formattedPhone = '234' + formattedPhone;
    }

    const rateKey = `${RATE_LIMIT_PREFIX}${dbUser.id}`;
    const currentCount = await redisClient.incr(rateKey);
    if (currentCount === 1) {
      await redisClient.expire(rateKey, Number(process.env.RATE_LIMIT_WINDOW) || 3600);
    }
    if (currentCount > (Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 50)) {
      return NextResponse.json({ error: 'Too many OTP requests. Try later.' }, { status: 429 });
    }

    if ((dbUser.balance ?? 0) < CALL_COST) {
      return NextResponse.json({ error: 'Insufficient balance' }, { status: 402 });
    }

    const otp = generateOtp();
    const hashedOtp = hashOtp(dbUser.id.toString(), otp);
    const otpKey = `${OTP_PREFIX}${dbUser.id}`;
    await redisClient.hSet(otpKey, { hash: hashedOtp, attempts: 0 });
    await redisClient.expire(otpKey, Number(process.env.OTP_EXPIRY_SECONDS) || 300);

    const voicepassResponse = await fetch('https://api.voicepass.skurel.com/send-voice-otp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + dbUser.api_key,
      },
      body: JSON.stringify({ phone: formattedPhone, otp }),
    });

    const data = await voicepassResponse.json().catch(() => ({}));
    console.log('VoicePass response:', voicepassResponse.status, data);

    const providerSuccess = voicepassResponse.ok || data?.call_id != null || data?.status === 'queue';
    if (!providerSuccess) {
      await redisClient.del(otpKey);
      return NextResponse.json({ error: 'Failed to initiate call via provider' }, { status: 502 });
    }

    const callId = data.call_id || `CID-${Date.now()}`;
    const statusFromProvider = data.status?.toUpperCase() || 'INITIATED';
    const isAnswered = statusFromProvider === 'ANSWERED';
    const isProcessing = ['INITIATED', 'QUEUE', 'RINGING', 'IN-PROGRESS'].includes(statusFromProvider);
    const isImmediateNonBillable = !isAnswered && !isProcessing;
    const finalCost = isImmediateNonBillable ? 0 : CALL_COST;

    await db.$transaction(
      async (tx) => {
        if (finalCost > 0) {
          const updatedUser = await tx.vp_user.update({
            where: { id: dbUser.id },
            data: { balance: { decrement: finalCost } },
          });
          await tx.vp_transactions.create({
            data: {
              vp_user: { connect: { id: dbUser.id } },
              type: 'DEBIT',
              amount: finalCost,
              balance_before: dbUser.balance ?? 0,
              balance_after: updatedUser.balance ?? 0,
              description: `Call initiation charge for call ${callId}`,
              reference: `CALL-${callId}`,
            },
          });
        }
        await tx.vp_call_log.create({
          data: {
            vp_user: { connect: { id: dbUser.id } },
            call_id: callId,
            phone_number: formattedPhone,
            otp: hashedOtp,
            status: statusFromProvider.toLowerCase(),
            cost: finalCost,
            created_at: new Date().toISOString(),
            duration: '0',
            answer_time: isAnswered ? new Date().toISOString() : null,
            end_at: isImmediateNonBillable ? new Date().toISOString() : null,
          },
        });
      },
      { timeout: 30000 }
    );

    return NextResponse.json({ success: true, callId, message: 'Call initiated successfully' });
  } catch (error) {
    console.error('Send OTP error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
