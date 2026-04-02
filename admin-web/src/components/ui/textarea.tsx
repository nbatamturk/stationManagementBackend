import { TextareaHTMLAttributes } from 'react';
import clsx from 'clsx';

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={clsx('input textarea', className)} {...props} />;
}
