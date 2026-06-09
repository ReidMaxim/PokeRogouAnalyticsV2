import { formatBiomeName } from "../shared/biome-names";
import {
  buildStarterRecommendationNote,
  type StarterRecommendation,
} from "./starter-recommendation";
import { buildRunNarrative } from "./run-narrative";
import {
  diffVoucherCounts,
  formatVoucherDeltaDisplay,
  voucherSummaryFromEntry,
} from "../shared/voucher-names";
import {
  mergePartyDetails,
  parsePartyAbilities,
  parsePartyHeldItems,
  parsePartyMoves,
} from "../shared/party-detail";
import { partyRosterFingerprint } from "../shared/snapshot-diff";
import type { RunLogEntry, RunResult, RunSummary } from "../storage/run-log-types";

export interface PartyMember {
  name: string;
  level: number | null;
  speciesId: number | null;
  ability?: string | null;
  moves?: string[];
  heldItems?: string[];
}

export interface TimelineNode {
  id: number | string;
  wave: number | null;
  timestamp: string;
  eventType: string;
  label: string;
  party: PartyMember[];
  enemy: PartyMember[];
  money: number | null;
  score: number | null;
  trainerName: string | null;
  biome: string | null;
  changeReasons: string[];
  isEvolution?: boolean;
}

export interface ChartPoint {
  wave: number;
  money: number;
  score: number;
  timestamp: string;
}

export interface RunRecap {
  runId: string;
  status: "active" | "ended";
  result: RunResult | null;
  headline: string;
  durationMs: number;
  maxWave: number | null;
  moneyDelta: number;
  startMoney: number | null;
  finalMoney: number | null;
  finalScore: number | null;
  startParty: PartyMember[];
  currentParty: PartyMember[];
  timelineNodes: TimelineNode[];
  chartSeries: ChartPoint[];
  keyMoments: string[];
  trainerBattles: string[];
  evolutions: string[];
  eventCount: number;
  personalBestNote: string | null;
  currentBiome: string | null;
  modifierCount: number;
  modifierSummary: string;
  vouchersEarnedThisRun: string | null;
  starterRecommendationNote: string | null;
  narrative: string;
  note: string | null;
  trainerBattleLog: TrainerBattleEntry[];
  deathSummary: string | null;
  biomeJourney: BiomeJourneyEntry[];
  modifierAcquisitionLog: ModifierAcquisitionEntry[];
  voucherChangeLog: VoucherChangeEntry[];
  evolutionLog: EvolutionEntry[];
  moneyChangeLog: MoneyChangeEntry[];
  waveMilestones: WaveMilestoneEntry[];
  enemyEncounterLog: EnemyEncounterEntry[];
}

export interface TrainerBattleEntry {
  wave: number | null;
  trainerName: string;
  biome: string | null;
  enemyTeam: string | null;
  isBoss: boolean;
}

export interface BiomeJourneyEntry {
  biome: string;
  fromWave: number | null;
  toWave: number | null;
}

export interface ModifierAcquisitionEntry {
  wave: number | null;
  timestamp: string;
  label: string;
}

export interface VoucherChangeEntry {
  wave: number | null;
  timestamp: string;
  label: string;
}

export interface EvolutionEntry {
  wave: number | null;
  timestamp: string;
  pokemon: string;
  reason: string;
}

export interface MoneyChangeEntry {
  wave: number | null;
  timestamp: string;
  money: number | null;
  label: string;
}

export interface WaveMilestoneEntry {
  wave: number | null;
  timestamp: string;
  label: string;
}

export interface EnemyEncounterEntry {
  wave: number | null;
  timestamp: string;
  trainerName: string | null;
  enemyTeam: string | null;
  label: string;
}

const TIMELINE_EVENT_TYPES = new Set([
  "run_start",
  "run_end",
  "wave_change",
  "trainer_battle",
  "party_change",
  "biome_change",
  "money_change",
  "enemy_change",
  "modifier_change",
  "voucher_change",
]);

