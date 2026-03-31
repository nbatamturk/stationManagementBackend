'use client';
import { Button } from './button';

export function ConfirmButton({ onConfirm, label, confirmText }: { onConfirm: () => void; label: string; confirmText: string }) {
  return <Button type='button' onClick={() => { if (window.confirm(confirmText)) onConfirm(); }}>{label}</Button>;
}
