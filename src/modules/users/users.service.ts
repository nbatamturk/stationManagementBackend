import { AppError } from '../../utils/errors';

import { usersRepository, type UsersRepository } from './users.repository';

export class UsersService {
  constructor(private readonly repository: UsersRepository = usersRepository) {}

  async getSafeUserById(userId: string) {
    const user = await this.repository.findById(userId);

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

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
