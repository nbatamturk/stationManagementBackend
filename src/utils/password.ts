import { AppError } from './errors';

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const PASSWORD_SALT_ROUNDS = 10;
export const INVALID_PASSWORD_INPUT_CODE = 'INVALID_INPUT';

export const assertPasswordNotBlank = (password: string, label = 'Password') => {
  if (password.trim().length === 0) {
    throw new AppError(`${label} is required`, 400, INVALID_PASSWORD_INPUT_CODE);
  }

  return password;
};
