import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AppButton, AppCard, AppScreen, AppTextInput, colors } from '@/components';
import { useAuth } from '@/features/auth';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SUPPORT_EMAIL =
  process.env.EXPO_PUBLIC_SUPPORT_EMAIL?.trim() || 'evcdv@vestel.com.tr';

type FormErrors = {
  email?: string;
  password?: string;
};

export default function LoginScreen(): React.JSX.Element {
  const router = useRouter();
  const { signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  const handleSupportPress = (): void => {
    void Linking.openURL(`mailto:${SUPPORT_EMAIL}`);
  };

  const handleSubmit = async (): Promise<void> => {
    const normalizedEmail = email.trim().toLowerCase();
    const nextErrors: FormErrors = {};

    if (!normalizedEmail) {
      nextErrors.email = 'Enter your email address.';
    } else if (!EMAIL_PATTERN.test(normalizedEmail)) {
      nextErrors.email = 'Use a valid email address.';
    }

    if (!password) {
      nextErrors.password = 'Enter your password.';
    }

    setFormErrors(nextErrors);
    setErrorMessage('');

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setSubmitting(true);

    try {
      await signIn(normalizedEmail, password);
      router.replace('/');
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Login failed. Check your credentials and try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppScreen contentContainerStyle={styles.content}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardContainer}
      >
        <View style={styles.shell}>
          <View style={styles.topGlow} />
          <View style={styles.bottomGlow} />

          <AppCard style={styles.formCard}>
            <View style={styles.formHeader}>
              <Text style={styles.formEyebrow}>Welcome Back</Text>
              <Text style={styles.formTitle}>Sign In To Continue</Text>
              <Text style={styles.formSubtitle}>
                Use your assigned account. The app restores your session automatically after
                successful login.
              </Text>
            </View>

            {errorMessage ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
                <Text style={styles.errorBannerText}>{errorMessage}</Text>
              </View>
            ) : null}

            <AppTextInput
              label="Work Email"
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                setErrorMessage('');
                if (formErrors.email) {
                  setFormErrors((prev) => ({ ...prev, email: undefined }));
                }
              }}
              placeholder="name@company.com"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
              error={formErrors.email}
              required
            />

            <AppTextInput
              label="Password"
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                setErrorMessage('');
                if (formErrors.password) {
                  setFormErrors((prev) => ({ ...prev, password: undefined }));
                }
              }}
              placeholder="Enter your password"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={() => {
                void handleSubmit();
              }}
              error={formErrors.password}
              required
              rightAccessory={
                <Pressable
                  onPress={() => setShowPassword((prev) => !prev)}
                  style={({ pressed }) => [styles.passwordToggle, pressed && styles.pressed]}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={colors.mutedText}
                  />
                  <Text style={styles.passwordToggleText}>
                    {showPassword ? 'Hide' : 'Show'}
                  </Text>
                </Pressable>
              }
            />

            <View style={styles.sessionNote}>
              <Ionicons name="lock-closed-outline" size={15} color={colors.primary} />
              <Text style={styles.sessionNoteText}>
                Tokens are stored securely on device and invalid sessions are cleared automatically.
              </Text>
            </View>

            <AppButton
              label={submitting ? 'Signing In...' : 'Sign In'}
              onPress={() => {
                void handleSubmit();
              }}
              disabled={submitting}
              style={styles.submitButton}
            />

            <View style={styles.footerNote}>
              <Text style={styles.footerNoteText}>
                For problems or other questions, you can reach{' '}
                <Text style={styles.footerNoteLink} onPress={handleSupportPress}>
                  {SUPPORT_EMAIL}
                </Text>
                .
              </Text>
            </View>
          </AppCard>
        </View>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    justifyContent: 'center',
    paddingVertical: 20,
  },
  keyboardContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  shell: {
    position: 'relative',
    gap: 16,
    overflow: 'hidden',
  },
  topGlow: {
    position: 'absolute',
    top: -48,
    right: -20,
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: '#DDEBFF',
  },
  bottomGlow: {
    position: 'absolute',
    bottom: 40,
    left: -36,
    width: 140,
    height: 140,
    borderRadius: 999,
    backgroundColor: '#EEF5FF',
  },
  formCard: {
    gap: 16,
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  formHeader: {
    gap: 4,
  },
  formEyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  formTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  formSubtitle: {
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 19,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderColor: '#F0C5C5',
    backgroundColor: '#FFF4F4',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  errorBannerText: {
    flex: 1,
    color: colors.danger,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  passwordToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  passwordToggleText: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.72,
  },
  sessionNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 12,
    backgroundColor: '#F4F8FF',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  sessionNoteText: {
    flex: 1,
    color: colors.text,
    fontSize: 12,
    lineHeight: 18,
  },
  submitButton: {
    marginTop: 4,
  },
  footerNote: {
    gap: 4,
    paddingTop: 2,
  },
  footerNoteText: {
    color: colors.mutedText,
    fontSize: 12,
    lineHeight: 18,
  },
  footerNoteLink: {
    color: colors.primary,
    fontWeight: '700',
  },
});
