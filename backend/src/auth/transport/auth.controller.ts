import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
  UnauthorizedException,
  Headers,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { AuthService } from '../infrastructure/auth.service.js';
import {
  ForgotPasswordDto,
  LoginDto,
  RefreshDto,
  RegisterDto,
  ResetPasswordDto,
  TelegramAuthDto,
  TelegramOtpVerifyDto,
} from './dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { AuthApplicationService } from '../application/auth.application.js';
import { EffectHttpAdapter } from '../application/effect-http.adapter.js';
import { ConfigService } from '@nestjs/config';
import { TelegramOidcService } from '../infrastructure/providers/telegram/telegram-oidc.service.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly authApplication: AuthApplicationService,
    private readonly effectHttp: EffectHttpAdapter,
    private readonly config: ConfigService,
    private readonly telegramOidc: TelegramOidcService,
  ) {}

  private readCookie(req: any, name: string): string | undefined {
    const cookieHeader = req?.headers?.cookie;
    if (typeof cookieHeader !== 'string') return undefined;
    for (const entry of cookieHeader.split(';')) {
      const [key, ...valueParts] = entry.trim().split('=');
      if (key === name) return decodeURIComponent(valueParts.join('='));
    }
    return undefined;
  }

  private setRefreshCookie(res: Response, refreshToken: string) {
    const secure = this.config.get<string>('COOKIE_SECURE') === 'true';
    const sameSite = this.config.get<'lax' | 'strict' | 'none'>(
      'COOKIE_SAME_SITE',
      'lax',
    );
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure,
      sameSite,
      domain: this.config.get<string>('COOKIE_DOMAIN') || undefined,
      path: '/auth',
      maxAge: this.refreshCookieMaxAge(),
    });
  }

  private clearRefreshCookie(res: Response) {
    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: this.config.get<string>('COOKIE_SECURE') === 'true',
      sameSite: this.config.get<'lax' | 'strict' | 'none'>(
        'COOKIE_SAME_SITE',
        'lax',
      ),
      domain: this.config.get<string>('COOKIE_DOMAIN') || undefined,
      path: '/auth',
    });
  }

  private refreshCookieMaxAge() {
    const ttl = this.config.get<string>('JWT_REFRESH_TTL', '30d');
    const match = /^(\d+)([dh])$/.exec(ttl);
    if (!match) return 30 * 24 * 60 * 60 * 1000;
    const value = Number(match[1]);
    return (match[2] === 'd' ? value * 24 : value) * 60 * 60 * 1000;
  }

  private validateTrustedOrigin(req: any) {
    const origin = req?.headers?.origin;
    if (typeof origin !== 'string') return;
    const configured = (this.config.get<string>('CORS_ORIGINS') ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    const trusted = configured.length > 0
      ? configured
      : [this.config.getOrThrow<string>('FRONTEND_URL')];
    if (!trusted.includes(origin)) {
      throw new UnauthorizedException('Untrusted origin');
    }
  }

  @Post('register')
  async register(
    @Body() body: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const session = await this.effectHttp.run(
      this.authApplication.register(body),
    );
    this.setRefreshCookie(res, session.refreshToken);
    return { user: session.user, accessToken: session.accessToken };
  }

  @Post('login')
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const session = await this.effectHttp.run(
      this.authApplication.login(body),
    );
    this.setRefreshCookie(res, session.refreshToken);
    return { user: session.user, accessToken: session.accessToken };
  }

  @Post('refresh')
  async refresh(
    @Body() body: RefreshDto,
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.validateTrustedOrigin(req);
    const refreshToken =
      this.readCookie(req, 'refresh_token') ?? body.refreshToken;
    if (!refreshToken) {
      throw new BadRequestException('Refresh token is required');
    }
    const session = await this.auth.refresh(refreshToken);
    this.setRefreshCookie(res, session.refreshToken);
    return { user: session.user, accessToken: session.accessToken };
  }

  @Post('logout')
  async logout(
    @Body() body: RefreshDto,
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.validateTrustedOrigin(req);
    const refreshToken =
      this.readCookie(req, 'refresh_token') ?? body.refreshToken;
    if (refreshToken) await this.auth.logout(refreshToken);
    this.clearRefreshCookie(res);
    return { message: 'Logged out' };
  }

  @Post('password/forgot')
  forgotPassword(@Body() body: ForgotPasswordDto) {
    return this.auth.forgotPassword(body.email);
  }

  @Post('password/reset')
  resetPassword(@Body() body: ResetPasswordDto) {
    return this.auth.resetPassword(body.token, body.password);
  }

  @Post('email/verify/request')
  @UseGuards(JwtAuthGuard)
  requestVerification(@Req() req: any) {
    return this.auth.sendVerificationEmail(req.user.id);
  }

  @Get('email/verify/:token')
  verifyEmail(@Param('token') token: string) {
    return this.auth.verifyEmail(token);
  }

  @Post('telegram')
  async telegram(
    @Body() body: TelegramAuthDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const session = await this.auth.telegramLogin(
      body as unknown as Record<string, unknown>,
    );
    this.setRefreshCookie(res, session.refreshToken);
    return { user: session.user, accessToken: session.accessToken };
  }

  @Post('telegram/otp/request')
  requestTelegramOtp() {
    return this.auth.requestTelegramOtp();
  }

  @Get('telegram/otp/status/:challengeId')
  telegramOtpStatus(@Param('challengeId') challengeId: string) {
    return this.auth.telegramOtpStatus(challengeId);
  }

  @Post('telegram/webhook')
  telegramWebhook(
    @Body() update: Record<string, unknown>,
    @Headers('x-telegram-bot-api-secret-token') secret: string | undefined,
  ) {
    return this.auth.handleTelegramWebhook(update, secret);
  }

  @Post('telegram/otp/verify')
  async verifyTelegramOtp(
    @Body() body: TelegramOtpVerifyDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const session = await this.auth.verifyTelegramOtp(
      body.challengeId,
      body.code,
    );
    this.setRefreshCookie(res, session.refreshToken);
    return { user: session.user, accessToken: session.accessToken };
  }

  @Get('telegram/oidc')
  async telegramOidcStart(@Req() req: any, @Res() res: Response) {
    const authorizationUrl = await this.telegramOidc.createAuthorization(req);
    return res.redirect(authorizationUrl);
  }

  @Get('telegram/oidc/callback')
  async telegramOidcCallback(
    @Req() req: any,
    @Res() res: Response,
  ) {
    const query = req.query as Record<string, string | undefined>;
    if (query.error) {
      return res.redirect(
        `${this.config.getOrThrow<string>('FRONTEND_URL')}/auth/callback?error=${encodeURIComponent(
          query.error === 'access_denied'
            ? 'telegram_oidc_cancelled'
            : 'telegram_oidc_failed',
        )}`,
      );
    }
    if (!query.code || !query.state) {
      return res.redirect(
        `${this.config.getOrThrow<string>('FRONTEND_URL')}/auth/callback?error=telegram_oidc_failed`,
      );
    }
    try {
      const claims = await this.telegramOidc.exchangeCallback(
        req,
        query.code,
        query.state,
      );
      const session = await this.auth.findOrCreateTelegramOidc(claims);
      this.setRefreshCookie(res, session.refreshToken);
      return res.redirect(
        `${this.config.getOrThrow<string>('FRONTEND_URL')}/auth/callback?authenticated=true`,
      );
    } catch {
      return res.redirect(
        `${this.config.getOrThrow<string>('FRONTEND_URL')}/auth/callback?error=telegram_oidc_failed`,
      );
    }
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  google() {}

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: any, @Res() res: Response) {
    const session = await this.auth.findOrCreateSocial(req.user);
    this.setRefreshCookie(res, session.refreshToken);
    return res.redirect(
      `${this.config.getOrThrow<string>('FRONTEND_URL')}/auth/callback?authenticated=true`,
    );
  }

  @Get('facebook')
  @UseGuards(AuthGuard('facebook'))
  facebook() {}

  @Get('facebook/callback')
  @UseGuards(AuthGuard('facebook'))
  async facebookCallback(@Req() req: any, @Res() res: Response) {
    const session = await this.auth.findOrCreateSocial(req.user);
    this.setRefreshCookie(res, session.refreshToken);
    return res.redirect(
      `${this.config.getOrThrow<string>('FRONTEND_URL')}/auth/callback?authenticated=true`,
    );
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: any) {
    return this.auth.me(req.user.id);
  }
}
