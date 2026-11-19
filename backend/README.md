# Dona Auth Backend

NestJS and PostgreSQL authentication module.

## Setup

1. Copy `.env.example` to `.env` and provide database and provider credentials.
2. Install dependencies: `npm install`
3. Generate Prisma: `npm run prisma:generate`
4. Create the database schema: `npm run prisma:migrate`
5. Start: `npm run start:dev`

## API

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /auth/password/forgot`
- `POST /auth/password/reset`
- `POST /auth/email/verify/request`
- `GET /auth/email/verify/:token`
- `POST /auth/telegram`
- `GET /auth/google`
- `GET /auth/google/callback`
- `GET /auth/facebook`
- `GET /auth/facebook/callback`
- `GET /auth/me`

Telegram login requires the bot token and validates the widget payload's HMAC-SHA-256 signature and a 24-hour expiry.
