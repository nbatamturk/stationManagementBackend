import { HTMLAttributes } from 'react';
import clsx from 'clsx';

type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export function Badge({
  className,
  tone = 'neutral',
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return <span className={clsx('badge', `badge-${tone}`, className)} {...props} />;
}
