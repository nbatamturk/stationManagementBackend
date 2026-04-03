'use client';
import { Button } from './button';

export function ConfirmButton({
  onConfirm,
  label,
  confirmText,
  variant = 'secondary',
  disabled = false,
}: {
  onConfirm: () => void;
  label: string;
  confirmText: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
}) {
  return (
    <Button
      type='button'
      variant={variant}
      disabled={disabled}
      onClick={() => {
        if (window.confirm(confirmText)) {
          onConfirm();
        }
      }}
    >
      {label}
    </Button>
  );
}
