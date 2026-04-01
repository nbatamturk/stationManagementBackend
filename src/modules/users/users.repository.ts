import { and, asc, count, eq, ilike, ne, or, type SQL } from 'drizzle-orm';

import { db } from '../../db/client';
import { users, type UserRole } from '../../db/schema';

type UserInsert = typeof users.$inferInsert;
type UserUpdate = Partial<Omit<UserInsert, 'id' | 'createdAt'>>;

export type UsersListFilters = {
  page: number;
  limit: number;
  role?: UserRole;
  isActive?: boolean;
  search?: string;
};

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

  async findByEmailExcludingId(email: string, excludedId: string) {
    return db.query.users.findFirst({
      where: and(eq(users.email, email.toLowerCase()), ne(users.id, excludedId)),
    });
  }

  async list(filters: UsersListFilters) {
    const conditions: SQL[] = [];

    if (filters.role) {
      conditions.push(eq(users.role, filters.role));
    }

    if (filters.isActive !== undefined) {
      conditions.push(eq(users.isActive, filters.isActive));
    }

    if (filters.search) {
      conditions.push(or(ilike(users.fullName, `%${filters.search}%`), ilike(users.email, `%${filters.search}%`))!);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const countRows = await db.select({ total: count() }).from(users).where(whereClause);
    const total = countRows[0]?.total ?? 0;

    const rows = await db
      .select()
      .from(users)
      .where(whereClause)
      .orderBy(asc(users.fullName), asc(users.createdAt))
      .limit(filters.limit)
      .offset((filters.page - 1) * filters.limit);

    return {
      rows,
      total,
    };
  }

  async create(values: UserInsert) {
    const [created] = await db.insert(users).values(values).returning();

    if (!created) {
      throw new Error('Failed to create user');
    }

    return created;
  }

  async updateById(id: string, values: UserUpdate) {
    const [updated] = await db
      .update(users)
      .set({
        ...values,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();

    return updated;
  }

  async countActiveAdmins(excludedUserId?: string) {
    const conditions: SQL[] = [eq(users.role, 'admin'), eq(users.isActive, true)];

    if (excludedUserId) {
      conditions.push(ne(users.id, excludedUserId));
    }

    const whereClause = and(...conditions);
    const [row] = await db.select({ total: count() }).from(users).where(whereClause);
    return row?.total ?? 0;
  }
}

export const usersRepository = new UsersRepository();
