import { Inject, Injectable } from '@nestjs/common';
import { Effect } from 'effect';
import { AuthService } from './auth.service.js';
import {
  DatabaseError,
  InvalidCredentialsError,
  UserAlreadyExistsError,
} from './auth.errors.js';

export type RegisterInput = {
  email: string;
  password: string;
  name?: string;
};

export type LoginInput = {
  email: string;
  password: string;
};

type AuthOperationResult = Awaited<ReturnType<AuthService['register']>>;

function mapRegisterFailure(cause: unknown): UserAlreadyExistsError | DatabaseError {
  console.error('Register failure cause:', cause);
  if (typeof cause === 'object' && cause !== null) {
    const status = (cause as { status?: number }).status;
    if (status === 409) {
      return new UserAlreadyExistsError({
        message: 'An account with this email already exists',
      });
    }
  }
  return new DatabaseError({ message: 'Authentication operation failed' });
}

function mapLoginFailure(cause: unknown): InvalidCredentialsError | DatabaseError {
  if (typeof cause === 'object' && cause !== null) {
    const status = (cause as { status?: number }).status;
    if (status === 401) {
      return new InvalidCredentialsError({
        message: 'Invalid email or password',
      });
    }
  }
  return new DatabaseError({ message: 'Authentication operation failed' });
}

@Injectable()
export class AuthApplicationService {
  constructor(
    @Inject(AuthService)
    private readonly auth: Pick<AuthService, 'register' | 'login'>,
  ) { }

  register(input: RegisterInput): Effect.Effect<
    AuthOperationResult,
    UserAlreadyExistsError | DatabaseError
  > {
    return Effect.tryPromise({
      try: () => this.auth.register(input),
      catch: mapRegisterFailure,
    });
  }

  login(input: LoginInput): Effect.Effect<
    AuthOperationResult,
    InvalidCredentialsError | DatabaseError
  > {
    return Effect.tryPromise({
      try: () => this.auth.login(input),
      catch: mapLoginFailure,
    });
  }
}
