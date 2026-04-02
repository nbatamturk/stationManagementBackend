import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import type { FastifySchemaCompiler } from 'fastify/types/schema';

const strictWriteAjv = new Ajv({
  allErrors: false,
  coerceTypes: 'array',
  removeAdditional: false,
  useDefaults: true,
});

addFormats(strictWriteAjv);

export const strictWriteValidatorCompiler: FastifySchemaCompiler<unknown> = ({ schema }) =>
  strictWriteAjv.compile(schema as object);

export const strictWriteRouteOptions = {
  validatorCompiler: strictWriteValidatorCompiler,
} as const;
