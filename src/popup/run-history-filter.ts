import type { RunSummary } from "../storage/run-log-types";

export type RunHistoryOutcomeFilter = "all" | "active" | "win" | "loss";

export function matchesOutcomeFilter(run: RunSummary, filter: RunHistoryOutcomeFilter): boolean {
  if (filter === "all") {
    return true;
  }
  if (filter === "active") {
    return run.outcome === "active";
  }
  if (filter === "win") {
    return run.outcome === "ended" && run.result === "win";
  }
  if (filter === "loss") {
    return run.outcome === "ended" && run.result === "loss";
  }
  return true;
}
