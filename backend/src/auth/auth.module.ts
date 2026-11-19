import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './transport/auth.controller.js';
import { AuthService } from './infrastructure/auth.service.js';
import { EmailService } from './infrastructure/email/email.service.js';
import { JwtStrategy } from './infrastructure/providers/jwt.strategy.js';
import { FacebookStrategyProvider, GoogleStrategyProvider } from './infrastructure/providers/social.strategy.js';
import { AuthApplicationService } from './application/auth.application.js';
import { EffectHttpAdapter } from './application/effect-http.adapter.js';
import { TelegramOidcService } from './infrastructure/providers/telegram/telegram-oidc.service.js';
import { SessionService } from './infrastructure/session.service.js';
import { PasswordAuthService } from './infrastructure/password-auth.service.js';
import { AccountAuthService } from './infrastructure/account-auth.service.js';
import { TelegramOtpService } from './infrastructure/telegram-otp.service.js';

@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    EmailService,
    AuthApplicationService,
    EffectHttpAdapter,
    JwtStrategy,
    GoogleStrategyProvider,
    FacebookStrategyProvider,
    TelegramOidcService,
    SessionService,
    PasswordAuthService,
    AccountAuthService,
    TelegramOtpService,
  ],
})
export class AuthModule {}
