import { createHash, randomInt } from 'crypto';

const OTP_TTL_MS = 3 * 60 * 1000;
const SESSION_TTL_MS = 15 * 60 * 1000;

export function generateOtp(): string {
  return randomInt(100000, 999999).toString();
}

export function hashOtp(otp: string): string {
  return createHash('sha256').update(otp).digest('hex');
}

export function otpExpiryIso(from: Date = new Date()): string {
  return new Date(from.getTime() + OTP_TTL_MS).toISOString();
}

export function sessionExpiryIso(from: Date = new Date()): string {
  return new Date(from.getTime() + SESSION_TTL_MS).toISOString();
}

export function isExpired(isoDate?: string, now: Date = new Date()): boolean {
  if (!isoDate) return true;
  return new Date(isoDate).getTime() <= now.getTime();
}

export function verifyOtp(otp: string, hash?: string): boolean {
  if (!hash) return false;
  return hashOtp(otp) === hash;
}

export { OTP_TTL_MS, SESSION_TTL_MS };
