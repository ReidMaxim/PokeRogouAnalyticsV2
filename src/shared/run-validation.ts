import type { GameStateSnapshot } from "../content/game-access/types";
import type { RunResult } from "../storage/run-log-types";

const INVALID_RUN_ID_PREFIXES = ["unknown-seed", "no-scene"] as const;

export function isValidRunId(runId: string | null | undefined): boolean {
  if (!runId) {
    return false;
  }
  return !INVALID_RUN_ID_PREFIXES.some((prefix) => runId === prefix || runId.startsWith(`${prefix}:`));
}

/** Ready to open a run log — valid seed, wave, and money are all present. */
export function isTrackableRunSnapshot(snapshot: GameStateSnapshot): boolean {
  return (
    snapshot.battleSceneActive &&
    isValidRunId(snapshot.runId) &&
    typeof snapshot.wave === "number" &&
    snapshot.wave >= 0 &&
    typeof snapshot.money === "number"
  );
}

export function readPhaseRunResult(
  phase: { constructor?: { name?: string }; isVictory?: boolean } | null | undefined,
): RunResult | null {
  if (!phase?.constructor?.name) {
    return null;
  }

  if (phase.constructor.name === "GameOverPhase") {
    if (phase.isVictory === true) {
      return "win";
    }
    if (phase.isVictory === false) {
      return "loss";
    }
    return "unknown";
  }

  return null;
}

export function isDiscardedRunSummary(summary: {
  runId: string;
  outcome?: string;
  entryCount: number;
  maxWave: number | null;
}): boolean {
  if (!isValidRunId(summary.runId)) {
    return true;
  }

  if (summary.entryCount <= 1 && summary.maxWave === null) {
    return true;
  }

  return false;
}

export function isExportableRunSummary(summary: {
  runId: string;
  entryCount: number;
  maxWave: number | null;
  outcome?: string;
}): boolean {
  return isValidRunId(summary.runId) && !isDiscardedRunSummary(summary);
}
