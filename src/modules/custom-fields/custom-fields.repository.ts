import { and, eq, inArray, sql } from 'drizzle-orm';

import { db } from '../../db/client';
import { customFieldDefinitions, stationCustomFieldValues } from '../../db/schema';

type DefinitionInsert = typeof customFieldDefinitions.$inferInsert;
type DefinitionUpdate = Partial<Omit<DefinitionInsert, 'id' | 'createdAt'>>;

export class CustomFieldsRepository {
  async list(active?: boolean) {
    return db.query.customFieldDefinitions.findMany({
      where:
        active === undefined
          ? undefined
          : (table) =>
              eq(table.isActive, active),
      orderBy: (table, { asc }) => [asc(table.sortOrder), asc(table.createdAt)],
    });
  }

  async create(values: DefinitionInsert) {
    const [created] = await db.insert(customFieldDefinitions).values(values).returning();

    if (!created) {
      throw new Error('Failed to create custom field definition');
    }

    return created;
  }

  async findById(id: string) {
    return db.query.customFieldDefinitions.findFirst({
      where: eq(customFieldDefinitions.id, id),
    });
  }

  async updateById(id: string, values: DefinitionUpdate) {
    const [updated] = await db
      .update(customFieldDefinitions)
      .set({
        ...values,
        updatedAt: new Date(),
      })
      .where(eq(customFieldDefinitions.id, id))
      .returning();

    return updated;
  }

  async findByKeys(keys: string[], executor: any = db) {
    if (keys.length === 0) {
      return [];
    }

    return executor
      .select()
      .from(customFieldDefinitions)
      .where(inArray(customFieldDefinitions.key, keys));
  }

  async listActiveRequired(executor: any = db) {
    return executor
      .select()
      .from(customFieldDefinitions)
      .where(and(eq(customFieldDefinitions.isActive, true), eq(customFieldDefinitions.isRequired, true)));
  }

  async upsertStationFieldValue(stationId: string, fieldDefinitionId: string, valueJson: unknown, executor: any = db) {
    await executor
      .insert(stationCustomFieldValues)
      .values({
        stationId,
        fieldDefinitionId,
        valueJson,
      })
      .onConflictDoUpdate({
        target: [stationCustomFieldValues.stationId, stationCustomFieldValues.fieldDefinitionId],
        set: {
          valueJson,
          updatedAt: new Date(),
        },
      });
  }

  async deleteStationFieldValue(stationId: string, fieldDefinitionId: string, executor: any = db) {
    await executor
      .delete(stationCustomFieldValues)
      .where(
        and(
          eq(stationCustomFieldValues.stationId, stationId),
          eq(stationCustomFieldValues.fieldDefinitionId, fieldDefinitionId),
        ),
      );
  }

  async getStationCustomFieldRows(stationIds: string[]) {
    if (stationIds.length === 0) {
      return [];
    }

    return db
      .select({
        stationId: stationCustomFieldValues.stationId,
        key: customFieldDefinitions.key,
        type: customFieldDefinitions.type,
        valueJson: stationCustomFieldValues.valueJson,
      })
      .from(stationCustomFieldValues)
      .innerJoin(
        customFieldDefinitions,
        eq(stationCustomFieldValues.fieldDefinitionId, customFieldDefinitions.id),
      )
      .where(inArray(stationCustomFieldValues.stationId, stationIds));
  }

  async getStationIdsByFilter(fieldKey: string, value: string) {
    return db
      .select({
        stationId: stationCustomFieldValues.stationId,
      })
      .from(stationCustomFieldValues)
      .innerJoin(
        customFieldDefinitions,
        eq(stationCustomFieldValues.fieldDefinitionId, customFieldDefinitions.id),
      )
      .where(
        and(
          eq(customFieldDefinitions.key, fieldKey),
          eq(customFieldDefinitions.isActive, true),
          eq(customFieldDefinitions.isFilterable, true),
          sql`CAST(${stationCustomFieldValues.valueJson} AS TEXT) ILIKE ${`%${value}%`}`,
        ),
      );
  }
}

export const customFieldsRepository = new CustomFieldsRepository();
