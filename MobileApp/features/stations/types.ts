import type { Station, StationConnectorSummary, StationCustomValuesByFieldId } from '@/types';

export interface StationListItem
  extends Pick<
    Station,
    | 'id'
    | 'name'
    | 'code'
    | 'location'
    | 'brandId'
    | 'modelId'
    | 'brand'
    | 'model'
    | 'powerKw'
    | 'currentType'
    | 'status'
    | 'lastTestDate'
    | 'updatedAt'
    | 'isArchived'
    | 'archivedAt'
    | 'modelTemplateVersion'
  > {
  connectorSummary: StationConnectorSummary;
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
