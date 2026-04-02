'use client';

import { useDeferredValue, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { stationsClient } from '@/lib/api/stations-client';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

export function StationPicker({
  value,
  onChange,
  label = 'Station',
}: {
  value?: string;
  onChange: (stationId: string) => void;
  label?: string;
}) {
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const selectedStation = useQuery({
    queryKey: ['station-picker-current', value],
    queryFn: () => stationsClient.get(value!),
    enabled: Boolean(value),
  });
  const stationOptions = useQuery({
    queryKey: ['station-picker-options', deferredSearch],
    queryFn: () =>
      stationsClient.list({
        page: 1,
        limit: 8,
        includeArchived: true,
        sortBy: 'updatedAt',
        sortOrder: 'desc',
        view: 'compact',
        search: deferredSearch.trim() || undefined,
      }),
  });

  useEffect(() => {
    if (!value) {
      setSearch('');
      return;
    }

    if (!search && selectedStation.data?.data?.name) {
      setSearch(selectedStation.data.data.name);
    }
  }, [search, selectedStation.data?.data?.name, value]);

  const options = [...(stationOptions.data?.data ?? [])];
  const current = selectedStation.data?.data;

  if (current && !options.some((station) => station.id === current.id)) {
    options.unshift(current);
  }

  return (
    <div className='field'>
      <label>{label}</label>
      <Input
        placeholder='Search by station name, code, QR, or serial number'
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <Select value={value ?? ''} onChange={(event) => onChange(event.target.value)}>
        <option value=''>Select a station</option>
        {options.map((station) => (
          <option key={station.id} value={station.id}>
            {station.name} ({station.code})
          </option>
        ))}
      </Select>
      {current ? <p className='field-hint'>{current.location} · {current.status}</p> : null}
    </div>
  );
}
