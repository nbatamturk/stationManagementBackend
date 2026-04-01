export type CustomFieldType = 'text' | 'number' | 'boolean' | 'date' | 'select' | 'json';

export interface CustomFieldDefinition {
  id: string;
  key: string;
  label: string;
  type: CustomFieldType;
  optionsJson: string | null;
  isRequired: boolean;
  isFilterable: boolean;
  isVisibleInList: boolean;
  sortOrder: number;
  isActive: boolean;
}

export interface CustomFieldDefinitionDraft {
  key: string;
  label: string;
  type: CustomFieldType;
  optionsJson: string;
  isRequired: boolean;
  isFilterable: boolean;
  isVisibleInList: boolean;
  sortOrder: number;
  isActive: boolean;
}

export interface StationCustomFieldValue {
  id: string;
  stationId: string;
  fieldId: string;
  value: string;
}

export type StationCustomValuesByFieldId = Record<string, string>;