function isValidRunId(runId: string): boolean {
  return runId !== "no-scene" && !runId.startsWith("unknown-seed");
}

function getChangeReasons(entry: RunLogEntry): string[] {
  return Array.isArray(entry.changeReasons) ? entry.changeReasons : [];
}

export function parsePartySummary(summary: string | null | undefined): PartyMember[] {
  if (!summary?.trim()) {
    return [];
  }

  return summary.split("|").map((part) => {
    const segments = part.split(":");
    if (segments.length >= 3) {
      const speciesRaw = segments.pop()!.trim();
      const levelRaw = segments.pop()!.trim();
      const name = segments.join(":").trim();
      const level = levelRaw === "?" ? null : Number(levelRaw);
      const speciesId = speciesRaw === "?" ? null : Number(speciesRaw);
      return {
        name,
        level: Number.isFinite(level) ? level : null,
        speciesId: Number.isFinite(speciesId) ? speciesId : null,
      };
    }

    const colon = part.lastIndexOf(":");
    if (colon <= 0) {
      return { name: part.trim(), level: null, speciesId: null };
    }
    const name = part.slice(0, colon).trim();
    const levelRaw = part.slice(colon + 1).trim();
    const level = levelRaw === "?" ? null : Number(levelRaw);
    return { name, level: Number.isFinite(level) ? level : null, speciesId: null };
  });
}

function enrichPartyFromRaw(
  party: PartyMember[],
  rawParty:
    | Array<{
        name: string;
        level: number | null;
        speciesId: number | null;
        ability?: string | null;
        moves?: string[];
        heldItems?: string[];
      }>
    | undefined,
  entry?: RunLogEntry,
  detailSource: "party" | "enemy" = "party",
): PartyMember[] {
  if (rawParty?.length) {
    return party.map((member, index) => ({
      ...member,
      speciesId: member.speciesId ?? rawParty[index]?.speciesId ?? null,
      ability: rawParty[index]?.ability ?? null,
      moves: rawParty[index]?.moves ?? [],
      heldItems: rawParty[index]?.heldItems ?? [],
    }));
  }

  const slotCount = party.length;
  if (slotCount === 0) {
    return party;
  }

  const abilities = parsePartyAbilities(
    detailSource === "enemy" ? entry?.enemyAbilities : entry?.partyAbilities,
    slotCount,
  );
  const moves = parsePartyMoves(
    detailSource === "enemy" ? entry?.enemyMoves : entry?.partyMoves,
    slotCount,
  );
  const heldItems = parsePartyHeldItems(
    detailSource === "enemy" ? entry?.enemyHeldItems : entry?.partyHeldItems,
    slotCount,
  );

  return mergePartyDetails(
    party.map((member) => ({
      name: member.name,
      level: member.level,
      speciesId: member.speciesId,
    })),
    abilities,
    moves,
    heldItems,
  );
}

function resolveBiome(entry: RunLogEntry | undefined): string | null {
  if (!entry) {
    return null;
  }
  return formatBiomeName(entry.biome);
}

function formatDuration(ms: number): string {
  if (ms <= 0) {
    return "0m";
  }
  const minutes = Math.floor(ms / 60_000);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours > 0) {
    return `${hours}h ${remainingMinutes}m`;
  }
  return `${minutes}m`;
}

function isMeaningfulEvent(entry: RunLogEntry): boolean {
  if (!entry.eventType) {
    return typeof entry.wave === "number";
  }
  const reasons = getChangeReasons(entry);
  if (entry.eventType === "run_end" && reasons.some((r) => r.startsWith("Run ended ("))) {
    return false;
  }
  return TIMELINE_EVENT_TYPES.has(entry.eventType);
}

