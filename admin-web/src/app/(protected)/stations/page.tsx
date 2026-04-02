'use client';

import { FormEvent, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { customFieldsClient } from '@/lib/api/custom-fields-client';
import { useAuth } from '@/lib/auth/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { StateCard } from '@/components/ui/state-card';
import { StationsTable } from '@/features/stations/stations-table';

type FilterState = {
  search: string;
  status: string;
  archiveView: 'active' | 'all' | 'archived';
  sortBy: 'updatedAt' | 'name' | 'createdAt' | 'lastTestDate' | 'powerKw';
  sortOrder: 'asc' | 'desc';
  limit: string;
  customFilters: Record<string, string>;
};

function readFilters(searchParams: URLSearchParams): FilterState {
  const customFilters: Record<string, string> = {};

  for (const [key, value] of searchParams.entries()) {
    if (key.startsWith('cf.')) {
      customFilters[key.slice(3)] = value;
    }
  }

  return {
    search: searchParams.get('search') ?? '',
    status: searchParams.get('status') ?? '',
    archiveView: searchParams.get('isArchived') === 'true'
      ? 'archived'
      : searchParams.get('includeArchived') === 'true'
        ? 'all'
        : 'active',
    sortBy: (searchParams.get('sortBy') as FilterState['sortBy']) ?? 'updatedAt',
    sortOrder: (searchParams.get('sortOrder') as FilterState['sortOrder']) ?? 'desc',
    limit: searchParams.get('limit') ?? '20',
    customFilters,
  };
}

export default function StationsPage() {
  const { canWrite } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsKey = searchParams.toString();
  const page = Number(searchParams.get('page') ?? '1');
  const [filters, setFilters] = useState<FilterState>(() => readFilters(new URLSearchParams(searchParamsKey)));
  const customFields = useQuery({ queryKey: ['custom-fields-for-stations'], queryFn: () => customFieldsClient.list(true) });

  useEffect(() => {
    setFilters(readFilters(new URLSearchParams(searchParamsKey)));
  }, [searchParamsKey]);

  if (customFields.error) {
    return (
      <StateCard
        title='Stations unavailable'
        description={(customFields.error as Error).message || 'Station filters could not be initialized.'}
        tone='danger'
      />
    );
  }

  const filterableFields = (customFields.data?.data ?? []).filter((field) => field.isFilterable);
  const visibleFields = [...(customFields.data?.data ?? [])]
    .filter((field) => field.isVisibleInList)
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .slice(0, 3);

  const updateUrl = (nextFilters: FilterState, nextPage = 1) => {
    const params = new URLSearchParams();

    if (nextFilters.search.trim()) {
      params.set('search', nextFilters.search.trim());
    }

    if (nextFilters.status) {
      params.set('status', nextFilters.status);
    }

    if (nextFilters.archiveView === 'all') {
      params.set('includeArchived', 'true');
    }

    if (nextFilters.archiveView === 'archived') {
      params.set('isArchived', 'true');
    }

    if (nextFilters.sortBy !== 'updatedAt') {
      params.set('sortBy', nextFilters.sortBy);
    }

    if (nextFilters.sortOrder !== 'desc') {
      params.set('sortOrder', nextFilters.sortOrder);
    }

    if (nextFilters.limit !== '20') {
      params.set('limit', nextFilters.limit);
    }

    for (const [key, value] of Object.entries(nextFilters.customFilters)) {
      if (value.trim()) {
        params.set(`cf.${key}`, value.trim());
      }
    }

    if (nextPage > 1) {
      params.set('page', String(nextPage));
    }

    router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updateUrl(filters, 1);
  };

  const query: Record<string, string | number | boolean | undefined> = {
    page,
    limit: Number(filters.limit),
    search: filters.search.trim() || undefined,
    status: filters.status || undefined,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
  };

  if (filters.archiveView === 'all') {
    query.includeArchived = true;
  }

  if (filters.archiveView === 'archived') {
    query.isArchived = true;
  }

  for (const [key, value] of Object.entries(filters.customFilters)) {
    query[`cf.${key}`] = value.trim() || undefined;
  }

  return (
    <div className='page-stack'>
      <PageHeader
        title='Stations'
        description='Fast fleet search, sorting, and action handling for daily station management.'
      />

      <form className='card page-stack' onSubmit={handleSubmit}>
        <div className='toolbar'>
          <div className='field'>
            <label htmlFor='station-search'>Search</label>
            <Input
              id='station-search'
              placeholder='Name, code, QR, brand, model, serial, or location'
              value={filters.search}
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
            />
          </div>
          <div className='field'>
            <label htmlFor='status-filter'>Status</label>
            <Select
              id='status-filter'
              value={filters.status}
              onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
            >
              <option value=''>All statuses</option>
              <option value='active'>Active</option>
              <option value='maintenance'>Maintenance</option>
              <option value='inactive'>Inactive</option>
              <option value='faulty'>Faulty</option>
            </Select>
          </div>
          <div className='field'>
            <label htmlFor='archive-filter'>Archive view</label>
            <Select
              id='archive-filter'
              value={filters.archiveView}
              onChange={(event) => setFilters((current) => ({
                ...current,
                archiveView: event.target.value as FilterState['archiveView'],
              }))}
            >
              <option value='active'>Active only</option>
              <option value='all'>Include archived</option>
              <option value='archived'>Archived only</option>
            </Select>
          </div>
          <div className='field'>
            <label htmlFor='sort-by'>Sort by</label>
            <Select
              id='sort-by'
              value={filters.sortBy}
              onChange={(event) => setFilters((current) => ({
                ...current,
                sortBy: event.target.value as FilterState['sortBy'],
              }))}
            >
              <option value='updatedAt'>Last updated</option>
              <option value='name'>Name</option>
              <option value='createdAt'>Created at</option>
              <option value='lastTestDate'>Last test date</option>
              <option value='powerKw'>Power (kW)</option>
            </Select>
          </div>
          <div className='field'>
            <label htmlFor='sort-order'>Sort order</label>
            <Select
              id='sort-order'
              value={filters.sortOrder}
              onChange={(event) => setFilters((current) => ({
                ...current,
                sortOrder: event.target.value as FilterState['sortOrder'],
              }))}
            >
              <option value='desc'>Descending</option>
              <option value='asc'>Ascending</option>
            </Select>
          </div>
          <div className='field'>
            <label htmlFor='page-size'>Page size</label>
            <Select
              id='page-size'
              value={filters.limit}
              onChange={(event) => setFilters((current) => ({ ...current, limit: event.target.value }))}
            >
              <option value='10'>10</option>
              <option value='20'>20</option>
              <option value='50'>50</option>
            </Select>
          </div>
        </div>

        {filterableFields.length > 0 ? (
          <details className='subtle-box'>
            <summary>More filters</summary>
            <div className='filters-grid' style={{ marginTop: 16 }}>
              {filterableFields.map((field) => {
                const currentValue = filters.customFilters[field.key] ?? '';
                const rawOptions = field.options && typeof field.options === 'object' && field.options !== null
                  ? (field.options as { options?: unknown }).options
                  : undefined;
                const options = Array.isArray(rawOptions)
                  ? rawOptions.filter((option): option is string => typeof option === 'string')
                  : [];

                if (field.type === 'select') {
                  return (
                    <div key={field.id} className='field'>
                      <label htmlFor={`filter-${field.key}`}>{field.label}</label>
                      <Select
                        id={`filter-${field.key}`}
                        value={currentValue}
                        onChange={(event) => setFilters((current) => ({
                          ...current,
                          customFilters: {
                            ...current.customFilters,
                            [field.key]: event.target.value,
                          },
                        }))}
                      >
                        <option value=''>Any value</option>
                        {options.map((option) => <option key={option} value={option}>{option}</option>)}
                      </Select>
                    </div>
                  );
                }

                if (field.type === 'boolean') {
                  return (
                    <div key={field.id} className='field'>
                      <label htmlFor={`filter-${field.key}`}>{field.label}</label>
                      <Select
                        id={`filter-${field.key}`}
                        value={currentValue}
                        onChange={(event) => setFilters((current) => ({
                          ...current,
                          customFilters: {
                            ...current.customFilters,
                            [field.key]: event.target.value,
                          },
                        }))}
                      >
                        <option value=''>Any value</option>
                        <option value='true'>Yes</option>
                        <option value='false'>No</option>
                      </Select>
                    </div>
                  );
                }

                return (
                  <div key={field.id} className='field'>
                    <label htmlFor={`filter-${field.key}`}>{field.label}</label>
                    <Input
                      id={`filter-${field.key}`}
                      value={currentValue}
                      placeholder={`Filter by ${field.label.toLowerCase()}`}
                      onChange={(event) => setFilters((current) => ({
                        ...current,
                        customFilters: {
                          ...current.customFilters,
                          [field.key]: event.target.value,
                        },
                      }))}
                    />
                  </div>
                );
              })}
            </div>
          </details>
        ) : null}

        <div className='section-actions'>
          <Button type='submit'>Apply filters</Button>
          <Button
            type='button'
            variant='secondary'
            onClick={() => {
              const resetState: FilterState = {
                search: '',
                status: '',
                archiveView: 'active',
                sortBy: 'updatedAt',
                sortOrder: 'desc',
                limit: '20',
                customFilters: {},
              };
              setFilters(resetState);
              updateUrl(resetState, 1);
            }}
          >
            Reset
          </Button>
          {!canWrite ? <p className='muted'>Viewer mode: write actions are hidden.</p> : null}
        </div>
      </form>

      <StationsTable
        query={query}
        visibleFields={visibleFields}
        onPageChange={(nextPage) => updateUrl(filters, nextPage)}
      />
    </div>
  );
}
