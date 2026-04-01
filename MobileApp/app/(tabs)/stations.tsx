import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  AppCard,
  AppScreen,
  AppTextInput,
  EmptyState,
  LoadingState,
  OptionChip,
  StatusBadge,
  colors,
} from '@/components';
import { getCustomFieldDefinitions } from '@/features/custom-fields';
import { getStationBrands, getStationList, getStationModels } from '@/features/stations';
import type { StationListItem } from '@/features/stations';
import type {
  CustomFieldDefinition,
  StationCurrentType,
  StationListCustomFieldFilter,
  StationListFilters,
  StationListStatusFilter,
  StationSortBy,
} from '@/types';
import { parseSelectOptions } from '@/utils/custom-field';

const statusOptions: Array<{ label: string; value: StationListStatusFilter }> = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Maintenance', value: 'maintenance' },
  { label: 'Inactive', value: 'inactive' },
  { label: 'Faulty', value: 'faulty' },
  { label: 'Archived', value: 'archived' },
];

const currentTypeOptions: Array<{ label: string; value: StationCurrentType | 'all' }> = [
  { label: 'All', value: 'all' },
  { label: 'AC', value: 'AC' },
  { label: 'DC', value: 'DC' },
];

const sortOptions: Array<{ label: string; value: StationSortBy }> = [
  { label: 'Name', value: 'name' },
  { label: 'Updated', value: 'updatedAt' },
  { label: 'Power', value: 'powerKw' },
];

const createDefaultFilters = (): StationListFilters => ({
  searchText: '',
  status: 'all',
  brand: 'all',
  model: 'all',
  currentType: 'all',
  sortBy: 'updatedAt',
  customFieldFilters: [],
});

const prettifyCustomFieldKey = (value: string): string =>
  value
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^\w/, (char) => char.toUpperCase());

const isValidDateOnly = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  return !Number.isNaN(new Date(value).getTime());
};

