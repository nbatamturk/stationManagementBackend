import { Type } from '@sinclair/typebox';

import {
  createSuccessResponseSchema,
  deleteResultDataSchema,
  isoDateTimeSchema,
  uuidSchema,
} from '../../utils/api-schemas';

export const attachmentParentParamsSchema = Type.Object(
  {
    id: uuidSchema,
  },
  { additionalProperties: false },
);

export const attachmentIdParamsSchema = Type.Object(
  {
    id: uuidSchema,
  },
  { additionalProperties: false },
);

const attachmentTargetTypeSchema = Type.Union([
  Type.Literal('station'),
  Type.Literal('issue'),
  Type.Literal('testHistory'),
]);

export const attachmentRecordSchema = Type.Object(
  {
    id: uuidSchema,
    stationId: uuidSchema,
    issueId: Type.Union([uuidSchema, Type.Null()]),
    testHistoryId: Type.Union([uuidSchema, Type.Null()]),
    targetType: attachmentTargetTypeSchema,
    originalFileName: Type.String(),
    mimeType: Type.String(),
    sizeBytes: Type.Integer({ minimum: 0 }),
    uploadedBy: Type.Union([uuidSchema, Type.Null()]),
    createdAt: isoDateTimeSchema,
    downloadUrl: Type.String({
      description: 'Relative download URL for authenticated clients.',
    }),
  },
  { additionalProperties: false },
);

export const attachmentListResponseSchema = createSuccessResponseSchema(Type.Array(attachmentRecordSchema));

export const attachmentResponseSchema = createSuccessResponseSchema(attachmentRecordSchema);

export const attachmentDeleteResponseSchema = createSuccessResponseSchema(deleteResultDataSchema);
