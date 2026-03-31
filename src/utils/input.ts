import { AppError } from './errors';

type TextOptions = {
  maxLength: number;
  minLength?: number;
  collapseWhitespace?: boolean;
};

type OptionalTextOptions = TextOptions & {
  emptyAs?: 'undefined' | 'null';
};

const INVALID_INPUT_CODE = 'INVALID_INPUT';

const normalizeUnicode = (value: string) => value.normalize('NFKC').replace(/\u0000/g, '');

const assertLength = (field: string, value: string, options: TextOptions) => {
  if (options.minLength !== undefined && value.length < options.minLength) {
    throw new AppError(
      `${field} must be at least ${options.minLength} characters`,
      400,
      INVALID_INPUT_CODE,
    );
  }

  if (value.length > options.maxLength) {
    throw new AppError(
      `${field} must be ${options.maxLength} characters or fewer`,
      400,
      INVALID_INPUT_CODE,
    );
  }
};

const normalizeSingleLineText = (value: string, collapseWhitespace = true) => {
  const normalized = normalizeUnicode(value).trim();

  if (!collapseWhitespace) {
    return normalized;
  }

  return normalized.replace(/\s+/g, ' ');
};

export const normalizeRequiredSingleLineText = (
  value: string,
  field: string,
  options: TextOptions,
) => {
  const normalized = normalizeSingleLineText(value, options.collapseWhitespace ?? true);

  if (!normalized) {
    throw new AppError(`${field} is required`, 400, INVALID_INPUT_CODE);
  }

  assertLength(field, normalized, options);
  return normalized;
};

export const normalizeOptionalSingleLineText = (
  value: string | undefined,
  field: string,
  options: OptionalTextOptions,
) => {
  if (value === undefined) {
    return undefined;
  }

  const normalized = normalizeSingleLineText(value, options.collapseWhitespace ?? true);

  if (!normalized) {
    return options.emptyAs === 'null' ? null : undefined;
  }

  assertLength(field, normalized, options);
  return normalized;
};

export const normalizeOptionalMultilineText = (
  value: string | null | undefined,
  field: string,
  options: OptionalTextOptions,
) => {
  if (value === undefined || value === null) {
    return value;
  }

  const normalized = normalizeUnicode(value).replace(/\r\n?/g, '\n').trim();

  if (!normalized) {
    return options.emptyAs === 'null' ? null : undefined;
  }

  assertLength(field, normalized, options);
  return normalized;
};

export const normalizeEmail = (value: string) =>
  normalizeRequiredSingleLineText(value, 'Email', {
    maxLength: 255,
  }).toLowerCase();