function buildNodeLabel(entry: RunLogEntry): string {
  const reasons = getChangeReasons(entry);
  if (reasons.length > 0) {
    return reasons[0]!;
  }
  if (entry.trainerName) {
    return `Trainer: ${entry.trainerName}`;
  }
  if (entry.eventType) {
    return entry.eventType.replace(/_/g, " ");
  }
  return "Event";
}

function buildEvolutionLog(events: RunLogEntry[]): EvolutionEntry[] {
  const log: EvolutionEntry[] = [];
  let lastRoster = "";

  for (const entry of events) {
    if (entry.eventType !== "party_change" && entry.eventType !== "run_start" && entry.eventType !== "wave_change") {
      continue;
    }

    const roster = partyRosterFingerprint(
      parsePartySummary(entry.partySummary).map((member) => ({
        name: member.name,
        level: member.level,
        speciesId: member.speciesId,
      })),
    );

    if (lastRoster && roster !== lastRoster) {
      const prevEntry = events
        .slice(0, events.indexOf(entry))
        .reverse()
        .find((e) => e.partySummary);
      const prev = parsePartySummary(prevEntry?.partySummary ?? "");
      const curr = parsePartySummary(entry.partySummary);
      const prevNames = new Set(prev.map((p) => `${p.name}:${p.level ?? "?"}`));

      for (const member of curr) {
        const key = `${member.name}:${member.level ?? "?"}`;
        if (!prevNames.has(key)) {
          log.push({
            wave: entry.wave,
            timestamp: entry.timestamp,
            pokemon: member.name,
            reason: getChangeReasons(entry)[0] ?? "party change",
          });
        }
      }
    }

    lastRoster = roster;
  }

  return log;
}

function buildChartSeries(events: RunLogEntry[]): ChartPoint[] {
  const byWave = new Map<number, ChartPoint>();

  for (const entry of events) {
    if (typeof entry.wave !== "number") {
      continue;
    }

    const existing = byWave.get(entry.wave);
    byWave.set(entry.wave, {
      wave: entry.wave,
      money: entry.money ?? existing?.money ?? 0,
      score: entry.score ?? existing?.score ?? 0,
      timestamp: entry.timestamp,
    });
  }

  return [...byWave.values()].sort((a, b) => a.wave - b.wave);
}

function buildHeadline(summary: RunSummary, maxWave: number | null): string {
  const waveLabel = maxWave != null ? `Wave ${maxWave}` : "Run";

  if (summary.outcome === "active") {
    return `${waveLabel} — In progress`;
  }

  if (summary.result === "win") {
    return `${waveLabel} — Victory!`;
  }
  if (summary.result === "loss") {
    return `${waveLabel} — Loss`;
  }

  return `${waveLabel} — Finished`;
}

function formatEnemyTeamSummary(summary: string | null | undefined): string | null {
  const enemy = parsePartySummary(summary);
  if (enemy.length === 0) {
    return null;
  }

  return enemy
    .map((member) => (member.level != null ? `${member.name} Lv${member.level}` : member.name))
    .join(", ");
}

function buildTrainerBattleLog(events: RunLogEntry[]): TrainerBattleEntry[] {
  const log = new Map<string, TrainerBattleEntry>();

  for (const event of events) {
    if (!event.trainerName) {
      continue;
    }

    const key = `${event.wave ?? "?"}:${event.trainerName}`;
    const existing = log.get(key);
    const isBoss = event.isBoss === true || existing?.isBoss === true;

    log.set(key, {
      wave: event.wave,
      trainerName: event.trainerName,
      biome: resolveBiome(event),
      enemyTeam: formatEnemyTeamSummary(event.enemySummary) ?? existing?.enemyTeam ?? null,
      isBoss,
    });
  }

  return [...log.values()];
}

function formatDeathEnemyLine(lastEvent: RunLogEntry): string | null {
  return formatEnemyTeamSummary(lastEvent.enemySummary);
}

