import { and, asc, eq } from 'drizzle-orm';

import { db } from '../../db/client';
import { stationBrands, stationModels } from '../../db/schema';

type BrandInsert = typeof stationBrands.$inferInsert;
type ModelInsert = typeof stationModels.$inferInsert;

export class StationCatalogRepository {
  async listBrands(executor: any = db) {
    return executor
      .select()
      .from(stationBrands)
      .orderBy(asc(stationBrands.name), asc(stationBrands.id));
  }

  async findBrandById(id: string, executor: any = db) {
    return executor.query.stationBrands.findFirst({
      where: eq(stationBrands.id, id),
    });
  }

  async findBrandByName(name: string, executor: any = db) {
    return executor.query.stationBrands.findFirst({
      where: eq(stationBrands.name, name),
    });
  }

  async createBrand(values: BrandInsert, executor: any = db) {
    const [created] = await executor.insert(stationBrands).values(values).returning();

    if (!created) {
      throw new Error('Failed to create station brand');
    }

    return created;
  }

  async updateBrand(id: string, values: Partial<BrandInsert>, executor: any = db) {
    const [updated] = await executor
      .update(stationBrands)
      .set({
        ...values,
        updatedAt: new Date(),
      })
      .where(eq(stationBrands.id, id))
      .returning();

    return updated;
  }

  async deleteBrand(id: string, executor: any = db) {
    const [deleted] = await executor.delete(stationBrands).where(eq(stationBrands.id, id)).returning();
    return deleted;
  }

  async listModels(executor: any = db) {
    return executor
      .select()
      .from(stationModels)
      .orderBy(asc(stationModels.brandId), asc(stationModels.name), asc(stationModels.id));
  }

  async findModelByBrandAndName(brandId: string, name: string, executor: any = db) {
    return executor.query.stationModels.findFirst({
      where: and(eq(stationModels.brandId, brandId), eq(stationModels.name, name)),
    });
  }

  async findModelById(id: string, executor: any = db) {
    return executor.query.stationModels.findFirst({
      where: eq(stationModels.id, id),
    });
  }

  async createModel(values: ModelInsert, executor: any = db) {
    const [created] = await executor.insert(stationModels).values(values).returning();

    if (!created) {
      throw new Error('Failed to create station model');
    }

    return created;
  }

  async updateModel(id: string, values: Partial<ModelInsert>, executor: any = db) {
    const [updated] = await executor
      .update(stationModels)
      .set({
        ...values,
        updatedAt: new Date(),
      })
      .where(eq(stationModels.id, id))
      .returning();

    return updated;
  }

  async deleteModel(id: string, executor: any = db) {
    const [deleted] = await executor.delete(stationModels).where(eq(stationModels.id, id)).returning();
    return deleted;
  }
}

export const stationCatalogRepository = new StationCatalogRepository();
