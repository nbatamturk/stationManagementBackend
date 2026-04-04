import { randomUUID } from 'node:crypto';
import { access, constants, mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import sharp from 'sharp';

import { env } from '../../config/env';
import { AppError } from '../../utils/errors';

const modelImageMimeTypeToExtensions: Record<string, readonly string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
};

const decodedFormatToMimeType: Record<string, keyof typeof modelImageMimeTypeToExtensions> = {
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export const modelImageAllowedMimeTypes = Object.keys(modelImageMimeTypeToExtensions) as Array<
  keyof typeof modelImageMimeTypeToExtensions
>;

const modelImageAllowedMimeTypeSet = new Set<string>(modelImageAllowedMimeTypes);

export const modelImageMaxFileSizeBytes = env.MODEL_IMAGES_MAX_FILE_SIZE_BYTES;

const MODEL_IMAGE_MAX_DIMENSION_PX = 4096;
const MODEL_IMAGE_MAX_TOTAL_PIXELS = 16_000_000;
const MODEL_IMAGE_INLINE_FILE_NAME = 'station-model-image';

type ModelImagePathInput = {
  modelId: string;
  originalFileName: string;
  mimeType: string;
};

type NormalizeModelImageInput = {
  mimeType: string;
  originalFileName: string | null | undefined;
  sizeBytes: number;
  buffer: Buffer;
};

type NormalizedModelImage = {
  buffer: Buffer;
  mimeType: 'image/jpeg' | 'image/png';
  originalFileName: string;
  sizeBytes: number;
};

const getUploadsRootPath = () => path.resolve(process.cwd(), env.UPLOADS_DIR);

const getNodeErrorCode = (error: unknown) =>
  typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : null;

const normalizeMimeType = (mimeType: string) => mimeType.trim().toLowerCase();

const getSafeExtension = (fileName: string, mimeType: string) => {
  const extension = path.extname(fileName).toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 16);
  const allowedExtensions = modelImageMimeTypeToExtensions[mimeType] ?? [];

  if (extension && extension !== '.' && allowedExtensions.includes(extension)) {
    return extension;
  }

  return allowedExtensions[0] ?? '';
};

const getStoredBaseName = (fileName: string, extension: string) => {
  const rawBaseName = extension ? fileName.slice(0, -extension.length) : fileName;
  const sanitized = rawBaseName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

  return sanitized || MODEL_IMAGE_INLINE_FILE_NAME;
};