function buildDeathSummary(summary: RunSummary, lastEvent: RunLogEntry | undefined): string | null {
  if (summary.outcome !== "ended" || summary.result !== "loss" || !lastEvent) {
    return null;
  }

  const wave = summary.maxWave ?? lastEvent.wave;
  const biome = resolveBiome(lastEvent);
  const trainer = lastEvent.trainerName;
  const enemyLine = formatDeathEnemyLine(lastEvent);
  const enemySuffix = enemyLine ? ` Last enemy: ${enemyLine}.` : "";

  if (trainer && biome) {
    return `Fell to ${trainer} at wave ${wave ?? "?"} in ${biome}.${enemySuffix}`;
  }
  if (trainer) {
    return `Fell to ${trainer} at wave ${wave ?? "?"}${enemySuffix}`;
  }
  if (biome) {
    return `Run ended at wave ${wave ?? "?"} in ${biome}.${enemySuffix}`;
  }

  return wave != null ? `Run ended at wave ${wave}.${enemySuffix}` : null;
}

function buildBiomeJourney(events: RunLogEntry[]): BiomeJourneyEntry[] {
  const journey: BiomeJourneyEntry[] = [];

  for (const event of events) {
    const biome = resolveBiome(event);
    if (!biome) {
      continue;
    }

    const last = journey[journey.length - 1];
    if (last?.biome === biome) {
      if (typeof event.wave === "number") {
        last.toWave = event.wave;
      }
      continue;
    }

    journey.push({
      biome,
      fromWave: event.wave,
      toWave: event.wave,
    });
  }

  return journey;
}

function buildModifierAcquisitionLog(events: RunLogEntry[]): ModifierAcquisitionEntry[] {
  return events
    .filter((event) => event.eventType === "modifier_change")
    .map((event) => ({
      wave: event.wave,
      timestamp: event.timestamp,
      label: getChangeReasons(event)[0] ?? "Modifier inventory changed",
    }));
}

function buildVoucherChangeLog(events: RunLogEntry[]): VoucherChangeEntry[] {
  return events
    .filter((event) => event.eventType === "voucher_change")
    .map((event) => ({
      wave: event.wave,
      timestamp: event.timestamp,
      label: getChangeReasons(event)[0] ?? "Voucher inventory changed",
    }));
}

function buildMoneyChangeLog(events: RunLogEntry[]): MoneyChangeEntry[] {
  return events
    .filter((event) => event.eventType === "money_change")
    .map((event) => ({
      wave: event.wave,
      timestamp: event.timestamp,
      money: event.money,
      label: getChangeReasons(event)[0] ?? "Money changed",
    }));
}

