'use client';
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState, type ImgHTMLAttributes, type ReactNode } from 'react';

import { getToken } from '@/lib/auth/token';

const API_PROXY_PREFIX = '/api/proxy';
const DIRECT_URL_PATTERN = /^(blob:|data:|https?:\/\/)/i;

type ProtectedImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src: string;
  fallback?: ReactNode;
};

export function ProtectedImage({ src, fallback = null, alt, ...props }: ProtectedImageProps) {
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!src) {
      setResolvedSrc(null);
      return;
    }

    if (DIRECT_URL_PATTERN.test(src)) {
      setResolvedSrc(src);
      return;
    }

    const controller = new AbortController();
    const token = getToken();
    const headers = new Headers();

    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    let objectUrl: string | null = null;

    const loadImage = async () => {
      try {
        const response = await fetch(`${API_PROXY_PREFIX}${src}`, {
          cache: 'no-store',
          headers,
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        setResolvedSrc(objectUrl);
      } catch {
        if (!controller.signal.aborted) {
          setResolvedSrc(null);
        }
      }
    };

    void loadImage();

    return () => {
      controller.abort();

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [src]);

  if (!resolvedSrc) {
    return <>{fallback}</>;
  }

  return <img alt={alt} src={resolvedSrc} {...props} />;
}
