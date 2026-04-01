export interface SettingsMenuItem {
  label: string;
  description: string;
  route?: string;
  isComingSoon?: boolean;
}

export const settingsMenuItems: SettingsMenuItem[] = [
  {
    label: 'Custom Field Management',
    description: 'Manage dynamic fields used in station forms and filters.',
    route: '/settings/custom-fields',
  },
  {
    label: 'Test History',
    description: 'Infrastructure is prepared for station test history records.',
    isComingSoon: true,
  },
  {
    label: 'Issue / Fault Records',
    description: 'Infrastructure is prepared for issue tracking per station.',
    isComingSoon: true,
  },
  {
    label: 'Photo Attachments',
    description: 'Infrastructure is prepared for local photo attachments.',
    isComingSoon: true,
  },
  {
    label: 'Export / Import',
    description: 'Infrastructure is prepared for local data exchange workflows.',
    isComingSoon: true,
  },
  {
    label: 'Role Permissions',
    description: 'Infrastructure is prepared for local role-based access control.',
    isComingSoon: true,
  },
];
