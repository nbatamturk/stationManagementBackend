import { and, asc, desc, eq, ilike, inArray, or, type SQL } from 'drizzle-orm';

import { db } from '../../db/client';
import { stations } from '../../db/schema';

type StationInsert = typeof stations.$inferInsert;
type StationUpdate = Partial<Omit<StationInsert, 'id' | 'createdAt'>>;

export type StationSortBy = 'name' | 'createdAt' | 'updatedAt' | 'lastTestDate' | 'powerKw';

export type StationListFilter = {
  search?: string;
  status?: 'active' | 'maintenance' | 'inactive' | 'faulty' | 'archived';
  brand?: string;
  currentType?: 'AC' | 'DC';
  sortBy?: StationSortBy;
  sortOrder?: 'asc' | 'desc';
  includeArchived?: boolean;
  customFilteredStationIds?: string[] | null;
};

export class StationsRepository {
  async list(filters: StationListFilter) {
    const conditions: SQL[] = [];

    if (!filters.includeArchived) {
      conditions.push(eq(stations.isArchived, false));
    }

    if (filters.status) {
      conditions.push(eq(stations.status, filters.status));
    }

    if (filters.brand) {
      conditions.push(eq(stations.brand, filters.brand));
    }

    if (filters.currentType) {
      conditions.push(eq(stations.currentType, filters.currentType));
    }

    if (filters.search) {
      conditions.push(
        or(
          ilike(stations.name, `%${filters.search}%`),
          ilike(stations.code, `%${filters.search}%`),
          ilike(stations.serialNumber, `%${filters.search}%`),
          ilike(stations.location, `%${filters.search}%`),
        )!,
      );
    }

    if (filters.customFilteredStationIds !== null && filters.customFilteredStationIds !== undefined) {
      if (filters.customFilteredStationIds.length === 0) {
        return [];
      }

      conditions.push(inArray(stations.id, filters.customFilteredStationIds));
    }

    const sortColumnMap = {
      name: stations.name,
      createdAt: stations.createdAt,
      updatedAt: stations.updatedAt,
      lastTestDate: stations.lastTestDate,
      powerKw: stations.powerKw,
    } as const;

    const sortBy = filters.sortBy ?? 'updatedAt';
    const orderDirection = filters.sortOrder ?? 'desc';

    return db
      .select()
      .from(stations)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(orderDirection === 'asc' ? asc(sortColumnMap[sortBy]) : desc(sortColumnMap[sortBy]));
  }

  async findById(id: string) {
    return db.query.stations.findFirst({
      where: eq(stations.id, id),
    });
  }

  async create(values: StationInsert) {
    const [created] = await db.insert(stations).values(values).returning();

    if (!created) {
      throw new Error('Failed to create station');
    }

    return created;
  }

  async updateById(id: string, values: StationUpdate) {
    const [updated] = await db
      .update(stations)
      .set({
        ...values,
        updatedAt: new Date(),
      })
      .where(eq(stations.id, id))
      .returning();

    return updated;
  }

  async deleteById(id: string) {
    const [deleted] = await db.delete(stations).where(eq(stations.id, id)).returning({ id: stations.id });
    return deleted;
  }

  async archiveById(id: string, userId: string) {
    const [updated] = await db
      .update(stations)
      .set({
        status: 'archived',
        isArchived: true,
        archivedAt: new Date(),
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(stations.id, id))
      .returning();

    return updated;
  }

  async updateLastTestDate(stationId: string, testDate: Date) {
    await db
      .update(stations)
      .set({
        lastTestDate: testDate,
        updatedAt: new Date(),
      })
      .where(eq(stations.id, stationId));
  }
}

export const stationsRepository = new StationsRepository();
