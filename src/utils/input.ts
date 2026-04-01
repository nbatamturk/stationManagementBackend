import { AppError } from './errors';

type TextOptions = {
  maxLength: number;
  minLength?: number;
  collapseWhitespace?: boolean;
};

type OptionalTextOptions = TextOptions & {
  emptyAs?: 'undefined' | 'null';
};

type NumberOptions = {
  integer?: boolean;
  maximum?: number;
  minimum?: number;
};

type DateOptions = {
  allowFuture?: boolean;
  emptyAs?: 'undefined' | 'null';
  maxFutureMs?: number;
};

type ObjectOptions = {
  emptyAs?: 'undefined' | 'null';
  maxKeys?: number;
};

const INVALID_INPUT_CODE = 'INVALID_INPUT';

const normalizeUnicode = (value: string) => value.normalize('NFKC').replace(/\u0000/g, '');

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

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

export const normalizeRequiredFiniteNumber = (
  value: number,
  field: string,
  options: NumberOptions = {},
) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new AppError(`${field} must be a valid number`, 400, INVALID_INPUT_CODE);
  }

  if (options.integer && !Number.isInteger(value)) {
    throw new AppError(`${field} must be an integer`, 400, INVALID_INPUT_CODE);
  }

  if (options.minimum !== undefined && value < options.minimum) {
    throw new AppError(`${field} must be greater than or equal to ${options.minimum}`, 400, INVALID_INPUT_CODE);
  }

  if (options.maximum !== undefined && value > options.maximum) {
    throw new AppError(`${field} must be less than or equal to ${options.maximum}`, 400, INVALID_INPUT_CODE);
  }

  return value;
};

export const normalizeOptionalFiniteNumber = (
  value: number | undefined,
  field: string,
  options: NumberOptions = {},
) => {
  if (value === undefined) {
    return undefined;
  }

  return normalizeRequiredFiniteNumber(value, field, options);
};

export const normalizeOptionalDateTime = (
  value: string | null | undefined,
  field: string,
  options: DateOptions = {},
) => {
  if (value === undefined || value === null) {
    return value;
  }

  const normalized =
    normalizeOptionalSingleLineText(value, field, {
      collapseWhitespace: false,
      emptyAs: options.emptyAs,
      maxLength: 100,
    }) ?? (options.emptyAs === 'null' ? null : undefined);

  if (normalized === undefined || normalized === null) {
    return normalized;
  }

  const parsed = new Date(normalized);

  if (Number.isNaN(parsed.getTime())) {
    throw new AppError(`${field} must be a valid ISO 8601 date-time`, 400, INVALID_INPUT_CODE);
  }

  const maxFutureMs = options.maxFutureMs ?? 0;

  if (!options.allowFuture && parsed.getTime() > Date.now() + maxFutureMs) {
    throw new AppError(`${field} cannot be in the future`, 400, INVALID_INPUT_CODE);
  }

  return parsed;
};

export const normalizeOptionalObject = (
  value: unknown,
  field: string,
  options: ObjectOptions = {},
) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return options.emptyAs === 'null' ? null : undefined;
  }

  if (!isPlainObject(value)) {
    throw new AppError(`${field} must be an object`, 400, INVALID_INPUT_CODE);
  }

  if (options.maxKeys !== undefined && Object.keys(value).length > options.maxKeys) {
    throw new AppError(`${field} must contain ${options.maxKeys} keys or fewer`, 400, INVALID_INPUT_CODE);
  }

  return value;
};
