'use client';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { StateCard } from '@/components/ui/state-card';
import { customFieldsClient } from '@/lib/api/custom-fields-client';
import { stationsClient } from '@/lib/api/stations-client';
import { StationForm } from '@/features/stations/station-form';
import { useDocumentTitle } from '@/lib/use-document-title';

export default function EditStationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const station = useQuery({ queryKey: ['station', id], queryFn: () => stationsClient.get(id) });
  const customFields = useQuery({ queryKey: ['customFieldsActive'], queryFn: () => customFieldsClient.list(true) });
  const stationConfig = useQuery({ queryKey: ['station-config'], queryFn: () => stationsClient.getConfig() });
  const applyTemplate = useMutation({
    mutationFn: () => stationsClient.applyModelTemplate(id),
    onSuccess: async (response) => {
      queryClient.setQueryData(['station', id], response);
      await queryClient.invalidateQueries({ queryKey: ['stations-table'] });
    },
  });
  useDocumentTitle(station.data?.data?.name ? `Edit ${station.data.data.name}` : 'Edit Station');

  if (station.isLoading || customFields.isLoading || stationConfig.isLoading) {
    return <StateCard title='Loading station' description='Fetching station details, catalog options, and active custom fields.' />;
  }
  if (station.error || customFields.error || stationConfig.error) {
    return (
      <StateCard
        title='Station form unavailable'
        description={
          (station.error as Error | undefined)?.message ||
          (customFields.error as Error | undefined)?.message ||
          (stationConfig.error as Error | undefined)?.message ||
          'The station could not be loaded.'
        }
        tone='danger'
      />
    );
  }
  if (!station.data || !customFields.data || !stationConfig.data) {
    return <StateCard title='Station not found' description='The requested station could not be loaded.' tone='warning' />;
  }

  return (
    <StationForm
      key={`${station.data.data.updatedAt}-${station.data.data.modelTemplateVersion ?? 'none'}`}
      initial={station.data.data}
      customFields={customFields.data.data}
      config={stationConfig.data.data}
      actionSlot={
        <ConfirmButton
          label={applyTemplate.isPending ? 'Applying template...' : 'Apply Model Template'}
          confirmText='Replace the current station connectors with the latest template from the selected model?'
          onConfirm={() => applyTemplate.mutate()}
          variant='secondary'
          disabled={applyTemplate.isPending}
        />
      }
      onSubmit={async (payload) => {
        await stationsClient.update(id, payload);
        router.push(`/stations/${id}`);
      }}
    />
  );
}
