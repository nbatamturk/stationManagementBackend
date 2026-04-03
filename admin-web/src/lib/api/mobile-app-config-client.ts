import {
  MobileAppConfig,
  MobileAppConfigUpdatePayload,
  MobileAppVersionCheckPayload,
  MobileAppVersionCheckResult,
  SuccessResponse,
} from '@/types/api';
import { apiFetch } from './http';

export const mobileAppConfigClient = {
  get: () => apiFetch<SuccessResponse<MobileAppConfig>>('/mobile-app-config'),
  update: (payload: MobileAppConfigUpdatePayload) =>
    apiFetch<SuccessResponse<MobileAppConfig>>('/mobile-app-config', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  check: (payload: MobileAppVersionCheckPayload) =>
    apiFetch<SuccessResponse<MobileAppVersionCheckResult>>(
      '/mobile-app-config/check',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      false,
    ),
};
