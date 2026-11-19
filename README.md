# Dona Auth

Full-stack authentication sample with a NestJS/Prisma backend and a Next.js
frontend.

## Features

- Email/password authentication
- Google and Facebook OAuth
- Telegram OTP/deep-link login
- Telegram OAuth/OIDC login
- JWT access tokens with rotated HttpOnly refresh-token cookies
- Password reset and email verification flows
- PostgreSQL persistence through Prisma

## Project Structure

```text
backend/   NestJS API, Prisma schema, migrations, and auth services
frontend/  Next.js login and account UI
docs/      Authentication flow documentation
```

## Getting Started

### Backend

```bash
cd backend
cp .env.example .env
npm install
npm run prisma:generate
npm run prisma:migrate
npm run start:dev
```

The API runs on `http://localhost:4000` by default.

### Frontend

In another terminal:

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

The frontend runs on `http://localhost:3000` by default.

Configure provider credentials and database settings in
`backend/.env`. Provider integrations are optional unless their login flow is
being used.

## Authentication Documentation

- [Local authentication](docs/local-auth-flow.md)
- [Google OAuth](docs/google-auth-flow.md)
- [Facebook OAuth](docs/facebook-auth-flow.md)
- [Telegram OTP](docs/telegram-auth-flow.md)
- [Telegram OAuth/OIDC](docs/telegram-oidc-auth-flow.md)

## Development Checks

```bash
cd backend
npm test
npm run build

cd ../frontend
npm run build
```
