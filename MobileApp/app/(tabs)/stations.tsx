import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AppButton,
  AppCard,
  AppTextInput,
  EmptyState,
  ErrorState,
  LoadingState,
  OptionChip,
  SectionHeader,
  StatusBadge,
  colors,
} from '@/components';
import { useAuth } from '@/features/auth';
import { getCustomFieldDefinitions } from '@/features/custom-fields';
import { getStationFilterOptions, getStationList } from '@/features/stations';
import type { StationListItem, StationListPage } from '@/features/stations';
import type {
  CustomFieldDefinition,
  StationCurrentType,
  StationListCustomFieldFilter,
  StationListFilters,
  StationListStatusFilter,
  StationSortBy,
  TestResult,
} from '@/types';
import { formatDateShort, formatDateTime } from '@/utils/date';
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
  { label: 'Updated', value: 'updatedAt' },
  { label: 'Name', value: 'name' },
  { label: 'Power', value: 'powerKw' },
];

const createDefaultFilters = (searchText = ''): StationListFilters => ({
  searchText,
  status: 'all',
  brand: 'all',
  model: 'all',
  currentType: 'all',
  sortBy: 'updatedAt',
  customFieldFilters: [],
});

const isValidDateOnly = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  return !Number.isNaN(new Date(value).getTime());
};

const statusLabels: Record<Exclude<StationListStatusFilter, 'all'>, string> = {
  active: 'Active',
  maintenance: 'Maintenance',
  inactive: 'Inactive',
  faulty: 'Faulty',
  archived: 'Archived',
};

const currentTypeLabels: Record<StationCurrentType, string> = {
  AC: 'AC',
  DC: 'DC',
};

const sortLabels: Record<StationSortBy, string> = {
  updatedAt: 'Updated',
  name: 'Name',
  powerKw: 'Power',
};

const testResultLabels: Record<TestResult, string> = {
  pass: 'Latest Test: Pass',
  warning: 'Latest Test: Warning',
  fail: 'Latest Test: Fail',
};

type ActiveFilterTag = {
  id: string;
  label: string;
  type: 'search' | 'status' | 'brand' | 'model' | 'currentType' | 'sort' | 'custom';
  fieldId?: string;
};

const formatAppliedFilterTags = (
  filters: StationListFilters,
  customDefinitions: CustomFieldDefinition[],
): ActiveFilterTag[] => {
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
    const definition = customDefinitions.find((item) => item.id === filter.fieldId);

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
};

const SummaryPill = ({
  label,
  backgroundColor,
  color,
}: {
  label: string;
  backgroundColor: string;
  color: string;
}): React.JSX.Element => {
  return (
    <View style={[styles.summaryPill, { backgroundColor }]}>
      <Text style={[styles.summaryPillText, { color }]}>{label}</Text>
    </View>
  );
};

