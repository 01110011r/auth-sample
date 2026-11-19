import {
  BadRequestException,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { randomInt, timingSafeEqual } from 'crypto';
import { AccountAuthService } from './account-auth.service.js';
import { SessionService } from './session.service.js';

@Injectable()
export class TelegramOtpService implements OnModuleInit, OnModuleDestroy {
  private pollingTimer: NodeJS.Timeout | null = null;
  private updateOffset = 0;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly config: ConfigService,
    private readonly session: SessionService,
    private readonly accounts: AccountAuthService,
  ) {}

  onModuleInit() {
    if (this.config.get<string>('TELEGRAM_BOT_TOKEN')) {
      void this.enablePolling();
      this.pollingTimer = setInterval(() => {
        void this.pollUpdates();
      }, 1500);
    }
  }

  onModuleDestroy() {
    if (this.pollingTimer) clearInterval(this.pollingTimer);
  }

  private async enablePolling() {
    const botToken = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!botToken || this.config.get<string>('TELEGRAM_BOT_WEBHOOK_SECRET')) return;
    try {
      await fetch(`https://api.telegram.org/bot${botToken}/deleteWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drop_pending_updates: false }),
        signal: AbortSignal.timeout(5_000),
      });
    } catch {
      return;
    }
  }

  private async pollUpdates() {
    const botToken = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!botToken) return;
    try {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/getUpdates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offset: this.updateOffset,
          timeout: 1,
          allowed_updates: ['message'],
        }),
        signal: AbortSignal.timeout(5_000),
      });
      if (!response.ok) return;
      const payload = await response.json() as {
        ok?: boolean;
        result?: Array<{ update_id: number; message?: unknown }>;
      };
      if (!payload.ok || !payload.result) return;
      for (const update of payload.result) {
        this.updateOffset = Math.max(this.updateOffset, update.update_id + 1);
        await this.handleWebhook(update as Record<string, unknown>);
      }
    } catch {
      return;
    }
  }

  async request() {
    const botToken = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    const botUsername = this.config.get<string>('TELEGRAM_BOT_USERNAME');
    if (!botToken) {
      throw new BadRequestException('Telegram authentication is not configured');
    }
    if (!botUsername) {
      throw new BadRequestException('Telegram bot username is not configured');
    }

    const challenge = await this.prisma.telegramOtpChallenge.create({
      data: {
        telegramId: 'pending',
        otpHash: this.session.hashToken(this.session.randomToken()),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });
    return {
      challengeId: challenge.id,
      expiresAt: challenge.expiresAt,
      deepLink: `https://t.me/${botUsername.replace(/^@/, '')}?start=login_${challenge.id}`,
    };
  }

  async verify(challengeId: string, code: string) {
    const telegramId = await this.consumeChallenge(challengeId, code);
    return this.accounts.findOrCreateTelegramUser(telegramId);
  }

  private async consumeChallenge(challengeId: string, code: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const challenge = await tx.telegramOtpChallenge.findUnique({
        where: { id: challengeId },
      });
      if (!challenge || challenge.usedAt || challenge.expiresAt <= new Date()) return null;

      const supplied = Buffer.from(this.session.hashToken(code), 'hex');
      const stored = Buffer.from(challenge.otpHash, 'hex');
      const valid = supplied.length === stored.length && timingSafeEqual(supplied, stored);
      if (!valid) {
        const attempts = challenge.attempts + 1;
        await tx.telegramOtpChallenge.update({
          where: { id: challenge.id },
          data: { attempts, usedAt: attempts >= 5 ? new Date() : null },
        });
        return null;
      }

      const consumed = await tx.telegramOtpChallenge.updateMany({
        where: { id: challenge.id, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      return consumed.count === 1 ? challenge.telegramId : null;
    });
    if (!result) {
      throw new UnauthorizedException('Telegram login code is invalid or expired');
    }
    return result;
  }

  async handleWebhook(update: Record<string, unknown>, suppliedSecret?: string) {
    const botToken = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    const expectedSecret = this.config.get<string>('TELEGRAM_BOT_WEBHOOK_SECRET');
    if (!botToken) return false;
    if (expectedSecret) {
      const supplied = Buffer.from(suppliedSecret ?? '');
      const expected = Buffer.from(expectedSecret);
      if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
        return false;
      }
    }

    const message = update.message as { chat?: { id?: number }; text?: string } | undefined;
    const chatId = message?.chat?.id;
    const text = message?.text;
    if (!chatId || typeof text !== 'string') return true;
    const match = /^\/start(?:@\w+)?\s+login_(.+)$/.exec(text.trim());
    if (!match) return true;

    const challenge = await this.prisma.telegramOtpChallenge.findUnique({
      where: { id: match[1] },
    });
    if (!challenge || challenge.usedAt || challenge.expiresAt <= new Date()) return true;

    const code = String(randomInt(100000, 1000000));
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: `Your Dona Auth login code is ${code}. It expires in 5 minutes.`,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return true;
    await this.prisma.telegramOtpChallenge.update({
      where: { id: challenge.id },
      data: { telegramId: String(chatId), otpHash: this.session.hashToken(code) },
    });
    return true;
  }

  async status(challengeId: string) {
    const challenge = await this.prisma.telegramOtpChallenge.findUnique({
      where: { id: challengeId },
      select: { telegramId: true, expiresAt: true, usedAt: true },
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
}
