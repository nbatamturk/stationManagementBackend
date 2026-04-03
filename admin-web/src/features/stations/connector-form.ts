import { z } from 'zod';
import { CurrentType, StationConnector, StationConnectorInput, StationConnectorSummary, StationConnectorType } from '@/types/api';

export const connectorTypeOptions = ['Type2', 'CCS2', 'CHAdeMO', 'GBT', 'NACS', 'Other'] as const;
export const currentTypeOptions = ['AC', 'DC'] as const;

export const connectorFormSchema = z.object({
  connectorNo: z.coerce.number().int().min(1, 'Connector number must be at least 1'),
  connectorType: z.enum(connectorTypeOptions),
  currentType: z.enum(currentTypeOptions),
  powerKw: z.coerce.number().positive('Power must be greater than 0').max(1000, 'Power must be 1000 kW or less'),
  sortOrder: z.coerce.number().int().min(1, 'Sort order must be at least 1'),
  isActive: z.boolean(),
});

export const connectorsFormSchema = z
  .array(connectorFormSchema)
  .min(1, 'At least one connector is required')
  .superRefine((connectors, context) => {
    const usedConnectorNumbers = new Map<number, number>();

    connectors.forEach((connector, index) => {
      const duplicateIndex = usedConnectorNumbers.get(connector.connectorNo);

      if (duplicateIndex !== undefined) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Connector number ${connector.connectorNo} is duplicated`,
          path: [index, 'connectorNo'],
        });
      } else {
        usedConnectorNumbers.set(connector.connectorNo, index);
      }
    });
  });

export type ConnectorFormValue = z.infer<typeof connectorFormSchema>;

type ConnectorLike = StationConnectorInput | StationConnector;

export function createEmptyConnector(order = 1): ConnectorFormValue {
  return {
    connectorNo: order,
    connectorType: 'CCS2',
    currentType: 'DC',
    powerKw: 50,
    sortOrder: order,
    isActive: true,
  };
}

export function toConnectorFormValue(connector: ConnectorLike): ConnectorFormValue {
  return {
    connectorNo: connector.connectorNo,
    connectorType: connector.connectorType,
    currentType: connector.currentType,
    powerKw: connector.powerKw,
    sortOrder: connector.sortOrder ?? connector.connectorNo,
    isActive: connector.isActive ?? true,
  };
}

export function deriveConnectorFields(connectors: ConnectorFormValue[]) {
  const orderedConnectors = [...connectors]
    .filter((connector) =>
      Number.isInteger(connector.connectorNo) &&
      connector.connectorNo > 0 &&
      Number.isInteger(connector.sortOrder) &&
      connector.sortOrder > 0 &&
      Number.isFinite(connector.powerKw) &&
      connector.powerKw > 0,
    )
    .sort((left, right) => left.sortOrder - right.sortOrder || left.connectorNo - right.connectorNo);

  const types: StationConnectorType[] = [];
  const seenTypes = new Set<StationConnectorType>();
  let maxPowerKw = 0;
  let hasAC = false;
  let hasDC = false;

  orderedConnectors.forEach((connector) => {
    if (!seenTypes.has(connector.connectorType)) {
      seenTypes.add(connector.connectorType);
      types.push(connector.connectorType);
    }

    maxPowerKw = Math.max(maxPowerKw, connector.powerKw);
    hasAC = hasAC || connector.currentType === 'AC';
    hasDC = hasDC || connector.currentType === 'DC';
  });

  const summary: StationConnectorSummary = {
    types,
    maxPowerKw,
    hasAC,
    hasDC,
    count: orderedConnectors.length,
  };

  const currentType: CurrentType | null = summary.count === 0 ? null : summary.hasDC ? 'DC' : 'AC';

  return {
    summary,
    currentType,
    powerKw: summary.count === 0 ? null : summary.maxPowerKw,
    socketType: summary.count === 0 ? '' : summary.types.join(', '),
  };
}
