export function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return 'Not available';
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function formatDate(value: string | null | undefined) {
  if (!value) {
    return 'Not available';
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
  }).format(new Date(value));
}

export function formatRelativeTime(value: string | null | undefined) {
  if (!value) {
    return 'Not available';
  }

  const deltaMs = new Date(value).getTime() - Date.now();
  const absMs = Math.abs(deltaMs);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;

  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

  if (absMs < hour) {
    return formatter.format(Math.round(deltaMs / minute), 'minute');
  }

  if (absMs < day) {
    return formatter.format(Math.round(deltaMs / hour), 'hour');
  }

  if (absMs < week) {
    return formatter.format(Math.round(deltaMs / day), 'day');
  }

  return formatter.format(Math.round(deltaMs / week), 'week');
}

export function formatEnumLabel(value: string) {
  return value
    .replaceAll('.', ' ')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function formatCustomValue(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return 'Not set';
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  if (typeof value === 'number') {
    return value.toLocaleString();
  }

  if (typeof value === 'string') {
    if (!Number.isNaN(Date.parse(value)) && value.includes('T')) {
      return formatDateTime(value);
    }

    return value;
  }

  return JSON.stringify(value, null, 2);
}

export function toDateInputValue(value: string | null | undefined) {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toISOString().slice(0, 10);
}

export function parseDateInputValue(value: string) {
  if (!value) {
    return null;
  }

  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

export function stringifyJson(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  return JSON.stringify(value, null, 2);
}
