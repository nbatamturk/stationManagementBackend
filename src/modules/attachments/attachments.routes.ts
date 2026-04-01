import { createReadStream } from 'node:fs';

import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';

import { successResponse } from '../../utils/api-response';
import { getCurrentUserId } from '../../utils/auth';
import { AppError } from '../../utils/errors';
import { bearerAuthSecurity, pickErrorResponseSchemas } from '../../utils/api-schemas';
import { assertCanWrite } from '../../utils/rbac';

import {
  attachmentDeleteResponseSchema,
  attachmentIdParamsSchema,
  attachmentListResponseSchema,
  attachmentParentParamsSchema,
  attachmentResponseSchema,
} from './attachments.schemas';
import { attachmentMaxFileSizeBytes } from './attachments.storage';
import { attachmentsService } from './attachments.service';

type AttachmentUploadPayload = {
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  buffer: Buffer;
};

const downloadResponseSchema = Type.String({
  description: 'Binary attachment contents. The actual response content type depends on the stored file MIME type.',
});

const mapMultipartError = (request: FastifyRequest, error: unknown) => {
  if (error instanceof request.server.multipartErrors.RequestFileTooLargeError) {
    throw new AppError(
      `Attachment exceeds maximum size of ${Math.floor(attachmentMaxFileSizeBytes / (1024 * 1024))} MB`,
      413,
      'ATTACHMENT_TOO_LARGE',
      {
        maxFileSizeBytes: attachmentMaxFileSizeBytes,
      },
    );
  }

  if (error instanceof request.server.multipartErrors.FilesLimitError) {
    throw new AppError('Only one attachment file is allowed', 400, 'INVALID_ATTACHMENT_UPLOAD');
  }

  if (error instanceof request.server.multipartErrors.FieldsLimitError) {
    throw new AppError('Attachment upload cannot include extra form fields', 400, 'INVALID_ATTACHMENT_UPLOAD');
  }

  if (error instanceof request.server.multipartErrors.PartsLimitError) {
    throw new AppError('Attachment upload contains too many form parts', 400, 'INVALID_ATTACHMENT_UPLOAD');
  }

  throw error;
};

const readAttachmentUpload = async (request: FastifyRequest): Promise<AttachmentUploadPayload> => {
  if (!request.isMultipart()) {
    throw new AppError('Attachment upload must use multipart/form-data with a file field', 400, 'INVALID_ATTACHMENT_UPLOAD');
  }

  let part;

  try {
    part = await request.file({
      throwFileSizeLimit: true,
      limits: {
        fields: 0,
        files: 1,
        fileSize: attachmentMaxFileSizeBytes,
        parts: 1,
      },
    });
  } catch (error) {
    mapMultipartError(request, error);
  }

  if (!part) {
    throw new AppError('Attachment file is required', 400, 'INVALID_ATTACHMENT_UPLOAD');
  }

  try {
    const buffer = await part.toBuffer();

    return {
      originalFileName: part.filename,
      mimeType: part.mimetype,
      sizeBytes: buffer.byteLength,
      buffer,
    };
  } catch (error) {
    mapMultipartError(request, error);
    throw error;
  }
};

