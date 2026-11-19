import {
  BadRequestException,
  ConflictException,
  Injectable,
  BadGatewayException,
  UnauthorizedException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthProvider, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'crypto';
import { parseRefreshTtl, verifyTelegramPayload } from './security.js';
import { EmailService } from './email.service.js';
import { SocialProfile } from './social.strategy.js';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService implements OnModuleInit, OnModuleDestroy {
  private telegramPollingTimer: NodeJS.Timeout | null = null;
  private telegramUpdateOffset = 0;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly jwt: JwtService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    if (this.config.get<string>('TELEGRAM_BOT_TOKEN')) {
      void this.enableTelegramPolling();
      this.telegramPollingTimer = setInterval(() => {
        void this.pollTelegramUpdates();
      }, 1500);
    }
  }

  private async enableTelegramPolling() {
    const botToken = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!botToken || this.config.get<string>('TELEGRAM_BOT_WEBHOOK_SECRET')) {
      return;
    }
    try {
      await fetch(
        `https://api.telegram.org/bot${botToken}/deleteWebhook`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ drop_pending_updates: false }),
          signal: AbortSignal.timeout(5_000),
        },
      );
    } catch {
      return;
    }
  }

  onModuleDestroy() {
    if (this.telegramPollingTimer) {
      clearInterval(this.telegramPollingTimer);
    }
  }

  private async pollTelegramUpdates() {
    const botToken = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!botToken) return;
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${botToken}/getUpdates`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            offset: this.telegramUpdateOffset,
            timeout: 1,
            allowed_updates: ['message'],
          }),
          signal: AbortSignal.timeout(5_000),
        },
      );
      if (!response.ok) return;
      const payload = await response.json() as {
        ok?: boolean;
        result?: Array<{ update_id: number; message?: unknown }>;
      };
      if (!payload.ok || !payload.result) return;
      for (const update of payload.result) {
        this.telegramUpdateOffset = Math.max(
          this.telegramUpdateOffset,
          update.update_id + 1,
        );
        await this.handleTelegramWebhook(update as Record<string, unknown>);
      }
    } catch {
      return;
    }
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private randomToken() {
    return randomBytes(32).toString('hex');
  }

  private refreshTokenExpiresAt() {
    const ttl = this.config.get<string>('JWT_REFRESH_TTL', '30d');
    return new Date(Date.now() + parseRefreshTtl(ttl));
  }

  private async issueRefreshToken(userId: string) {
    const token = this.randomToken();
    const expiresAt = new Date();
    expiresAt.setTime(this.refreshTokenExpiresAt().getTime());
    await this.prisma.refreshToken.create({
      data: { tokenHash: this.hashToken(token), userId, expiresAt },
    });
    return token;
  }

  private issueAccessToken(user: { id: string; email: string }) {
    return this.jwt.sign(
      { sub: user.id, email: user.email },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get<string>('JWT_ACCESS_TTL', '15m') as `${number}${'m' | 'h' | 'd'}`,
      },
    );
  }

  private async issueSession(user: { id: string; email: string }) {
    return {
      accessToken: this.issueAccessToken(user),
      refreshToken: await this.issueRefreshToken(user.id),
    };
  }

  private publicUser(user: any) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      emailVerified: user.emailVerified,
    };
  }

  async register(input: { email: string; password: string; name?: string }) {
    const email = input.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('An account with this email already exists');

    const user = await this.prisma.user.create({
      data: {
        email,
        name: input.name,
        passwordHash: await bcrypt.hash(input.password, 12),
      },
    });
    await this.sendVerificationEmail(user.id);
    return { user: this.publicUser(user), ...(await this.issueSession(user)) };
  }

  async login(input: { email: string; password: string }) {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });
    if (!user?.passwordHash ||
      !(await bcrypt.compare(input.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return { user: this.publicUser(user), ...(await this.issueSession(user)) };
  }

  async refresh(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    const now = new Date();
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const record = await tx.refreshToken.findFirst({
          where: {
            tokenHash,
            revokedAt: null,
            expiresAt: { gt: now },
          },
          include: { user: true },
        });
        if (!record) return null;

        const revoked = await tx.refreshToken.updateMany({
          where: {
            id: record.id,
            tokenHash,
            revokedAt: null,
            expiresAt: { gt: now },
          },
          data: { revokedAt: now },
        });
        if (revoked.count !== 1) return null;

        const replacement = this.randomToken();
        await tx.refreshToken.create({
          data: {
            tokenHash: this.hashToken(replacement),
            userId: record.userId,
            expiresAt: this.refreshTokenExpiresAt(),
          },
        });
        return { user: record.user, replacement };
      });
      if (!result) {
        throw new UnauthorizedException('Refresh token is invalid or expired');
      }
      return {
        user: this.publicUser(result.user),
        accessToken: this.issueAccessToken(result.user),
        refreshToken: result.replacement,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw error;
    }
  }

  async logout(refreshToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (user) {
      const token = this.randomToken();
      await this.prisma.passwordResetToken.create({
        data: {
          tokenHash: this.hashToken(token),
          userId: user.id,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });
      await this.email.sendPasswordReset(user.email, token);
    }
    return { message: 'If the email exists, password reset instructions have been sent' };
  }

  async resetPassword(token: string, password: string) {
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: this.hashToken(token) },
    });
    if (!record || record.usedAt || record.expiresAt <= new Date()) {
      throw new BadRequestException('Password reset token is invalid or expired');
    }
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash: await bcrypt.hash(password, 12) },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  async sendVerificationEmail(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.emailVerified) return;
    const token = this.randomToken();
    await this.prisma.emailVerificationToken.create({
      data: {
        tokenHash: this.hashToken(token),
        userId,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    await this.email.sendVerification(user.email, token);
  }

  async verifyEmail(token: string) {
    const record = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash: this.hashToken(token) },
    });
    if (!record || record.usedAt || record.expiresAt <= new Date()) {
      throw new BadRequestException('Email verification token is invalid or expired');
    }
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { emailVerified: true },
      }),
      this.prisma.emailVerificationToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);
  }

  async findOrCreateSocial(profile: SocialProfile) {
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
      return this.issueSession(existingIdentity.user);
    }

    let user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await this.prisma.user.create({
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
    } else {
      throw new ConflictException(
        'An account with this email already exists. Sign in and link the provider explicitly.',
      );
    }
    return this.issueSession(user);
  }

  async requestTelegramOtp() {
    const botToken = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    const botUsername = this.config.get<string>('TELEGRAM_BOT_USERNAME');
    if (!botToken) {
      throw new BadRequestException('Telegram authentication is not configured');
    }
    if (!botUsername) {
      throw new BadRequestException('Telegram bot username is not configured');
    }

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    const challenge = await this.prisma.telegramOtpChallenge.create({
      data: {
        telegramId: 'pending',
        otpHash: this.hashToken(randomBytes(32).toString('hex')),
        expiresAt,
      },
    });

    return {
      challengeId: challenge.id,
      expiresAt,
      deepLink: `https://t.me/${botUsername.replace(/^@/, '')}?start=login_${challenge.id}`,
    };
  }

  async verifyTelegramOtp(challengeId: string, code: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const challenge = await tx.telegramOtpChallenge.findUnique({
        where: { id: challengeId },
      });
      if (
        !challenge ||
        challenge.usedAt ||
        challenge.expiresAt <= new Date()
      ) {
        return null;
      }

      const suppliedHash = this.hashToken(code);
      const supplied = Buffer.from(suppliedHash, 'hex');
      const stored = Buffer.from(challenge.otpHash, 'hex');
      const valid =
        supplied.length === stored.length &&
        timingSafeEqual(supplied, stored);

      if (!valid) {
        const attempts = challenge.attempts + 1;
        await tx.telegramOtpChallenge.update({
          where: { id: challenge.id },
          data: {
            attempts,
            usedAt: attempts >= 5 ? new Date() : null,
          },
        });
        return null;
      }

      const consumed = await tx.telegramOtpChallenge.updateMany({
        where: {
          id: challenge.id,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { usedAt: new Date() },
      });
      if (consumed.count !== 1) return null;

      return challenge.telegramId;
    });

    if (!result) {
      throw new UnauthorizedException('Telegram login code is invalid or expired');
    }

    const telegramId = result;
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
    return {
      user: this.publicUser(account.user),
      ...(await this.issueSession(account.user)),
    };
  }

  async handleTelegramWebhook(
    update: Record<string, unknown>,
    suppliedSecret?: string,
  ) {
    const botToken = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    const expectedSecret = this.config.get<string>(
      'TELEGRAM_BOT_WEBHOOK_SECRET',
    );
    if (!botToken) return false;

    if (expectedSecret) {
      const supplied = Buffer.from(suppliedSecret ?? '');
      const expected = Buffer.from(expectedSecret);
      if (
        supplied.length !== expected.length ||
        !timingSafeEqual(supplied, expected)
      ) {
        return false;
      }
    }

    const message = update.message as
      | {
          chat?: { id?: number };
          text?: string;
        }
      | undefined;
    const chatId = message?.chat?.id;
    const text = message?.text;
    if (!chatId || typeof text !== 'string') return true;

    const match = /^\/start(?:@\w+)?\s+login_(.+)$/.exec(text.trim());
    if (!match) return true;
    const challengeId = match[1];
    const challenge = await this.prisma.telegramOtpChallenge.findUnique({
      where: { id: challengeId },
    });
    if (
      !challenge ||
      challenge.usedAt ||
      challenge.expiresAt <= new Date()
    ) {
      return true;
    }

    const code = String(randomInt(100000, 1000000));
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: `Your Dona Auth login code is ${code}. It expires in 5 minutes.`,
        }),
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!response.ok) return true;

    await this.prisma.telegramOtpChallenge.update({
      where: { id: challenge.id },
      data: {
        telegramId: String(chatId),
        otpHash: this.hashToken(code),
      },
    });
    return true;
  }

  async telegramOtpStatus(challengeId: string) {
    const challenge = await this.prisma.telegramOtpChallenge.findUnique({
      where: { id: challengeId },
      select: {
        telegramId: true,
        expiresAt: true,
        usedAt: true,
      },
    });
    if (!challenge || challenge.usedAt || challenge.expiresAt <= new Date()) {
      return { status: 'expired' as const };
    }
    return {
      status: challenge.telegramId === 'pending'
        ? ('waiting' as const)
        : ('sent' as const),
    };
  }

  async telegramLogin(data: Record<string, unknown>) {
    const botToken = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!botToken) throw new BadRequestException('Telegram authentication is not configured');
    const result = verifyTelegramPayload(data, botToken);
    if (result === 'malformed') {
      throw new BadRequestException('Malformed Telegram authentication payload');
    }
    if (result === 'expired') {
      throw new UnauthorizedException('Telegram login has expired');
    }
    if (result === 'future') {
      throw new UnauthorizedException('Telegram login timestamp is in the future');
    }
    if (result === 'invalid-signature') {
      throw new UnauthorizedException('Telegram login signature is invalid');
    }

    const telegramId = String(data.id);
    let account = await this.prisma.socialAccount.findUnique({
      where: { provider_providerId: { provider: AuthProvider.TELEGRAM, providerId: telegramId } },
      include: { user: true },
    });
    if (!account) {
      const email = `${telegramId}@telegram.local`;
      let user = await this.prisma.user.findUnique({ where: { email } });
      if (!user) {
        user = await this.prisma.user.create({
          data: {
            email,
            name: typeof data.first_name === 'string'
              ? [data.first_name, data.last_name].filter(Boolean).join(' ')
              : undefined,
            avatarUrl: typeof data.photo_url === 'string' ? data.photo_url : undefined,
            emailVerified: true,
          },
        });
      }
      account = await this.prisma.socialAccount.create({
        data: { provider: AuthProvider.TELEGRAM, providerId: telegramId, userId: user.id },
        include: { user: true },
      });
    }
    return { user: this.publicUser(account.user), ...(await this.issueSession(account.user)) };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    return this.publicUser(user);
  }
}
