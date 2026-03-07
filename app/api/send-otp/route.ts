import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import redisClient from '@/lib/redis';
import { generateOtp, hashOtp } from '@/lib/otp';

// Rate limiting (optional) – adjust as needed
const RATE_LIMIT_PREFIX = 'rate:';
const OTP_PREFIX = 'otp:';
const CALL_COST = 3.5; // Fixed cost per call

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate user
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse and validate input
    const { phoneNumber } = await req.json();
    if (!phoneNumber) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    // 3. Normalize phone number (same logic as original)
    let formattedPhone = String(phoneNumber).replace(/\s/g, '').replace(/^\+/, '');
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '234' + formattedPhone.slice(1);
    } else if (!formattedPhone.startsWith('234')) {
      formattedPhone = '234' + formattedPhone;
    }

    // 4. Rate limiting per user (optional, but recommended)
    const rateKey = `${RATE_LIMIT_PREFIX}${user.id}`;
    const currentCount = await redisClient.incr(rateKey);
    if (currentCount === 1) {
      await redisClient.expire(rateKey, Number(process.env.RATE_LIMIT_WINDOW) || 3600);
    }
    if (currentCount > (Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 5)) {
      return NextResponse.json({ error: 'Too many OTP requests. Try later.' }, { status: 429 });
    }

    // 5. Generate OTP and its hash
    const otp = generateOtp();
    const hashedOtp = hashOtp(user.id.toString(), otp);

    // 6. Store hashed OTP in Redis with expiration and attempts counter
    const otpKey = `${OTP_PREFIX}${user.id}`;
    await redisClient.hSet(otpKey, {
      hash: hashedOtp,
      attempts: 0,
    });
    await redisClient.expire(otpKey, Number(process.env.OTP_EXPIRY_SECONDS) || 300); // 5 min default

    // 7. Fetch user balance and API key from DB
    const dbUser = await db.vp_user.findUnique({
      where: { id: Number(user.id) },
      select: { balance: true, api_key: true }
    });

    if (!dbUser) {
      // Clean up Redis if user not found
      await redisClient.del(otpKey);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 8. Check sufficient balance
    if ((dbUser.balance ?? 0) < CALL_COST) {
      await redisClient.del(otpKey);
      return NextResponse.json({ error: 'Insufficient balance' }, { status: 402 });
    }

    // 9. Call external VoicePass API with the plain OTP
    const response = await fetch("https://api.voicepass.skurel.com/send-voice-otp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + dbUser.api_key
      },
      body: JSON.stringify({
        phone: formattedPhone,
        otp: otp
      })
    });

    const data = await response.json().catch(() => ({}));
    const providerSuccess = response.ok || data?.call_id != null || data?.status === 'queue';

    if (!providerSuccess) {
      // Call failed – delete the OTP hash so it cannot be verified
      await redisClient.del(otpKey);
      console.error('VoicePass API error:', response.status, data);
      return NextResponse.json({ error: 'Failed to initiate call via provider' }, { status: 502 });
    }

    // 10. Process provider response
    const callId = data.call_id || `CID-${Date.now()}`;
    const statusFromProvider = data.status?.toUpperCase() || 'INITIATED';

    const isAnswered = statusFromProvider === 'ANSWERED';
    const isProcessing = ['INITIATED', 'QUEUE', 'RINGING', 'IN-PROGRESS'].includes(statusFromProvider);
    const isImmediateNonBillable = !isAnswered && !isProcessing;

    const finalCost = isImmediateNonBillable ? 0 : CALL_COST;

    // 11. Atomically deduct balance, create transaction, and log the call
    await db.$transaction(async (tx) => {
      if (finalCost > 0) {
        // Deduct balance
        const updatedUser = await tx.vp_user.update({
          where: { id: Number(user.id) },
          data: { balance: { decrement: finalCost } }
        });

        // Create debit transaction
        await tx.vp_transactions.create({
          data: {
            user_id: Number(user.id),
            type: 'DEBIT',
            amount: finalCost,
            balance_before: dbUser.balance ?? 0,
            balance_after: updatedUser.balance ?? 0,
            description: `Call initiation charge for call ${callId}`,
            reference: `CALL-${callId}`,
          }
        });
      }

      // Create call log (⚠️ storing plain OTP is a security risk – consider hashing or masking)
      await tx.vp_call_log.create({
        data: {
          user_id: Number(user.id),
          call_id: callId,
          phone_number: formattedPhone,
          otp: otp,               // Consider storing only hash or masked value
          status: statusFromProvider.toLowerCase(),
          cost: finalCost,
          created_at: new Date().toISOString(),
          duration: '0',
          answer_time: isAnswered ? new Date().toISOString() : null,
          end_at: isImmediateNonBillable ? new Date().toISOString() : null,
        }
      });
    });

    // 12. Return success
    return NextResponse.json({
      success: true,
      callId,
      message: 'Call initiated successfully'
    });

  } catch (error) {
    console.error('Send OTP error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}