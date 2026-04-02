import { ReactNode } from 'react';

export function TableShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className='card table-shell'>
      <div className='table-shell-header'>
        <div>
          <h3>{title}</h3>
          {description ? <p className='muted'>{description}</p> : null}
        </div>
        {actions ? <div className='table-shell-actions'>{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}
