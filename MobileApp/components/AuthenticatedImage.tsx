import { Buffer } from 'buffer';
import React, { useEffect, useMemo, useState } from 'react';
import { Image, type ImageProps } from 'react-native';

import { useAuth } from '@/features/auth';
import { getAccessToken } from '@/lib/auth/session-store';
import { getApiBaseUrl } from '@/lib/api/http';

type AuthenticatedImageProps = Omit<ImageProps, 'source'> & {
  uri: string;
  fallback?: React.ReactNode;
  loadingFallback?: React.ReactNode;
};

const normalizeUri = (uri: string): string => {
  const apiBaseUrl = getApiBaseUrl().replace(/\/+$/, '');
  return uri.startsWith('/') ? `${apiBaseUrl}${uri}` : uri;
};

const requiresAuthenticatedFetch = (rawUri: string, normalizedUri: string): boolean => {
  const apiBaseUrl = getApiBaseUrl().replace(/\/+$/, '');
  return rawUri.startsWith('/') || normalizedUri.startsWith(`${apiBaseUrl}/`);
};

const getImageMimeType = (contentTypeHeader: string | null): string => {
  if (!contentTypeHeader) {
    return 'image/jpeg';
  }

  const mimeType = contentTypeHeader.split(';', 1)[0]?.trim().toLowerCase();
  return mimeType?.startsWith('image/') ? mimeType : 'image/jpeg';
};

export const AuthenticatedImage = ({
  uri,
  fallback = null,
  loadingFallback = null,
  onError,
  ...props
}: AuthenticatedImageProps): React.JSX.Element => {
  const { status } = useAuth();
  const token = getAccessToken();
  const normalizedUri = useMemo(() => normalizeUri(uri), [uri]);
  const shouldUseProtectedFetch = useMemo(
    () => requiresAuthenticatedFetch(uri, normalizedUri),
    [normalizedUri, uri],
  );
  const [resolvedUri, setResolvedUri] = useState<string | null>(shouldUseProtectedFetch ? null : normalizedUri);
  const [resolutionState, setResolutionState] = useState<'idle' | 'loading' | 'ready' | 'failed'>(
    !uri ? 'idle' : shouldUseProtectedFetch ? 'loading' : 'ready',
  );

  useEffect(() => {
    let isActive = true;
    const abortController = new AbortController();

    if (!uri) {
      setResolvedUri(null);
      setResolutionState('idle');
      return () => {
        abortController.abort();
      };
    }

    if (!shouldUseProtectedFetch) {
      setResolvedUri(normalizedUri);
      setResolutionState('ready');
      return () => {
        abortController.abort();
      };
    }

    if (status === 'loading') {
      setResolvedUri(null);
      setResolutionState('loading');
      return () => {
        abortController.abort();
      };
    }

    if (!token || status === 'unauthenticated') {
      setResolvedUri(null);
      setResolutionState('failed');
      return () => {
        abortController.abort();
      };
    }

    setResolvedUri(null);
    setResolutionState('loading');

    void (async () => {
      try {
        const response = await fetch(normalizedUri, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`Image request failed with HTTP ${response.status}`);
        }

        const mimeType = getImageMimeType(response.headers.get('content-type'));
        const bytes = await response.arrayBuffer();

        if (!isActive) {
          return;
        }

        const base64Payload = Buffer.from(bytes).toString('base64');
        setResolvedUri(`data:${mimeType};base64,${base64Payload}`);
        setResolutionState('ready');
      } catch {
        if (!isActive || abortController.signal.aborted) {
          return;
        }

        setResolvedUri(null);
        setResolutionState('failed');
      }
    })();

    return () => {
      isActive = false;
      abortController.abort();
    };
  }, [normalizedUri, shouldUseProtectedFetch, status, token, uri]);

  if (resolutionState === 'loading') {
    return <>{loadingFallback}</>;
  }

  if (!resolvedUri || resolutionState === 'failed') {
    return <>{fallback}</>;
  }

  return (
    <Image
      key={`${uri}:${token ?? 'anon'}:${status}`}
      source={{ uri: resolvedUri }}
      onError={(event) => {
        setResolvedUri(null);
        setResolutionState('failed');
        onError?.(event);
      }}
      {...props}
    />
  );
};
