'use client';
import { Button } from './button';

export function ConfirmButton({
  onConfirm,
  label,
  confirmText,
  variant = 'secondary',
}: {
  onConfirm: () => void;
  label: string;
  confirmText: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
}) {
  return <Button type='button' variant={variant} onClick={() => { if (window.confirm(confirmText)) onConfirm(); }}>{label}</Button>;
}
