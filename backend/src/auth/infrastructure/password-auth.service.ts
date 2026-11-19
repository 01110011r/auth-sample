import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { EmailService } from './email/email.service.js';
import { AuthSession, SessionService } from './session.service.js';

@Injectable()
export class PasswordAuthService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly email: EmailService,
    private readonly session: SessionService,
  ) {}

  private randomToken() {
    return this.session.randomToken();
  }

  async register(input: { email: string; password: string; name?: string }): Promise<AuthSession> {
    const email = input.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const user = await this.prisma.user.create({
      data: {
        email,
        name: input.name,
        passwordHash: await bcrypt.hash(input.password, 12),
      },
    });
    await this.sendVerificationEmail(user.id);
    return this.session.issueSession(user);
  }

  async login(input: { email: string; password: string }): Promise<AuthSession> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });
    if (!user?.passwordHash ||
      !(await bcrypt.compare(input.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return this.session.issueSession(user);
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (user?.email) {
      const token = this.randomToken();
      await this.prisma.passwordResetToken.create({
        data: {
          tokenHash: this.session.hashToken(token),
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
      where: { tokenHash: this.session.hashToken(token) },
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
    if (!user?.email || user.emailVerified) return;
    const token = this.randomToken();
    await this.prisma.emailVerificationToken.create({
      data: {
        tokenHash: this.session.hashToken(token),
        userId,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    await this.email.sendVerification(user.email, token);
  }

  async verifyEmail(token: string) {
    const record = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash: this.session.hashToken(token) },
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

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    return this.session.publicUser(user);
  }
}
