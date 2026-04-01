import { randomUUID } from 'node:crypto';
import { access, constants, mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { env } from '../../config/env';
import { AppError } from '../../utils/errors';

const mimeTypeToExtensions: Record<string, readonly string[]> = {
  'application/json': ['.json'],
  'application/msword': ['.doc'],
  'application/pdf': ['.pdf'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/zip': ['.zip'],
  'image/gif': ['.gif'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'text/csv': ['.csv'],
  'text/plain': ['.txt', '.log'],
};

export const attachmentAllowedMimeTypes = [
  'application/json',
  'application/msword',
  'application/pdf',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/zip',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/csv',
  'text/plain',
] as const;

const allowedMimeTypeSet = new Set<string>(attachmentAllowedMimeTypes);

export const attachmentMaxFileSizeBytes = env.ATTACHMENTS_MAX_FILE_SIZE_BYTES;

type AttachmentPathInput = {
  stationId: string;
  issueId?: string | null;
  testHistoryId?: string | null;
  originalFileName: string;
  mimeType: string;
};

const getUploadsRootPath = () => path.resolve(process.cwd(), env.UPLOADS_DIR);

const getNodeErrorCode = (error: unknown) =>
  typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : null;

const normalizeMimeType = (mimeType: string) => mimeType.trim().toLowerCase();

const getSafeExtension = (fileName: string, mimeType: string) => {
  const extension = path.extname(fileName).toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 16);
  const allowedExtensions = mimeTypeToExtensions[mimeType] ?? [];

  if (extension && extension !== '.' && allowedExtensions.includes(extension)) {
    return extension;
  }

  return allowedExtensions[0] ?? '';
};

const getStoredBaseName = (fileName: string, extension: string) => {
  const rawBaseName = extension ? fileName.slice(0, -extension.length) : fileName;
  const sanitized = rawBaseName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

  return sanitized || 'file';
};

const toAsciiDownloadName = (fileName: string) => {
  const ascii = fileName.replace(/[^\x20-\x7e]+/g, '_').replace(/["\\]/g, '_').trim();
  return ascii || 'download';
};

const encodeContentDispositionFileName = (fileName: string) =>
  encodeURIComponent(fileName).replace(/['()]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);

export const sanitizeOriginalFileName = (fileName: string | null | undefined) => {
  const normalized = path
    .basename(fileName || 'file')
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f]+/g, '')
    .trim();

  return (normalized || 'file').slice(0, 255);
};

export const validateAttachmentFile = (input: {
  mimeType: string;
  originalFileName: string | null | undefined;
  sizeBytes: number;
}) => {
  const mimeType = normalizeMimeType(input.mimeType);
  const originalFileName = sanitizeOriginalFileName(input.originalFileName);
  const extension = path.extname(originalFileName).toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 16);

  if (!allowedMimeTypeSet.has(mimeType)) {
    throw new AppError('Unsupported attachment type', 415, 'UNSUPPORTED_ATTACHMENT_TYPE', {
      allowedMimeTypes: [...attachmentAllowedMimeTypes],
    });
  }

  if (input.sizeBytes <= 0) {
    throw new AppError('Attachment file is empty', 400, 'EMPTY_ATTACHMENT');
  }

  if (input.sizeBytes > attachmentMaxFileSizeBytes) {
    throw new AppError(
      `Attachment exceeds maximum size of ${Math.floor(attachmentMaxFileSizeBytes / (1024 * 1024))} MB`,
      413,
      'ATTACHMENT_TOO_LARGE',
      {
        maxFileSizeBytes: attachmentMaxFileSizeBytes,
      },
    );
  }

  if (extension && extension !== '.') {
    const allowedExtensions = mimeTypeToExtensions[mimeType] ?? [];

    if (allowedExtensions.length > 0 && !allowedExtensions.includes(extension)) {
      throw new AppError(
        'Attachment file extension does not match the content type',
        400,
        'INVALID_ATTACHMENT_FILE_NAME',
        {
          allowedExtensions,
        },
      );
    }
  }

  return mimeType;
};

export const buildAttachmentStoragePath = (input: AttachmentPathInput) => {
  const originalFileName = sanitizeOriginalFileName(input.originalFileName);
  const mimeType = normalizeMimeType(input.mimeType);
  const extension = getSafeExtension(originalFileName, mimeType);
  const storedBaseName = getStoredBaseName(originalFileName, extension);
  const storedFileName = `${randomUUID()}-${storedBaseName}${extension}`;

  if (input.issueId) {
    return path.posix.join('attachments', 'stations', input.stationId, 'issues', input.issueId, storedFileName);
  }

  if (input.testHistoryId) {
    return path.posix.join(
      'attachments',
      'stations',
      input.stationId,
      'test-history',
      input.testHistoryId,
      storedFileName,
    );
  }

  return path.posix.join('attachments', 'stations', input.stationId, storedFileName);
};

export const resolveAttachmentAbsolutePath = (storagePath: string) => {
  const uploadsRootPath = getUploadsRootPath();
  const absolutePath = path.resolve(uploadsRootPath, ...storagePath.split('/'));
  const relativeToRoot = path.relative(uploadsRootPath, absolutePath);

  if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
    throw new AppError('Invalid attachment path', 500, 'INVALID_ATTACHMENT_PATH');
  }

  return absolutePath;
};

export const writeAttachmentBuffer = async (storagePath: string, buffer: Buffer) => {
  const absolutePath = resolveAttachmentAbsolutePath(storagePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, buffer, { flag: 'wx' });
  return absolutePath;
};

export const ensureAttachmentReadable = async (storagePath: string) => {
  const absolutePath = resolveAttachmentAbsolutePath(storagePath);

  try {
    await access(absolutePath, constants.R_OK);
    return absolutePath;
  } catch (error) {
    if (getNodeErrorCode(error) === 'ENOENT') {
      throw new AppError('Attachment file not found', 404, 'ATTACHMENT_FILE_NOT_FOUND');
    }

    throw error;
  }
};

export const deleteStoredAttachmentFile = async (storagePath: string) => {
  try {
    await unlink(resolveAttachmentAbsolutePath(storagePath));
    return true;
  } catch (error) {
    if (getNodeErrorCode(error) === 'ENOENT') {
      return false;
    }

    throw error;
  }
};

export const buildAttachmentContentDisposition = (fileName: string) => {
  const normalized = sanitizeOriginalFileName(fileName);
  const fallback = toAsciiDownloadName(normalized);
  const encoded = encodeContentDispositionFileName(normalized);

  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
};
