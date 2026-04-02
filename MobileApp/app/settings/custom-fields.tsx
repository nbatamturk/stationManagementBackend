import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  AppButton,
  AppCard,
  AppScreen,
  AppTextInput,
  EmptyState,
  LabeledSwitch,
  LoadingState,
  OptionChip,
  colors,
} from '@/components';
import { useAuth } from '@/features/auth';
import { getCustomFieldDefinitions, setCustomFieldActive, upsertCustomFieldDefinition } from '@/features/custom-fields';
import type { CustomFieldDefinition, CustomFieldDefinitionDraft, CustomFieldType } from '@/types';
import { optionsEditorTextToJson, optionsJsonToEditorText } from '@/utils/custom-field';

const customFieldTypeOptions: CustomFieldType[] = ['text', 'number', 'boolean', 'date', 'select'];

const createDefaultDraft = (): CustomFieldDefinitionDraft => ({
  key: '',
  label: '',
  type: 'text',
  optionsJson: '',
  isRequired: false,
  isFilterable: false,
  isVisibleInList: false,
  sortOrder: 0,
  isActive: true,
});

const definitionToDraft = (definition: CustomFieldDefinition): CustomFieldDefinitionDraft => ({
  key: definition.key,
  label: definition.label,
  type: definition.type,
  optionsJson: definition.optionsJson ?? '',
  isRequired: definition.isRequired,
  isFilterable: definition.isFilterable,
  isVisibleInList: definition.isVisibleInList,
  sortOrder: definition.sortOrder,
  isActive: definition.isActive,
});

