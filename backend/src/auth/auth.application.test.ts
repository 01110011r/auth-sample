import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import { AuthApplicationService } from './auth.application.js';

describe('AuthApplicationService', () => {
  it('returns the registration result', async () => {
    const result = {
      accessToken: 'access',
      refreshToken: 'refresh',
      user: {
        id: 'user-1',
        email: 'alice@example.com',
        name: 'Alice',
        avatarUrl: null,
        emailVerified: false,
      },
    };
    const application = new AuthApplicationService({
      register: async () => result,
      login: async () => result,
    });

    await expect(
      Effect.runPromise(application.register({
        email: 'alice@example.com',
        password: 'password123',
        name: 'Alice',
      })),
    ).resolves.toEqual(result);
  });

  it('maps an existing user failure to a tagged error', async () => {
    const application = new AuthApplicationService({
      register: async () => {
        throw Object.assign(new Error('exists'), { status: 409 });
      },
      login: async () => {
        throw Object.assign(new Error('invalid'), { status: 401 });
      },
    });

    const error = await Effect.runPromise(
      Effect.flip(application.register({
        email: 'alice@example.com',
        password: 'password123',
      })),
    );
    expect(error._tag).toBe('UserAlreadyExistsError');
  });

  it('maps invalid credentials to a tagged error', async () => {
    const application = new AuthApplicationService({
      register: async () => {
        throw Object.assign(new Error('exists'), { status: 409 });
      },
      login: async () => {
        throw Object.assign(new Error('invalid'), { status: 401 });
      },
    });

    const error = await Effect.runPromise(
      Effect.flip(application.login({
        email: 'alice@example.com',
        password: 'wrong',
      })),
    );
    expect(error._tag).toBe('InvalidCredentialsError');
  });
});
