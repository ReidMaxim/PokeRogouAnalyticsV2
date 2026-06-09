import { createLogger } from "../../shared/logger";
import { isSeedFlicker } from "../../shared/snapshot-diff";
import type { RunLogEntry, RunResult } from "../../storage/run-log-types";
import { snapshotToLogEntry, type RunEventType } from "../../storage/run-log-types";
import { buildGameStateSnapshot, getBattleScene } from "../game-access/battle-scene-access";
import { getCapturedGame } from "../game-access/phaser-hook";
import type { GameStateSnapshot } from "../game-access/types";
import { detectChanges } from "./change-detector";
import { isTrackableRunSnapshot, isValidRunId } from "../../shared/run-validation";

const logger = createLogger("collectors/run-state");

export type CollectorLogHandler = (entry: RunLogEntry) => void;

export class RunStateCollector {
  private enabled = false;
  private timer: number | null = null;
  private lastSnapshot: GameStateSnapshot | null = null;
  private lastActiveSnapshot: GameStateSnapshot | null = null;
  private trackingRun = false;
  private canonicalRunId: string | null = null;
  private lastRunResultHint: RunResult | null = null;

  constructor(private readonly onLog: CollectorLogHandler) {}

  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) {
      return;
    }
    this.enabled = enabled;
    logger.info(`Run state collection ${enabled ? "enabled" : "disabled"}`);

    if (enabled) {
      this.startPolling();
    } else {
      this.stopPolling();
    }
  }

  private startPolling(): void {
    this.stopPolling();
    this.tick();
    this.timer = window.setInterval(() => this.tick(), 1500);
  }

  private stopPolling(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  private tick(): void {
    if (!this.enabled) {
      return;
    }

    const rawSnapshot = buildGameStateSnapshot();
    if (!rawSnapshot) {
      return;
    }

    const snapshot = this.stabilizeRunId(rawSnapshot);

    if (snapshot.runResultHint && snapshot.runResultHint !== "unknown") {
      this.lastRunResultHint = snapshot.runResultHint;
    }

    if (isTrackableRunSnapshot(snapshot)) {
      this.lastActiveSnapshot = snapshot;
      if (!this.canonicalRunId && isValidRunId(snapshot.runId)) {
        this.canonicalRunId = snapshot.runId;
      }
    }

    const change = detectChanges(this.lastSnapshot, snapshot, {
      hadActiveRun: this.trackingRun,
      canonicalRunId: this.canonicalRunId,
      lastActiveSnapshot: this.lastActiveSnapshot,
    });

    if (change.shouldLog) {
      this.emitLog(snapshot, change.eventType, change.reasons);

      if (change.followUp) {
        this.emitLog(snapshot, change.followUp.eventType, change.followUp.reasons);
      }
    }

    this.lastSnapshot = snapshot;
  }

  private stabilizeRunId(snapshot: GameStateSnapshot): GameStateSnapshot {
    if (!this.lastSnapshot || !this.canonicalRunId) {
      return snapshot;
    }

    if (snapshot.runId === this.canonicalRunId) {
      return snapshot;
    }

    if (isSeedFlicker(this.lastSnapshot, snapshot, this.canonicalRunId)) {
      return { ...snapshot, runId: this.canonicalRunId };
    }

    return snapshot;
  }

  private emitLog(snapshot: GameStateSnapshot, eventType: RunEventType, reasons: string[]): void {
    let entrySnapshot = snapshot;
    let runResult: RunResult | null = null;

    if (eventType === "run_end") {
      entrySnapshot = {
        ...(this.lastActiveSnapshot ?? this.lastSnapshot ?? snapshot),
        timestamp: snapshot.timestamp,
        runId: this.canonicalRunId ?? this.lastActiveSnapshot?.runId ?? snapshot.runId,
      };
      runResult = this.lastRunResultHint ?? entrySnapshot.runResultHint ?? "unknown";
      this.trackingRun = false;
      this.canonicalRunId = null;
      this.lastRunResultHint = null;
    } else if (eventType === "run_start") {
      this.trackingRun = true;
      this.canonicalRunId = snapshot.runId;
      this.lastRunResultHint = null;
    }

    const entry = snapshotToLogEntry(entrySnapshot, eventType, reasons, runResult);
    logger.info("Run event logged", {
      eventType: entry.eventType,
      wave: entry.wave,
      runId: entry.runId,
      runResult: entry.runResult,
      reasons: entry.changeReasons,
    });
    this.onLog(entry);
  }

  forceSample(): RunLogEntry | null {
    const snapshot = buildGameStateSnapshot();
    if (!snapshot || !isTrackableRunSnapshot(snapshot)) {
      return null;
    }
    return snapshotToLogEntry(snapshot, "run_start", ["Manual sample"]);
  }
}

export function getCollectorDiagnostics(): Record<string, unknown> {
  return {
    gameCaptured: Boolean(getCapturedGame()),
    battleScene: Boolean(getBattleScene()),
    state: buildGameStateSnapshot(),
  };
}
