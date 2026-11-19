import { createHash } from 'crypto';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../infrastructure/auth.service.js';

describe('Telegram deep-link OTP', () => {
  it('rejects OTP requests without bot configuration', async () => {
    const service = new AuthService(
      {} as any,
      {} as any,
      {} as any,
      { get: () => undefined } as any,
    );
    await expect(service.requestTelegramOtp()).rejects.toThrow(/not configured/i);
  });

  it('creates a challenge and returns a Telegram deep link', async () => {
    const challenge = {
      id: 'challenge-1',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    };
    const prisma = {
      telegramOtpChallenge: {
        create: vi.fn().mockResolvedValue(challenge),
      },
    };
    const service = new AuthService(
      prisma as any,
      {} as any,
      {} as any,
      {
        get: (key: string) => {
          if (key === 'TELEGRAM_BOT_TOKEN') return 'test-bot-token';
          if (key === 'TELEGRAM_BOT_USERNAME') return 'test_bot';
          return undefined;
        },
      } as any,
    );

    const result = await service.requestTelegramOtp();
    expect(result.challengeId).toBe('challenge-1');
    expect(result.deepLink).toBe(
      'https://t.me/test_bot?start=login_challenge-1',
    );
  });

  it('sends the OTP after a valid /start webhook', async () => {
    const challenge = {
      id: 'challenge-1',
      telegramId: 'pending',
      otpHash: createHash('sha256').update('placeholder').digest('hex'),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      usedAt: null,
    };
    const prisma = {
      telegramOtpChallenge: {
        findUnique: vi.fn().mockResolvedValue(challenge),
        update: vi.fn().mockResolvedValue(challenge),
      },
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const service = new AuthService(
      prisma as any,
      {} as any,
      {} as any,
      {
        get: (key: string) => {
          if (key === 'TELEGRAM_BOT_TOKEN') return 'test-bot-token';
          if (key === 'TELEGRAM_BOT_WEBHOOK_SECRET') return 'webhook-secret';
          return undefined;
        },
      } as any,
    );

    const handled = await service.handleTelegramWebhook(
      {
        message: {
          chat: { id: 123456 },
          text: '/start login_challenge-1',
        },
      },
      'webhook-secret',
    );

    expect(handled).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(prisma.telegramOtpChallenge.update).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });

  it('rejects invalid or expired OTP challenges', async () => {
    const prisma = {
      $transaction: vi.fn().mockImplementation(async (callback) =>
        callback({
          telegramOtpChallenge: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'challenge-1',
              telegramId: '123456',
              otpHash: createHash('sha256').update('123456').digest('hex'),
              expiresAt: new Date(Date.now() - 1000),
              attempts: 0,
              usedAt: null,
            }),
          },
        }),
      ),
    };
    const service = new AuthService(
      prisma as any,
      {} as any,
      {} as any,
      {} as any,
    );
    await expect(
      service.verifyTelegramOtp('challenge-1', '123456'),
    ).rejects.toThrow(/invalid or expired/i);
  });
});
