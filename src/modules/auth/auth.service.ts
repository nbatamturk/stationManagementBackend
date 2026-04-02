import type { FastifyJWT } from '@fastify/jwt';
import { compare, hash } from 'bcryptjs';

import { env } from '../../config/env';
import { writeAuditLog } from '../../utils/audit-log';
import { AppError } from '../../utils/errors';
import { normalizeEmail } from '../../utils/input';
import { assertPasswordNotBlank, PASSWORD_SALT_ROUNDS } from '../../utils/password';

import { authRepository, type AuthRepository } from './auth.repository';
import { AuthenticationError } from './auth.errors';

type LoginInput = {
  email: string;
  password: string;
};

type ChangePasswordInput = {
  currentPassword: string;
  newPassword: string;
};

type SignToken = (payload: Pick<FastifyJWT['payload'], 'email' | 'role' | 'sub'>) => string;

const DUMMY_PASSWORD_HASH = '$2b$10$dKMmT5orGRg/PCCRilLruefVLAR2DLT8OLm87MOUCv1y3XNixwkSq';

export class AuthService {
  constructor(private readonly repository: AuthRepository = authRepository) {}

  async login(input: LoginInput, signToken: SignToken) {
    const normalizedEmail = normalizeEmail(input.email);
    const user = await this.repository.findUserByEmail(normalizedEmail);

    if (!user) {
      await compare(input.password, DUMMY_PASSWORD_HASH);
      throw new AuthenticationError('invalid_credentials');
    }

    const passwordMatches = await compare(input.password, user.passwordHash);

    if (!passwordMatches || !user.isActive) {
      throw new AuthenticationError(passwordMatches ? 'inactive_user' : 'invalid_credentials');
    }

    const accessToken = signToken({
      sub: user.id,
      role: user.role,
      email: user.email,
    });

    return {
      accessToken,
      tokenType: 'Bearer' as const,
      expiresIn: env.JWT_EXPIRES_IN,
      session: {
        accessTokenExpiresIn: env.JWT_EXPIRES_IN,
        refreshEndpoint: null,
        refreshTokenEnabled: false,
        sessionVersion: 1 as const,
        strategy: 'jwt-bearer' as const,
      },
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        isActive: user.isActive,
      },
    };
  }

  async me(userId: string) {
    const user = await this.repository.findUserById(userId);

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        isActive: user.isActive,
      },
    };
  }

  async changePassword(userId: string, input: ChangePasswordInput) {
    const user = await this.repository.findUserById(userId);

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    const newPassword = assertPasswordNotBlank(input.newPassword, 'New password');
    const passwordMatches = await compare(input.currentPassword, user.passwordHash);

    if (!passwordMatches) {
      throw new AppError('Current password is incorrect', 400, 'INVALID_CURRENT_PASSWORD');
    }

    const passwordHash = await hash(newPassword, PASSWORD_SALT_ROUNDS);
    const updated = await this.repository.updatePasswordHash(userId, passwordHash);

    if (!updated) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    await writeAuditLog({
      actorUserId: userId,
      entityType: 'user',
      entityId: userId,
      action: 'user.password.changed',
      metadataJson: {
        changedBySelf: true,
      },
    });

    return {
      success: true as const,
    };
  }
}

export const authService = new AuthService();
