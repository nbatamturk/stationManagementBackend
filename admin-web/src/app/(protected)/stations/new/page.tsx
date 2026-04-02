'use client';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { StateCard } from '@/components/ui/state-card';
import { customFieldsClient } from '@/lib/api/custom-fields-client';
import { stationsClient } from '@/lib/api/stations-client';
import { StationForm } from '@/features/stations/station-form';

export default function NewStationPage() {
  const router = useRouter();
  const customFields = useQuery({ queryKey: ['customFieldsActive'], queryFn: () => customFieldsClient.list(true) });
  if (customFields.isLoading) return <StateCard title='Loading station form' description='Preparing active custom field definitions.' />;
  if (customFields.error) {
    return <StateCard title='Station form unavailable' description={(customFields.error as Error).message} tone='danger' />;
  }
  if (!customFields.data) return <StateCard title='Station form unavailable' description='Active custom field definitions could not be loaded.' tone='warning' />;
  return <StationForm customFields={customFields.data.data} onSubmit={async (payload) => { await stationsClient.create(payload); router.push('/stations'); }} />;
}
