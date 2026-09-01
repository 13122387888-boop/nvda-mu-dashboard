import { parseYmd } from "@/lib/dates";

export const MAX_OPTION_SNAPSHOT_LAG_BUSINESS_DAYS = 1;

export function businessDaysBetween(startDate: string, endDate: string) {
  const start = parseYmd(startDate);
  const end = parseYmd(endDate);
  if (start > end) return null;
  let count = 0;
  for (const cursor = new Date(start.getTime() + 86_400_000); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    if (cursor.getUTCDay() !== 0 && cursor.getUTCDay() !== 6) count += 1;
  }
  return count;
}

export function optionSnapshotLagBusinessDays(stockDate: string, snapshotDate: string) {
  return businessDaysBetween(snapshotDate, stockDate);
}

export function isRecentOptionSnapshot(
  stockDate: string,
  snapshotDate: string,
  maxBusinessDays = MAX_OPTION_SNAPSHOT_LAG_BUSINESS_DAYS,
) {
  const lag = optionSnapshotLagBusinessDays(stockDate, snapshotDate);
  return lag !== null && lag <= maxBusinessDays;
}
