import { eq } from 'drizzle-orm';

import { db } from '../../db/client';
import { users } from '../../db/schema';

export class UsersRepository {
  async findById(id: string) {
    return db.query.users.findFirst({
      where: eq(users.id, id),
    });
  }

  async findByEmail(email: string) {
    return db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase()),
    });
  }
}

export const usersRepository = new UsersRepository();
