import type { MobilePlatformValue } from '../../contracts/domain';
import { isUndefinedTableError } from '../../utils/db-errors';
import { AppError } from '../../utils/errors';
import { writeAuditLog } from '../../utils/audit-log';
import { normalizeOptionalSingleLineText, normalizeRequiredSingleLineText } from '../../utils/input';

import {
  mobileAppConfigRepository,
  type MobileAppConfigRepository,
} from './mobile-app-config.repository';

const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

type MobileAppConfigRecord = Awaited<ReturnType<MobileAppConfigRepository['get']>>;

type MobileAppConfigResponse = {
  iosMinimumSupportedVersion: string | null;
  androidMinimumSupportedVersion: string | null;
  iosDownloadUrl: string | null;
  androidDownloadUrl: string | null;
  updatedAt: Date | null;
  updatedByUserId: string | null;
};

type VersionCheckResult = {
  platform: MobilePlatformValue;
  appVersion: string;
  minimumSupportedVersion: string | null;
  downloadUrl: string | null;
  shouldWarn: boolean;
  warningMode: 'warn';
  message: string | null;
};

const APP_DOWNLOAD_URL_MAX_LENGTH = 2048;

const parseVersion = (value: string, field: string) => {
  const normalized = normalizeRequiredSingleLineText(value, field, {
    collapseWhitespace: false,
    maxLength: 32,
    minLength: 5,
  });

  if (!VERSION_PATTERN.test(normalized)) {
    throw new AppError(`${field} must use x.y.z format`, 400, 'INVALID_APP_VERSION');
  }

  return normalized.split('.').map((segment) => Number(segment)) as [number, number, number];
};

const compareVersions = (left: string, right: string) => {
  const leftParts = parseVersion(left, 'App version');
  const rightParts = parseVersion(right, 'Minimum supported version');

  for (const index of [0, 1, 2] as const) {
    const delta = leftParts[index] - rightParts[index];

    if (delta !== 0) {
      return delta;
    }
  }

  return 0;
};

const normalizeOptionalHttpsUrl = (value: string | null | undefined, field: string): string | null => {
  const normalized = normalizeOptionalSingleLineText(value ?? undefined, field, {
    collapseWhitespace: false,
    emptyAs: 'null',
    maxLength: APP_DOWNLOAD_URL_MAX_LENGTH,
  });

  if (normalized === undefined || normalized === null) {
    return null;
  }

  let parsed: URL;

  try {
    parsed = new URL(normalized);
  } catch {
    throw new AppError(`${field} must be a valid HTTPS URL`, 400, 'INVALID_APP_DOWNLOAD_URL');
  }

  if (parsed.protocol !== 'https:') {
    throw new AppError(`${field} must use https://`, 400, 'INVALID_APP_DOWNLOAD_URL');
  }

  return parsed.toString();
};

export class MobileAppConfigService {
  constructor(private readonly repository: MobileAppConfigRepository = mobileAppConfigRepository) {}

  async get(): Promise<MobileAppConfigResponse> {
    try {
      const config = await this.repository.get();
      return this.toResponse(config);
    } catch (error) {
      throw this.mapStorageError(error);
    }
  }

  async update(
    userId: string,
    payload: {
      iosMinimumSupportedVersion: string | null;
      androidMinimumSupportedVersion: string | null;
      iosDownloadUrl: string | null;
      androidDownloadUrl: string | null;
    },
  ): Promise<MobileAppConfigResponse> {
    const iosMinimumSupportedVersion = this.normalizeOptionalVersion(
      payload.iosMinimumSupportedVersion,
      'iOS minimum supported version',
    );
    const androidMinimumSupportedVersion = this.normalizeOptionalVersion(
      payload.androidMinimumSupportedVersion,
      'Android minimum supported version',
    );
    const iosDownloadUrl = normalizeOptionalHttpsUrl(payload.iosDownloadUrl, 'iOS download URL');
    const androidDownloadUrl = normalizeOptionalHttpsUrl(
      payload.androidDownloadUrl,
      'Android download URL',
    );

    try {
      const saved = await this.repository.upsert({
        androidMinimumSupportedVersion,
        androidDownloadUrl,
        iosMinimumSupportedVersion,
        iosDownloadUrl,
        updatedBy: userId,
      });

      await writeAuditLog({
        actorUserId: userId,
        entityType: 'mobile_app_config',
        entityId: saved.id,
        action: 'mobile_app_config.updated',
        metadataJson: {
          iosMinimumSupportedVersion,
          androidMinimumSupportedVersion,
          iosDownloadUrl,
          androidDownloadUrl,
        },
      });

      return this.toResponse(saved);
    } catch (error) {
      throw this.mapStorageError(error);
    }
  }

  async check(payload: { platform: MobilePlatformValue; appVersion: string }): Promise<VersionCheckResult> {
    const appVersion = normalizeRequiredSingleLineText(payload.appVersion, 'App version', {
      collapseWhitespace: false,
      maxLength: 32,
      minLength: 5,
    });

    parseVersion(appVersion, 'App version');

    let minimumSupportedVersion: string | null;
    let downloadUrl: string | null;

    try {
      const config = await this.repository.get();
      if (payload.platform === 'ios') {
        minimumSupportedVersion = config?.iosMinimumSupportedVersion ?? null;
        downloadUrl = config?.iosDownloadUrl ?? null;
      } else {
        minimumSupportedVersion = config?.androidMinimumSupportedVersion ?? null;
        downloadUrl = config?.androidDownloadUrl ?? null;
      }
    } catch (error) {
      throw this.mapStorageError(error);
    }

    if (!minimumSupportedVersion) {
      return {
        platform: payload.platform,
        appVersion,
        minimumSupportedVersion: null,
        downloadUrl,
        shouldWarn: false,
        warningMode: 'warn',
        message: null,
      };
    }

    const shouldWarn = compareVersions(appVersion, minimumSupportedVersion) < 0;

    return {
      platform: payload.platform,
      appVersion,
      minimumSupportedVersion,
      downloadUrl,
      shouldWarn,
      warningMode: 'warn',
      message: shouldWarn
        ? `Installed ${payload.platform} app version ${appVersion} is below the minimum supported version ${minimumSupportedVersion}.`
        : null,
    };
  }

  private normalizeOptionalVersion(value: string | null, field: string) {
    const normalized = normalizeOptionalSingleLineText(value ?? undefined, field, {
      collapseWhitespace: false,
      emptyAs: 'null',
      maxLength: 32,
      minLength: 5,
    });

    if (normalized === undefined || normalized === null) {
      return null;
    }

    parseVersion(normalized, field);
    return normalized;
  }

  private toResponse(config: MobileAppConfigRecord): MobileAppConfigResponse {
    return {
      iosMinimumSupportedVersion: config?.iosMinimumSupportedVersion ?? null,
      androidMinimumSupportedVersion: config?.androidMinimumSupportedVersion ?? null,
      iosDownloadUrl: config?.iosDownloadUrl ?? null,
      androidDownloadUrl: config?.androidDownloadUrl ?? null,
      updatedAt: config?.updatedAt ?? null,
      updatedByUserId: config?.updatedBy ?? null,
    };
  }

  private mapStorageError(error: unknown) {
    if (isUndefinedTableError(error)) {
      return new AppError(
        'Mobile app config storage is missing. Run npm run db:migrate and try again.',
        500,
        'MOBILE_APP_CONFIG_SCHEMA_MISSING',
      );
    }

    return error;
  }
}

export const mobileAppConfigService = new MobileAppConfigService();