export const attachmentsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/stations/:id/attachments',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Attachments'],
        summary: 'List station attachments',
        security: bearerAuthSecurity,
        params: attachmentParentParamsSchema,
        response: {
          200: attachmentListResponseSchema,
          ...pickErrorResponseSchemas(401, 404, 500),
        },
      },
    },
    async (request) => {
      const params = request.params as { id: string };
      const data = await attachmentsService.listByStation(params.id);
      return successResponse(data);
    },
  );

  fastify.post(
    '/stations/:id/attachments',
    {
      preHandler: [fastify.authenticate, assertCanWrite],
      schema: {
        tags: ['Attachments'],
        summary: 'Upload a station attachment',
        description: 'Upload a single attachment using `multipart/form-data` with a file field.',
        security: bearerAuthSecurity,
        consumes: ['multipart/form-data'],
        params: attachmentParentParamsSchema,
        response: {
          201: attachmentResponseSchema,
          ...pickErrorResponseSchemas(400, 401, 403, 404, 413, 500),
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { id: string };
      const upload = await readAttachmentUpload(request);
      const data = await attachmentsService.uploadToStation(getCurrentUserId(request), params.id, upload);
      return reply.status(201).send(successResponse(data));
    },
  );

  fastify.get(
    '/issues/:id/attachments',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Attachments'],
        summary: 'List issue attachments',
        security: bearerAuthSecurity,
        params: attachmentParentParamsSchema,
        response: {
          200: attachmentListResponseSchema,
          ...pickErrorResponseSchemas(401, 404, 500),
        },
      },
    },
    async (request) => {
      const params = request.params as { id: string };
      const data = await attachmentsService.listByIssue(params.id);
      return successResponse(data);
    },
  );

  fastify.post(
    '/issues/:id/attachments',
    {
      preHandler: [fastify.authenticate, assertCanWrite],
      schema: {
        tags: ['Attachments'],
        summary: 'Upload an issue attachment',
        description: 'Upload a single attachment using `multipart/form-data` with a file field.',
        security: bearerAuthSecurity,
        consumes: ['multipart/form-data'],
        params: attachmentParentParamsSchema,
        response: {
          201: attachmentResponseSchema,
          ...pickErrorResponseSchemas(400, 401, 403, 404, 413, 500),
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { id: string };
      const upload = await readAttachmentUpload(request);
      const data = await attachmentsService.uploadToIssue(getCurrentUserId(request), params.id, upload);
      return reply.status(201).send(successResponse(data));
    },
  );

  fastify.get(
    '/test-history/:id/attachments',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Attachments'],
        summary: 'List test history attachments',
        security: bearerAuthSecurity,
        params: attachmentParentParamsSchema,
        response: {
          200: attachmentListResponseSchema,
          ...pickErrorResponseSchemas(401, 404, 500),
        },
      },
    },
    async (request) => {
      const params = request.params as { id: string };
      const data = await attachmentsService.listByTestHistory(params.id);
      return successResponse(data);
    },
  );

  fastify.post(
    '/test-history/:id/attachments',
    {
      preHandler: [fastify.authenticate, assertCanWrite],
      schema: {
        tags: ['Attachments'],
        summary: 'Upload a test history attachment',
        description: 'Upload a single attachment using `multipart/form-data` with a file field.',
        security: bearerAuthSecurity,
        consumes: ['multipart/form-data'],
        params: attachmentParentParamsSchema,
        response: {
          201: attachmentResponseSchema,
          ...pickErrorResponseSchemas(400, 401, 403, 404, 413, 500),
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { id: string };
      const upload = await readAttachmentUpload(request);
      const data = await attachmentsService.uploadToTestHistory(getCurrentUserId(request), params.id, upload);
      return reply.status(201).send(successResponse(data));
    },
  );

  fastify.delete(
    '/attachments/:id',
    {
      preHandler: [fastify.authenticate, assertCanWrite],
      schema: {
        tags: ['Attachments'],
        summary: 'Delete an attachment',
        security: bearerAuthSecurity,
        params: attachmentIdParamsSchema,
        response: {
          200: attachmentDeleteResponseSchema,
          ...pickErrorResponseSchemas(401, 403, 404, 500),
        },
      },
    },
    async (request) => {
      const params = request.params as { id: string };
      const data = await attachmentsService.delete(getCurrentUserId(request), params.id);
      return successResponse(data);
    },
  );

  fastify.get(
    '/attachments/:id/download',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Attachments'],
        summary: 'Download an attachment',
        description: 'Streams the stored attachment file to the client. The response body is binary and the content type matches the stored file MIME type.',
        security: bearerAuthSecurity,
        produces: ['application/octet-stream'],
        params: attachmentIdParamsSchema,
        response: {
          200: downloadResponseSchema,
          ...pickErrorResponseSchemas(401, 404, 500),
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { id: string };
      const download = await attachmentsService.prepareDownload(getCurrentUserId(request), params.id);

      reply.header('content-type', download.mimeType);
      reply.header('content-length', String(download.sizeBytes));
      reply.header('content-disposition', download.contentDisposition);
      reply.header('x-content-type-options', 'nosniff');

      return reply.send(createReadStream(download.absolutePath));
    },
  );
};
