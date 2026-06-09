import { runRecapLabel } from "./run-recap";
import type { RunResult, RunSummary } from "../storage/run-log-types";

export interface RunTrendPoint {
  runIndex: number;
  runId: string;
  label: string;
  endedAt: string;
  result: "win" | "loss";
  maxWave: number | null;
  cumulativeWinRate: number;
}

function isCountedResult(result: RunResult | null | undefined): result is "win" | "loss" {
  return result === "win" || result === "loss";
}

export function computeRunTrends(runs: RunSummary[]): RunTrendPoint[] {
  const ended = runs
    .filter((run) => run.outcome === "ended" && isCountedResult(run.result))
    .sort((a, b) => {
      const aTime = a.endedAt ?? a.startedAt;
      const bTime = b.endedAt ?? b.startedAt;
      return aTime.localeCompare(bTime);
    });

  let wins = 0;
  const points: RunTrendPoint[] = [];

  for (let index = 0; index < ended.length; index += 1) {
    const run = ended[index]!;
    if (run.result === "win") {
      wins += 1;
    }

    points.push({
      runIndex: index + 1,
      runId: run.runId,
      label: runRecapLabel(run),
      endedAt: run.endedAt ?? run.startedAt,
      result: run.result as "win" | "loss",
      maxWave: run.maxWave,
      cumulativeWinRate: wins / (index + 1),
    });
  }

  return points;
}
