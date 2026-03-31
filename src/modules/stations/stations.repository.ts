import { and, asc, count, desc, eq, gte, ilike, inArray, lte, or, sql, type SQL } from 'drizzle-orm';

import { db } from '../../db/client';
import { attachments, stationIssueRecords, stationTestHistory, stations } from '../../db/schema';

type StationInsert = typeof stations.$inferInsert;
type StationUpdate = Partial<Omit<StationInsert, 'id' | 'createdAt'>>;
const unique = <T>(values: T[]) => Array.from(new Set(values));

export type StationSortBy = 'name' | 'createdAt' | 'updatedAt' | 'lastTestDate' | 'powerKw';
export type StationMobileSummary = {
  totalIssueCount: number;
  openIssueCount: number;
  hasOpenIssues: boolean;
  attachmentCount: number;
  testHistoryCount: number;
  latestTestResult: 'pass' | 'fail' | 'warning' | null;
};

export type StationListFilter = {
  page: number;
  limit: number;
  search?: string;
  ids?: string[];
  code?: string;
  qrCode?: string;
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

    if (filters.ids && filters.ids.length > 0) {
      conditions.push(inArray(stations.id, filters.ids));
    }

    if (filters.code) {
      conditions.push(eq(stations.code, filters.code));
    }

    if (filters.qrCode) {
      conditions.push(eq(stations.qrCode, filters.qrCode));
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
          ilike(stations.qrCode, `%${filters.search}%`),
          ilike(stations.brand, `%${filters.search}%`),
          ilike(stations.model, `%${filters.search}%`),
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

  async findByQrCode(qrCode: string) {
    return db.query.stations.findFirst({
      where: eq(stations.qrCode, qrCode),
    });
  }

  async findByUniqueFields(values: { codes?: string[]; qrCodes?: string[]; serialNumbers?: string[] }) {
    const codes = unique(values.codes ?? []);
    const qrCodes = unique(values.qrCodes ?? []);
    const serialNumbers = unique(values.serialNumbers ?? []);
    const conditions: SQL[] = [];

    if (codes.length > 0) {
      conditions.push(inArray(stations.code, codes));
    }

    if (qrCodes.length > 0) {
      conditions.push(inArray(stations.qrCode, qrCodes));
    }

    if (serialNumbers.length > 0) {
      conditions.push(inArray(stations.serialNumber, serialNumbers));
    }

    if (conditions.length === 0) {
      return [];
    }

    return db
      .select()
      .from(stations)
      .where(or(...conditions)!);
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

  async touchById(id: string, userId: string, executor: any = db) {
    const [updated] = await executor
      .update(stations)
      .set({
        updatedAt: new Date(),
        updatedBy: userId,
      })
      .where(eq(stations.id, id))
      .returning({ id: stations.id });

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

  async getMobileSummaryMap(stationIds: string[]) {
    const uniqueStationIds = unique(stationIds);

    if (uniqueStationIds.length === 0) {
      return new Map<string, StationMobileSummary>();
    }

    const [issueRows, attachmentRows, testHistoryRows, latestTestRows] = await Promise.all([
      db
        .select({
          stationId: stationIssueRecords.stationId,
          totalIssueCount: sql<number>`count(*)::int`,
          openIssueCount: sql<number>`coalesce(sum(case when ${stationIssueRecords.status} in ('open', 'in_progress') then 1 else 0 end), 0)::int`,
        })
        .from(stationIssueRecords)
        .where(inArray(stationIssueRecords.stationId, uniqueStationIds))
        .groupBy(stationIssueRecords.stationId),
      db
        .select({
          stationId: attachments.stationId,
          attachmentCount: sql<number>`count(*)::int`,
        })
        .from(attachments)
        .where(inArray(attachments.stationId, uniqueStationIds))
        .groupBy(attachments.stationId),
      db
        .select({
          stationId: stationTestHistory.stationId,
          testHistoryCount: sql<number>`count(*)::int`,
        })
        .from(stationTestHistory)
        .where(inArray(stationTestHistory.stationId, uniqueStationIds))
        .groupBy(stationTestHistory.stationId),
      db
        .select({
          stationId: stationTestHistory.stationId,
          result: stationTestHistory.result,
        })
        .from(stationTestHistory)
        .where(inArray(stationTestHistory.stationId, uniqueStationIds))
        .orderBy(desc(stationTestHistory.testDate), desc(stationTestHistory.createdAt)),
    ]);

    const summaryMap = new Map<string, StationMobileSummary>();

    for (const stationId of uniqueStationIds) {
      summaryMap.set(stationId, {
        totalIssueCount: 0,
        openIssueCount: 0,
        hasOpenIssues: false,
        attachmentCount: 0,
        testHistoryCount: 0,
        latestTestResult: null,
      });
    }

    for (const row of issueRows) {
      const current = summaryMap.get(row.stationId);

      if (!current) {
        continue;
      }

      current.totalIssueCount = row.totalIssueCount;
      current.openIssueCount = row.openIssueCount;
      current.hasOpenIssues = row.openIssueCount > 0;
    }

    for (const row of attachmentRows) {
      const current = summaryMap.get(row.stationId);

      if (!current) {
        continue;
      }

      current.attachmentCount = row.attachmentCount;
    }

    for (const row of testHistoryRows) {
      const current = summaryMap.get(row.stationId);

      if (!current) {
        continue;
      }

      current.testHistoryCount = row.testHistoryCount;
    }

    for (const row of latestTestRows) {
      const current = summaryMap.get(row.stationId);

      if (!current || current.latestTestResult !== null) {
        continue;
      }

      current.latestTestResult = row.result;
    }

    return summaryMap;
  }
}

export const stationsRepository = new StationsRepository();
