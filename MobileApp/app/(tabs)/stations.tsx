import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  AppButton,
  AppCard,
  AppScreen,
  AppTextInput,
  EmptyState,
  LoadingState,
  OptionChip,
  SectionHeader,
  StatusBadge,
  colors,
} from '@/components';
import { getCustomFieldDefinitions } from '@/features/custom-fields';
import { getStationFilterOptions, getStationList } from '@/features/stations';
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

type ActiveFilterTag = {
  id: string;
  label: string;
  type: 'search' | 'status' | 'brand' | 'model' | 'currentType' | 'sort' | 'custom';
  fieldId?: string;
};

const sortLabels: Record<StationSortBy, string> = {
  name: 'Name',
  updatedAt: 'Updated',
  powerKw: 'Power',
};

const currentTypeLabels: Record<StationCurrentType, string> = {
  AC: 'AC',
  DC: 'DC',
};

const statusLabels: Record<Exclude<StationListStatusFilter, 'all'>, string> = {
  active: 'Active',
  maintenance: 'Maintenance',
  inactive: 'Inactive',
  faulty: 'Faulty',
  archived: 'Archived',
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
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const loadFilterMetadata = useCallback(async () => {
    setMetadataLoading(true);
    setErrorMessage('');

    try {
      const [filterOptions, definitions] = await Promise.all([
        getStationFilterOptions({
          searchText: filters.searchText,
          status: filters.status,
          brand: filters.brand,
          currentType: filters.currentType,
        }),
        getCustomFieldDefinitions(true),
      ]);
      const filterableDefinitions = definitions.filter((definition) => definition.isFilterable);
      const definitionTypeById = new Map(
        filterableDefinitions.map((definition) => [definition.id, definition.type]),
      );
      const allowedBrands = new Set(filterOptions.brands);
      const allowedModels = new Set(filterOptions.models);

      setBrands(filterOptions.brands);
      setModels(filterOptions.models);
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

        const nextBrand =
          prev.brand !== 'all' && !allowedBrands.has(prev.brand) ? 'all' : prev.brand;
        const nextModel =
          prev.model !== 'all' && !allowedModels.has(prev.model) ? 'all' : prev.model;

        if (isUnchanged) {
          if (nextBrand === prev.brand && nextModel === prev.model) {
            return prev;
          }
        }

        return {
          ...prev,
          brand: nextBrand,
          model: nextModel,
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
  }, [filters.brand, filters.currentType, filters.searchText, filters.status]);

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

  const activeFilterTags = useMemo<ActiveFilterTag[]>(() => {
    const tags: ActiveFilterTag[] = [];

    if (filters.searchText.trim()) {
      tags.push({
        id: 'search',
        label: `Search: ${filters.searchText.trim()}`,
        type: 'search',
      });
    }

    if (filters.status !== 'all') {
      tags.push({
        id: 'status',
        label: `Status: ${statusLabels[filters.status]}`,
        type: 'status',
      });
    }

    if (filters.currentType !== 'all') {
      tags.push({
        id: 'currentType',
        label: `Current: ${currentTypeLabels[filters.currentType]}`,
        type: 'currentType',
      });
    }

    if (filters.brand !== 'all') {
      tags.push({
        id: 'brand',
        label: `Brand: ${filters.brand}`,
        type: 'brand',
      });
    }

    if (filters.model !== 'all') {
      tags.push({
        id: 'model',
        label: `Model: ${filters.model}`,
        type: 'model',
      });
    }

    if (filters.sortBy !== 'updatedAt') {
      tags.push({
        id: 'sort',
        label: `Sort: ${sortLabels[filters.sortBy]}`,
        type: 'sort',
      });
    }

    for (const filter of filters.customFieldFilters) {
      const definition = customFilterDefinitions.find((item) => item.id === filter.fieldId);

      if (!definition || !filter.value.trim()) {
        continue;
      }

      tags.push({
        id: `custom:${filter.fieldId}`,
        label: `${definition.label}: ${filter.value.trim()}`,
        type: 'custom',
        fieldId: filter.fieldId,
      });
    }

    return tags;
  }, [customFilterDefinitions, filters]);

  const advancedFilterCount = useMemo(() => {
    let total = 0;

    if (filters.brand !== 'all') {
      total += 1;
    }

    if (filters.model !== 'all') {
      total += 1;
    }

    total += filters.customFieldFilters.filter((item) => item.value.trim().length > 0).length;

    return total;
  }, [filters.brand, filters.customFieldFilters, filters.model]);

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

  const clearAllFilters = useCallback(() => {
    setFilters(createDefaultFilters());
  }, []);

  const clearActiveFilter = useCallback((tag: ActiveFilterTag) => {
    switch (tag.type) {
      case 'search':
        setFilters((prev) => ({ ...prev, searchText: '' }));
        return;
      case 'status':
        setFilters((prev) => ({ ...prev, status: 'all' }));
        return;
      case 'brand':
        setFilters((prev) => ({ ...prev, brand: 'all' }));
        return;
      case 'model':
        setFilters((prev) => ({ ...prev, model: 'all' }));
        return;
      case 'currentType':
        setFilters((prev) => ({ ...prev, currentType: 'all' }));
        return;
      case 'sort':
        setFilters((prev) => ({ ...prev, sortBy: 'updatedAt' }));
        return;
      case 'custom':
        if (!tag.fieldId) {
          return;
        }

        setFilters((prev) => ({
          ...prev,
          customFieldFilters: prev.customFieldFilters.filter((item) => item.fieldId !== tag.fieldId),
        }));
    }
  }, []);

  return (
    <AppScreen>
      <SectionHeader
        title="Stations"
        subtitle="Search backend records quickly, then open advanced filters only when needed."
      />

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      <AppCard style={styles.filterCard}>
        <View style={styles.filterHeaderRow}>
          <View style={styles.filterHeaderText}>
            <Text style={styles.filterTitle}>Find Stations</Text>
            <Text style={styles.filterSubtitle}>
              Search by name, code, serial number, or narrow the list with guided filters.
            </Text>
          </View>
          <AppButton
            label={showAdvancedFilters ? 'Hide More' : 'More Filters'}
            variant="secondary"
            onPress={() => setShowAdvancedFilters((prev) => !prev)}
            style={styles.filterHeaderButton}
          />
        </View>

        <AppTextInput
          label="Search"
          value={filters.searchText}
          onChangeText={(value) => setFilters((prev) => ({ ...prev, searchText: value }))}
          placeholder="Name, code, or serial number"
          autoCapitalize="none"
        />

        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>Quick Status</Text>
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

        <View style={styles.filterFooterRow}>
          <View style={styles.resultsBox}>
            <Text style={styles.resultsValue}>{loading ? '...' : stations.length}</Text>
            <Text style={styles.resultsLabel}>
              {loading ? 'Refreshing results' : stations.length === 1 ? 'Station shown' : 'Stations shown'}
            </Text>
          </View>
          {hasActiveFilters ? (
            <AppButton
              label="Clear All"
              variant="secondary"
              onPress={clearAllFilters}
              style={styles.clearButton}
            />
          ) : null}
        </View>

        {activeFilterTags.length > 0 ? (
          <View style={styles.activeFilterSection}>
            <View style={styles.activeFilterHeader}>
              <Text style={styles.activeFilterTitle}>Active Filters</Text>
              <Text style={styles.activeFilterCount}>{activeFilterTags.length} applied</Text>
            </View>
            <View style={styles.activeFilterWrap}>
              {activeFilterTags.map((tag) => (
                <Pressable
                  key={tag.id}
                  onPress={() => clearActiveFilter(tag)}
                  style={({ pressed }) => [styles.activeFilterPill, pressed && styles.pressed]}
                >
                  <Text style={styles.activeFilterPillText}>{tag.label}</Text>
                  <Text style={styles.activeFilterPillAction}>Clear</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {showAdvancedFilters ? (
          <View style={styles.advancedFiltersPanel}>
            <View style={styles.advancedFiltersHeader}>
              <View style={styles.advancedFiltersHeaderText}>
                <Text style={styles.advancedFiltersTitle}>More Filters</Text>
                <Text style={styles.advancedFiltersSubtitle}>
                  Refine by brand, model, sorting, and custom field values.
                </Text>
              </View>
              {advancedFilterCount > 0 ? (
                <View style={styles.advancedBadge}>
                  <Text style={styles.advancedBadgeText}>{advancedFilterCount}</Text>
                </View>
              ) : null}
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
          </View>
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
  filterCard: {
    gap: 14,
  },
  filterHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
  },
  filterHeaderText: {
    flex: 1,
    gap: 4,
  },
  filterTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  filterSubtitle: {
    color: colors.mutedText,
    fontSize: 12,
    lineHeight: 18,
  },
  filterHeaderButton: {
    minWidth: 118,
  },
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
  filterFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  resultsBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#F8FBFF',
    gap: 2,
  },
  resultsValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  resultsLabel: {
    color: colors.mutedText,
    fontSize: 12,
  },
  clearButton: {
    minWidth: 110,
  },
  activeFilterSection: {
    gap: 8,
  },
  activeFilterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  activeFilterTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  activeFilterCount: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: '600',
  },
  activeFilterWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  activeFilterPill: {
    borderWidth: 1,
    borderColor: '#CFE0FF',
    backgroundColor: '#F3F8FF',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 2,
  },
  activeFilterPillText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  activeFilterPillAction: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  advancedFiltersPanel: {
    gap: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 14,
  },
  advancedFiltersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  advancedFiltersHeaderText: {
    flex: 1,
    gap: 4,
  },
  advancedFiltersTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  advancedFiltersSubtitle: {
    color: colors.mutedText,
    fontSize: 12,
    lineHeight: 18,
  },
  advancedBadge: {
    minWidth: 28,
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 8,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  advancedBadgeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
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
