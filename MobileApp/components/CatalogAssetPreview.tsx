import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  type ImageProps,
} from 'react-native';

import { AuthenticatedImage } from '@/components/AuthenticatedImage';
import { LoadingState } from '@/components/LoadingState';
import { colors } from '@/components/theme';

type CatalogAssetPreviewProps = {
  label: string;
  uri?: string | null;
  emptyText: string;
  failureText?: string;
  loadingText?: string;
  frameMinHeight?: number;
  resizeMode?: ImageProps['resizeMode'];
};

const Placeholder = ({ message }: { message: string }): React.JSX.Element => (
  <View style={styles.placeholder}>
    <Text style={styles.placeholderText}>{message}</Text>
  </View>
);

export const CatalogAssetPreview = ({
  label,
  uri,
  emptyText,
  failureText,
  loadingText,
  frameMinHeight = 140,
  resizeMode = 'contain',
}: CatalogAssetPreviewProps): React.JSX.Element => {
  const missingPlaceholder = <Placeholder message={emptyText} />;
  const failedPlaceholder = <Placeholder message={failureText ?? emptyText} />;

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.frame, { minHeight: frameMinHeight }]}>
        {uri ? (
          <AuthenticatedImage
            uri={uri}
            resizeMode={resizeMode}
            style={[styles.image, { minHeight: frameMinHeight, height: frameMinHeight }]}
            fallback={failedPlaceholder}
            loadingFallback={
              <View style={styles.placeholder}>
                <LoadingState label={loadingText ?? `Loading ${label.toLowerCase()}...`} compact />
              </View>
            }
          />
        ) : (
          missingPlaceholder
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    gap: 8,
    flex: 1,
  },
  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  frame: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#F8FBFF',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    minHeight: 100,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  placeholderText: {
    color: colors.mutedText,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
});