export default function StationListScreen(): React.JSX.Element {
  const router = useRouter();
  const params = useLocalSearchParams<{ search?: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const canWriteStations = user?.role === 'admin' || user?.role === 'operator';

  const initialSearch = typeof params.search === 'string' ? params.search.trim() : '';

  const [searchText, setSearchText] = useState(initialSearch);
  const [appliedFilters, setAppliedFilters] = useState<StationListFilters>(() =>
    createDefaultFilters(initialSearch),
  );
  const [draftFilters, setDraftFilters] = useState<StationListFilters>(() =>
    createDefaultFilters(initialSearch),
  );
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const [stationPage, setStationPage] = useState<StationListPage | null>(null);
  const [stations, setStations] = useState<StationListItem[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [brands, setBrands] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [customFilterDefinitions, setCustomFilterDefinitions] = useState<CustomFieldDefinition[]>([]);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [metadataError, setMetadataError] = useState('');

  const stationRequestIdRef = useRef(0);
  const metadataRequestIdRef = useRef(0);
  const lastHandledSearchParamRef = useRef(initialSearch);

  useEffect(() => {
    const nextSearch = typeof params.search === 'string' ? params.search.trim() : '';

    if (!nextSearch || nextSearch === lastHandledSearchParamRef.current) {
      return;
    }

    lastHandledSearchParamRef.current = nextSearch;
    setSearchText(nextSearch);
    setAppliedFilters((prev) => ({ ...prev, searchText: nextSearch }));
    setDraftFilters((prev) => ({ ...prev, searchText: nextSearch }));
  }, [params.search]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setAppliedFilters((prev) =>
        prev.searchText === searchText ? prev : { ...prev, searchText },
      );
      setDraftFilters((prev) =>
        prev.searchText === searchText ? prev : { ...prev, searchText },
      );
    }, 350);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [searchText]);

  const customFilterMap = useMemo(() => {
    return draftFilters.customFieldFilters.reduce<Record<string, StationListCustomFieldFilter>>(
      (accumulator, item) => {
        accumulator[item.fieldId] = item;
        return accumulator;
      },
      {},
    );
  }, [draftFilters.customFieldFilters]);

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

  const activeFilterTags = useMemo(
    () => formatAppliedFilterTags(appliedFilters, customFilterDefinitions),
    [appliedFilters, customFilterDefinitions],
  );

  const hasActiveFilters = activeFilterTags.length > 0;
  const hasAdvancedDraftChanges =
    draftFilters.brand !== appliedFilters.brand ||
    draftFilters.model !== appliedFilters.model ||
    draftFilters.sortBy !== appliedFilters.sortBy ||
    JSON.stringify(draftFilters.customFieldFilters) !==
      JSON.stringify(appliedFilters.customFieldFilters);

  const loadStations = useCallback(
    async (mode: 'initial' | 'refresh' | 'background' = 'initial') => {
      const requestId = stationRequestIdRef.current + 1;
      stationRequestIdRef.current = requestId;

      if (mode === 'initial') {
        setInitialLoading(true);
      }

      if (mode === 'refresh') {
        setRefreshing(true);
      }

      if (mode !== 'background') {
        setErrorMessage('');
      }

      try {
        const result = await getStationList(appliedFilters, 1);

        if (requestId !== stationRequestIdRef.current) {
          return;
        }

        setStationPage(result);
        setStations(result.items);
      } catch (error) {
        if (requestId !== stationRequestIdRef.current) {
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? `Could not load stations: ${error.message}`
            : 'Could not load stations.',
        );

        if (mode === 'initial') {
          setStations([]);
          setStationPage(null);
        }
      } finally {
        if (requestId !== stationRequestIdRef.current) {
          return;
        }

        if (mode === 'initial') {
          setInitialLoading(false);
        }

        if (mode === 'refresh') {
          setRefreshing(false);
        }
      }
    },
    [appliedFilters],
  );

  const loadMoreStations = useCallback(async () => {
    if (
      loadingMore ||
      initialLoading ||
      refreshing ||
      !stationPage?.hasMore ||
      !stationPage.meta
    ) {
      return;
    }

    const nextPage = stationPage.meta.page + 1;
    const requestId = stationRequestIdRef.current + 1;
    stationRequestIdRef.current = requestId;
    setLoadingMore(true);

    try {
      const result = await getStationList(appliedFilters, nextPage);

      if (requestId !== stationRequestIdRef.current) {
        return;
      }

      setStationPage(result);
      setStations((prev) => {
        const seenIds = new Set(prev.map((item) => item.id));
        return [...prev, ...result.items.filter((item) => !seenIds.has(item.id))];
      });
    } catch (error) {
      if (requestId !== stationRequestIdRef.current) {
        return;
      }

      setErrorMessage(
        error instanceof Error
          ? `Could not load more stations: ${error.message}`
          : 'Could not load more stations.',
      );
    } finally {
      if (requestId === stationRequestIdRef.current) {
        setLoadingMore(false);
      }
    }
  }, [appliedFilters, initialLoading, loadingMore, refreshing, stationPage]);

  const loadFilterMetadata = useCallback(async () => {
    const requestId = metadataRequestIdRef.current + 1;
    metadataRequestIdRef.current = requestId;
    setMetadataLoading(true);
    setMetadataError('');

    try {
      const [filterOptions, definitions] = await Promise.all([
        getStationFilterOptions({
          searchText: draftFilters.searchText,
          status: draftFilters.status,
          brand: draftFilters.brand,
          currentType: draftFilters.currentType,
        }),
        getCustomFieldDefinitions(true),
      ]);

      if (requestId !== metadataRequestIdRef.current) {
        return;
      }

      const filterableDefinitions = definitions.filter((definition) => definition.isFilterable);
      const definitionTypeById = new Map(
        filterableDefinitions.map((definition) => [definition.id, definition.type]),
      );
      const allowedFieldIds = new Set(filterableDefinitions.map((definition) => definition.id));
      const allowedBrands = new Set(filterOptions.brands);
      const allowedModels = new Set(filterOptions.models);

      setBrands(filterOptions.brands);
      setModels(filterOptions.models);
      setCustomFilterDefinitions(filterableDefinitions);
      setDraftFilters((prev) => ({
        ...prev,
        brand: prev.brand !== 'all' && !allowedBrands.has(prev.brand) ? 'all' : prev.brand,
        model: prev.model !== 'all' && !allowedModels.has(prev.model) ? 'all' : prev.model,
        customFieldFilters: prev.customFieldFilters
          .filter((item) => allowedFieldIds.has(item.fieldId))
          .map((item) => ({
            ...item,
            type: definitionTypeById.get(item.fieldId) ?? item.type,
          })),
      }));
    } catch (error) {
      if (requestId !== metadataRequestIdRef.current) {
        return;
      }

      setMetadataError(
        error instanceof Error
          ? `Could not load advanced filters: ${error.message}`
          : 'Could not load advanced filters.',
      );
    } finally {
      if (requestId === metadataRequestIdRef.current) {
        setMetadataLoading(false);
      }
    }
  }, [draftFilters.brand, draftFilters.currentType, draftFilters.searchText, draftFilters.status]);

  useEffect(() => {
    void loadStations('initial');
  }, [loadStations]);

  useFocusEffect(
    useCallback(() => {
      if (stationRequestIdRef.current === 0) {
        return;
      }

      void loadStations(stations.length > 0 ? 'background' : 'initial');
    }, [loadStations, stations.length]),
  );

  useEffect(() => {
    if (!showAdvancedFilters) {
      return;
    }

    void loadFilterMetadata();
  }, [
    draftFilters.brand,
    draftFilters.currentType,
    draftFilters.searchText,
    draftFilters.status,
    loadFilterMetadata,
    showAdvancedFilters,
  ]);

  const clearAllFilters = useCallback(() => {
    const clearedFilters = createDefaultFilters();
    setSearchText('');
    setAppliedFilters(clearedFilters);
    setDraftFilters(clearedFilters);
  }, []);

  const clearActiveFilter = useCallback((tag: ActiveFilterTag) => {
    switch (tag.type) {
      case 'search':
        setSearchText('');
        setAppliedFilters((prev) => ({ ...prev, searchText: '' }));
        setDraftFilters((prev) => ({ ...prev, searchText: '' }));
        return;
      case 'status':
        setAppliedFilters((prev) => ({ ...prev, status: 'all' }));
        setDraftFilters((prev) => ({ ...prev, status: 'all' }));
        return;
      case 'brand':
        setAppliedFilters((prev) => ({ ...prev, brand: 'all', model: 'all' }));
        setDraftFilters((prev) => ({ ...prev, brand: 'all', model: 'all' }));
        return;
      case 'model':
        setAppliedFilters((prev) => ({ ...prev, model: 'all' }));
        setDraftFilters((prev) => ({ ...prev, model: 'all' }));
        return;
      case 'currentType':
        setAppliedFilters((prev) => ({ ...prev, currentType: 'all' }));
        setDraftFilters((prev) => ({ ...prev, currentType: 'all' }));
        return;
      case 'sort':
        setAppliedFilters((prev) => ({ ...prev, sortBy: 'updatedAt' }));
        setDraftFilters((prev) => ({ ...prev, sortBy: 'updatedAt' }));
        return;
      case 'custom':
        if (!tag.fieldId) {
          return;
        }

        setAppliedFilters((prev) => ({
          ...prev,
          customFieldFilters: prev.customFieldFilters.filter((item) => item.fieldId !== tag.fieldId),
        }));
        setDraftFilters((prev) => ({
          ...prev,
          customFieldFilters: prev.customFieldFilters.filter((item) => item.fieldId !== tag.fieldId),
        }));
    }
  }, []);

  const setCustomFilterValue = useCallback(
    (definition: CustomFieldDefinition, value: string) => {
      setDraftFilters((prev) => {
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

  const applyAdvancedFilters = (): void => {
    if (Object.keys(customFilterErrors).length > 0) {
      return;
    }

    setAppliedFilters(draftFilters);
    setShowAdvancedFilters(false);
  };

  const resetAdvancedFilters = (): void => {
    setDraftFilters((prev) => ({
      ...prev,
      brand: 'all',
      model: 'all',
      sortBy: 'updatedAt',
      customFieldFilters: [],
    }));
  };

  const renderStationCard = ({ item }: { item: StationListItem }): React.JSX.Element => (
    <Pressable
      key={item.id}
      style={({ pressed }) => [styles.listItem, pressed && styles.pressed]}
      onPress={() => router.push({ pathname: '/stations/[id]', params: { id: item.id } })}
    >
      <View style={styles.listHeader}>
        <View style={styles.listMain}>
          <Text style={styles.stationName}>{item.name}</Text>
          <Text style={styles.stationMeta}>
            {item.code} • {item.location}
          </Text>
          <Text style={styles.stationMeta}>
            {item.brand} {item.model} • {item.powerKw} kW • {item.currentType}
          </Text>
          <Text style={styles.stationMeta}>Last update: {formatDateTime(item.updatedAt)}</Text>
        </View>
        <StatusBadge status={item.status} isArchived={item.isArchived} />
      </View>

      <View style={styles.summaryRow}>
        <SummaryPill
          label={
            item.summary.openIssueCount > 0
              ? `${item.summary.openIssueCount} open issue${item.summary.openIssueCount === 1 ? '' : 's'}`
              : 'No open issues'
          }
          backgroundColor={item.summary.openIssueCount > 0 ? '#FFF1EA' : '#EEF7EE'}
          color={item.summary.openIssueCount > 0 ? '#C75100' : '#0F9D58'}
        />
        <SummaryPill
          label={`${item.summary.testHistoryCount} test${item.summary.testHistoryCount === 1 ? '' : 's'}`}
          backgroundColor="#EEF4FF"
          color={colors.primary}
        />
        {item.summary.latestTestResult ? (
          <SummaryPill
            label={testResultLabels[item.summary.latestTestResult]}
            backgroundColor={
              item.summary.latestTestResult === 'pass'
                ? '#EEF7EE'
                : item.summary.latestTestResult === 'warning'
                  ? '#FFF7E6'
                  : '#FDECEC'
            }
            color={
              item.summary.latestTestResult === 'pass'
                ? '#0F9D58'
                : item.summary.latestTestResult === 'warning'
                  ? '#C17900'
                  : colors.danger
            }
          />
        ) : null}
        {item.lastTestDate ? (
          <SummaryPill
            label={`Last test ${formatDateShort(item.lastTestDate)}`}
            backgroundColor="#F4F6FA"
            color={colors.mutedText}
          />
        ) : null}
      </View>
    </Pressable>
  );

  const header = (
    <View style={styles.headerContent}>
      <SectionHeader
        title="Stations"
        subtitle="Search fast in the field, then use advanced filters only when you need to narrow the result set."
      />

      <AppCard style={styles.filterCard}>
        <View style={styles.filterHeaderRow}>
          <View style={styles.filterHeaderText}>
            <Text style={styles.filterTitle}>Find Stations</Text>
            <Text style={styles.filterSubtitle}>
              Search by station name, code, or serial-related text. Quick filters update the list
              automatically.
            </Text>
          </View>
          <AppButton
            label={showAdvancedFilters ? 'Hide Filters' : 'More Filters'}
            variant="secondary"
            onPress={() => setShowAdvancedFilters((prev) => !prev)}
            style={styles.filterToggleButton}
          />
        </View>

        <AppTextInput
          label="Search"
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Name, code, QR, or serial"
          autoCapitalize="none"
        />

        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>Quick Status</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {statusOptions.map((option) => (
              <OptionChip
                key={option.value}
                label={option.label}
                selected={appliedFilters.status === option.value}
                onPress={() => {
                  setAppliedFilters((prev) => ({ ...prev, status: option.value }));
                  setDraftFilters((prev) => ({ ...prev, status: option.value }));
                }}
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
                selected={appliedFilters.currentType === option.value}
                onPress={() => {
                  setAppliedFilters((prev) => ({ ...prev, currentType: option.value }));
                  setDraftFilters((prev) => ({ ...prev, currentType: option.value }));
                }}
              />
            ))}
          </View>
        </View>

        <View style={styles.filterFooterRow}>
          <View style={styles.resultsBox}>
            <Text style={styles.resultsValue}>
              {initialLoading ? '...' : stationPage?.meta.total ?? stations.length}
            </Text>
            <Text style={styles.resultsLabel}>
              {initialLoading
                ? 'Refreshing results'
                : `${stations.length} currently loaded${
                    stationPage?.meta.total ? ` of ${stationPage.meta.total}` : ''
                  }`}
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

        {errorMessage && stations.length > 0 ? (
          <ErrorState
            title="Station list needs attention"
            description={errorMessage}
            actionLabel="Retry"
            onActionPress={() => {
              void loadStations('refresh');
            }}
            compact
          />
        ) : null}

        {activeFilterTags.length > 0 ? (
          <View style={styles.activeFilterSection}>
            <View style={styles.activeFilterHeader}>
              <Text style={styles.activeFilterTitle}>Applied Filters</Text>
              <Text style={styles.activeFilterCount}>{activeFilterTags.length} active</Text>
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
            <View style={styles.advancedHeader}>
              <View style={styles.advancedHeaderText}>
                <Text style={styles.advancedTitle}>Advanced Filters</Text>
                <Text style={styles.advancedSubtitle}>
                  Change draft filters here, then apply them when ready.
                </Text>
              </View>
              {hasAdvancedDraftChanges ? (
                <View style={styles.draftBadge}>
                  <Text style={styles.draftBadgeText}>Draft</Text>
                </View>
              ) : null}
            </View>

            {metadataLoading ? <LoadingState label="Loading advanced filters..." compact /> : null}
            {metadataError ? (
              <ErrorState
                title="Advanced filters unavailable"
                description={metadataError}
                actionLabel="Retry"
                onActionPress={() => {
                  void loadFilterMetadata();
                }}
                compact
              />
            ) : null}

            {!metadataLoading ? (
              <>
                <View style={styles.filterGroup}>
                  <Text style={styles.filterLabel}>Brand</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipRow}
                  >
                    {['all', ...brands].map((brand) => (
                      <OptionChip
                        key={brand}
                        label={brand === 'all' ? 'All' : brand}
                        selected={draftFilters.brand === brand}
                        onPress={() =>
                          setDraftFilters((prev) => ({
                            ...prev,
                            brand,
                            model: brand === prev.brand ? prev.model : 'all',
                          }))
                        }
                      />
                    ))}
                  </ScrollView>
                </View>

                <View style={styles.filterGroup}>
                  <Text style={styles.filterLabel}>Model</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipRow}
                  >
                    {['all', ...models].map((model) => (
                      <OptionChip
                        key={model}
                        label={model === 'all' ? 'All' : model}
                        selected={draftFilters.model === model}
                        onPress={() => setDraftFilters((prev) => ({ ...prev, model }))}
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
                        selected={draftFilters.sortBy === option.value}
                        onPress={() =>
                          setDraftFilters((prev) => ({ ...prev, sortBy: option.value }))
                        }
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
                                This field has no configured options yet.
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
                ) : null}

                <View style={styles.advancedActionRow}>
                  <AppButton
                    label="Apply Filters"
                    onPress={applyAdvancedFilters}
                    disabled={Object.keys(customFilterErrors).length > 0}
                    style={styles.advancedActionButton}
                  />
                  <AppButton
                    label="Reset Advanced"
                    onPress={resetAdvancedFilters}
                    variant="secondary"
                    style={styles.advancedActionButton}
                  />
                </View>
              </>
            ) : null}
          </View>
        ) : null}
      </AppCard>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <FlatList
        data={stations}
        keyExtractor={(item) => item.id}
        renderItem={renderStationCard}
        ListHeaderComponent={header}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerLoader}>
              <LoadingState label="Loading more stations..." compact />
            </View>
          ) : null
        }
        ListEmptyComponent={
          initialLoading ? (
            <LoadingState label="Loading stations..." />
          ) : errorMessage ? (
            <ErrorState
              title="Station list unavailable"
              description={errorMessage}
              actionLabel="Retry"
              onActionPress={() => {
                void loadStations('refresh');
              }}
            />
          ) : hasActiveFilters ? (
            <EmptyState
              title="No matching stations"
              description="No station matches the current filters. Clear filters or broaden the search."
              actionLabel="Clear Filters"
              onActionPress={clearAllFilters}
            />
          ) : (
            <EmptyState
              title="No stations yet"
              description="No station records were returned from backend yet."
              actionLabel="Refresh"
              onActionPress={() => {
                void loadStations('refresh');
              }}
            />
          )
        }
        onRefresh={() => {
          void loadStations('refresh');
        }}
        refreshing={refreshing}
        onEndReached={() => {
          void loadMoreStations();
        }}
        onEndReachedThreshold={0.4}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: 24 + Math.max(insets.bottom, 16) + (canWriteStations ? 88 : 0) },
          stations.length === 0 ? styles.emptyListContent : null,
        ]}
      />

      {canWriteStations ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Create new station"
          onPress={() => router.push('/stations/edit')}
          style={({ pressed }) => [
            styles.fab,
            {
              bottom: Math.max(insets.bottom, 0) +2,
            },
            pressed && styles.fabPressed,
          ]}
        >
          <Ionicons name="add" size={20} color="#FFFFFF" />
          <Text style={styles.fabLabel}>New Station</Text>
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 6,
    gap: 12,
    backgroundColor: colors.background,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  headerContent: {
    gap: 12,
    paddingBottom: 8,
  },
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
  filterToggleButton: {
    minWidth: 122,
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
  },
  activeFilterWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  activeFilterPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
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
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    gap: 12,
    backgroundColor: '#FCFDFF',
  },
  advancedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    alignItems: 'flex-start',
  },
  advancedHeaderText: {
    flex: 1,
    gap: 2,
  },
  advancedTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  advancedSubtitle: {
    fontSize: 12,
    color: colors.mutedText,
    lineHeight: 18,
  },
  draftBadge: {
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  draftBadgeText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  customFilterItem: {
    gap: 6,
  },
  customFilterLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  filterHintText: {
    color: colors.mutedText,
    fontSize: 12,
    lineHeight: 18,
  },
  advancedActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  advancedActionButton: {
    flex: 1,
  },
  listItem: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    gap: 10,
    backgroundColor: colors.surface,
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
    fontSize: 12,
    color: colors.mutedText,
    lineHeight: 18,
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  summaryPill: {
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 9,
  },
  summaryPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  footerLoader: {
    paddingBottom: 8,
  },
  fab: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 18,
    shadowColor: '#0B224C',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 6,
  },
  fabPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  fabLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.82,
  },
});
