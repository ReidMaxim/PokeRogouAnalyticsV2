import type { RunSummary } from "../storage/run-log-types";

export interface WinStreakStats {
  currentWinStreak: number;
  bestWinStreak: number;
  currentLossStreak: number;
  bestLossStreak: number;
}

export function computeWinStreakStats(runs: RunSummary[]): WinStreakStats {
  const ended = runs
    .filter((run) => run.outcome === "ended" && (run.result === "win" || run.result === "loss"))
    .sort((a, b) => (a.endedAt ?? a.startedAt).localeCompare(b.endedAt ?? b.startedAt));

  let currentWinStreak = 0;
  let bestWinStreak = 0;
  let currentLossStreak = 0;
  let bestLossStreak = 0;

  for (const run of ended) {
    if (run.result === "win") {
      currentWinStreak += 1;
      currentLossStreak = 0;
      bestWinStreak = Math.max(bestWinStreak, currentWinStreak);
      continue;
    }

    currentLossStreak += 1;
    currentWinStreak = 0;
    bestLossStreak = Math.max(bestLossStreak, currentLossStreak);
  }

  return {
    currentWinStreak,
    bestWinStreak,
    currentLossStreak,
    bestLossStreak,
  };
}
