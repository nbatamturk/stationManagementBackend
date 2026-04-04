import { Buffer } from 'buffer';
import React, { useEffect, useMemo, useState } from 'react';
import { Image, type ImageProps } from 'react-native';

import { useAuth } from '@/features/auth';
import { getAccessToken } from '@/lib/auth/session-store';
import { getApiBaseUrl } from '@/lib/api/http';

type AuthenticatedImageProps = Omit<ImageProps, 'source'> & {
  uri: string;
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
  ...props
}: AuthenticatedImageProps): React.JSX.Element => {
  const { status } = useAuth();
  const token = getAccessToken();
  const normalizedUri = useMemo(() => normalizeUri(uri), [uri]);
  const shouldUseProtectedFetch = useMemo(
    () => requiresAuthenticatedFetch(uri, normalizedUri),
    [normalizedUri, uri],
  );
  const [resolvedUri, setResolvedUri] = useState<string | null>(
    shouldUseProtectedFetch ? null : normalizedUri,
  );

  useEffect(() => {
    let isActive = true;
    const abortController = new AbortController();

    if (!uri) {
      setResolvedUri(null);
      return () => {
        abortController.abort();
      };
    }

    if (!shouldUseProtectedFetch) {
      setResolvedUri(normalizedUri);
      return () => {
        abortController.abort();
      };
    }

    if (status !== 'authenticated' || !token) {
      setResolvedUri(null);
      return () => {
        abortController.abort();
      };
    }

    setResolvedUri(null);

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
      } catch {
        if (!isActive || abortController.signal.aborted) {
          return;
        }

        setResolvedUri(null);
      }
    })();

    return () => {
      isActive = false;
      abortController.abort();
    };
  }, [normalizedUri, shouldUseProtectedFetch, status, token, uri]);

  if (!resolvedUri) {
    return <></>;
  }

  return <Image key={`${uri}:${token ?? 'anon'}:${status}`} source={{ uri: resolvedUri }} {...props} />;
};
