import { CameraView, type BarcodeScanningResult, useCameraPermissions } from 'expo-camera';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton, AppCard, AppScreen, LoadingState, colors } from '@/components';
import { getStationByQrCode } from '@/features/stations';

export default function QrScanScreen(): React.JSX.Element {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [isChecking, setIsChecking] = useState(false);
  const [isScannerEnabled, setIsScannerEnabled] = useState(true);
  const [scannedQrCode, setScannedQrCode] = useState<string>('');
  const [notFoundMessage, setNotFoundMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useFocusEffect(
    useCallback(() => {
      setIsScannerEnabled(true);
      setScannedQrCode('');
      setNotFoundMessage('');
      setErrorMessage('');
      setIsChecking(false);
    }, []),
  );

  const handleScannedValue = async (qrCodeValue: string): Promise<void> => {
    const sanitized = qrCodeValue.trim();

    if (!sanitized || isChecking) {
      return;
    }

    setIsChecking(true);
    setIsScannerEnabled(false);
    setScannedQrCode(sanitized);
    setNotFoundMessage('');
    setErrorMessage('');

    try {
      const station = await getStationByQrCode(sanitized);

      if (station) {
        router.push({ pathname: '/stations/[id]', params: { id: station.id } });
        return;
      }

      router.push({ pathname: '/stations/edit', params: { qrCode: sanitized } });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? `Could not check scanned QR: ${error.message}`
          : 'Could not check scanned QR.',
      );
    } finally {
      setIsChecking(false);
    }
  };

  const handleBarcodeScanned = (result: BarcodeScanningResult): void => {
    void handleScannedValue(result.data);
  };

  const retryScan = (): void => {
    setIsScannerEnabled(true);
    setNotFoundMessage('');
    setErrorMessage('');
  };

  if (!permission) {
    return (
      <AppScreen>
        <LoadingState label="Preparing camera..." />
      </AppScreen>
    );
  }

  if (!permission.granted) {
    return (
      <AppScreen>
        <AppCard>
          <Text style={styles.helperText}>
            Allow camera access to scan QR codes and open station records directly.
          </Text>
          <AppButton label="Grant Camera Permission" onPress={() => void requestPermission()} />
        </AppCard>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <AppCard>
        <View style={styles.cameraContainer}>
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: ['qr'],
            }}
            onBarcodeScanned={isScannerEnabled ? handleBarcodeScanned : undefined}
          />
          <View style={styles.overlay} pointerEvents="none">
            <View style={styles.scanFrame} />
          </View>
        </View>

        {isChecking ? <LoadingState label="Checking scanned QR..." /> : null}

        {scannedQrCode ? (
          <Text style={styles.scannedText}>
            QR: <Text style={styles.scannedValue}>{scannedQrCode}</Text>
          </Text>
        ) : (
          <Text style={styles.helperText}>Point camera to station QR code.</Text>
        )}

        {notFoundMessage ? <Text style={styles.notFoundText}>{notFoundMessage}</Text> : null}
        {errorMessage ? <Text style={styles.notFoundText}>{errorMessage}</Text> : null}

        {!isScannerEnabled ? (
          <View style={styles.actionRow}>
            <AppButton
              label="Scan Again"
              variant="secondary"
              onPress={retryScan}
            />
          </View>
        ) : null}
      </AppCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  cameraContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#0C1324',
    height: 280,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanFrame: {
    width: 180,
    height: 180,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  helperText: {
    fontSize: 13,
    color: colors.mutedText,
    lineHeight: 19,
  },
  scannedText: {
    fontSize: 12,
    color: colors.mutedText,
  },
  scannedValue: {
    fontWeight: '600',
    color: colors.text,
  },
  notFoundText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '600',
  },
  actionRow: {
    alignSelf: 'flex-start',
  },
});
