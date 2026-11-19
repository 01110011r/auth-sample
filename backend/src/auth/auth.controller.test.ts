import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import { AuthController } from './auth.controller.js';

describe('auth frontend integration', () => {
  function makeController() {
    const authResult = {
      user: {
        id: 'user-1',
        email: 'alice@example.com',
        name: 'Alice',
        avatarUrl: null,
        emailVerified: false,
      },
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    };
    const auth = {
      refresh: async () => authResult,
      logout: async () => undefined,
    };
    const authApplication = {
      register: () => Effect.succeed(authResult),
      login: () => Effect.succeed(authResult),
    };
    const effectHttp = {
      run: async (effect: any) => Effect.runPromise(effect),
    };
    const configValues: Record<string, unknown> = {
      COOKIE_SECURE: 'false',
      COOKIE_SAME_SITE: 'lax',
      COOKIE_DOMAIN: '',
      JWT_REFRESH_TTL: '30d',
      CORS_ORIGINS: 'http://localhost:3000',
      FRONTEND_URL: 'http://localhost:3000',
    };
    const config = {
      get: (key: string, fallback?: unknown) =>
        configValues[key] ?? fallback,
      getOrThrow: (key: string) => configValues[key],
    };
    return {
      controller: new AuthController(
        auth as any,
        authApplication as any,
        effectHttp as any,
        config as any,
      ),
    };
  }

  it('login sets an HttpOnly refresh cookie and does not return the refresh token', async () => {
    const { controller } = makeController();
    const cookies: any[] = [];
    const response = {
      cookie: (name: string, value: string, options: any) => cookies.push({ name, value, options }),
    } as any;

    const result = await controller.login(
      { email: 'alice@example.com', password: 'password123' },
      response,
    );

    expect(cookies).toHaveLength(1);
    expect(cookies[0].name).toBe('refresh_token');
    expect(cookies[0].options.httpOnly).toBe(true);
    expect(cookies[0].options.secure).toBe(false);
    expect(result).not.toHaveProperty('refreshToken');
  });

  it('registration sets the refresh cookie and returns the access token', async () => {
    const { controller } = makeController();
    let cookie: any;
    const response = {
      cookie: (name: string, value: string, options: any) => {
        cookie = { name, value, options };
      },
    } as any;

    const result = await controller.register(
      { email: 'alice@example.com', password: 'password123', name: 'Alice' },
      response,
    );

    expect(cookie.name).toBe('refresh_token');
    expect(result.accessToken).toBe('access-token');
    expect(result).not.toHaveProperty('refreshToken');
  });
});
