import { ReactNode } from 'react';
import clsx from 'clsx';

type StateTone = 'neutral' | 'success' | 'warning' | 'danger';

export function StateCard({
  title,
  description,
  action,
  tone = 'neutral',
}: {
  title: string;
  description: string;
  action?: ReactNode;
  tone?: StateTone;
}) {
  return (
    <div className={clsx('card', 'state-card', `state-card-${tone}`)}>
      <div>
        <h3>{title}</h3>
        <p className='muted'>{description}</p>
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}
