import crypto from 'crypto';

export function generateOtp(): string {
  return crypto.randomInt(100000, 999999).toString();
}

export function hashOtp(accountId: string, otp: string): string {
  const secret = process.env.OTP_SECRET!;
  const data = `${accountId}:${otp}:${secret}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}