export default function CustomFieldSettingsScreen(): React.JSX.Element {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [definitions, setDefinitions] = useState<CustomFieldDefinition[]>([]);
  const [draft, setDraft] = useState<CustomFieldDefinitionDraft>(createDefaultDraft());
  const [selectOptionsText, setSelectOptionsText] = useState('');
  const [selectedFieldId, setSelectedFieldId] = useState<string | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState('');

  const loadDefinitions = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getCustomFieldDefinitions(false);
      setDefinitions(result);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadDefinitions();
    }, [loadDefinitions]),
  );

  const resetForm = (): void => {
    setDraft(createDefaultDraft());
    setSelectOptionsText('');
    setSelectedFieldId(undefined);
    setErrorMessage('');
  };

  const saveDefinition = async (): Promise<void> => {
    if (!isAdmin) {
      setErrorMessage('Only admin users can change custom field definitions.');
      return;
    }

    setErrorMessage('');

    if (!draft.label.trim()) {
      setErrorMessage('Label is required.');
      return;
    }

    let normalizedOptionsJson = '';

    if (draft.type === 'select') {
      const json = optionsEditorTextToJson(selectOptionsText);
      const parsed = JSON.parse(json);

      if (!Array.isArray(parsed) || parsed.length === 0) {
        setErrorMessage('Select fields must include at least one option.');
        return;
      }

      normalizedOptionsJson = json;
    }

    setSaving(true);

    try {
      await upsertCustomFieldDefinition(
        {
          ...draft,
          optionsJson: normalizedOptionsJson,
          sortOrder: Number.isNaN(Number(draft.sortOrder)) ? 0 : Number(draft.sortOrder),
        },
        selectedFieldId,
      );

      await loadDefinitions();
      resetForm();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? `Could not save custom field: ${error.message}`
          : 'Could not save custom field.',
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleFieldActive = async (definition: CustomFieldDefinition): Promise<void> => {
    if (!isAdmin) {
      setErrorMessage('Only admin users can change custom field definitions.');
      return;
    }

    if (definition.isActive) {
      Alert.alert(
        'Disable Field',
        `Disable "${definition.label}"? Existing values will be kept, but the field will be hidden from active usage.`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Disable',
            style: 'destructive',
            onPress: () => {
              void setCustomFieldActive(definition.id, false).then(loadDefinitions);
            },
          },
        ],
      );
      return;
    }

    await setCustomFieldActive(definition.id, true);
    await loadDefinitions();
  };

  return (
    <AppScreen>
      <AppCard>
        <Text style={styles.cardTitle}>{selectedFieldId ? 'Edit Field' : 'Create Field'}</Text>

        <AppTextInput
          label="Label"
          value={draft.label}
          required
          onChangeText={(value) => setDraft((prev) => ({ ...prev, label: value }))}
        />
        <AppTextInput
          label="Key"
          value={draft.key}
          onChangeText={(value) => setDraft((prev) => ({ ...prev, key: value }))}
          placeholder="Optional, auto-generated from label"
          autoCapitalize="none"
          editable={isAdmin && !selectedFieldId}
        />

        <View style={styles.typeGroup}>
          <Text style={styles.groupLabel}>Type</Text>
          <View style={styles.typeRow}>
            {customFieldTypeOptions.map((typeOption) => (
              <OptionChip
                key={typeOption}
                label={typeOption}
                selected={draft.type === typeOption}
                onPress={() => setDraft((prev) => ({ ...prev, type: typeOption }))}
              />
            ))}
          </View>
        </View>

        {draft.type === 'select' ? (
          <View style={styles.selectEditorGroup}>
            <AppTextInput
              label="Select Options"
              value={selectOptionsText}
              onChangeText={setSelectOptionsText}
              placeholder={'Option A\\nOption B\\nOption C'}
              autoCapitalize="none"
              multiline
            />
            <Text style={styles.selectEditorHint}>Enter one option per line.</Text>
          </View>
        ) : null}

        <AppTextInput
          label="Sort Order"
          value={`${draft.sortOrder}`}
          onChangeText={(value) =>
            setDraft((prev) => ({
              ...prev,
              sortOrder: Number.isNaN(Number(value)) ? 0 : Number(value || 0),
            }))
          }
          keyboardType="numeric"
          autoCapitalize="none"
        />

        <LabeledSwitch
          label="Required"
          value={draft.isRequired}
          onValueChange={(value) => setDraft((prev) => ({ ...prev, isRequired: value }))}
        />
        <LabeledSwitch
          label="Filterable"
          value={draft.isFilterable}
          onValueChange={(value) => setDraft((prev) => ({ ...prev, isFilterable: value }))}
        />
        <LabeledSwitch
          label="Visible in List"
          value={draft.isVisibleInList}
          onValueChange={(value) => setDraft((prev) => ({ ...prev, isVisibleInList: value }))}
        />
        <LabeledSwitch
          label="Active"
          value={draft.isActive}
          onValueChange={(value) => setDraft((prev) => ({ ...prev, isActive: value }))}
        />

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
        {!isAdmin ? (
          <Text style={styles.readOnlyText}>
            This screen is read-only for non-admin users.
          </Text>
        ) : null}

        <View style={styles.actionRow}>
          <AppButton
            label={saving ? 'Saving...' : selectedFieldId ? 'Update Field' : 'Create Field'}
            onPress={() => {
              void saveDefinition();
            }}
            disabled={saving || !isAdmin}
            style={styles.buttonFlex}
          />
          <AppButton
            label="Reset"
            variant="secondary"
            onPress={resetForm}
            style={styles.buttonFlex}
          />
        </View>
      </AppCard>

      <AppCard>
        <Text style={styles.cardTitle}>Existing Definitions</Text>
        {loading ? (
          <LoadingState label="Loading field definitions..." />
        ) : definitions.length === 0 ? (
          <EmptyState
            title="No custom fields"
            description="Create your first dynamic field above."
            actionLabel="Start New Field"
            onActionPress={resetForm}
          />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.definitionList}>
              {definitions.map((definition) => (
                <Pressable
                  key={definition.id}
                  style={({ pressed }) => [styles.definitionItem, pressed && styles.pressed]}
                  onPress={() => {
                    setSelectedFieldId(definition.id);
                    setDraft(definitionToDraft(definition));
                    setSelectOptionsText(optionsJsonToEditorText(definition.optionsJson));
                    setErrorMessage('');
                  }}
                >
                  <Text style={styles.definitionLabel}>{definition.label}</Text>
                  <Text style={styles.definitionMeta}>
                    {definition.key} • {definition.type} • sort {definition.sortOrder}
                  </Text>
                  <Text style={styles.definitionMeta}>
                    Required: {definition.isRequired ? 'Yes' : 'No'} • Filterable:{' '}
                    {definition.isFilterable ? 'Yes' : 'No'} • List:{' '}
                    {definition.isVisibleInList ? 'Yes' : 'No'}
                  </Text>
                  <AppButton
                    label={definition.isActive ? 'Disable' : 'Enable'}
                    variant={definition.isActive ? 'secondary' : 'primary'}
                    onPress={() => {
                      void toggleFieldActive(definition);
                    }}
                  />
                </Pressable>
              ))}
            </View>
          </ScrollView>
        )}
      </AppCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  cardTitle: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '700',
  },
  groupLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  typeGroup: {
    gap: 8,
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectEditorGroup: {
    gap: 6,
  },
  selectEditorHint: {
    fontSize: 12,
    color: colors.mutedText,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  buttonFlex: {
    flex: 1,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '600',
  },
  readOnlyText: {
    color: colors.mutedText,
    fontSize: 12,
    lineHeight: 18,
  },
  definitionList: {
    gap: 10,
  },
  definitionItem: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 10,
    gap: 4,
    width: 320,
    backgroundColor: colors.surface,
  },
  pressed: {
    opacity: 0.82,
  },
  definitionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  definitionMeta: {
    fontSize: 12,
    color: colors.mutedText,
    lineHeight: 17,
  },
});
