import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/encryption';
import { createToken, setSessionCookie } from '@/lib/auth';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const { email, password, name } = await req.json();

    if (!email || !password || !name) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    const existing = await db.vp_user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 400 });
    }

    const hashedPassword = await hashPassword(password);
    const apiKey = 'vp_live_' + crypto.randomBytes(24).toString('hex');

    const user = await db.vp_user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        api_key: apiKey,
        balance: 100,
        is_active: true,
        role: 'user',
        user_type: 'prepaid',
      },
    });

    const token = await createToken({
      id: user.id,
      email: user.email!,
      name: user.name!,
      api_key: user.api_key!,
      balance: user.balance ?? 100,
    });

    await setSessionCookie(token);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json({ error: 'Signup failed' }, { status: 500 });
  }
}