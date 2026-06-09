import type { GameStateSnapshot } from "../content/game-access/types";
import { isTrackableRunSnapshot, isValidRunId } from "./run-validation";

type PartyMember = GameStateSnapshot["party"][number];
type PartyRosterMember = Pick<PartyMember, "name" | "level" | "speciesId">;

export function parseRunId(runId: string): { seed: string; slot: number } | null {
  const separator = runId.lastIndexOf(":");
  if (separator <= 0) {
    return null;
  }

  const seed = runId.slice(0, separator);
  const slot = Number(runId.slice(separator + 1));
  if (!Number.isFinite(slot)) {
    return null;
  }

  return { seed, slot };
}

/** Multiset of species/levels — ignores party order on the field. */
export function partyRosterFingerprint(party: PartyRosterMember[]): string {
  return JSON.stringify(
    party
      .map((member) => `${member.speciesId ?? member.name}:${member.level ?? "?"}`)
      .sort(),
  );
}

export function partyDetailFingerprint(party: PartyMember[]): string {
  return JSON.stringify(
    party.map((member) => ({
      key: `${member.speciesId ?? member.name}:${member.level ?? "?"}`,
      ability: member.ability ?? "",
      moves: member.moves ?? [],
      heldItems: member.heldItems ?? [],
    })),
  );
}

export function partyOrderFingerprint(party: PartyMember[]): string {
  return JSON.stringify(party);
}

export function isSeedFlicker(
  previous: GameStateSnapshot,
  current: GameStateSnapshot,
  canonicalRunId: string | null,
): boolean {
  if (previous.runId === current.runId) {
    return false;
  }

  if (!isValidRunId(previous.runId) || !isValidRunId(current.runId)) {
    return false;
  }

  const previousSlot = parseRunId(previous.runId)?.slot;
  const currentSlot = parseRunId(current.runId)?.slot;
  if (previousSlot === undefined || currentSlot === undefined || previousSlot !== currentSlot) {
    return false;
  }

  if (previous.wave !== current.wave) {
    return false;
  }

  if (previous.money !== current.money) {
    return false;
  }

  if (partyRosterFingerprint(previous.party) !== partyRosterFingerprint(current.party)) {
    return false;
  }

  if (canonicalRunId && (current.runId === canonicalRunId || previous.runId === canonicalRunId)) {
    return true;
  }

  return true;
}

/** Brief battle-scene drop while the same run continues. */
export function isRunContinuityAfterGap(
  current: GameStateSnapshot,
  canonicalRunId: string | null,
  lastActive: GameStateSnapshot | null,
): boolean {
  if (!canonicalRunId || current.runId !== canonicalRunId) {
    return false;
  }

  if (!isTrackableRunSnapshot(current) || !lastActive) {
    return false;
  }

  if (typeof lastActive.wave === "number" && typeof current.wave === "number" && current.wave < lastActive.wave) {
    return false;
  }

  if (partyRosterFingerprint(lastActive.party) !== partyRosterFingerprint(current.party)) {
    return false;
  }

  return true;
}

export function isLikelyNewRun(
  previous: GameStateSnapshot,
  current: GameStateSnapshot,
  lastActive: GameStateSnapshot | null,
  canonicalRunId: string | null,
): boolean {
  if (isSeedFlicker(previous, current, canonicalRunId)) {
    return false;
  }

  if (
    typeof lastActive?.wave === "number" &&
    typeof current.wave === "number" &&
    current.wave <= 2 &&
    lastActive.wave >= 5
  ) {
    return true;
  }

  if (
    typeof lastActive?.money === "number" &&
    typeof current.money === "number" &&
    current.money <= lastActive.money - 500
  ) {
    return true;
  }

  if (
    lastActive &&
    partyRosterFingerprint(lastActive.party).length > 2 &&
    partyRosterFingerprint(current.party).length > 2 &&
    partyRosterFingerprint(lastActive.party) !== partyRosterFingerprint(current.party) &&
    previous.wave === current.wave
  ) {
    return false;
  }

  return previous.runId !== current.runId;
}
