export type DataAlignment =
  | { status: "MISSING_OPTIONS" }
  | { status: "ALIGNED" }
  | { status: "MISMATCH"; stockIsNewer: boolean };

export function getDataAlignment(stockDate: string, optionsSnapshotDate: string | null): DataAlignment {
  if (!optionsSnapshotDate) return { status: "MISSING_OPTIONS" };
  if (stockDate === optionsSnapshotDate) return { status: "ALIGNED" };
  return { status: "MISMATCH", stockIsNewer: stockDate > optionsSnapshotDate };
}
