'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { stationsClient } from '@/lib/api/stations-client';
import { testHistoryClient } from '@/lib/api/test-history-client';
import { useAuth } from '@/lib/auth/auth-context';
import { formatCustomValue, formatDateTime, formatEnumLabel, parseDateInputValue, stringifyJson, toDateInputValue } from '@/lib/format';
import { TestResult } from '@/types/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { StateCard } from '@/components/ui/state-card';
import { Textarea } from '@/components/ui/textarea';
import { StationPicker } from '@/features/stations/station-picker';

type Filters = {
  stationId: string;
  result: string;
};

function getTone(value: string) {
  if (value === 'pass') {
    return 'success';
  }

  if (value === 'warning') {
    return 'warning';
  }

  if (value === 'fail') {
    return 'danger';
  }

  return 'neutral';
}

function readFilters(searchParams: URLSearchParams): Filters {
  return {
    stationId: searchParams.get('stationId') ?? '',
    result: searchParams.get('result') ?? '',
  };
}

export default function TestHistoryOverviewPage() {
  const { canWrite } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsKey = searchParams.toString();
  const [filters, setFilters] = useState<Filters>(() => readFilters(new URLSearchParams(searchParamsKey)));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState('');
  const station = useQuery({
    queryKey: ['test-history-station', filters.stationId],
    queryFn: () => stationsClient.get(filters.stationId),
    enabled: Boolean(filters.stationId),
  });
  const tests = useQuery({
    queryKey: ['test-history-page', filters.stationId],
    queryFn: () => testHistoryClient.listByStation(filters.stationId),
    enabled: Boolean(filters.stationId),
  });
  const form = useForm<{ testDate: string; result: TestResult; notes: string; metrics: string }>({
    defaultValues: {
      testDate: '',
      result: 'pass',
      notes: '',
      metrics: '',
    },
  });

  useEffect(() => {
    setFilters(readFilters(new URLSearchParams(searchParamsKey)));
  }, [searchParamsKey]);

  const updateUrl = (next: Filters) => {
    const params = new URLSearchParams();
    if (next.stationId) params.set('stationId', next.stationId);
    if (next.result) params.set('result', next.result);
    router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname);
  };

  const filteredTests = (tests.data?.data ?? []).filter((test) => !filters.result || test.result === filters.result);
  const selectedTest = filteredTests.find((test) => test.id === editingId) ?? (tests.data?.data ?? []).find((test) => test.id === editingId);

  useEffect(() => {
    if (!selectedTest) {
      form.reset({
        testDate: '',
        result: 'pass',
        notes: '',
        metrics: '',
      });
      return;
    }

    form.reset({
      testDate: toDateInputValue(selectedTest.testDate),
      result: selectedTest.result,
      notes: selectedTest.notes ?? '',
      metrics: stringifyJson(selectedTest.metrics),
    });
  }, [form, selectedTest]);

  const createTest = useMutation({
    mutationFn: (payload: { testDate?: string; result: TestResult; notes?: string; metrics?: Record<string, unknown> }) =>
      testHistoryClient.create(filters.stationId, payload),
    onSuccess: async () => {
      form.reset({ testDate: '', result: 'pass', notes: '', metrics: '' });
      await queryClient.invalidateQueries({ queryKey: ['test-history-page', filters.stationId] });
      await queryClient.invalidateQueries({ queryKey: ['station', filters.stationId] });
    },
  });
  const updateTest = useMutation({
    mutationFn: (payload: { id: string; testDate?: string; result: TestResult; notes?: string | null; metrics?: Record<string, unknown> }) =>
      testHistoryClient.update(payload.id, payload),
    onSuccess: async () => {
      setEditingId(null);
      await queryClient.invalidateQueries({ queryKey: ['test-history-page', filters.stationId] });
      await queryClient.invalidateQueries({ queryKey: ['station', filters.stationId] });
    },
  });
  const deleteTest = useMutation({
    mutationFn: (id: string) => testHistoryClient.remove(id),
    onSuccess: async () => {
      setEditingId(null);
      await queryClient.invalidateQueries({ queryKey: ['test-history-page', filters.stationId] });
      await queryClient.invalidateQueries({ queryKey: ['station', filters.stationId] });
    },
  });

  const mutationError = (createTest.error as Error | null)?.message || (updateTest.error as Error | null)?.message || '';

  return (
    <div className='page-stack'>
      <PageHeader
        title='Test history'
        description='Review and log station tests without losing the station context or recent results.'
      />

      <div className='card page-stack'>
        <div className='toolbar'>
          <StationPicker
            value={filters.stationId}
            onChange={(stationId) => {
              const next = { ...filters, stationId };
              setEditingId(null);
              setFilters(next);
              updateUrl(next);
            }}
          />
          <div className='field'>
            <label htmlFor='test-result-filter'>Result</label>
            <Select
              id='test-result-filter'
              value={filters.result}
              onChange={(event) => {
                const next = { ...filters, result: event.target.value };
                setFilters(next);
                updateUrl(next);
              }}
            >
              <option value=''>All results</option>
              <option value='pass'>Pass</option>
              <option value='warning'>Warning</option>
              <option value='fail'>Fail</option>
            </Select>
          </div>
          <div className='field'>
            <label>&nbsp;</label>
            <Button
              type='button'
              variant='secondary'
              onClick={() => {
                const next = { stationId: '', result: '' };
                setEditingId(null);
                setFilters(next);
                updateUrl(next);
              }}
            >
              Reset filters
            </Button>
          </div>
        </div>

        {station.data?.data ? (
          <div className='summary-grid'>
            <div className='card metric-card'>
              <p className='eyebrow'>Selected station</p>
              <strong>{station.data.data.name}</strong>
              <p className='muted'>{station.data.data.code} · {station.data.data.location}</p>
            </div>
            <div className='card metric-card'>
              <p className='eyebrow'>Visible test records</p>
              <p className='kpi-value'>{filteredTests.length}</p>
              <p className='muted'>Records that match the current filter.</p>
            </div>
            <div className='card metric-card'>
              <p className='eyebrow'>Failures</p>
              <p className='kpi-value'>{filteredTests.filter((test) => test.result === 'fail').length}</p>
              <p className='muted'>Failed test outcomes in the current result set.</p>
            </div>
            <div className='card metric-card'>
              <p className='eyebrow'>Warnings</p>
              <p className='kpi-value'>{filteredTests.filter((test) => test.result === 'warning').length}</p>
              <p className='muted'>Warning outcomes that may need follow-up.</p>
            </div>
          </div>
        ) : null}
      </div>

      {!filters.stationId ? (
        <StateCard title='Choose a station' description='Test history is currently station-scoped, so pick a station to continue.' />
      ) : null}

      {filters.stationId && canWrite ? (
        <form
          className='card page-stack'
          onSubmit={form.handleSubmit(async (values) => {
            try {
              setFormError('');
              const metrics = values.metrics.trim() ? (JSON.parse(values.metrics) as Record<string, unknown>) : undefined;
              const payload = {
                testDate: parseDateInputValue(values.testDate) ?? undefined,
                result: values.result,
                notes: values.notes.trim() || undefined,
                metrics,
              };

              if (editingId) {
                await updateTest.mutateAsync({
                  id: editingId,
                  testDate: payload.testDate,
                  result: payload.result,
                  notes: payload.notes ?? null,
                  metrics,
                });
                return;
              }

              await createTest.mutateAsync(payload);
            } catch (error) {
              setFormError((error as Error).message);
            }
          })}
        >
          <div>
            <h3>{editingId ? 'Edit test record' : 'Log new test'}</h3>
            <p className='muted'>Keep tests predictable with a single form for creation and correction.</p>
          </div>

          <div className='form-grid'>
            <div className='field'>
              <label htmlFor='test-date'>Test date</label>
              <Input id='test-date' type='date' {...form.register('testDate')} />
            </div>
            <div className='field'>
              <label htmlFor='test-result'>Result</label>
              <Select id='test-result' {...form.register('result')}>
                <option value='pass'>Pass</option>
                <option value='warning'>Warning</option>
                <option value='fail'>Fail</option>
              </Select>
            </div>
          </div>

          <div className='field'>
            <label htmlFor='test-notes'>Notes</label>
            <Textarea id='test-notes' {...form.register('notes')} />
          </div>

          <div className='field'>
            <label htmlFor='test-metrics'>Metrics JSON</label>
            <Textarea id='test-metrics' {...form.register('metrics')} placeholder='{"voltage": 230, "current": 32}' />
          </div>

          {mutationError || formError ? <p className='form-error'>{mutationError || formError}</p> : null}

          <div className='section-actions'>
            <Button disabled={createTest.isPending || updateTest.isPending} type='submit'>
              {createTest.isPending || updateTest.isPending ? 'Saving...' : editingId ? 'Update test' : 'Create test'}
            </Button>
            {editingId ? (
              <Button
                type='button'
                variant='secondary'
                onClick={() => {
                  setEditingId(null);
                  form.reset({ testDate: '', result: 'pass', notes: '', metrics: '' });
                }}
              >
                Cancel edit
              </Button>
            ) : null}
          </div>
        </form>
      ) : null}

      {filters.stationId && tests.isLoading ? (
        <StateCard title='Loading tests' description='Fetching the latest test history for the selected station.' />
      ) : null}

      {filters.stationId && tests.error ? (
        <StateCard title='Test history unavailable' description={(tests.error as Error).message} tone='danger' />
      ) : null}

      {filters.stationId && !tests.isLoading && !tests.error ? (
        <div className='card list'>
          <div>
            <h3>Recorded tests</h3>
            <p className='muted'>The list stays station-scoped, with quick editing when operators need to correct a record.</p>
          </div>
          {filteredTests.length === 0 ? (
            <p className='muted'>No test records match the current filter.</p>
          ) : (
            filteredTests.map((test) => (
              <div key={test.id} className='list-item'>
                <div className='stack-row' style={{ justifyContent: 'space-between' }}>
                  <div>
                    <strong>{formatDateTime(test.testDate)}</strong>
                    <p className='muted'>Created {formatDateTime(test.createdAt)}</p>
                  </div>
                  <div className='inline-cluster'>
                    <Badge tone={getTone(test.result)}>{formatEnumLabel(test.result)}</Badge>
                    {canWrite ? (
                      <Button type='button' variant='secondary' onClick={() => setEditingId(test.id)}>
                        Edit
                      </Button>
                    ) : null}
                    {canWrite ? (
                      <ConfirmButton
                        label='Delete'
                        confirmText='Delete this test record?'
                        onConfirm={() => deleteTest.mutate(test.id)}
                        variant='danger'
                      />
                    ) : null}
                  </div>
                </div>
                <p>{test.notes || 'No notes captured for this record.'}</p>
                {Object.keys(test.metrics ?? {}).length > 0 ? (
                  <details>
                    <summary>Metrics</summary>
                    <pre>{formatCustomValue(test.metrics)}</pre>
                  </details>
                ) : null}
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
