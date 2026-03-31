import { ReactNode } from 'react';

export function TableShell({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return <div className='card'><div style={{display:'flex',justifyContent:'space-between',marginBottom:12}}><h3>{title}</h3>{actions}</div>{children}</div>;
}
