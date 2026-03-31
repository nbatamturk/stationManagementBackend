import { and, asc, count, desc, eq, gte, ilike, inArray, lte, or, type SQL } from 'drizzle-orm';

import { db } from '../../db/client';
import { stations } from '../../db/schema';

type StationInsert = typeof stations.$inferInsert;
type StationUpdate = Partial<Omit<StationInsert, 'id' | 'createdAt'>>;

export type StationSortBy = 'name' | 'createdAt' | 'updatedAt' | 'lastTestDate' | 'powerKw';

export type StationListFilter = {
  page: number;
  limit: number;
  search?: string;
  status?: 'active' | 'maintenance' | 'inactive' | 'faulty' | 'archived';
  brand?: string;
  currentType?: 'AC' | 'DC';
  sortBy?: StationSortBy;
  sortOrder?: 'asc' | 'desc';
  includeArchived?: boolean;
  isArchived?: boolean;
  createdFrom?: Date;
  createdTo?: Date;
  updatedFrom?: Date;
  updatedTo?: Date;
  powerMin?: number;
  powerMax?: number;
  customFilteredStationIds?: string[] | null;
};

export class StationsRepository {
  async list(filters: StationListFilter) {
    const conditions: SQL[] = [];

    if (filters.isArchived !== undefined) {
      conditions.push(eq(stations.isArchived, filters.isArchived));
    } else if (!filters.includeArchived) {
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

    if (filters.createdFrom) {
      conditions.push(gte(stations.createdAt, filters.createdFrom));
    }

    if (filters.createdTo) {
      conditions.push(lte(stations.createdAt, filters.createdTo));
    }

    if (filters.updatedFrom) {
      conditions.push(gte(stations.updatedAt, filters.updatedFrom));
    }

    if (filters.updatedTo) {
      conditions.push(lte(stations.updatedAt, filters.updatedTo));
    }

    if (filters.powerMin !== undefined) {
      conditions.push(gte(stations.powerKw, filters.powerMin.toString()));
    }

    if (filters.powerMax !== undefined) {
      conditions.push(lte(stations.powerKw, filters.powerMax.toString()));
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
        return {
          rows: [],
          total: 0,
        };
      }

      conditions.push(inArray(stations.id, filters.customFilteredStationIds));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const sortColumnMap = {
      name: stations.name,
      createdAt: stations.createdAt,
      updatedAt: stations.updatedAt,
      lastTestDate: stations.lastTestDate,
      powerKw: stations.powerKw,
    } as const;

    const sortBy = filters.sortBy ?? 'updatedAt';
    const orderDirection = filters.sortOrder ?? 'desc';

    const countRows = await db.select({ total: count() }).from(stations).where(whereClause);
    const total = countRows[0]?.total ?? 0;

    const rows = await db
      .select()
      .from(stations)
      .where(whereClause)
      .orderBy(
        orderDirection === 'asc' ? asc(sortColumnMap[sortBy]) : desc(sortColumnMap[sortBy]),
        orderDirection === 'asc' ? asc(stations.id) : desc(stations.id),
      )
      .limit(filters.limit)
      .offset((filters.page - 1) * filters.limit);

    return {
      rows,
      total,
    };
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

  async updateLastTestDate(stationId: string, testDate: Date | null) {
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
