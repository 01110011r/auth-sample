import { describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@prisma/client';
import { AuthService } from '../infrastructure/auth.service.js';

function createService(prisma: any) {
  return new AuthService(
    prisma,
    {
      sign: vi.fn().mockReturnValue('access-token'),
    } as any,
    {} as any,
    {
      get: (key: string) => {
        if (key === 'JWT_ACCESS_SECRET') return 'test-secret';
        if (key === 'JWT_ACCESS_TTL') return '15m';
        if (key === 'JWT_REFRESH_TTL') return '30d';
        return undefined;
      },
      getOrThrow: () => 'test-secret',
    } as any,
  );
}

describe('Telegram OIDC account resolution', () => {
  it('returns an existing linked Telegram identity first', async () => {
    const user = {
      id: 'user-1',
      email: null,
      name: 'Alice',
      avatarUrl: null,
      emailVerified: false,
      phoneNumber: '+15550000000',
    };
    const prisma = {
      socialAccount: {
        findUnique: vi.fn().mockResolvedValue({
          provider: AuthProvider.TELEGRAM,
          providerId: 'telegram-sub',
          user,
        }),
      },
      refreshToken: {
        create: vi.fn().mockResolvedValue({ id: 'refresh-1' }),
      },
    };
    const service = createService(prisma);

    const session = await service.findOrCreateTelegramOidc({
      sub: 'telegram-sub',
      phone_number: '+15550000000',
    });

    expect(session.user.id).toBe('user-1');
    expect(prisma.socialAccount.findUnique).toHaveBeenCalledOnce();
  });

  it('links by verified phone number when no Telegram identity exists', async () => {
    const user = {
      id: 'phone-user',
      email: 'existing@example.com',
      name: 'Existing',
      avatarUrl: null,
      emailVerified: true,
      phoneNumber: '+15550000000',
    };
    const prisma = {
      socialAccount: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'identity-1' }),
      },
      user: {
        findUnique: vi.fn().mockResolvedValue(user),
        update: vi.fn().mockResolvedValue(user),
      },
      refreshToken: {
        create: vi.fn().mockResolvedValue({ id: 'refresh-1' }),
      },
    };
    const service = createService(prisma);

    const session = await service.findOrCreateTelegramOidc({
      sub: 'telegram-sub',
      phone_number: '+15550000000',
    });

    expect(session.user.id).toBe('phone-user');
    expect(prisma.socialAccount.create).toHaveBeenCalledWith({
      data: {
        provider: AuthProvider.TELEGRAM,
        providerId: 'telegram-sub',
        userId: 'phone-user',
      },
    });
  });

  it('creates a phone-less Telegram user with no email', async () => {
    const user = {
      id: 'new-telegram-user',
      email: null,
      name: 'Telegram User',
      avatarUrl: null,
      emailVerified: false,
      phoneNumber: null,
    };
    const prisma = {
      socialAccount: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      user: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(user),
      },
      refreshToken: {
        create: vi.fn().mockResolvedValue({ id: 'refresh-1' }),
      },
    };
    const service = createService(prisma);

    const session = await service.findOrCreateTelegramOidc({
      sub: 'telegram-sub',
      name: 'Telegram User',
    });

    expect(session.user.email).toBeNull();
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: undefined,
          emailVerified: false,
          accounts: expect.objectContaining({}),
        }),
      }),
    );
  });
});
