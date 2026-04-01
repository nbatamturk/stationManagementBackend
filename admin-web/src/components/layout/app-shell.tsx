'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { Button } from '@/components/ui/button';

const nav = [
  ['Dashboard', '/dashboard'], ['My Tasks', '/my-tasks'], ['Stations', '/stations'], ['Custom Fields', '/custom-fields'], ['Users', '/users'], ['Audit Logs', '/audit-logs'], ['Issues', '/issues'], ['Test History', '/test-history'],
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  return <div style={{display:'grid',gridTemplateColumns:'240px 1fr',minHeight:'100vh'}}>
    <aside style={{borderRight:'1px solid #e5e7eb',padding:16,background:'#fff'}}>
      <h2>Station Admin</h2>
      <div style={{display:'grid',gap:8,marginTop:16}}>{nav.map(([l,href]) => <Link key={href} href={href} style={{fontWeight:pathname.startsWith(href) ? 'bold' : 'normal'}}>{l}</Link>)}</div>
    </aside>
    <main>
      <header style={{padding:16,borderBottom:'1px solid #e5e7eb',background:'#fff',display:'flex',justifyContent:'space-between'}}>
        <div>Welcome, {user?.fullName ?? '-'}</div>
        <Button onClick={() => { logout(); router.push('/login'); }}>Logout</Button>
      </header>
      <div style={{padding:16}}>{children}</div>
    </main>
  </div>;
}
