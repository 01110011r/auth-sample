import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { parseRefreshTtl } from '../domain/security.js';

export type PublicUser = {
  id: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
};

export type AuthSession = {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
};

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  randomToken() {
    return randomBytes(32).toString('hex');
  }

  publicUser(user: {
    id: string;
    email: string | null;
    name: string | null;
    avatarUrl: string | null;
    emailVerified: boolean;
  }): PublicUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      emailVerified: user.emailVerified,
    };
  }

  private refreshTokenExpiresAt() {
    const ttl = this.config.get<string>('JWT_REFRESH_TTL', '30d');
    return new Date(Date.now() + parseRefreshTtl(ttl));
  }

  private async issueRefreshToken(userId: string) {
    const token = this.randomToken();
    await this.prisma.refreshToken.create({
      data: {
        tokenHash: this.hashToken(token),
        userId,
        expiresAt: this.refreshTokenExpiresAt(),
      },
    });
    return token;
  }

  private issueAccessToken(user: { id: string; email: string | null }) {
    return this.jwt.sign(
      { sub: user.id, email: user.email },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get<string>('JWT_ACCESS_TTL', '15m') as `${number}${'m' | 'h' | 'd'}`,
      },
    );
  }

  async issueSession(user: { id: string; email: string | null }): Promise<AuthSession> {
    return {
      user: this.publicUser(user as PublicUser),
      accessToken: this.issueAccessToken(user),
      refreshToken: await this.issueRefreshToken(user.id),
    };
  }

  async refresh(refreshToken: string): Promise<AuthSession> {
    const tokenHash = this.hashToken(refreshToken);
    const now = new Date();
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
  }

  async logout(refreshToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
