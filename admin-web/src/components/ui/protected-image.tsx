'use client';
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState, type ImgHTMLAttributes, type ReactNode } from 'react';

import { getToken } from '@/lib/auth/token';

const API_PROXY_PREFIX = '/api/proxy';
const DIRECT_URL_PATTERN = /^(blob:|data:)/i;
const PUBLIC_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, '') ?? '';

type ProtectedImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src: string;
  fallback?: ReactNode;
};

function resolveProtectedImageSource(src: string) {
  if (!src) {
    return null;
  }

  if (src.startsWith(API_PROXY_PREFIX)) {
    return {
      mode: 'direct' as const,
      url: src,
    };
  }

  if (DIRECT_URL_PATTERN.test(src)) {
    return {
      mode: 'direct' as const,
      url: src,
    };
  }

  if (/^https?:\/\//i.test(src)) {
    if (!PUBLIC_API_BASE_URL) {
      return {
        mode: 'direct' as const,
        url: src,
      };
    }

    try {
      const imageUrl = new URL(src);
      const apiBaseUrl = new URL(PUBLIC_API_BASE_URL);

      if (imageUrl.origin === apiBaseUrl.origin) {
        return {
          mode: 'proxied' as const,
          url: `${API_PROXY_PREFIX}${imageUrl.pathname}${imageUrl.search}`,
        };
      }
    } catch {
      return {
        mode: 'direct' as const,
        url: src,
      };
    }

    return {
      mode: 'direct' as const,
      url: src,
    };
  }

  return {
    mode: 'proxied' as const,
    url: `${API_PROXY_PREFIX}${src}`,
  };
}

export function ProtectedImage({ src, fallback = null, alt, ...props }: ProtectedImageProps) {
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!src) {
      setResolvedSrc(null);
      return;
    }

    const source = resolveProtectedImageSource(src);

    if (!source) {
      setResolvedSrc(null);
      return;
    }

    if (source.mode === 'direct') {
      setResolvedSrc(source.url);
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
        const response = await fetch(source.url, {
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