const toAsciiDownloadName = (fileName: string) => {
  const ascii = fileName.replace(/[^\x20-\x7e]+/g, '_').replace(/["\\]/g, '_').trim();
  return ascii || MODEL_IMAGE_INLINE_FILE_NAME;
};

const encodeContentDispositionFileName = (fileName: string) =>
  encodeURIComponent(fileName).replace(/['()]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);

const replaceExtension = (fileName: string, extension: string) => {
  const baseName = path.basename(fileName, path.extname(fileName));
  const sanitizedBaseName = sanitizeModelImageOriginalFileName(baseName);
  return `${sanitizedBaseName || MODEL_IMAGE_INLINE_FILE_NAME}${extension}`;
};

const getOutputExtension = (mimeType: 'image/jpeg' | 'image/png') =>
  mimeType === 'image/png' ? '.png' : '.jpg';

export const sanitizeModelImageOriginalFileName = (fileName: string | null | undefined) => {
  const normalized = path
    .basename(fileName || MODEL_IMAGE_INLINE_FILE_NAME)
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f]+/g, '')
    .trim();

  return (normalized || MODEL_IMAGE_INLINE_FILE_NAME).slice(0, 255);
};

export const validateAndNormalizeModelImage = async (
  input: NormalizeModelImageInput,
): Promise<NormalizedModelImage> => {
  const declaredMimeType = normalizeMimeType(input.mimeType);
  const originalFileName = sanitizeModelImageOriginalFileName(input.originalFileName);
  const declaredExtension = path.extname(originalFileName).toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 16);

  if (!modelImageAllowedMimeTypeSet.has(declaredMimeType)) {
    throw new AppError('Unsupported station model image type', 415, 'UNSUPPORTED_STATION_MODEL_IMAGE_TYPE', {
      allowedMimeTypes: [...modelImageAllowedMimeTypes],
    });
  }

  if (input.sizeBytes <= 0) {
    throw new AppError('Station model image is empty', 400, 'EMPTY_STATION_MODEL_IMAGE');
  }

  if (input.sizeBytes > modelImageMaxFileSizeBytes) {
    throw new AppError(
      `Station model image exceeds maximum size of ${Math.floor(modelImageMaxFileSizeBytes / (1024 * 1024))} MB`,
      413,
      'STATION_MODEL_IMAGE_TOO_LARGE',
      {
        maxFileSizeBytes: modelImageMaxFileSizeBytes,
      },
    );
  }

  const allowedExtensions = modelImageMimeTypeToExtensions[declaredMimeType] ?? [];

  if (declaredExtension && declaredExtension !== '.' && !allowedExtensions.includes(declaredExtension)) {
    throw new AppError(
      'Station model image file extension does not match the declared content type',
      400,
      'INVALID_STATION_MODEL_IMAGE_FILE_NAME',
      {
        allowedExtensions,
      },
    );
  }

  let metadata: sharp.Metadata;

  try {
    metadata = await sharp(input.buffer, {
      animated: true,
      limitInputPixels: MODEL_IMAGE_MAX_TOTAL_PIXELS,
    }).metadata();
  } catch {
    throw new AppError('Station model image content is unreadable or invalid', 415, 'INVALID_STATION_MODEL_IMAGE_CONTENT');
  }

  const actualMimeType = metadata.format ? decodedFormatToMimeType[metadata.format] : undefined;

  if (!actualMimeType || !modelImageAllowedMimeTypeSet.has(actualMimeType)) {
    throw new AppError('Station model image content must be PNG, JPEG, or WebP', 415, 'INVALID_STATION_MODEL_IMAGE_CONTENT');
  }

  if (actualMimeType !== declaredMimeType) {
    throw new AppError(
      'Station model image content does not match the declared content type',
      400,
      'STATION_MODEL_IMAGE_MIME_MISMATCH',
    );
  }

  if (!metadata.width || !metadata.height) {
    throw new AppError('Station model image dimensions could not be determined', 400, 'INVALID_STATION_MODEL_IMAGE_DIMENSIONS');
  }

  if (metadata.pages && metadata.pages > 1) {
    throw new AppError('Animated station model images are not supported', 415, 'UNSUPPORTED_STATION_MODEL_IMAGE_TYPE');
  }

  if (metadata.width > MODEL_IMAGE_MAX_DIMENSION_PX || metadata.height > MODEL_IMAGE_MAX_DIMENSION_PX) {
    throw new AppError(
      `Station model image dimensions must be at most ${MODEL_IMAGE_MAX_DIMENSION_PX}x${MODEL_IMAGE_MAX_DIMENSION_PX}`,
      400,
      'STATION_MODEL_IMAGE_DIMENSIONS_EXCEEDED',
      {
        maxDimensionPx: MODEL_IMAGE_MAX_DIMENSION_PX,
      },
    );
  }

  if (metadata.width * metadata.height > MODEL_IMAGE_MAX_TOTAL_PIXELS) {
    throw new AppError(
      `Station model image exceeds the maximum pixel count of ${MODEL_IMAGE_MAX_TOTAL_PIXELS.toLocaleString('en-US')}`,
      400,
      'STATION_MODEL_IMAGE_PIXELS_EXCEEDED',
      {
        maxTotalPixels: MODEL_IMAGE_MAX_TOTAL_PIXELS,
      },
    );
  }

  const pipeline = sharp(input.buffer, {
    animated: false,
    limitInputPixels: MODEL_IMAGE_MAX_TOTAL_PIXELS,
  })
    .rotate()
    .resize({
      width: MODEL_IMAGE_MAX_DIMENSION_PX,
      height: MODEL_IMAGE_MAX_DIMENSION_PX,
      fit: 'inside',
      withoutEnlargement: true,
    });

  const normalizedMimeType: 'image/jpeg' | 'image/png' = metadata.hasAlpha ? 'image/png' : 'image/jpeg';
  const normalizedBuffer =
    normalizedMimeType === 'image/png'
      ? await pipeline.png({ compressionLevel: 9, progressive: false }).toBuffer()
      : await pipeline.jpeg({ mozjpeg: true, progressive: false, quality: 86 }).toBuffer();

  if (normalizedBuffer.byteLength <= 0) {
    throw new AppError('Station model image normalization failed', 500, 'STATION_MODEL_IMAGE_NORMALIZATION_FAILED');
  }

  if (normalizedBuffer.byteLength > modelImageMaxFileSizeBytes) {
    throw new AppError(
      `Normalized station model image exceeds maximum size of ${Math.floor(modelImageMaxFileSizeBytes / (1024 * 1024))} MB`,
      413,
      'STATION_MODEL_IMAGE_TOO_LARGE',
      {
        maxFileSizeBytes: modelImageMaxFileSizeBytes,
      },
    );
  }

  return {
    buffer: normalizedBuffer,
    mimeType: normalizedMimeType,
    originalFileName: replaceExtension(originalFileName, getOutputExtension(normalizedMimeType)),
    sizeBytes: normalizedBuffer.byteLength,
  };
};

export const buildStationModelImageStoragePath = (input: ModelImagePathInput) => {
  const originalFileName = sanitizeModelImageOriginalFileName(input.originalFileName);
  const mimeType = normalizeMimeType(input.mimeType);
  const extension = getSafeExtension(originalFileName, mimeType);
  const storedBaseName = getStoredBaseName(originalFileName, extension);
  const storedFileName = `${randomUUID()}-${storedBaseName}${extension}`;

  return path.posix.join('station-model-images', input.modelId, storedFileName);
};

export const resolveStationModelImageAbsolutePath = (storagePath: string) => {
  const uploadsRootPath = getUploadsRootPath();
  const absolutePath = path.resolve(uploadsRootPath, ...storagePath.split('/'));
  const relativeToRoot = path.relative(uploadsRootPath, absolutePath);

  if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
    throw new AppError('Invalid station model image path', 500, 'INVALID_STATION_MODEL_IMAGE_PATH');
  }

  return absolutePath;
};

