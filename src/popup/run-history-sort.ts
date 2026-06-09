import type { RunSummary } from "../storage/run-log-types";

export type RunHistorySort =
  | "newest"
  | "oldest"
  | "highest-wave"
  | "lowest-wave"
  | "wins-first"
  | "longest-first"
  | "shortest-first";

function runDurationMs(run: RunSummary): number {
  const start = new Date(run.startedAt).getTime();
  const end = run.endedAt ? new Date(run.endedAt).getTime() : Date.now();
  return Math.max(0, end - start);
}

export function sortRunHistory(runs: RunSummary[], sort: RunHistorySort): RunSummary[] {
  const sorted = [...runs];

  sorted.sort((a, b) => {
    if (Boolean(b.pinned) !== Boolean(a.pinned)) {
      return a.pinned ? -1 : 1;
    }

    if (sort === "oldest") {
      return a.startedAt.localeCompare(b.startedAt);
    }

    if (sort === "highest-wave") {
      const waveDiff = (b.maxWave ?? 0) - (a.maxWave ?? 0);
      if (waveDiff !== 0) {
        return waveDiff;
      }
      return (b.endedAt ?? b.startedAt).localeCompare(a.endedAt ?? a.startedAt);
    }

    if (sort === "lowest-wave") {
      const waveDiff = (a.maxWave ?? 0) - (b.maxWave ?? 0);
      if (waveDiff !== 0) {
        return waveDiff;
      }
      return (b.endedAt ?? b.startedAt).localeCompare(a.endedAt ?? a.startedAt);
    }

    if (sort === "wins-first") {
      const score = (run: RunSummary): number => {
        if (run.outcome === "active") {
          return 1;
        }
        if (run.result === "win") {
          return 3;
        }
        if (run.result === "loss") {
          return 0;
        }
        return 2;
      };
      const resultDiff = score(b) - score(a);
      if (resultDiff !== 0) {
        return resultDiff;
      }
      return (b.endedAt ?? b.startedAt).localeCompare(a.endedAt ?? a.startedAt);
    }

    if (sort === "longest-first") {
      const durationDiff = runDurationMs(b) - runDurationMs(a);
      if (durationDiff !== 0) {
        return durationDiff;
      }
      return (b.endedAt ?? b.startedAt).localeCompare(a.endedAt ?? a.startedAt);
    }

    if (sort === "shortest-first") {
      const durationDiff = runDurationMs(a) - runDurationMs(b);
      if (durationDiff !== 0) {
        return durationDiff;
      }
      return (b.endedAt ?? b.startedAt).localeCompare(a.endedAt ?? a.startedAt);
    }

    return (b.endedAt ?? b.startedAt).localeCompare(a.endedAt ?? a.startedAt);
  });

  return sorted;
}
