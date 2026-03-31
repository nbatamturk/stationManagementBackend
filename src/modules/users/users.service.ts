import { hash } from 'bcryptjs';

import type { UserRole } from '../../db/schema';
import { writeAuditLog } from '../../utils/audit-log';
import { AppError } from '../../utils/errors';
import {
  normalizeEmail,
  normalizeOptionalSingleLineText,
  normalizeRequiredSingleLineText,
} from '../../utils/input';

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
    const normalizedFilters: UsersListFilters = {
      ...filters,
      search: normalizeOptionalSingleLineText(filters.search, 'Search', {
        maxLength: 120,
      }) ?? undefined,
    };

    const { rows, total } = await this.repository.list(normalizedFilters);

    return {
      data: rows.map((row) => this.toSafeUser(row)),
      meta: {
        page: normalizedFilters.page,
        limit: normalizedFilters.limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / normalizedFilters.limit),
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
    const normalizedEmail = normalizeEmail(payload.email);
    const normalizedFullName = normalizeRequiredSingleLineText(payload.fullName, 'Full name', {
      maxLength: 150,
      minLength: 2,
    });
    const existingUser = await this.repository.findByEmail(normalizedEmail);

    if (existingUser) {
      throw new AppError('Email already exists', 409, 'USER_EMAIL_EXISTS');
    }

    const passwordHash = await hash(payload.password, PASSWORD_SALT_ROUNDS);

    const created = await this.repository.create({
      email: normalizedEmail,
      fullName: normalizedFullName,
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

    const normalizedPayload = {
      email: payload.email ? normalizeEmail(payload.email) : undefined,
      fullName:
        normalizeOptionalSingleLineText(payload.fullName, 'Full name', {
          maxLength: 150,
          minLength: 2,
        }) ?? undefined,
      password: payload.password,
      role: payload.role,
    };

    if (Object.values(normalizedPayload).every((value) => value === undefined)) {
      return this.toSafeUser(user);
    }

    if (normalizedPayload.email) {
      const duplicate = await this.repository.findByEmailExcludingId(normalizedPayload.email, id);

      if (duplicate) {
        throw new AppError('Email already exists', 409, 'USER_EMAIL_EXISTS');
      }
    }

    const passwordHash = normalizedPayload.password
      ? await hash(normalizedPayload.password, PASSWORD_SALT_ROUNDS)
      : undefined;

    const updated = await this.repository.updateById(id, {
      email: normalizedPayload.email,
      fullName: normalizedPayload.fullName,
      passwordHash,
      role: normalizedPayload.role,
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
        changedFields: Object.entries(normalizedPayload)
          .filter(([, value]) => value !== undefined)
          .map(([key]) => key),
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
