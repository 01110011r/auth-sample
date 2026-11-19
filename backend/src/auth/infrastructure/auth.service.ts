import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
import { verifyTelegramPayload } from '../domain/security.js';
import { EmailService } from './email/email.service.js';
import { AccountAuthService } from './account-auth.service.js';
import { PasswordAuthService } from './password-auth.service.js';
import { SessionService } from './session.service.js';
import { TelegramOtpService } from './telegram-otp.service.js';
import { SocialProfile } from './providers/social.strategy.js';
import { TelegramOidcClaims } from './providers/telegram/telegram-oidc.service.js';

@Injectable()
export class AuthService {
  private readonly config: ConfigService;
  private readonly session: SessionService;
  private readonly password: PasswordAuthService;
  private readonly accounts: AccountAuthService;
  private readonly telegramOtp: TelegramOtpService;

  constructor(
    prisma: PrismaClient,
    jwt: JwtService,
    email: EmailService,
    config: ConfigService,
    session?: SessionService,
    password?: PasswordAuthService,
    accounts?: AccountAuthService,
    telegramOtp?: TelegramOtpService,
  ) {
    this.config = config;
    this.session = session ?? new SessionService(prisma, jwt, config);
    this.password = password ?? new PasswordAuthService(prisma, email, this.session);
    this.accounts = accounts ?? new AccountAuthService(prisma, this.session);
    this.telegramOtp = telegramOtp ??
      new TelegramOtpService(prisma, config, this.session, this.accounts);
  }

  register(input: { email: string; password: string; name?: string }) {
    return this.password.register(input);
  }

  login(input: { email: string; password: string }) {
    return this.password.login(input);
  }

  refresh(refreshToken: string) {
    return this.session.refresh(refreshToken);
  }

  logout(refreshToken: string) {
    return this.session.logout(refreshToken);
  }

  forgotPassword(email: string) {
    return this.password.forgotPassword(email);
  }

  resetPassword(token: string, password: string) {
    return this.password.resetPassword(token, password);
  }

  sendVerificationEmail(userId: string) {
    return this.password.sendVerificationEmail(userId);
  }

  verifyEmail(token: string) {
    return this.password.verifyEmail(token);
  }

  findOrCreateSocial(profile: SocialProfile) {
    return this.accounts.findOrCreateSocial(profile);
  }

  findOrCreateTelegramOidc(claims: TelegramOidcClaims) {
    return this.accounts.findOrCreateTelegramOidc(claims);
  }

  requestTelegramOtp() {
    return this.telegramOtp.request();
  }

  verifyTelegramOtp(challengeId: string, code: string) {
    return this.telegramOtp.verify(challengeId, code);
  }

  handleTelegramWebhook(update: Record<string, unknown>, suppliedSecret?: string) {
    return this.telegramOtp.handleWebhook(update, suppliedSecret);
  }

  telegramOtpStatus(challengeId: string) {
    return this.telegramOtp.status(challengeId);
  }

  async telegramLogin(data: Record<string, unknown>) {
    const botToken = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!botToken) {
      throw new BadRequestException('Telegram authentication is not configured');
    }
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
    return this.accounts.telegramLogin(data);
  }

  me(userId: string) {
    return this.password.me(userId);
  }
}
