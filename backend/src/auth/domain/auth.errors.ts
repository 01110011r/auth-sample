import { Data } from 'effect';

export class InvalidCredentialsError extends Data.TaggedError('InvalidCredentialsError')<{
  readonly message: string;
}> {}

export class UserAlreadyExistsError extends Data.TaggedError('UserAlreadyExistsError')<{
  readonly message: string;
}> {}

export class DatabaseError extends Data.TaggedError('DatabaseError')<{
  readonly message: string;
}> {}

export type AuthApplicationError =
  | InvalidCredentialsError
  | UserAlreadyExistsError
  | DatabaseError;
