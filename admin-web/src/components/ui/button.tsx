import { ButtonHTMLAttributes } from 'react';
import clsx from 'clsx';

export function Button({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={clsx('px-3 py-2 rounded border bg-black text-white disabled:opacity-60', className)} {...props} />;
}
