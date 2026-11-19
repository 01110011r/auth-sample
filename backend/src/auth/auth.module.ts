import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { EmailService } from './email.service.js';
import { JwtStrategy } from './jwt.strategy.js';
import { FacebookStrategyProvider, GoogleStrategyProvider } from './social.strategy.js';
import { AuthApplicationService } from './auth.application.js';
import { EffectHttpAdapter } from './effect-http.adapter.js';

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
  ],
})
export class AuthModule {}
