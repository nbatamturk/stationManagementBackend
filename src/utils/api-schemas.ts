import { Type, type TSchema } from '@sinclair/typebox';

export type CommonErrorStatusCode = 400 | 401 | 403 | 404 | 409 | 413 | 429 | 500;

type SchemaOptions = {
  description?: string;
  examples?: unknown[];
};

type ErrorExample = {
  code: string;
  message: string;
  details: unknown;
};

export const uuidSchema = Type.String({
  format: 'uuid',
  description: 'UUID identifier.',
});

export const isoDateTimeSchema = Type.String({
  format: 'date-time',
  description: 'ISO 8601 timestamp in UTC. All API date and date-like fields use this format.',
});

export const paginationMetaSchema = Type.Object(
  {
    page: Type.Integer({ minimum: 1 }),
    limit: Type.Integer({ minimum: 1 }),
    total: Type.Integer({ minimum: 0 }),
    totalPages: Type.Integer({ minimum: 0 }),
  },
  {
    additionalProperties: false,
    description: 'Standard pagination metadata for list responses.',
  },
);

export const deleteResultDataSchema = Type.Object(
  {
    success: Type.Literal(true),
    id: uuidSchema,
  },
  {
    additionalProperties: false,
    description: 'Delete confirmation payload.',
  },
);

const errorDetailsSchema = Type.Union([Type.Any(), Type.Null()]);

const buildErrorResponseSchema = (description: string, example: ErrorExample) =>
  Type.Object(
    {
      code: Type.String({
        minLength: 1,
        description: 'Machine-readable error code.',
      }),
      message: Type.String({
        minLength: 1,
        description: 'Human-readable error message.',
      }),
      details: errorDetailsSchema,
    },
    {
      additionalProperties: false,
      description,
      examples: [example],
    },
  );

export const commonErrorResponseSchemas = {
  400: buildErrorResponseSchema('Request validation or filter error.', {
    code: 'VALIDATION_ERROR',
    message: 'body/email must match format "email"',
    details: null,
  }),
  401: buildErrorResponseSchema('Authentication is required or the token is invalid.', {
    code: 'UNAUTHORIZED',
    message: 'Unauthorized',
    details: null,
  }),
  403: buildErrorResponseSchema('Authenticated user is not allowed to perform this action.', {
    code: 'FORBIDDEN',
    message: 'Forbidden',
    details: null,
  }),
  404: buildErrorResponseSchema('Requested resource was not found.', {
    code: 'NOT_FOUND',
    message: 'Route not found',
    details: null,
  }),
  409: buildErrorResponseSchema('Request conflicts with existing data.', {
    code: 'RESOURCE_CONFLICT',
    message: 'Resource already exists',
    details: null,
  }),
  413: buildErrorResponseSchema('Uploaded payload exceeds the supported size.', {
    code: 'PAYLOAD_TOO_LARGE',
    message: 'Uploaded payload is too large',
    details: null,
  }),
  429: buildErrorResponseSchema('Too many requests or authentication attempts.', {
    code: 'RATE_LIMITED',
    message: 'Too many requests',
    details: null,
  }),
  500: buildErrorResponseSchema('Unexpected server error.', {
    code: 'INTERNAL_ERROR',
    message: 'Unexpected internal server error',
    details: null,
  }),
} as const satisfies Record<CommonErrorStatusCode, TSchema>;

export const createSuccessResponseSchema = <T extends TSchema>(dataSchema: T, options: SchemaOptions = {}) =>
  Type.Object(
    {
      data: dataSchema,
    },
    {
      additionalProperties: false,
      ...options,
    },
  );

export const createCollectionResponseSchema = <T extends TSchema>(itemSchema: T, options: SchemaOptions = {}) =>
  createSuccessResponseSchema(
    Type.Array(itemSchema, {
      description: 'Collection response payload.',
    }),
    options,
  );

export const createPaginatedResponseSchema = <T extends TSchema>(itemSchema: T, options: SchemaOptions = {}) =>
  Type.Object(
    {
      data: Type.Array(itemSchema),
      meta: paginationMetaSchema,
    },
    {
      additionalProperties: false,
      ...options,
    },
  );

export const pickErrorResponseSchemas = (...statusCodes: readonly CommonErrorStatusCode[]) =>
  Object.fromEntries(
    statusCodes.map((statusCode) => [statusCode, commonErrorResponseSchemas[statusCode]]),
  ) as Partial<Record<CommonErrorStatusCode, TSchema>>;

export const createEnumSchema = <T extends readonly [string, ...string[]]>(
  values: T,
  options: {
    description?: string;
  } = {},
) => {
  if (values.length === 1) {
    return Type.Literal(values[0], options);
  }

  const literalSchemas = values.map((value) => Type.Literal(value)) as [
    ReturnType<typeof Type.Literal>,
    ReturnType<typeof Type.Literal>,
    ...ReturnType<typeof Type.Literal>[],
  ];

  return Type.Union(literalSchemas, options);
};

export const bearerAuthSecurity = [{ bearerAuth: [] }] as const;
