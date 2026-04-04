export const userRoleValues = ['admin', 'operator', 'viewer'] as const;

export const stationStatusValues = ['active', 'maintenance', 'inactive', 'faulty'] as const;

export const currentTypeValues = ['AC', 'DC'] as const;

export const socketTypeValues = ['Type2', 'CCS2', 'CHAdeMO', 'GBT', 'NACS', 'Other'] as const;
export const connectorTypeValues = socketTypeValues;

export const customFieldTypeValues = ['text', 'number', 'boolean', 'select', 'date', 'json'] as const;

export const stationTestResultValues = ['pass', 'fail', 'warning'] as const;

export const issueSeverityValues = ['low', 'medium', 'high', 'critical'] as const;

export const issueStatusValues = ['open', 'in_progress', 'resolved', 'closed'] as const;

export const stationViewValues = ['full', 'compact'] as const;

export const attachmentTargetTypeValues = ['station', 'issue', 'testHistory'] as const;
export const mobilePlatformValues = ['ios', 'android'] as const;

export type UserRoleValue = (typeof userRoleValues)[number];
export type StationStatusValue = (typeof stationStatusValues)[number];
export type CurrentTypeValue = (typeof currentTypeValues)[number];
export type SocketTypeValue = (typeof socketTypeValues)[number];
export type ConnectorTypeValue = (typeof connectorTypeValues)[number];
export type CustomFieldTypeValue = (typeof customFieldTypeValues)[number];
export type StationTestResultValue = (typeof stationTestResultValues)[number];
export type IssueSeverityValue = (typeof issueSeverityValues)[number];
export type IssueStatusValue = (typeof issueStatusValues)[number];
export type StationViewValue = (typeof stationViewValues)[number];
export type AttachmentTargetTypeValue = (typeof attachmentTargetTypeValues)[number];
export type MobilePlatformValue = (typeof mobilePlatformValues)[number];