function buildWaveMilestones(events: RunLogEntry[]): WaveMilestoneEntry[] {
  const milestones: WaveMilestoneEntry[] = [];
  const seenTrainerKeys = new Set<string>();
  const seenDecadeWaves = new Set<number>();

  for (const event of events) {
    if (event.eventType === "run_start") {
      milestones.push({
        wave: event.wave,
        timestamp: event.timestamp,
        label: "Run started",
      });
      continue;
    }

    if (event.eventType === "run_end") {
      milestones.push({
        wave: event.wave,
        timestamp: event.timestamp,
        label: `Run ended (${event.runResult ?? "unknown"})`,
      });
      continue;
    }

    if (event.eventType === "biome_change") {
      milestones.push({
        wave: event.wave,
        timestamp: event.timestamp,
        label: `Entered ${resolveBiome(event) ?? "new biome"}`,
      });
    }

    if (event.trainerName) {
      const trainerKey = `${event.wave ?? "?"}:${event.trainerName}`;
      if (!seenTrainerKeys.has(trainerKey)) {
        seenTrainerKeys.add(trainerKey);
        milestones.push({
          wave: event.wave,
          timestamp: event.timestamp,
          label: `Trainer: ${event.trainerName}`,
        });
      }
    }

    if (typeof event.wave === "number" && event.wave > 0 && event.wave % 10 === 0 && !seenDecadeWaves.has(event.wave)) {
      seenDecadeWaves.add(event.wave);
      milestones.push({
        wave: event.wave,
        timestamp: event.timestamp,
        label: `Reached wave ${event.wave}`,
      });
    }
  }

  return milestones.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

function buildEnemyEncounterLog(events: RunLogEntry[]): EnemyEncounterEntry[] {
  return events
    .filter((event) => event.eventType === "enemy_change")
    .map((event) => ({
      wave: event.wave,
      timestamp: event.timestamp,
      trainerName: event.trainerName,
      enemyTeam: formatEnemyTeamSummary(event.enemySummary),
      label: getChangeReasons(event)[0] ?? "Enemy changed",
    }));
}

export function buildRunRecap(
  summary: RunSummary,
  events: RunLogEntry[],
  options?: {
    personalBestNote?: string | null;
    starterRecommendation?: StarterRecommendation | null;
  },
): RunRecap {
  const sorted = [...events]
    .filter((e) => isValidRunId(e.runId))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const meaningful = sorted.filter(isMeaningfulEvent);
  const firstEvent = meaningful[0] ?? sorted[0];
  const lastEvent = meaningful[meaningful.length - 1] ?? sorted[sorted.length - 1];

  const startMs = new Date(summary.startedAt).getTime();
  const endMs = summary.endedAt ? new Date(summary.endedAt).getTime() : Date.now();
  const durationMs = Math.max(0, endMs - startMs);

  const startParty = enrichPartyFromRaw(
    parsePartySummary(firstEvent?.partySummary ?? ""),
    firstEvent?.rawSnapshot?.party,
    firstEvent,
  );
  const currentParty = enrichPartyFromRaw(
    parsePartySummary(lastEvent?.partySummary ?? ""),
    lastEvent?.rawSnapshot?.party,
    lastEvent,
  );

  const startMoney = summary.startMoney ?? firstEvent?.money ?? null;
  const finalMoney = summary.finalMoney ?? lastEvent?.money ?? null;
  const moneyDelta = startMoney != null && finalMoney != null ? finalMoney - startMoney : 0;

  const maxWave = summary.maxWave ?? lastEvent?.wave ?? null;

  const trainerBattles = [
    ...new Set(
      sorted
        .filter((e) => e.trainerName || e.eventType === "trainer_battle")
        .map((e) => e.trainerName)
        .filter((name): name is string => Boolean(name)),
    ),
  ];
  const trainerBattleLog = buildTrainerBattleLog(sorted);
  const deathSummary = buildDeathSummary(summary, lastEvent);
  const biomeJourney = buildBiomeJourney(sorted);
  const modifierAcquisitionLog = buildModifierAcquisitionLog(sorted);
  const voucherChangeLog = buildVoucherChangeLog(sorted);
  const evolutionLog = buildEvolutionLog(sorted);
  const moneyChangeLog = buildMoneyChangeLog(sorted);
  const waveMilestones = buildWaveMilestones(sorted);
  const enemyEncounterLog = buildEnemyEncounterLog(sorted);

  const evolutionTimestamps = new Set(evolutionLog.map((entry) => entry.timestamp));
  const timelineNodes: TimelineNode[] = meaningful.map((entry, index) => ({
    id: entry.id ?? `${entry.timestamp}-${index}`,
    wave: entry.wave,
    timestamp: entry.timestamp,
    eventType: entry.eventType || "snapshot",
    label: buildNodeLabel(entry),
    party: enrichPartyFromRaw(parsePartySummary(entry.partySummary ?? ""), entry.rawSnapshot?.party, entry),
    enemy: enrichPartyFromRaw(
      parsePartySummary(entry.enemySummary ?? ""),
      entry.rawSnapshot?.enemyParty,
      entry,
      "enemy",
    ),
    money: entry.money,
    score: entry.score,
    trainerName: entry.trainerName,
    biome: resolveBiome(entry),
    changeReasons: getChangeReasons(entry),
    isEvolution: evolutionTimestamps.has(entry.timestamp),
  }));

  const keyMoments: string[] = [];
  if (maxWave != null) {
    keyMoments.push(`Reached wave ${maxWave}`);
  }
  if (moneyDelta !== 0) {
    keyMoments.push(`Money ${moneyDelta >= 0 ? "+" : ""}${moneyDelta} (${formatDuration(durationMs)} run)`);
  }
  for (const trainer of trainerBattles.slice(0, 3)) {
    keyMoments.push(`Defeated ${trainer}`);
  }

  for (const evo of evolutionLog.slice(0, 2)) {
    keyMoments.push(`${evo.pokemon} updated (${evo.reason})`);
  }

  const lastModifiers = lastEvent?.modifierSummary ?? lastEvent?.rawSnapshot?.modifierSummary ?? "";
  const modifierCount = lastEvent?.modifierCount ?? lastEvent?.rawSnapshot?.modifierCount ?? 0;
  if (modifierCount > 0 && lastModifiers) {
    const topModifiers = lastModifiers.split("|").slice(0, 3).join(", ");
    keyMoments.push(`${modifierCount} modifier(s): ${topModifiers}`);
  }

  const startVouchers = voucherSummaryFromEntry(sorted.find((e) => e.eventType === "run_start") ?? firstEvent);
  const endVouchers = voucherSummaryFromEntry(lastEvent);
  const vouchersEarned = diffVoucherCounts(startVouchers, endVouchers);
  const vouchersEarnedDisplay = formatVoucherDeltaDisplay(vouchersEarned);
  if (vouchersEarnedDisplay) {
    keyMoments.push(`Vouchers earned: ${vouchersEarnedDisplay}`);
  }

  const starterRecommendationNote = buildStarterRecommendationNote(
    startParty[0] ?? null,
    options?.starterRecommendation ?? null,
  );

  const recapDraft: RunRecap = {
    runId: summary.runId,
    status: summary.outcome ?? "active",
    result: summary.result ?? null,
    headline: buildHeadline(summary, maxWave),
    durationMs,
    maxWave,
    moneyDelta,
    startMoney,
    finalMoney,
    finalScore: lastEvent?.score ?? null,
    startParty,
    currentParty,
    timelineNodes,
    chartSeries: buildChartSeries(sorted),
    keyMoments: (keyMoments ?? []).slice(0, 5),
    trainerBattles: trainerBattles ?? [],
    evolutions: evolutionLog.map((entry) => `${entry.pokemon} updated (${entry.reason})`),
    eventCount: sorted.length,
    personalBestNote: options?.personalBestNote ?? null,
    currentBiome: resolveBiome(lastEvent),
    modifierCount,
    modifierSummary: lastModifiers,
    vouchersEarnedThisRun: vouchersEarnedDisplay,
    starterRecommendationNote,
    narrative: "",
    note: summary.note ?? null,
    trainerBattleLog,
    deathSummary,
    biomeJourney,
    modifierAcquisitionLog,
    voucherChangeLog,
    evolutionLog,
    moneyChangeLog,
    waveMilestones,
    enemyEncounterLog,
  };

  return {
    ...recapDraft,
    narrative: buildRunNarrative(recapDraft),
  };
}

export function formatRecapDuration(ms: number): string {
  return formatDuration(ms);
}

export function runRecapLabel(summary: RunSummary): string {
  const wave = summary.maxWave ?? summary.finalWave;
  const wavePart = wave != null ? `Wave ${wave}` : "Run";
  const date = new Date(summary.startedAt).toLocaleDateString();
  const status = summary.outcome === "active" ? " (active)" : "";
  return `${wavePart} — ${date}${status}`;
}
