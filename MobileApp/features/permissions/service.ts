import { withDatabase } from '@/database';
import type { AppRole, AppUser, RolePermission } from '@/types';

const defaultRolePermissions: Record<AppRole, string[]> = {
  admin: ['stations:read', 'stations:write', 'settings:write', 'export:run'],
  engineer: ['stations:read', 'stations:write', 'settings:read'],
  viewer: ['stations:read'],
};

type UserRow = {
  id: string;
  username: string;
  displayName: string;
  role: AppRole;
  isActive: number;
  createdAt: string;
  updatedAt: string;
};

const mapUser = (row: UserRow): AppUser => ({
  id: row.id,
  username: row.username,
  displayName: row.displayName,
  role: row.role,
  isActive: row.isActive === 1,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export const getUsers = async (): Promise<AppUser[]> => {
  return withDatabase(async (db) => {
    const rows = await db.getAllAsync<UserRow>(
      `SELECT *
       FROM app_users
       ORDER BY displayName COLLATE NOCASE ASC;`,
    );

    return rows.map(mapUser);
  });
};

export const getRolePermissions = async (role: AppRole): Promise<RolePermission[]> => {
  const customPermissions = await withDatabase(async (db) => {
    return db.getAllAsync<RolePermission>(
      `SELECT role, permissionKey
       FROM role_permissions
       WHERE role = ?
       ORDER BY permissionKey ASC;`,
      role,
    );
  });

  if (customPermissions.length > 0) {
    return customPermissions;
  }

  return (defaultRolePermissions[role] ?? []).map((permissionKey) => ({
    role,
    permissionKey,
  }));
};

export const userHasPermission = async (user: AppUser, permissionKey: string): Promise<boolean> => {
  const permissions = await getRolePermissions(user.role);
  return permissions.some((permission) => permission.permissionKey === permissionKey);
};
