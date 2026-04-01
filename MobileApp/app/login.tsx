import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton, AppCard, AppScreen, AppTextInput, colors } from '@/components';
import { useAuth } from '@/features/auth';

export default function LoginScreen(): React.JSX.Element {
  const router = useRouter();
  const { signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (): Promise<void> => {
    setErrorMessage('');

    const normalizedEmail = email.trim();
    if (!normalizedEmail || !password) {
      setErrorMessage('Email and password are required.');
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
      <View style={styles.hero}>
        <Text style={styles.kicker}>Phase 1 Integration</Text>
        <Text style={styles.title}>Station Management Mobile</Text>
        <Text style={styles.description}>
          Backend is now the source of truth. Sign in to load stations, station detail, QR lookup,
          test history, and issue records from the API.
        </Text>
      </View>

      <AppCard style={styles.card}>
        <AppTextInput
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="operator@evlab.local"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
        />
        <AppTextInput
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="Enter password"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
        />

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        <AppButton
          label={submitting ? 'Signing In...' : 'Sign In'}
          onPress={() => {
            void handleSubmit();
          }}
          disabled={submitting}
        />

        <Text style={styles.hintText}>
          Local prototype data is no longer used for the integrated station flows.
        </Text>
      </AppCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    justifyContent: 'center',
    paddingVertical: 24,
  },
  hero: {
    gap: 8,
  },
  kicker: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
  },
  description: {
    color: colors.mutedText,
    fontSize: 14,
    lineHeight: 21,
  },
  card: {
    gap: 14,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '600',
  },
  hintText: {
    color: colors.mutedText,
    fontSize: 12,
    lineHeight: 18,
  },
});
