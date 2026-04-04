import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton, AppCard, AppScreen, colors } from '@/components';

export default function CustomFieldSettingsScreen(): React.JSX.Element {
  const router = useRouter();

  return (
    <AppScreen contentContainerStyle={styles.content}>
      <AppCard style={styles.card}>
        <Text style={styles.eyebrow}>Admin-Web Only</Text>
        <Text style={styles.title}>Custom field definitions moved out of mobile</Text>
        <Text style={styles.body}>
          Field users can still view and fill active custom fields on station records, but
          definition management now lives in admin-web so the catalog and station forms stay in
          sync.
        </Text>

        <View style={styles.noteBox}>
          <Text style={styles.noteTitle}>Use admin-web for</Text>
          <Text style={styles.noteText}>Creating, editing, or deleting custom field definitions</Text>
          <Text style={styles.noteText}>Updating required rules, visibility, and list filtering</Text>
          <Text style={styles.noteText}>Managing select options and long-term field structure</Text>
        </View>

        <View style={styles.actions}>
          <AppButton
            label="Back To Settings"
            variant="secondary"
            onPress={() => router.replace('/settings')}
          />
        </View>
      </AppCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    justifyContent: 'center',
  },
  card: {
    gap: 14,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  body: {
    color: colors.mutedText,
    fontSize: 14,
    lineHeight: 21,
  },
  noteBox: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: '#F8FBFF',
    padding: 12,
    gap: 6,
  },
  noteTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  noteText: {
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 19,
  },
  actions: {
    gap: 10,
  },
});
