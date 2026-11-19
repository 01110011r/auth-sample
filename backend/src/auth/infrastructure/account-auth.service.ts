import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthProvider, PrismaClient } from '@prisma/client';
import { SocialProfile } from './providers/social.strategy.js';
import { TelegramOidcClaims } from './providers/telegram/telegram-oidc.service.js';
import { AuthSession, SessionService } from './session.service.js';

@Injectable()
export class AccountAuthService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly session: SessionService,
  ) {}

  async findOrCreateSocial(profile: SocialProfile): Promise<AuthSession> {
    const email = profile.email.toLowerCase();
    if (!profile.emailVerified) {
      throw new UnauthorizedException('Provider email is not verified');
    }

    const existingIdentity = await this.prisma.socialAccount.findUnique({
      where: {
        provider_providerId: {
          provider: profile.provider,
          providerId: profile.providerId,
        },
      },
      include: { user: true },
    });
    if (existingIdentity) {
      return this.session.issueSession(existingIdentity.user);
    }

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user) {
      throw new ConflictException(
        'An account with this email already exists. Sign in and link the provider explicitly.',
      );
    }
    const created = await this.prisma.user.create({
      data: {
        email,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
        emailVerified: true,
        accounts: {
          create: {
            provider: profile.provider,
            providerId: profile.providerId,
          },
        },
      },
    });
    return this.session.issueSession(created);
  }

  async findOrCreateTelegramOidc(claims: TelegramOidcClaims): Promise<AuthSession> {
    if (!claims.sub) {
      throw new UnauthorizedException('Telegram OIDC subject is missing');
    }

    const existingIdentity = await this.prisma.socialAccount.findUnique({
      where: {
        provider_providerId: {
          provider: AuthProvider.TELEGRAM,
          providerId: claims.sub,
        },
      },
      include: { user: true },
    });
    if (existingIdentity) {
      return this.session.issueSession(existingIdentity.user);
    }

    const phoneNumber = claims.phone_number?.trim();
    let user = phoneNumber
      ? await this.prisma.user.findUnique({ where: { phoneNumber } })
      : null;

    if (user) {
      await this.prisma.socialAccount.create({
        data: {
          provider: AuthProvider.TELEGRAM,
          providerId: claims.sub,
          userId: user.id,
        },
      });
      if (!user.name && claims.name) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { name: claims.name, avatarUrl: claims.picture ?? user.avatarUrl },
        });
      }
    } else {
      user = await this.prisma.user.create({
        data: {
          email: undefined,
          name: claims.name ?? claims.preferred_username,
          avatarUrl: claims.picture,
          phoneNumber: phoneNumber || undefined,
          emailVerified: false,
          accounts: {
            create: {
              provider: AuthProvider.TELEGRAM,
              providerId: claims.sub,
            },
          },
        },
      });
    }
    return this.session.issueSession(user);
  }

  async findOrCreateTelegramUser(
    telegramId: string,
    details: {
      name?: string;
      avatarUrl?: string;
    } = {},
  ): Promise<AuthSession> {
    let account = await this.prisma.socialAccount.findUnique({
      where: {
        provider_providerId: {
          provider: AuthProvider.TELEGRAM,
          providerId: telegramId,
        },
      },
      include: { user: true },
    });
    if (!account) {
      const email = `${telegramId}@telegram.local`;
      let user = await this.prisma.user.findUnique({ where: { email } });
      if (!user) {
        user = await this.prisma.user.create({
          data: {
            email,
            name: details.name,
            avatarUrl: details.avatarUrl,
            emailVerified: true,
          },
        });
      }
      account = await this.prisma.socialAccount.create({
        data: {
          provider: AuthProvider.TELEGRAM,
          providerId: telegramId,
          userId: user.id,
        },
        include: { user: true },
      });
    }
    return this.session.issueSession(account.user);
  }

  async telegramLogin(data: Record<string, unknown>): Promise<AuthSession> {
    const name = typeof data.first_name === 'string'
      ? [data.first_name, data.last_name].filter(Boolean).join(' ')
      : undefined;
    const avatarUrl = typeof data.photo_url === 'string'
      ? data.photo_url
      : undefined;
    return this.findOrCreateTelegramUser(String(data.id), { name, avatarUrl });
  }
}
