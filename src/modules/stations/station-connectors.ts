import { connectorTypeValues, currentTypeValues } from '../../contracts/domain';
import { type ConnectorType, type CurrentType } from '../../db/schema';
import { AppError } from '../../utils/errors';

const MAX_CONNECTOR_POWER_KW = 1000;
const connectorTypeSet = new Set<ConnectorType>(connectorTypeValues);
const currentTypeSet = new Set<CurrentType>(currentTypeValues);

export type StationConnectorInput = {
  connectorNo: number;
  connectorType: ConnectorType;
  currentType: CurrentType;
  powerKw: number;
  isActive?: boolean;
  sortOrder?: number;
};

export type NormalizedStationConnectorInput = {
  connectorNo: number;
  connectorType: ConnectorType;
  currentType: CurrentType;
  powerKw: number;
  isActive: boolean;
  sortOrder: number;
};

export type StationConnectorResponse = NormalizedStationConnectorInput & {
  id: string;
};

export type StationConnectorSummary = {
  types: ConnectorType[];
  maxPowerKw: number;
  hasAC: boolean;
  hasDC: boolean;
  count: number;
};

const sortConnectors = <T extends { sortOrder: number; connectorNo: number; id?: string }>(connectors: T[]) =>
  [...connectors].sort(
    (left, right) =>
      left.sortOrder - right.sortOrder ||
      left.connectorNo - right.connectorNo ||
      (left.id ?? '').localeCompare(right.id ?? ''),
  );

export const normalizeStationConnectors = (
  connectors: StationConnectorInput[] | undefined,
): NormalizedStationConnectorInput[] => {
  if (!Array.isArray(connectors) || connectors.length === 0) {
    throw new AppError('Stations must include at least one connector', 400, 'STATION_CONNECTOR_REQUIRED');
  }

  const normalized: NormalizedStationConnectorInput[] = [];
  const usedConnectorNumbers = new Set<number>();

  for (const connector of connectors) {
    if (!Number.isInteger(connector.connectorNo) || connector.connectorNo < 1) {
      throw new AppError(
        'Connector number must be a positive integer',
        400,
        'STATION_CONNECTOR_INVALID_NO',
      );
    }

    if (usedConnectorNumbers.has(connector.connectorNo)) {
      throw new AppError(
        `Connector number ${connector.connectorNo} is duplicated for this station`,
        400,
        'STATION_CONNECTOR_DUPLICATE_NO',
      );
    }

    if (!connectorTypeSet.has(connector.connectorType)) {
      throw new AppError(
        `Connector type must be one of: ${connectorTypeValues.join(', ')}`,
        400,
        'STATION_CONNECTOR_INVALID_TYPE',
      );
    }

    if (!currentTypeSet.has(connector.currentType)) {
      throw new AppError(
        `Connector current type must be one of: ${currentTypeValues.join(', ')}`,
        400,
        'STATION_CONNECTOR_INVALID_CURRENT_TYPE',
      );
    }

    if (!Number.isFinite(connector.powerKw) || connector.powerKw <= 0 || connector.powerKw > MAX_CONNECTOR_POWER_KW) {
      throw new AppError(
        `Connector power (kW) must be greater than 0 and at most ${MAX_CONNECTOR_POWER_KW}`,
        400,
        'STATION_CONNECTOR_INVALID_POWER',
      );
    }

    const sortOrder =
      connector.sortOrder === undefined
        ? connector.connectorNo
        : !Number.isInteger(connector.sortOrder) || connector.sortOrder < 1
          ? (() => {
              throw new AppError(
                'Connector sort order must be a positive integer',
                400,
                'STATION_CONNECTOR_INVALID_SORT_ORDER',
              );
            })()
          : connector.sortOrder;

    normalized.push({
      connectorNo: connector.connectorNo,
      connectorType: connector.connectorType,
      currentType: connector.currentType,
      powerKw: Number(connector.powerKw),
      isActive: connector.isActive ?? true,
      sortOrder,
    });

    usedConnectorNumbers.add(connector.connectorNo);
  }

  return sortConnectors(normalized);
};

export const buildConnectorSummary = (
  connectors: Array<Pick<NormalizedStationConnectorInput, 'connectorType' | 'currentType' | 'powerKw' | 'sortOrder' | 'connectorNo'>>,
): StationConnectorSummary => {
  if (connectors.length === 0) {
    return {
      types: [],
      maxPowerKw: 0,
      hasAC: false,
      hasDC: false,
      count: 0,
    };
  }

  const orderedConnectors = sortConnectors(connectors);
  const types: ConnectorType[] = [];
  const seenTypes = new Set<ConnectorType>();
  let maxPowerKw = 0;
  let hasAC = false;
  let hasDC = false;

  for (const connector of orderedConnectors) {
    if (!seenTypes.has(connector.connectorType)) {
      types.push(connector.connectorType);
      seenTypes.add(connector.connectorType);
    }

    maxPowerKw = Math.max(maxPowerKw, Number(connector.powerKw));
    hasAC = hasAC || connector.currentType === 'AC';
    hasDC = hasDC || connector.currentType === 'DC';
  }

  return {
    types,
    maxPowerKw,
    hasAC,
    hasDC,
    count: orderedConnectors.length,
  };
};

export const buildDerivedStationConnectorFields = (
  connectors: Array<Pick<NormalizedStationConnectorInput, 'connectorType' | 'currentType' | 'powerKw' | 'sortOrder' | 'connectorNo'>>,
) => {
  const connectorSummary = buildConnectorSummary(connectors);

  if (connectorSummary.count === 0) {
    throw new AppError('Stations must include at least one connector', 400, 'STATION_CONNECTOR_REQUIRED');
  }

  return {
    connectorSummary,
    currentType: (connectorSummary.hasDC ? 'DC' : 'AC') as CurrentType,
    powerKw: connectorSummary.maxPowerKw,
    socketType: connectorSummary.types.join(', '),
  };
};

export const sortStationConnectorResponses = (connectors: StationConnectorResponse[]) => sortConnectors(connectors);
