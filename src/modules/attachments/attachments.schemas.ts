import { Type } from '@sinclair/typebox';

import { attachmentTargetTypeValues } from '../../contracts/domain';
import {
  createCollectionResponseSchema,
  createEnumSchema,
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

const attachmentTargetTypeSchema = createEnumSchema(attachmentTargetTypeValues);

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

export const attachmentListResponseSchema = createCollectionResponseSchema(attachmentRecordSchema);

export const attachmentResponseSchema = createSuccessResponseSchema(attachmentRecordSchema);

export const attachmentDeleteResponseSchema = createSuccessResponseSchema(deleteResultDataSchema);
