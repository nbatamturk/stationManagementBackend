'use client';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { StateCard } from '@/components/ui/state-card';
import { customFieldsClient } from '@/lib/api/custom-fields-client';
import { stationsClient } from '@/lib/api/stations-client';
import { StationForm } from '@/features/stations/station-form';

export default function EditStationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const station = useQuery({ queryKey: ['station', id], queryFn: () => stationsClient.get(id) });
  const customFields = useQuery({ queryKey: ['customFieldsActive'], queryFn: () => customFieldsClient.list(true) });
  if (station.isLoading || customFields.isLoading) {
    return <StateCard title='Loading station' description='Fetching station details and active custom fields.' />;
  }
  if (station.error || customFields.error) {
    return (
      <StateCard
        title='Station form unavailable'
        description={(station.error as Error | undefined)?.message || (customFields.error as Error | undefined)?.message || 'The station could not be loaded.'}
        tone='danger'
      />
    );
  }
  if (!station.data || !customFields.data) {
    return <StateCard title='Station not found' description='The requested station could not be loaded.' tone='warning' />;
  }
  return <StationForm initial={station.data.data} customFields={customFields.data.data} onSubmit={async (payload) => { await stationsClient.update(id, payload); router.push(`/stations/${id}`); }} />;
}
