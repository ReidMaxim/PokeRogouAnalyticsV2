import { formatBiomeName } from "../shared/biome-names";
import {
  formatPartyAbilities,
  formatPartyHeldItems,
  formatPartyMoves,
  mergePartyDetails,
} from "../shared/party-detail";
import type { GameStateSnapshot } from "../content/game-access/types";

export type RunResult = "win" | "loss" | "unknown";

export type RunEventType =
  | "run_start"
  | "run_end"
  | "wave_change"
  | "money_change"
  | "party_change"
  | "biome_change"
  | "enemy_change"
  | "trainer_battle"
  | "modifier_change"
  | "voucher_change";

export interface RunLogEntry {
  id?: number;
  timestamp: string;
  runId: string;
  eventType: RunEventType;
  changeReasons: string[];
  wave: number | null;
  biome: string | null;
  money: number | null;
  score: number | null;
  phase: string | null;
  trainerName: string | null;
  battleType: number | null;
  isBoss: boolean | null;
  partyCount: number;
  partySummary: string;
  partyAbilities?: string;
  partyMoves?: string;
  partyHeldItems?: string;
  enemySummary: string;
  enemyAbilities?: string;
  enemyMoves?: string;
  enemyHeldItems?: string;
  modifierCount?: number;
  modifierSummary?: string;
  voucherTotal?: number;
  voucherSummary?: string;
  runResult?: RunResult | null;
  rawSnapshot?: GameStateSnapshot;
}

export interface RunSummary {
  runId: string;
  startedAt: string;
  endedAt: string | null;
  outcome: "active" | "ended";
  result: RunResult | null;
  finalWave: number | null;
  maxWave: number | null;
  startMoney: number | null;
  finalMoney: number | null;
  entryCount: number;
  starterLabel?: string | null;
  lastBiome?: string | null;
  pinned?: boolean;
  note?: string | null;
}

export function formatPartySummary(
  party: Array<{
    name: string;
    level: number | null;
    speciesId: number | null;
    ability?: string | null;
    moves?: string[];
    heldItems?: string[];
  }>,
): string {
  if (!party.length) {
    return "";
  }
  return party.map((p) => `${p.name}:${p.level ?? "?"}:${p.speciesId ?? "?"}`).join("|");
}

function detailFieldsFromParty(party: GameStateSnapshot["party"]): {
  abilities: string;
  moves: string;
  heldItems: string;
} {
  const detailed = mergePartyDetails(
    party,
    party.map((member) => member.ability ?? ""),
    party.map((member) => member.moves ?? []),
    party.map((member) => member.heldItems ?? []),
  );
  return {
    abilities: formatPartyAbilities(detailed),
    moves: formatPartyMoves(detailed),
    heldItems: formatPartyHeldItems(detailed),
  };
}

function partyDetailFields(party: GameStateSnapshot["party"]): {
  partyAbilities: string;
  partyMoves: string;
  partyHeldItems: string;
} {
  const details = detailFieldsFromParty(party);
  return {
    partyAbilities: details.abilities,
    partyMoves: details.moves,
    partyHeldItems: details.heldItems,
  };
}

function enemyDetailFields(enemyParty: GameStateSnapshot["enemyParty"]): {
  enemyAbilities: string;
  enemyMoves: string;
  enemyHeldItems: string;
} {
  const details = detailFieldsFromParty(enemyParty);
  return {
    enemyAbilities: details.abilities,
    enemyMoves: details.moves,
    enemyHeldItems: details.heldItems,
  };
}

export function snapshotToLogEntry(
  snapshot: GameStateSnapshot,
  eventType: RunEventType,
  changeReasons: string[],
  runResult?: RunResult | null,
): RunLogEntry {
  const partyDetails = partyDetailFields(snapshot.party);
  const enemyDetails = enemyDetailFields(snapshot.enemyParty);
  return {
    timestamp: snapshot.timestamp,
    runId: snapshot.runId,
    eventType,
    changeReasons,
    wave: snapshot.wave,
    biome: formatBiomeName(snapshot.biome),
    money: snapshot.money,
    score: snapshot.score,
    phase: snapshot.phase,
    trainerName: snapshot.trainerName,
    battleType: snapshot.battleType,
    isBoss: snapshot.isBoss,
    partyCount: snapshot.party.length,
    partySummary: formatPartySummary(snapshot.party),
    partyAbilities: partyDetails.partyAbilities || undefined,
    partyMoves: partyDetails.partyMoves || undefined,
    partyHeldItems: partyDetails.partyHeldItems || undefined,
    enemySummary: formatPartySummary(snapshot.enemyParty),
    enemyAbilities: enemyDetails.enemyAbilities || undefined,
    enemyMoves: enemyDetails.enemyMoves || undefined,
    enemyHeldItems: enemyDetails.enemyHeldItems || undefined,
    modifierCount: snapshot.modifierCount,
    modifierSummary: snapshot.modifierSummary || undefined,
    voucherTotal: snapshot.voucherTotal,
    voucherSummary: snapshot.voucherSummary || undefined,
    runResult: runResult ?? null,
    rawSnapshot: snapshot,
  };
}
