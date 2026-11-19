import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import session from 'express-session';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const trustedOrigins = (config.get<string>('CORS_ORIGINS') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (trustedOrigins.length === 0) {
    trustedOrigins.push(config.getOrThrow<string>('FRONTEND_URL'));
  }
  app.enableCors({
    origin: trustedOrigins,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'X-CSRF-Token'],
  });
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: false,
  }));
  app.use(session({
    secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: config.get<string>('COOKIE_SECURE') === 'true',
      sameSite: config.get<'lax' | 'strict' | 'none'>(
        'COOKIE_SAME_SITE',
        'lax',
      ),
      maxAge: 10 * 60 * 1000,
    },
  }));
  await app.listen(app.get(ConfigService).getOrThrow<number>('PORT'));
}

bootstrap();
