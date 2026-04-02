'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const navigation = [
  {
    title: 'Operations',
    items: [
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Stations', href: '/stations' },
      { label: 'Issues', href: '/issues' },
      { label: 'Test History', href: '/test-history' },
    ],
  },
  {
    title: 'Administration',
    adminOnly: true,
    items: [
      { label: 'Custom Fields', href: '/custom-fields' },
      { label: 'Users', href: '/users' },
      { label: 'Audit Logs', href: '/audit-logs' },
    ],
  },
];

function formatWorkspaceContext(pathname: string, currentLabel: string | undefined, sectionTitle: string | undefined) {
  const segments = pathname.split('/').filter(Boolean);
  const contextParts: string[] = [];

  if (sectionTitle) {
    contextParts.push(sectionTitle);
  }

  if (currentLabel) {
    contextParts.push(currentLabel);
  }

  if (segments.includes('new')) {
    contextParts.push('New');
  } else if (segments.includes('edit')) {
    contextParts.push('Edit');
  } else if (segments.length > 1) {
    contextParts.push('Detail');
  }

  return contextParts.join(' / ') || 'Operations';
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout, isAdmin } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const visibleSections = navigation.filter((section) => !section.adminOnly || isAdmin);
  const currentItem = visibleSections.flatMap((section) => section.items).find((item) => pathname.startsWith(item.href));
  const currentSection = visibleSections.find((section) => section.items.some((item) => pathname.startsWith(item.href)));
  const workspaceContext = formatWorkspaceContext(pathname, currentItem?.label, currentSection?.title);

  return (
    <div className='app-shell'>
      <aside className='app-sidebar'>
        <div className='app-brand'>
          <p className='eyebrow'>Station Operations</p>
          <h2>Admin Panel</h2>
          <p className='muted'>Daily workflows for stations, issues, and audit visibility.</p>
        </div>

        <nav className='sidebar-nav'>
          {visibleSections.map((section) => (
            <div key={section.title} className='nav-section'>
              <p className='nav-section-title'>{section.title}</p>
              <div className='nav-links'>
                {section.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={pathname.startsWith(item.href) ? 'nav-link nav-link-active' : 'nav-link'}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <main className='app-main'>
        <header className='app-topbar'>
          <div className='topbar-context'>
            <p className='eyebrow'>Current workspace</p>
            <p className='topbar-context-text'>{workspaceContext}</p>
          </div>

          <div className='topbar-user'>
            <div>
              <p>{user?.fullName ?? 'Unknown user'}</p>
              <p className='muted'>{user?.email ?? '-'}</p>
            </div>
            {user?.role ? <Badge tone={isAdmin ? 'warning' : 'info'}>{user.role}</Badge> : null}
            <Button variant='secondary' onClick={() => { logout(); router.push('/login'); }}>Logout</Button>
          </div>
        </header>

        <div className='app-content'>{children}</div>
      </main>
    </div>
  );
}
