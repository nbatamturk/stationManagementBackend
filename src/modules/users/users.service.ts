import { hash } from 'bcryptjs';

import type { UserRole } from '../../db/schema';
import { writeAuditLog } from '../../utils/audit-log';
import { AppError } from '../../utils/errors';

import { usersRepository, type UsersListFilters, type UsersRepository } from './users.repository';

type CreateUserPayload = {
  email: string;
  fullName: string;
  password: string;
  role?: UserRole;
  isActive?: boolean;
};

type UpdateUserPayload = {
  email?: string;
  fullName?: string;
  password?: string;
  role?: UserRole;
};

const PASSWORD_SALT_ROUNDS = 10;

export class UsersService {
  constructor(private readonly repository: UsersRepository = usersRepository) {}

  async list(filters: UsersListFilters) {
    const { rows, total } = await this.repository.list(filters);

    return {
      data: rows.map((row) => this.toSafeUser(row)),
      meta: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / filters.limit),
      },
    };
  }

  async getSafeUserById(userId: string) {
    const user = await this.repository.findById(userId);

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    return this.toSafeUser(user);
  }

  async create(actorUserId: string, payload: CreateUserPayload) {
    const normalizedEmail = payload.email.toLowerCase();
    const existingUser = await this.repository.findByEmail(normalizedEmail);

    if (existingUser) {
      throw new AppError('Email already exists', 409, 'USER_EMAIL_EXISTS');
    }

    const passwordHash = await hash(payload.password, PASSWORD_SALT_ROUNDS);

    const created = await this.repository.create({
      email: normalizedEmail,
      fullName: payload.fullName,
      passwordHash,
      role: payload.role ?? 'operator',
      isActive: payload.isActive ?? true,
    });

    await writeAuditLog({
      actorUserId,
      entityType: 'user',
      entityId: created.id,
      action: 'user.created',
      metadataJson: {
        targetUserId: created.id,
        email: created.email,
        role: created.role,
        isActive: created.isActive,
      },
    });

    return this.toSafeUser(created);
  }

  async update(actorUserId: string, id: string, payload: UpdateUserPayload) {
    const user = await this.repository.findById(id);

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    if (Object.keys(payload).length === 0) {
      return this.toSafeUser(user);
    }

    if (payload.email) {
      const duplicate = await this.repository.findByEmailExcludingId(payload.email, id);

      if (duplicate) {
        throw new AppError('Email already exists', 409, 'USER_EMAIL_EXISTS');
      }
    }

    const passwordHash = payload.password ? await hash(payload.password, PASSWORD_SALT_ROUNDS) : undefined;

    const updated = await this.repository.updateById(id, {
      email: payload.email?.toLowerCase(),
      fullName: payload.fullName,
      passwordHash,
      role: payload.role,
    });

    if (!updated) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    await writeAuditLog({
      actorUserId,
      entityType: 'user',
      entityId: id,
      action: 'user.updated',
      metadataJson: {
        targetUserId: id,
        changedFields: Object.keys(payload),
      },
    });

    return this.toSafeUser(updated);
  }

  async setActive(actorUserId: string, id: string, isActive: boolean) {
    const user = await this.repository.findById(id);

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    const updated = await this.repository.updateById(id, { isActive });

    if (!updated) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    await writeAuditLog({
      actorUserId,
      entityType: 'user',
      entityId: id,
      action: isActive ? 'user.activated' : 'user.deactivated',
      metadataJson: {
        targetUserId: id,
        isActive,
      },
    });

    return this.toSafeUser(updated);
  }

  private toSafeUser(user: {
    id: string;
    email: string;
    fullName: string;
    role: UserRole;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}

export const usersService = new UsersService();
