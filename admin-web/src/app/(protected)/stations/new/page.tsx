'use client';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { customFieldsClient } from '@/lib/api/custom-fields-client';
import { stationsClient } from '@/lib/api/stations-client';
import { StationForm } from '@/features/stations/station-form';

export default function NewStationPage() {
  const router = useRouter();
  const customFields = useQuery({ queryKey: ['customFieldsActive'], queryFn: () => customFieldsClient.list(true) });
  if (!customFields.data) return <div>Loading...</div>;
  return <StationForm customFields={customFields.data.data} onSubmit={async (payload) => { await stationsClient.create(payload); router.push('/stations'); }} />;
}
