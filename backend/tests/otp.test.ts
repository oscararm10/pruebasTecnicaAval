import {
  generateOtp,
  hashOtp,
  isExpired,
  otpExpiryIso,
  verifyOtp,
} from '../src/shared/otp';

describe('otp utils', () => {
  it('genera OTP de 6 dígitos', () => {
    const otp = generateOtp();
    expect(otp).toMatch(/^\d{6}$/);
  });

  it('hashea y verifica OTP', () => {
    const otp = '123456';
    const hash = hashOtp(otp);
    expect(verifyOtp(otp, hash)).toBe(true);
    expect(verifyOtp('000000', hash)).toBe(false);
    expect(verifyOtp(otp, undefined)).toBe(false);
  });

  it('detecta expiración', () => {
    const past = new Date(Date.now() - 1000).toISOString();
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(isExpired(past)).toBe(true);
    expect(isExpired(future)).toBe(false);
    expect(isExpired(undefined)).toBe(true);
  });

  it('calcula expiry a 3 minutos', () => {
    const from = new Date('2026-01-01T00:00:00.000Z');
    expect(otpExpiryIso(from)).toBe('2026-01-01T00:03:00.000Z');
  });
});
