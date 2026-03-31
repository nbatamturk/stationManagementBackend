import { AppError } from '../../utils/errors';

export type AuthenticationFailureReason = 'invalid_credentials' | 'inactive_user';

export class AuthenticationError extends AppError {
  constructor(public readonly reason: AuthenticationFailureReason) {
    super('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }
}

export const isAuthenticationError = (error: unknown): error is AuthenticationError =>
  error instanceof AuthenticationError;
