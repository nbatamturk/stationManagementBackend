import { type Href, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { AppButton, AppCard, AppScreen, AppTextInput, colors, spacing } from '@/components';
import { changePassword } from '@/features/auth/service';
import { getApiErrorMessage, isApiError } from '@/lib/api/errors';

type FormErrors = {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
};

export default function ChangePasswordScreen(): React.JSX.Element {
  const router = useRouter();
  const settingsRoute = '/settings' as Href;
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  const handleSubmit = async (): Promise<void> => {
    if (submitting) {
      return;
    }

    const nextErrors: FormErrors = {};

    if (!currentPassword) {
      nextErrors.currentPassword = 'Enter your current password.';
    }

    if (!newPassword) {
      nextErrors.newPassword = 'Enter a new password.';
    } else if (newPassword.length < 8) {
      nextErrors.newPassword = 'New password must be at least 8 characters.';
    }

    if (!confirmPassword) {
      nextErrors.confirmPassword = 'Confirm the new password.';
    } else if (newPassword !== confirmPassword) {
      nextErrors.confirmPassword = 'Password confirmation does not match.';
    }

    setFormErrors(nextErrors);
    setErrorMessage('');

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setSubmitting(true);

    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setFormErrors({});
      Alert.alert(
        'Password Updated',
        'Your password has been updated. This session stays signed in on the current device.',
        [
          {
            text: 'OK',
            onPress: () => {
              router.replace(settingsRoute);
            },
          },
        ],
      );
    } catch (error) {
      if (isApiError(error)) {
        if (error.code === 'INVALID_CURRENT_PASSWORD') {
          setErrorMessage('Current password is incorrect. Check it and try again.');
          return;
        }

        if (error.kind === 'network') {
          setErrorMessage('Could not reach the server. Check your connection and try again.');
          return;
        }
      }

      setErrorMessage(
        getApiErrorMessage(error, 'Password update failed. Try again in a moment.'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppScreen>
      <AppCard style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.title}>Change Password</Text>
          <Text style={styles.description}>
            Confirm your current password, then choose a new one with at least 8 characters.
          </Text>
        </View>

        {errorMessage ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{errorMessage}</Text>
          </View>
        ) : null}

        <AppTextInput
          label="Current Password"
          value={currentPassword}
          onChangeText={(value) => {
            setCurrentPassword(value);
            setErrorMessage('');
            if (formErrors.currentPassword) {
              setFormErrors((prev) => ({ ...prev, currentPassword: undefined }));
            }
          }}
          placeholder="Enter your current password"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="password"
          textContentType="password"
          returnKeyType="next"
          error={formErrors.currentPassword}
          required
        />

        <AppTextInput
          label="New Password"
          value={newPassword}
          onChangeText={(value) => {
            setNewPassword(value);
            setErrorMessage('');
            if (formErrors.newPassword || formErrors.confirmPassword) {
              setFormErrors((prev) => ({
                ...prev,
                newPassword: undefined,
                confirmPassword: undefined,
              }));
            }
          }}
          placeholder="Use at least 8 characters"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="next"
          error={formErrors.newPassword}
          required
        />

        <AppTextInput
          label="Confirm New Password"
          value={confirmPassword}
          onChangeText={(value) => {
            setConfirmPassword(value);
            setErrorMessage('');
            if (formErrors.confirmPassword) {
              setFormErrors((prev) => ({ ...prev, confirmPassword: undefined }));
            }
          }}
          placeholder="Re-enter the new password"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={() => {
            void handleSubmit();
          }}
          error={formErrors.confirmPassword}
          required
        />

        <Text style={styles.note}>
          Changing the password here does not sign out the current device.
        </Text>

        <AppButton
          label={submitting ? 'Updating...' : 'Update Password'}
          onPress={() => {
            void handleSubmit();
          }}
          disabled={submitting}
        />
      </AppCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  header: {
    gap: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  description: {
    fontSize: 13,
    color: colors.mutedText,
    lineHeight: 18,
  },
  errorBanner: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F2C7C7',
    backgroundColor: '#FFF4F4',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorBannerText: {
    fontSize: 13,
    color: colors.danger,
    lineHeight: 18,
  },
  note: {
    fontSize: 13,
    color: colors.mutedText,
    lineHeight: 18,
  },
});
