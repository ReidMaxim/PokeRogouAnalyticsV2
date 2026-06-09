import { formatRecapDuration, type RunRecap } from "./run-recap";

export interface RunComparisonRow {
  label: string;
  left: string;
  right: string;
  highlight?: "left" | "right" | "none";
}

function fmtWave(value: number | null): string {
  return value != null ? String(value) : "—";
}

function fmtMoney(value: number | null): string {
  return value != null ? String(value) : "—";
}

function fmtResult(recap: RunRecap): string {
  if (recap.status === "active") {
    return "In progress";
  }
  return recap.result?.toUpperCase() ?? "—";
}

function partyLabel(recap: RunRecap): string {
  const party = recap.currentParty.length ? recap.currentParty : recap.startParty;
  if (party.length === 0) {
    return "—";
  }
  return party.map((m) => `${m.name}${m.level != null ? ` Lv${m.level}` : ""}`).join(", ");
}

function starterLabel(recap: RunRecap): string {
  const starter = recap.startParty[0];
  if (!starter) {
    return "—";
  }
  return `${starter.name}${starter.level != null ? ` Lv${starter.level}` : ""}`;
}

export function buildRunComparison(left: RunRecap, right: RunRecap): RunComparisonRow[] {
  const rows: RunComparisonRow[] = [
    {
      label: "Max wave",
      left: fmtWave(left.maxWave),
      right: fmtWave(right.maxWave),
      highlight:
        (left.maxWave ?? -1) > (right.maxWave ?? -1)
          ? "left"
          : (right.maxWave ?? -1) > (left.maxWave ?? -1)
            ? "right"
            : "none",
    },
    {
      label: "Result",
      left: fmtResult(left),
      right: fmtResult(right),
      highlight:
        left.result === "win" && right.result !== "win"
          ? "left"
          : right.result === "win" && left.result !== "win"
            ? "right"
            : "none",
    },
    {
      label: "Duration",
      left: formatRecapDuration(left.durationMs),
      right: formatRecapDuration(right.durationMs),
      highlight: "none",
    },
    {
      label: "Money",
      left: fmtMoney(left.finalMoney),
      right: fmtMoney(right.finalMoney),
      highlight:
        (left.finalMoney ?? -1) > (right.finalMoney ?? -1)
          ? "left"
          : (right.finalMoney ?? -1) > (left.finalMoney ?? -1)
            ? "right"
            : "none",
    },
    {
      label: "Money Δ",
      left: left.moneyDelta >= 0 ? `+${left.moneyDelta}` : String(left.moneyDelta),
      right: right.moneyDelta >= 0 ? `+${right.moneyDelta}` : String(right.moneyDelta),
      highlight:
        left.moneyDelta > right.moneyDelta
          ? "left"
          : right.moneyDelta > left.moneyDelta
            ? "right"
            : "none",
    },
    {
      label: "Score",
      left: fmtMoney(left.finalScore),
      right: fmtMoney(right.finalScore),
      highlight:
        (left.finalScore ?? -1) > (right.finalScore ?? -1)
          ? "left"
          : (right.finalScore ?? -1) > (left.finalScore ?? -1)
            ? "right"
            : "none",
    },
    {
      label: "Starter",
      left: starterLabel(left),
      right: starterLabel(right),
      highlight: "none",
    },
    {
      label: "Biome",
      left: left.currentBiome ?? "—",
      right: right.currentBiome ?? "—",
      highlight: "none",
    },
    {
      label: "Modifiers",
      left: left.modifierCount > 0 ? String(left.modifierCount) : "—",
      right: right.modifierCount > 0 ? String(right.modifierCount) : "—",
      highlight:
        left.modifierCount > right.modifierCount
          ? "left"
          : right.modifierCount > left.modifierCount
            ? "right"
            : "none",
    },
    {
      label: "Final party",
      left: partyLabel(left),
      right: partyLabel(right),
      highlight: "none",
    },
    {
      label: "Events",
      left: String(left.eventCount),
      right: String(right.eventCount),
      highlight: "none",
    },
  ];

  return rows;
}
