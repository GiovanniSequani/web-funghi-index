const dateFormatter = new Intl.DateTimeFormat('it-IT', {
  day: '2-digit',
  month: 'short',
});

const longDateFormatter = new Intl.DateTimeFormat('it-IT', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const decimalFormatter = new Intl.NumberFormat('it-IT', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const integerFormatter = new Intl.NumberFormat('it-IT', {
  maximumFractionDigits: 0,
});

function parseIsoDate(value: string): Date {
  return new Date(`${value}T12:00:00`);
}

export function formatShortDate(value: string): string {
  return dateFormatter.format(parseIsoDate(value)).replace('.', '');
}

export function formatLongDate(value: string): string {
  return longDateFormatter.format(parseIsoDate(value));
}

export function formatPeriod(dates: string[]): string {
  if (dates.length === 0) return 'Periodo non disponibile';
  return `${formatLongDate(dates[0])} – ${formatLongDate(dates[dates.length - 1])}`;
}

export function formatDecimal(value: number | null, unit: string): string {
  return value === null ? 'n/d' : `${decimalFormatter.format(value)} ${unit}`;
}

export function formatInteger(value: number | null, unit: string): string {
  return value === null ? 'n/d' : `${integerFormatter.format(value)} ${unit}`;
}
