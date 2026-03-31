import type { FastifyJWT } from '@fastify/jwt';
import { compare } from 'bcryptjs';

import { env } from '../../config/env';
import { AppError } from '../../utils/errors';
import { normalizeEmail } from '../../utils/input';

import { authRepository, type AuthRepository } from './auth.repository';
import { AuthenticationError } from './auth.errors';

type LoginInput = {
  email: string;
  password: string;
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
}

export const authService = new AuthService();
