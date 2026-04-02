'use client';

import { ReactNode } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { Role } from '@/types/api';
import { StateCard } from '@/components/ui/state-card';

export function RequireRole({
  roles,
  title = 'Restricted area',
  description = 'Your account does not have permission to use this page.',
  children,
}: {
  roles: Role[];
  title?: string;
  description?: string;
  children: ReactNode;
}) {
  const { hasRole } = useAuth();

  if (!hasRole(roles)) {
    return <StateCard title={title} description={description} tone='warning' />;
  }

  return <>{children}</>;
}
