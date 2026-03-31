'use client';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { customFieldsClient } from '@/lib/api/custom-fields-client';
import { stationsClient } from '@/lib/api/stations-client';
import { StationForm } from '@/features/stations/station-form';

export default function EditStationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const station = useQuery({ queryKey: ['station', id], queryFn: () => stationsClient.get(id) });
  const customFields = useQuery({ queryKey: ['customFieldsActive'], queryFn: () => customFieldsClient.list(true) });
  if (!station.data || !customFields.data) return <div>Loading...</div>;
  return <StationForm initial={station.data.data} customFields={customFields.data.data} onSubmit={async (payload) => { await stationsClient.update(id, payload); router.push(`/stations/${id}`); }} />;
}
