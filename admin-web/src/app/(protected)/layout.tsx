'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { useAuth } from '@/lib/auth/auth-context';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => { if (!loading && !user) router.replace('/login'); }, [loading, user, router]);
  if (loading || !user) return <div className='page-status'>Loading workspace...</div>;
  return <AppShell>{children}</AppShell>;
}
