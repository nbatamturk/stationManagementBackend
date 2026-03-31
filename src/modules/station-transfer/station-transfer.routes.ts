import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsync } from 'fastify';

import { successResponse } from '../../utils/api-response';
import { getCurrentUserId } from '../../utils/auth';
import { AppError } from '../../utils/errors';
import { bearerAuthSecurity, pickErrorResponseSchemas } from '../../utils/api-schemas';
import { requireRoles } from '../../utils/rbac';

import { stationListQuerySchema } from '../stations/stations.schemas';
import {
  stationImportApplyBodySchema,
  stationImportApplyResponseSchema,
  stationImportPreviewResponseSchema,
} from './station-transfer.schemas';
import { stationTransferService } from './station-transfer.service';

const csvResponseSchema = Type.String({
  description: 'CSV file contents.',
});

export const stationTransferRoutes: FastifyPluginAsync = async (fastify) => {
  const adminOnly = [fastify.authenticate, requireRoles(['admin'])];

  fastify.get(
    '/exports/stations.csv',
    {
      preHandler: adminOnly,
      schema: {
        tags: ['Station Transfer'],
        summary: 'Export stations as CSV',
        description:
          'Exports all matching stations as a CSV file. Uses the same filter model as `GET /stations`, including `cf.<key>` custom-field filters. Pagination parameters are accepted for compatibility but ignored by the export.',
        security: bearerAuthSecurity,
        produces: ['text/csv'],
        querystring: stationListQuerySchema,
        response: {
          200: csvResponseSchema,
          ...pickErrorResponseSchemas(400, 401, 403, 500),
        },
      },
    },
    async (request, reply) => {
      const query = request.query as Record<string, unknown>;
      const data = await stationTransferService.exportStationsCsv(getCurrentUserId(request), query);

      reply.header('content-type', 'text/csv; charset=utf-8');
      reply.header('content-disposition', `attachment; filename="${data.fileName}"`);

      return reply.send(data.csvContent);
    },
  );

  fastify.post(
    '/imports/stations/preview',
    {
      preHandler: adminOnly,
      schema: {
        tags: ['Station Transfer'],
        summary: 'Preview a station CSV import',
        description: 'Accepts `multipart/form-data` with a single CSV file field and returns validation, matching, and apply-ready preview data.',
        security: bearerAuthSecurity,
        consumes: ['multipart/form-data'],
        response: {
          200: stationImportPreviewResponseSchema,
          ...pickErrorResponseSchemas(400, 401, 403, 500),
        },
      },
    },
    async (request) => {
      if (!request.isMultipart()) {
        throw new AppError('CSV upload must use multipart/form-data with a file field', 400, 'INVALID_CSV_UPLOAD');
      }

      const part = await request.file();

      if (!part) {
        throw new AppError('CSV file is required', 400, 'INVALID_CSV_UPLOAD');
      }

      const csvContent = (await part.toBuffer()).toString('utf-8');
      const data = await stationTransferService.previewStationsCsvImport(getCurrentUserId(request), {
        fileName: part.filename || null,
        csvContent,
      });

      return successResponse(data);
    },
  );

  fastify.post(
    '/imports/stations/apply',
    {
      preHandler: adminOnly,
      schema: {
        tags: ['Station Transfer'],
        summary: 'Apply a station CSV import preview',
        security: bearerAuthSecurity,
        body: stationImportApplyBodySchema,
        response: {
          200: stationImportApplyResponseSchema,
          ...pickErrorResponseSchemas(400, 401, 403, 500),
        },
      },
    },
    async (request) => {
      const body = request.body as {
        mode?: 'upsert';
        rows: Array<{
          rowNumber: number;
          station: {
            name: string;
            code: string;
            qrCode: string;
            brand: string;
            model: string;
            serialNumber: string;
            powerKw: number;
            currentType: 'AC' | 'DC';
            socketType: 'Type2' | 'CCS2' | 'CHAdeMO' | 'GBT' | 'NACS' | 'Other';
            location: string;
            status?: 'active' | 'maintenance' | 'inactive' | 'faulty' | 'archived';
            isArchived?: boolean;
            lastTestDate?: string;
            notes?: string;
          };
          customFields?: Record<string, unknown>;
        }>;
      };

      const data = await stationTransferService.applyStationsCsvImport(getCurrentUserId(request), body);
      return successResponse(data);
    },
  );
};
