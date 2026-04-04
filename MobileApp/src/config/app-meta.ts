export const APP_META = {
  displayName: 'Vestel Field Core',
  displayVersion: '1.0.0',
  slug: 'istasyonTakipGPTV2',
  scheme: 'istasyontakipgptv2',
  supportEmail: 'evcdv@vestel.com.tr',
  branding: {
    primary: '#C8102E',
    primarySoft: '#FFF1F3',
    splashBackground: '#FFF7F7',
  },
} as const;

export type AppMeta = typeof APP_META;
