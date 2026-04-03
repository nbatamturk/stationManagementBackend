'use client';

import { useEffect } from 'react';

const APP_TITLE = 'Station Admin';

export const buildDocumentTitle = (value?: string | null) => {
  const normalizedValue = value?.trim();
  return normalizedValue ? `${normalizedValue} | ${APP_TITLE}` : APP_TITLE;
};

export const useDocumentTitle = (value?: string | null) => {
  useEffect(() => {
    document.title = buildDocumentTitle(value);
  }, [value]);
};
