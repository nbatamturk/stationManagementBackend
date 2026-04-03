import { eq } from 'drizzle-orm';

import { db } from '../../db/client';
import { mobileAppConfig } from '../../db/schema';

const DEFAULT_CONFIG_KEY = 'default';

type MobileAppConfigInsert = typeof mobileAppConfig.$inferInsert;
type MobileAppConfigUpdate = Partial<
  Pick<
    MobileAppConfigInsert,
    'androidMinimumSupportedVersion' | 'iosMinimumSupportedVersion' | 'updatedBy'
  >
>;

export class MobileAppConfigRepository {
  async get() {
    return db.query.mobileAppConfig.findFirst({
      where: eq(mobileAppConfig.configKey, DEFAULT_CONFIG_KEY),
    });
  }

  async upsert(values: MobileAppConfigUpdate) {
    const [saved] = await db
      .insert(mobileAppConfig)
      .values({
        configKey: DEFAULT_CONFIG_KEY,
        ...values,
      })
      .onConflictDoUpdate({
        target: mobileAppConfig.configKey,
        set: {
          ...values,
          updatedAt: new Date(),
        },
      })
      .returning();

    if (!saved) {
      throw new Error('Failed to save mobile app config');
    }

    return saved;
  }
}

export const mobileAppConfigRepository = new MobileAppConfigRepository();
