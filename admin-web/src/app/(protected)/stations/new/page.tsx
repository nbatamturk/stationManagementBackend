'use client';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { StateCard } from '@/components/ui/state-card';
import { customFieldsClient } from '@/lib/api/custom-fields-client';
import { stationsClient } from '@/lib/api/stations-client';
import { StationForm } from '@/features/stations/station-form';
import { useDocumentTitle } from '@/lib/use-document-title';

export default function NewStationPage() {
  useDocumentTitle('New Station');
  const router = useRouter();
  const customFields = useQuery({ queryKey: ['customFieldsActive'], queryFn: () => customFieldsClient.list(true) });
  const stationConfig = useQuery({ queryKey: ['station-config'], queryFn: () => stationsClient.getConfig() });

  if (customFields.isLoading || stationConfig.isLoading) {
    return <StateCard title='Loading station form' description='Preparing catalog options and active custom field definitions.' />;
  }

  if (customFields.error || stationConfig.error) {
    return (
      <StateCard
        title='Station form unavailable'
        description={
          (customFields.error as Error | undefined)?.message ||
          (stationConfig.error as Error | undefined)?.message ||
          'The station form could not be loaded.'
        }
        tone='danger'
      />
    );
  }

  if (!customFields.data || !stationConfig.data) {
    return <StateCard title='Station form unavailable' description='Station form configuration could not be loaded.' tone='warning' />;
  }

  return (
    <StationForm
      customFields={customFields.data.data}
      config={stationConfig.data.data}
      onSubmit={async (payload) => {
        await stationsClient.create(payload);
        router.push('/stations');
      }}
    />
  );
}
