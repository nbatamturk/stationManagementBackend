import type { Station, StationCustomValuesByFieldId } from '@/types';

export interface StationListItem extends Station {
  visibleCustomFields: Record<string, string>;
}

export interface StationDetails extends Station {
  customValuesByFieldId: StationCustomValuesByFieldId;
}
