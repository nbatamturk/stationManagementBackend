import { and, asc, desc, eq, inArray } from 'drizzle-orm';

import { db } from '../../db/client';
import { stationConnectors, stationModelConnectorTemplates } from '../../db/schema';

import type { NormalizedStationConnectorInput } from './station-connectors';

type StationConnectorInsert = typeof stationConnectors.$inferInsert;
export type StationConnectorRow = typeof stationConnectors.$inferSelect;
export type StationModelConnectorTemplateRow = typeof stationModelConnectorTemplates.$inferSelect;

const unique = <T>(values: T[]) => Array.from(new Set(values));

export class StationConnectorsRepository {
  async listActiveByStationIds(stationIds: string[], executor: any = db): Promise<StationConnectorRow[]> {
    const uniqueStationIds = unique(stationIds);

    if (uniqueStationIds.length === 0) {
      return [];
    }

    return executor
      .select()
      .from(stationConnectors)
      .where(and(inArray(stationConnectors.stationId, uniqueStationIds), eq(stationConnectors.isDeleted, false)))
      .orderBy(asc(stationConnectors.sortOrder), asc(stationConnectors.connectorNo), asc(stationConnectors.id));
  }

  async softDeleteActiveByStationId(stationId: string, executor: any = db) {
    return executor
      .update(stationConnectors)
      .set({
        isDeleted: true,
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(stationConnectors.stationId, stationId), eq(stationConnectors.isDeleted, false)))
      .returning({ id: stationConnectors.id });
  }

  async insertForStation(
    stationId: string,
    connectors: NormalizedStationConnectorInput[],
    executor: any = db,
  ): Promise<StationConnectorRow[]> {
    if (connectors.length === 0) {
      return [];
    }

    const values: StationConnectorInsert[] = connectors.map((connector) => ({
      stationId,
      connectorNo: connector.connectorNo,
      connectorType: connector.connectorType,
      currentType: connector.currentType,
      powerKw: connector.powerKw.toString(),
      isActive: connector.isActive,
      sortOrder: connector.sortOrder,
      isDeleted: false,
      deletedAt: null,
    }));

    return executor.insert(stationConnectors).values(values).returning();
  }

  async getLatestTemplateVersion(modelId: string, executor: any = db) {
    const [latest] = await executor
      .select({ version: stationModelConnectorTemplates.version })
      .from(stationModelConnectorTemplates)
      .where(and(eq(stationModelConnectorTemplates.modelId, modelId), eq(stationModelConnectorTemplates.isActive, true)))
      .orderBy(desc(stationModelConnectorTemplates.version))
      .limit(1);

    return latest?.version ?? null;
  }

  async listTemplateRows(
    modelId: string,
    version: number,
    executor: any = db,
  ): Promise<StationModelConnectorTemplateRow[]> {
    return executor
      .select()
      .from(stationModelConnectorTemplates)
      .where(
        and(
          eq(stationModelConnectorTemplates.modelId, modelId),
          eq(stationModelConnectorTemplates.version, version),
          eq(stationModelConnectorTemplates.isActive, true),
        ),
      )
      .orderBy(
        asc(stationModelConnectorTemplates.sortOrder),
        asc(stationModelConnectorTemplates.connectorNo),
        asc(stationModelConnectorTemplates.id),
      );
  }

  async insertTemplateVersion(
    modelId: string,
    version: number,
    connectors: NormalizedStationConnectorInput[],
    executor: any = db,
  ): Promise<StationModelConnectorTemplateRow[]> {
    if (connectors.length === 0) {
      return [];
    }

    return executor
      .insert(stationModelConnectorTemplates)
      .values(
        connectors.map((connector) => ({
          modelId,
          version,
          connectorNo: connector.connectorNo,
          connectorType: connector.connectorType,
          currentType: connector.currentType,
          powerKw: connector.powerKw.toString(),
          isActive: connector.isActive,
          sortOrder: connector.sortOrder,
        })),
      )
      .returning();
  }
}

export const stationConnectorsRepository = new StationConnectorsRepository();
