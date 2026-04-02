import { eq } from 'drizzle-orm';

import { db } from '../../db/client';
import { users } from '../../db/schema';

export class AuthRepository {
  async findUserByEmail(email: string) {
    return db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase()),
    });
  }

  async findUserById(id: string) {
    return db.query.users.findFirst({
      where: eq(users.id, id),
    });
  }

  async updatePasswordHash(userId: string, passwordHash: string) {
    const [updated] = await db
      .update(users)
      .set({
        passwordHash,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    return updated;
  }
}

export const authRepository = new AuthRepository();
