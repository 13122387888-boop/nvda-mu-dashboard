const YMD = /^\d{4}-\d{2}-\d{2}$/;

export function isYmd(value: string): boolean {
  if (!YMD.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export function parseYmd(value: string): Date {
  if (!isYmd(value)) throw new Error(`Invalid market date: ${value}`);
  return new Date(`${value}T00:00:00.000Z`);
}

export function dateToYmd(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function addDays(value: string, days: number): string {
  const date = parseYmd(value);
  date.setUTCDate(date.getUTCDate() + days);
  return dateToYmd(date);
}

export function todayYmd(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
