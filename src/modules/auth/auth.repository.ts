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
}

export const authRepository = new AuthRepository();
