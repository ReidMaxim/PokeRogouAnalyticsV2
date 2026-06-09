import type { GameStateSnapshot } from "../game-access/types";
import type { RunEventType } from "../../storage/run-log-types";
import {
  isLikelyNewRun,
  isRunContinuityAfterGap,
  isSeedFlicker,
  partyDetailFingerprint,
  partyRosterFingerprint,
} from "../../shared/snapshot-diff";
import {
  isTrackableRunSnapshot,
  isValidRunId,
} from "../../shared/run-validation";

export interface DetectChangesOptions {
  hadActiveRun: boolean;
  canonicalRunId: string | null;
  lastActiveSnapshot: GameStateSnapshot | null;
}

export interface DetectedChange {
  shouldLog: boolean;
  eventType: RunEventType;
  reasons: string[];
  followUp?: {
    eventType: RunEventType;
    reasons: string[];
  };
}

const EVENT_PRIORITY: RunEventType[] = [
  "run_start",
  "run_end",
  "wave_change",
  "trainer_battle",
  "party_change",
  "money_change",
  "biome_change",
  "enemy_change",
  "modifier_change",
  "voucher_change",
];

export function detectChanges(
  previous: GameStateSnapshot | null,
  current: GameStateSnapshot,
  options: DetectChangesOptions,
): DetectedChange {
  const reasons: string[] = [];

  if (!current.battleSceneActive || current.runId === "no-scene") {
    if (options.hadActiveRun && previous?.battleSceneActive && isValidRunId(previous.runId)) {
      reasons.push("Left battle scene (run ended or menu)");
      return { shouldLog: true, eventType: "run_end", reasons };
    }
    return { shouldLog: false, eventType: "run_end", reasons: [] };
  }

  if (
    options.hadActiveRun &&
    options.canonicalRunId &&
    isRunContinuityAfterGap(current, options.canonicalRunId, options.lastActiveSnapshot) &&
    (!previous || !previous.battleSceneActive || previous.runId !== current.runId)
  ) {
    return { shouldLog: false, eventType: "run_start", reasons: [] };
  }

  if (!previous || !previous.battleSceneActive || previous.runId !== current.runId) {
    if (
      previous?.battleSceneActive &&
      previous.runId !== current.runId &&
      options.hadActiveRun &&
      isSeedFlicker(previous, current, options.canonicalRunId)
    ) {
      return { shouldLog: false, eventType: "run_start", reasons: [] };
    }

    if (
      previous?.battleSceneActive &&
      previous.runId !== current.runId &&
      options.hadActiveRun &&
      isValidRunId(previous.runId) &&
      isLikelyNewRun(previous, current, options.lastActiveSnapshot, options.canonicalRunId)
    ) {
      reasons.push(`Run ended (${previous.runId})`);
      return {
        shouldLog: true,
        eventType: "run_end",
        reasons,
        followUp: isTrackableRunSnapshot(current)
          ? { eventType: "run_start", reasons: ["New run detected"] }
          : undefined,
      };
    }

    if (
      previous?.battleSceneActive &&
      previous.runId !== current.runId &&
      options.hadActiveRun &&
      !isLikelyNewRun(previous, current, options.lastActiveSnapshot, options.canonicalRunId)
    ) {
      return { shouldLog: false, eventType: "run_start", reasons: [] };
    }

    if (!isTrackableRunSnapshot(current)) {
      return { shouldLog: false, eventType: "run_start", reasons: [] };
    }

    if (options.hadActiveRun && options.canonicalRunId === current.runId) {
      return { shouldLog: false, eventType: "run_start", reasons: [] };
    }

    reasons.push(
      previous?.runId && previous.runId !== current.runId ? "New run detected" : "Run tracking started",
    );
    return { shouldLog: true, eventType: "run_start", reasons };
  }

  if (previous.wave !== current.wave) {
    reasons.push(`Wave ${previous.wave ?? "?"} → ${current.wave ?? "?"}`);
  }

  if (previous.money !== current.money) {
    reasons.push(`Money ${previous.money ?? "?"} → ${current.money ?? "?"}`);
  }

  if (previous.biome !== current.biome) {
    reasons.push(`Biome ${previous.biome ?? "?"} → ${current.biome ?? "?"}`);
  }

  const partyRosterChanged =
    partyRosterFingerprint(previous.party) !== partyRosterFingerprint(current.party);
  const partyDetailChanged =
    partyDetailFingerprint(previous.party) !== partyDetailFingerprint(current.party);
  if (partyRosterChanged) {
    reasons.push("Party changed");
  } else if (partyDetailChanged) {
    reasons.push("Party moves, ability, or items changed");
  }

  const enemyRosterChanged =
    partyRosterFingerprint(previous.enemyParty) !== partyRosterFingerprint(current.enemyParty);
  const enemyDetailChanged =
    partyDetailFingerprint(previous.enemyParty) !== partyDetailFingerprint(current.enemyParty);
  if (enemyRosterChanged) {
    reasons.push("Enemy lineup changed");
  } else if (enemyDetailChanged) {
    reasons.push("Enemy moves, ability, or items changed");
  }

  const trainerStarted = !previous.trainerName && Boolean(current.trainerName);
  if (trainerStarted) {
    reasons.push(`Trainer battle: ${current.trainerName}`);
  }

  if (previous.modifierSummary !== current.modifierSummary) {
    reasons.push(`Modifiers ${previous.modifierCount ?? 0} → ${current.modifierCount ?? 0}`);
  }

  if (previous.voucherSummary !== current.voucherSummary) {
    reasons.push(`Vouchers ${previous.voucherTotal ?? 0} → ${current.voucherTotal ?? 0}`);
  }

  if (reasons.length === 0) {
    return { shouldLog: false, eventType: "wave_change", reasons: [] };
  }

  const eventTypes: RunEventType[] = [];
  if (previous.wave !== current.wave) {
    eventTypes.push("wave_change");
  }
  if (trainerStarted) {
    eventTypes.push("trainer_battle");
  }
  if (partyRosterChanged || partyDetailChanged) {
    eventTypes.push("party_change");
  }
  if (previous.money !== current.money) {
    eventTypes.push("money_change");
  }
  if (previous.biome !== current.biome) {
    eventTypes.push("biome_change");
  }
  if (enemyRosterChanged || enemyDetailChanged) {
    eventTypes.push("enemy_change");
  }
  if (previous.modifierSummary !== current.modifierSummary) {
    eventTypes.push("modifier_change");
  }
  if (previous.voucherSummary !== current.voucherSummary) {
    eventTypes.push("voucher_change");
  }

  const eventType = pickPrimaryEventType(eventTypes);
  return { shouldLog: true, eventType, reasons };
}

function pickPrimaryEventType(types: RunEventType[]): RunEventType {
  for (const priority of EVENT_PRIORITY) {
    if (types.includes(priority)) {
      return priority;
    }
  }
  return types[0] ?? "wave_change";
}
