import { SelectHTMLAttributes } from 'react';
import clsx from 'clsx';

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={clsx('input', 'select-input', className)} {...props} />;
}
