const VOUCHER_TYPE_LABELS = ["Regular", "Plus", "Premium", "Golden"] as const;

export interface VoucherCountsSnapshot {
  summary: string;
  total: number;
  counts: Record<string, number>;
}

export function summarizeVoucherCounts(
  raw: Record<number, number> | number[] | null | undefined,
): VoucherCountsSnapshot {
  const counts: Record<string, number> = {};
  let total = 0;

  if (!raw) {
    return { summary: "", total: 0, counts };
  }

  const entries: Array<[number, number]> = Array.isArray(raw)
    ? raw.map((value, index) => [index, typeof value === "number" ? value : 0])
    : Object.entries(raw).map(([key, value]) => [Number(key), typeof value === "number" ? value : 0]);

  for (const [index, amount] of entries) {
    if (amount <= 0) {
      continue;
    }
    const label = VOUCHER_TYPE_LABELS[index]?.toLowerCase() ?? `type${index}`;
    counts[label] = amount;
    total += amount;
  }

  const summary = Object.entries(counts)
    .map(([label, amount]) => `${label}:${amount}`)
    .join("|");

  return { summary, total, counts };
}

export function formatVoucherCountsDisplay(snapshot: VoucherCountsSnapshot): string {
  if (snapshot.total === 0) {
    return "None";
  }

  return Object.entries(snapshot.counts)
    .map(([label, amount]) => `${label.charAt(0).toUpperCase()}${label.slice(1)} ${amount}`)
    .join(" · ");
}

export function parseVoucherSummary(summary: string | null | undefined): VoucherCountsSnapshot {
  if (!summary?.trim()) {
    return { summary: "", total: 0, counts: {} };
  }

  const counts: Record<string, number> = {};
  let total = 0;
  for (const part of summary.split("|")) {
    const colon = part.indexOf(":");
    if (colon <= 0) {
      continue;
    }
    const label = part.slice(0, colon).trim();
    const amount = Number(part.slice(colon + 1));
    if (label && Number.isFinite(amount) && amount > 0) {
      counts[label] = amount;
      total += amount;
    }
  }

  return { summary, total, counts };
}

export function diffVoucherCounts(
  before: VoucherCountsSnapshot,
  after: VoucherCountsSnapshot,
): VoucherCountsSnapshot {
  const counts: Record<string, number> = {};
  let total = 0;
  const labels = new Set([...Object.keys(before.counts), ...Object.keys(after.counts)]);

  for (const label of labels) {
    const delta = (after.counts[label] ?? 0) - (before.counts[label] ?? 0);
    if (delta > 0) {
      counts[label] = delta;
      total += delta;
    }
  }

  const summary = Object.entries(counts)
    .map(([label, amount]) => `${label}:${amount}`)
    .join("|");

  return { summary, total, counts };
}

export function formatVoucherDeltaDisplay(snapshot: VoucherCountsSnapshot): string | null {
  if (snapshot.total <= 0) {
    return null;
  }

  return Object.entries(snapshot.counts)
    .map(([label, amount]) => `+${amount} ${label.charAt(0).toUpperCase()}${label.slice(1)}`)
    .join(", ");
}

export function voucherSummaryFromEntry(entry: {
  voucherSummary?: string | null;
  rawSnapshot?: { voucherSummary?: string | null } | null;
} | null | undefined): VoucherCountsSnapshot {
  if (!entry) {
    return { summary: "", total: 0, counts: {} };
  }
  return parseVoucherSummary(entry.voucherSummary ?? entry.rawSnapshot?.voucherSummary ?? "");
}