export default function StationListScreen(): React.JSX.Element {
  const router = useRouter();
  const [filters, setFilters] = useState<StationListFilters>(createDefaultFilters());
  const [brands, setBrands] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [customFilterDefinitions, setCustomFilterDefinitions] = useState<CustomFieldDefinition[]>([]);
  const [stations, setStations] = useState<StationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [metadataLoading, setMetadataLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const loadFilterMetadata = useCallback(async () => {
    setMetadataLoading(true);
    setErrorMessage('');

    try {
      const [brandList, modelList, definitions] = await Promise.all([
        getStationBrands(),
        getStationModels(),
        getCustomFieldDefinitions(true),
      ]);
      const filterableDefinitions = definitions.filter((definition) => definition.isFilterable);
      const definitionTypeById = new Map(
        filterableDefinitions.map((definition) => [definition.id, definition.type]),
      );

      setBrands(brandList);
      setModels(modelList);
      setCustomFilterDefinitions(filterableDefinitions);
      setFilters((prev) => {
        const allowedIds = new Set(filterableDefinitions.map((definition) => definition.id));
        const nextCustomFilters = prev.customFieldFilters
          .filter((item) => allowedIds.has(item.fieldId))
          .map((item) => ({
            ...item,
            type: definitionTypeById.get(item.fieldId) ?? item.type,
          }));

        const isUnchanged =
          nextCustomFilters.length === prev.customFieldFilters.length &&
          nextCustomFilters.every((item, index) => {
            const previous = prev.customFieldFilters[index];
            return (
              previous &&
              previous.fieldId === item.fieldId &&
              previous.type === item.type &&
              previous.value === item.value
            );
          });

        if (isUnchanged) {
          return prev;
        }

        return {
          ...prev,
          customFieldFilters: nextCustomFilters,
        };
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? `Could not load station filters: ${error.message}`
          : 'Could not load station filters.',
      );
    } finally {
      setMetadataLoading(false);
    }
  }, []);

  const loadStations = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');

    try {
      const result = await getStationList(filters);
      setStations(result);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? `Could not load stations: ${error.message}`
          : 'Could not load stations.',
      );
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useFocusEffect(
    useCallback(() => {
      void loadFilterMetadata();
    }, [loadFilterMetadata]),
  );

  useFocusEffect(
    useCallback(() => {
      void loadStations();
    }, [loadStations]),
  );

  const brandOptions = useMemo(() => ['all', ...brands], [brands]);
  const modelOptions = useMemo(() => ['all', ...models], [models]);
  const customFilterMap = useMemo(() => {
    return filters.customFieldFilters.reduce<Record<string, StationListCustomFieldFilter>>(
      (accumulator, item) => {
        accumulator[item.fieldId] = item;
        return accumulator;
      },
      {},
    );
  }, [filters.customFieldFilters]);

  const customFilterErrors = useMemo(() => {
    const errors: Record<string, string> = {};

    for (const definition of customFilterDefinitions) {
      const value = customFilterMap[definition.id]?.value?.trim() ?? '';

      if (!value) {
        continue;
      }

      if (definition.type === 'number' && Number.isNaN(Number(value))) {
        errors[definition.id] = 'Enter a valid number.';
        continue;
      }

      if (definition.type === 'date' && !isValidDateOnly(value)) {
        errors[definition.id] = 'Use YYYY-MM-DD format.';
      }
    }

    return errors;
  }, [customFilterDefinitions, customFilterMap]);

  const hasActiveFilters = useMemo(() => {
    return (
      filters.searchText.trim().length > 0 ||
      filters.status !== 'all' ||
      filters.brand !== 'all' ||
      filters.model !== 'all' ||
      filters.currentType !== 'all' ||
      filters.sortBy !== 'updatedAt' ||
      filters.customFieldFilters.some((item) => item.value.trim().length > 0)
    );
  }, [filters]);

  const setCustomFilterValue = useCallback(
    (definition: CustomFieldDefinition, value: string) => {
      setFilters((prev) => {
        const nextFilters = prev.customFieldFilters.filter((item) => item.fieldId !== definition.id);

        if (!value.trim()) {
          return {
            ...prev,
            customFieldFilters: nextFilters,
          };
        }

        nextFilters.push({
          fieldId: definition.id,
          type: definition.type,
          value,
        });

        return {
          ...prev,
          customFieldFilters: nextFilters,
        };
      });
    },
    [],
  );

  return (
    <AppScreen>
      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      <AppCard>
        <AppTextInput
          label="Search"
          value={filters.searchText}
          onChangeText={(value) => setFilters((prev) => ({ ...prev, searchText: value }))}
          placeholder="Name, code, or serial number"
          autoCapitalize="none"
        />

        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>Status</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {statusOptions.map((option) => (
              <OptionChip
                key={option.value}
                label={option.label}
                selected={filters.status === option.value}
                onPress={() => setFilters((prev) => ({ ...prev, status: option.value }))}
              />
            ))}
          </ScrollView>
        </View>

        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>Brand</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {brandOptions.map((brand) => (
              <OptionChip
                key={brand}
                label={brand === 'all' ? 'All' : brand}
                selected={filters.brand === brand}
                onPress={() => setFilters((prev) => ({ ...prev, brand }))}
              />
            ))}
          </ScrollView>
        </View>

        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>Model</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {modelOptions.map((model) => (
              <OptionChip
                key={model}
                label={model === 'all' ? 'All' : model}
                selected={filters.model === model}
                onPress={() => setFilters((prev) => ({ ...prev, model }))}
              />
            ))}
          </ScrollView>
        </View>

        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>Current Type</Text>
          <View style={styles.inlineRow}>
            {currentTypeOptions.map((option) => (
              <OptionChip
                key={option.value}
                label={option.label}
                selected={filters.currentType === option.value}
                onPress={() => setFilters((prev) => ({ ...prev, currentType: option.value }))}
              />
            ))}
          </View>
        </View>

        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>Sort</Text>
          <View style={styles.inlineRow}>
            {sortOptions.map((option) => (
              <OptionChip
                key={option.value}
                label={option.label}
                selected={filters.sortBy === option.value}
                onPress={() => setFilters((prev) => ({ ...prev, sortBy: option.value }))}
              />
            ))}
          </View>
        </View>

        {customFilterDefinitions.length > 0 ? (
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Custom Field Filters</Text>

            {customFilterDefinitions.map((definition) => {
              const currentValue = customFilterMap[definition.id]?.value ?? '';
              const fieldError = customFilterErrors[definition.id];

              if (definition.type === 'boolean') {
                return (
                  <View key={definition.id} style={styles.customFilterItem}>
                    <Text style={styles.customFilterLabel}>{definition.label}</Text>
                    <View style={styles.inlineRow}>
                      <OptionChip
                        label="All"
                        selected={!currentValue}
                        onPress={() => setCustomFilterValue(definition, '')}
                      />
                      <OptionChip
                        label="Yes"
                        selected={currentValue === 'true'}
                        onPress={() => setCustomFilterValue(definition, 'true')}
                      />
                      <OptionChip
                        label="No"
                        selected={currentValue === 'false'}
                        onPress={() => setCustomFilterValue(definition, 'false')}
                      />
                    </View>
                  </View>
                );
              }

              if (definition.type === 'select') {
                const options = parseSelectOptions(definition.optionsJson);

                return (
                  <View key={definition.id} style={styles.customFilterItem}>
                    <Text style={styles.customFilterLabel}>{definition.label}</Text>
                    {options.length === 0 ? (
                      <Text style={styles.filterHintText}>
                        This field has no select options yet. Configure options in Custom Fields.
                      </Text>
                    ) : (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.chipRow}
                      >
                        <OptionChip
                          label="All"
                          selected={!currentValue}
                          onPress={() => setCustomFilterValue(definition, '')}
                        />
                        {options.map((option) => (
                          <OptionChip
                            key={option}
                            label={option}
                            selected={currentValue === option}
                            onPress={() => setCustomFilterValue(definition, option)}
                          />
                        ))}
                      </ScrollView>
                    )}
                  </View>
                );
              }

              if (definition.type === 'number') {
                return (
                  <View key={definition.id} style={styles.customFilterItem}>
                    <AppTextInput
                      label={`${definition.label} (Number)`}
                      value={currentValue}
                      onChangeText={(value) => setCustomFilterValue(definition, value)}
                      placeholder="Exact numeric value"
                      keyboardType="numeric"
                      autoCapitalize="none"
                      error={fieldError}
                    />
                  </View>
                );
              }

              if (definition.type === 'date') {
                return (
                  <View key={definition.id} style={styles.customFilterItem}>
                    <AppTextInput
                      label={`${definition.label} (Date)`}
                      value={currentValue}
                      onChangeText={(value) => setCustomFilterValue(definition, value)}
                      placeholder="YYYY-MM-DD"
                      autoCapitalize="none"
                      error={fieldError}
                    />
                  </View>
                );
              }

              return (
                <View key={definition.id} style={styles.customFilterItem}>
                  <AppTextInput
                    label={`${definition.label} (Text)`}
                    value={currentValue}
                    onChangeText={(value) => setCustomFilterValue(definition, value)}
                    placeholder="Contains..."
                    autoCapitalize="none"
                  />
                </View>
              );
            })}
          </View>
        ) : metadataLoading ? (
          <Text style={styles.filterHintText}>Loading custom field filters...</Text>
        ) : null}
      </AppCard>

      {loading ? (
        <LoadingState label="Loading stations..." />
      ) : stations.length === 0 ? (
        hasActiveFilters ? (
          <EmptyState
            title="No matching stations"
            description="No station matches the current filters. Clear filters and try again."
            actionLabel="Clear Filters"
            onActionPress={() => setFilters(createDefaultFilters())}
          />
        ) : (
          <EmptyState
            title="No stations yet"
            description="No station records were returned from backend yet."
            actionLabel="Refresh"
            onActionPress={() => {
              void loadStations();
            }}
          />
        )
      ) : (
        stations.map((station) => (
          <Pressable
            key={station.id}
            style={({ pressed }) => [styles.listItem, pressed && styles.pressed]}
            onPress={() => router.push({ pathname: '/stations/[id]', params: { id: station.id } })}
          >
            <View style={styles.listHeader}>
              <View style={styles.listMain}>
                <Text style={styles.stationName}>{station.name}</Text>
                <Text style={styles.stationMeta}>
                  {station.code} • {station.brand} • {station.model}
                </Text>
                <Text style={styles.stationMeta}>
                  Serial: {station.serialNumber} • {station.powerKw} kW • {station.currentType}
                </Text>
                {Object.entries(station.visibleCustomFields).map(([key, value]) => (
                  <Text key={key} style={styles.customFieldPreview}>
                    {prettifyCustomFieldKey(key)}: {value}
                  </Text>
                ))}
              </View>
              <StatusBadge status={station.status} isArchived={station.isArchived} />
            </View>
          </Pressable>
        ))
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  filterGroup: {
    gap: 6,
  },
  filterLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  chipRow: {
    gap: 8,
    paddingRight: 6,
  },
  inlineRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  listItem: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
  },
  pressed: {
    opacity: 0.82,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  listMain: {
    flex: 1,
    gap: 4,
  },
  stationName: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '700',
  },
  stationMeta: {
    color: colors.mutedText,
    fontSize: 12,
  },
  customFieldPreview: {
    color: colors.text,
    fontSize: 12,
  },
  customFilterItem: {
    gap: 8,
  },
  customFilterLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  filterHintText: {
    color: colors.mutedText,
    fontSize: 12,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '600',
  },
});