export const writeStationModelImageBuffer = async (storagePath: string, buffer: Buffer) => {
  const absolutePath = resolveStationModelImageAbsolutePath(storagePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, buffer, { flag: 'wx' });
  return absolutePath;
};

export const ensureStationModelImageReadable = async (storagePath: string) => {
  const absolutePath = resolveStationModelImageAbsolutePath(storagePath);

  try {
    await access(absolutePath, constants.R_OK);
    return absolutePath;
  } catch (error) {
    if (getNodeErrorCode(error) === 'ENOENT') {
      throw new AppError('Station model image file not found', 404, 'STATION_MODEL_IMAGE_FILE_NOT_FOUND');
    }

    throw error;
  }
};

export const deleteStoredStationModelImageFile = async (storagePath: string) => {
  try {
    await unlink(resolveStationModelImageAbsolutePath(storagePath));
    return true;
  } catch (error) {
    if (getNodeErrorCode(error) === 'ENOENT') {
      return false;
    }

    throw error;
  }
};

export const buildStationModelImageInlineContentDisposition = (fileName: string | null | undefined) => {
  const normalized = sanitizeModelImageOriginalFileName(fileName);
  const fallback = toAsciiDownloadName(normalized);
  const encoded = encodeContentDispositionFileName(normalized);

  return `inline; filename="${fallback}"; filename*=UTF-8''${encoded}`;
};
