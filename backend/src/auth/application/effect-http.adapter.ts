import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { Effect } from 'effect';

@Injectable()
export class EffectHttpAdapter {
  async run<A, E>(effect: Effect.Effect<A, E>): Promise<A> {
    try {
      return await Effect.runPromise(effect);
    } catch (error) {
      if (typeof error === 'object' && error !== null && '_tag' in error) {
        switch (error._tag) {
          case 'InvalidCredentialsError':
            throw new UnauthorizedException(
              'Invalid email or password',
            );
          case 'UserAlreadyExistsError':
            throw new ConflictException(
              'An account with this email already exists',
            );
          case 'DatabaseError':
            throw new InternalServerErrorException(
              'Authentication operation failed',
            );
        }
      }
      throw error;
    }
  }
}
