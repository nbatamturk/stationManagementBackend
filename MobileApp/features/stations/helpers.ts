import type {
  StationConnector,
  StationConnectorFormValue,
  StationConnectorInput,
  StationConnectorSummary,
  StationConnectorType,
  StationCurrentType,
} from '@/types';

export const connectorTypeOptions = ['Type2', 'CCS2', 'CHAdeMO', 'GBT', 'NACS', 'Other'] as const;
export const currentTypeOptions = ['AC', 'DC'] as const;

type ConnectorLike = StationConnectorInput | StationConnector;

export const createEmptyConnectorFormValue = (connectorNo = 1): StationConnectorFormValue => ({
  connectorNo: String(connectorNo),
  connectorType: 'Type2',
  currentType: 'AC',
  powerKw: '22',
  isActive: true,
});

export const toConnectorFormValue = (connector: ConnectorLike): StationConnectorFormValue => ({
  connectorNo: String(connector.connectorNo),
  connectorType: connector.connectorType,
  currentType: connector.currentType,
  powerKw: String(connector.powerKw),
  isActive: connector.isActive ?? true,
});

const normalizeConnectorInput = (connector: ConnectorLike): StationConnectorInput | null => {
  if (
    !Number.isInteger(connector.connectorNo) ||
    connector.connectorNo < 1 ||
    !Number.isFinite(connector.powerKw) ||
    connector.powerKw <= 0
  ) {
    return null;
  }

  return {
    connectorNo: connector.connectorNo,
    connectorType: connector.connectorType,
    currentType: connector.currentType,
    powerKw: connector.powerKw,
    isActive: connector.isActive ?? true,
    sortOrder: connector.sortOrder ?? connector.connectorNo,
  };
};

export const deriveConnectorFields = (connectors: ConnectorLike[]) => {
  const orderedConnectors = connectors
    .map((connector) => normalizeConnectorInput(connector))
    .filter((connector): connector is StationConnectorInput => Boolean(connector))
    .sort(
      (left, right) =>
        (left.sortOrder ?? left.connectorNo) - (right.sortOrder ?? right.connectorNo) ||
        left.connectorNo - right.connectorNo,
    );

  const types: StationConnectorType[] = [];
  const seenTypes = new Set<StationConnectorType>();
  let maxPowerKw = 0;
  let hasAC = false;
  let hasDC = false;

  for (const connector of orderedConnectors) {
    if (!seenTypes.has(connector.connectorType)) {
      seenTypes.add(connector.connectorType);
      types.push(connector.connectorType);
    }

    maxPowerKw = Math.max(maxPowerKw, connector.powerKw);
    hasAC = hasAC || connector.currentType === 'AC';
    hasDC = hasDC || connector.currentType === 'DC';
  }

  const summary: StationConnectorSummary = {
    types,
    maxPowerKw,
    hasAC,
    hasDC,
    count: orderedConnectors.length,
  };

  const currentType: StationCurrentType | null = summary.count === 0 ? null : hasDC ? 'DC' : 'AC';

  return {
    summary,
    currentType,
    powerKw: summary.count === 0 ? null : summary.maxPowerKw,
    socketType: summary.count === 0 ? '' : summary.types.join(', '),
  };
};

export const getNextConnectorNumber = (connectors: StationConnectorFormValue[]) =>
  connectors.reduce((maxValue, connector) => {
    const parsed = Number(connector.connectorNo);
    return Number.isInteger(parsed) && parsed > maxValue ? parsed : maxValue;
  }, 0) + 1;
