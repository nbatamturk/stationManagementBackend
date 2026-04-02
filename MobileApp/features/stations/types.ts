import type { Station, StationCustomValuesByFieldId } from '@/types';

export interface StationListItem
  extends Pick<
    Station,
    | 'id'
    | 'name'
    | 'code'
    | 'location'
    | 'brand'
    | 'model'
    | 'powerKw'
    | 'currentType'
    | 'status'
    | 'lastTestDate'
    | 'updatedAt'
    | 'isArchived'
    | 'archivedAt'
  > {
  summary: NonNullable<Station['summary']>;
}

export interface StationListPage {
  items: StationListItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  hasMore: boolean;
}

export interface StationFormRecord extends Station {
  customValuesByFieldId: StationCustomValuesByFieldId;
}
