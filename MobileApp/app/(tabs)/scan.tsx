import { CameraView, type BarcodeScanningResult, useCameraPermissions } from 'expo-camera';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  AppButton,
  AppCard,
  AppScreen,
  AppTextInput,
  ErrorState,
  LoadingState,
  colors,
} from '@/components';
import { getStationByQrCode } from '@/features/stations';

type ScanResultState =
  | {
      kind: 'not_found';
      qrCode: string;
      message: string;
    }
  | {
      kind: 'error';
      qrCode: string;
      message: string;
    }
  | null;

const DUPLICATE_SCAN_WINDOW_MS = 2500;

export default function QrScanScreen(): React.JSX.Element {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [manualQrCode, setManualQrCode] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [isScannerEnabled, setIsScannerEnabled] = useState(true);
  const [scannedQrCode, setScannedQrCode] = useState<string>('');
  const [scanResult, setScanResult] = useState<ScanResultState>(null);
  const lastHandledScanRef = useRef<{ qrCode: string; timestamp: number } | null>(null);

  useFocusEffect(
    useCallback(() => {
      setIsScannerEnabled(true);
      setScannedQrCode('');
      setScanResult(null);
      setIsChecking(false);
      lastHandledScanRef.current = null;
    }, []),
  );

  const handleScannedValue = async (qrCodeValue: string): Promise<void> => {
    const sanitized = qrCodeValue.trim();

    if (!sanitized || isChecking) {
      return;
    }

    const lastHandled = lastHandledScanRef.current;

    if (
      lastHandled &&
      lastHandled.qrCode === sanitized &&
      Date.now() - lastHandled.timestamp < DUPLICATE_SCAN_WINDOW_MS
    ) {
      return;
    }

    lastHandledScanRef.current = {
      qrCode: sanitized,
      timestamp: Date.now(),
    };

    setIsChecking(true);
    setIsScannerEnabled(false);
    setScannedQrCode(sanitized);
    setScanResult(null);

    try {
      const station = await getStationByQrCode(sanitized);

      if (station) {
        router.push({ pathname: '/stations/[id]', params: { id: station.id, section: 'overview' } });
        return;
      }

      setScanResult({
        kind: 'not_found',
        qrCode: sanitized,
        message:
          'No backend station matches this QR code yet. Create a station only if the QR is valid, expected, and you can assign the correct catalog model and connectors.',
      });
    } catch (error) {
      setScanResult({
        kind: 'error',
        qrCode: sanitized,
        message:
          error instanceof Error
            ? `Could not check the scanned QR code: ${error.message}`
            : 'Could not check the scanned QR code.',
      });
    } finally {
      setIsChecking(false);
    }
  };

  const handleBarcodeScanned = (result: BarcodeScanningResult): void => {
    void handleScannedValue(result.data);
  };

  const retryScan = (): void => {
    setIsScannerEnabled(true);
    setScannedQrCode('');
    setScanResult(null);
    setIsChecking(false);
  };

  const submitManualLookup = (): void => {
    void handleScannedValue(manualQrCode);
  };

  const lookupCard = (
    <AppCard>
      <Text style={styles.panelTitle}>Manual QR Lookup</Text>
      <AppTextInput
        label="QR Code"
        value={manualQrCode}
        onChangeText={setManualQrCode}
        placeholder="Enter or paste the station QR code"
        autoCapitalize="none"
        returnKeyType="go"
        onSubmitEditing={() => submitManualLookup()}
      />
      <AppButton
        label={isChecking ? 'Checking QR...' : 'Check QR'}
        onPress={submitManualLookup}
        disabled={isChecking || manualQrCode.trim().length < 2}
      />
    </AppCard>
  );

  const resultPanel =
    scanResult?.kind === 'not_found' ? (
      <ErrorState
        title="QR code not found"
        description={scanResult.message}
        actionLabel="Create Backend Station"
        onActionPress={() =>
          router.push({ pathname: '/stations/edit', params: { qrCode: scanResult.qrCode } })
        }
        secondaryActionLabel="Search Existing Stations"
        onSecondaryActionPress={() =>
          router.push({ pathname: '/stations', params: { search: scanResult.qrCode } })
        }
        compact
      />
    ) : scanResult?.kind === 'error' ? (
      <ErrorState
        title="QR lookup failed"
        description={scanResult.message}
        actionLabel="Try Again"
        onActionPress={retryScan}
        compact
      />
    ) : null;

  if (!permission) {
    return (
      <AppScreen>
        <LoadingState label="Preparing camera..." />
      </AppScreen>
    );
  }

  if (!permission.granted) {
    return (
      <AppScreen keyboardAvoiding>
        <AppCard>
          <Text style={styles.panelTitle}>Camera Access Required For Fast Scan</Text>
          <Text style={styles.helperText}>
            Allow camera access to scan station QR codes directly. You can still perform a manual
            QR lookup below.
          </Text>
          <AppButton label="Grant Camera Permission" onPress={() => void requestPermission()} />
        </AppCard>
        {resultPanel}
        {lookupCard}
      </AppScreen>
    );
  }

  return (
    <AppScreen keyboardAvoiding>
      {lookupCard}

      <AppCard>
        <Text style={styles.panelTitle}>Scan Station QR</Text>
        <Text style={styles.helperText}>
          Point the camera at the station QR code. Duplicate reads are ignored briefly to prevent
          accidental double handling. Successful matches open station detail immediately, where you
          can jump straight into test or issue entry.
        </Text>

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

        {isChecking ? <LoadingState label="Checking scanned QR..." compact /> : null}

        {scannedQrCode ? (
          <Text style={styles.scannedText}>
            Last QR: <Text style={styles.scannedValue}>{scannedQrCode}</Text>
          </Text>
        ) : null}

        {resultPanel}

        {!isScannerEnabled ? (
          <View style={styles.actionRow}>
            <AppButton label="Scan Again" variant="secondary" onPress={retryScan} />
          </View>
        ) : null}
      </AppCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  panelTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
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
  actionRow: {
    alignSelf: 'flex-start',
  },
});
