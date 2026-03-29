import type { FastifyJWT } from '@fastify/jwt';
import { compare } from 'bcryptjs';

import { env } from '../../config/env';
import { AppError } from '../../utils/errors';

import { authRepository, type AuthRepository } from './auth.repository';

type LoginInput = {
  email: string;
  password: string;
};

type SignToken = (payload: FastifyJWT['payload']) => string;

export class AuthService {
  constructor(private readonly repository: AuthRepository = authRepository) {}

  async login(input: LoginInput, signToken: SignToken) {
    const user = await this.repository.findUserByEmail(input.email.toLowerCase());

    if (!user) {
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    const passwordMatches = await compare(input.password, user.passwordHash);

    if (!passwordMatches) {
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    if (!user.isActive) {
      throw new AppError('User account is inactive', 403, 'USER_INACTIVE');
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
