import { computeRunTrends, type RunTrendPoint } from "./run-trends";
import { formatBiomeName } from "../shared/biome-names";
import { parsePartySummary } from "./run-recap";
import type { RunLogEntry, RunResult, RunSummary } from "../storage/run-log-types";

export interface StarterStat {
  label: string;
  speciesId: number | null;
  runs: number;
  wins: number;
  losses: number;
  avgWave: number;
  winRate: number;
}

export interface BiomeStat {
  biome: string;
  encounters: number;
  losses: number;
  avgWave: number;
}

export interface CrossRunAnalytics {
  overallWinRate: number | null;
  endedRuns: number;
  starterStats: StarterStat[];
  biomeStats: BiomeStat[];
  bestStarter: StarterStat | null;
  toughestBiome: BiomeStat | null;
  runTrend: RunTrendPoint[];
}

function partyFromEntry(entry: RunLogEntry): ReturnType<typeof parsePartySummary> {
  const fromSummary = parsePartySummary(entry.partySummary);
  const rawParty = entry.rawSnapshot?.party;
  if (!rawParty?.length) {
    return fromSummary;
  }
  return fromSummary.map((member, index) => ({
    ...member,
    speciesId: member.speciesId ?? rawParty[index]?.speciesId ?? null,
  }));
}

function starterFromRun(events: RunLogEntry[]): ReturnType<typeof parsePartySummary>[0] | null {
  const startEvent = events.find((e) => e.eventType === "run_start") ?? events[0];
  return startEvent ? (partyFromEntry(startEvent)[0] ?? null) : null;
}

function memberLabel(member: { name: string; speciesId?: number | null }): string {
  return member.name || (member.speciesId != null ? `#${member.speciesId}` : "Unknown");
}

function starterKey(member: { name: string; speciesId?: number | null }): string {
  return member.speciesId != null ? `id:${member.speciesId}` : `name:${member.name}`;
}

function lastBiomeBeforeEnd(events: RunLogEntry[]): string | null {
  const endIndex = events.findIndex((e) => e.eventType === "run_end");
  const slice = endIndex >= 0 ? events.slice(0, endIndex + 1) : events;

  for (let i = slice.length - 1; i >= 0; i--) {
    const biome = formatBiomeName(slice[i]?.biome);
    if (biome) {
      return biome;
    }
  }

  return null;
}

function isCountedResult(result: RunResult | null | undefined): result is "win" | "loss" {
  return result === "win" || result === "loss";
}

export function computeCrossRunAnalytics(
  runs: RunSummary[],
  allEvents: RunLogEntry[],
): CrossRunAnalytics {
  const eventsByRun = new Map<string, RunLogEntry[]>();
  for (const event of allEvents) {
    const list = eventsByRun.get(event.runId) ?? [];
    list.push(event);
    eventsByRun.set(event.runId, list);
  }

  const starterMap = new Map<
    string,
    { label: string; speciesId: number | null; runs: number; wins: number; losses: number; totalWave: number }
  >();
  const biomeMap = new Map<string, { encounters: number; losses: number; totalWave: number }>();

  let endedRuns = 0;
  let wins = 0;
  let losses = 0;

  for (const run of runs) {
    if (run.outcome !== "ended" || !isCountedResult(run.result)) {
      continue;
    }

    endedRuns += 1;
    if (run.result === "win") {
      wins += 1;
    } else {
      losses += 1;
    }

    const events = (eventsByRun.get(run.runId) ?? []).sort((a, b) =>
      a.timestamp.localeCompare(b.timestamp),
    );
    const starter = starterFromRun(events);
    const maxWave = typeof run.maxWave === "number" ? run.maxWave : 0;

    if (starter) {
      const key = starterKey(starter);
      const existing = starterMap.get(key) ?? {
        label: memberLabel(starter),
        speciesId: starter.speciesId ?? null,
        runs: 0,
        wins: 0,
        losses: 0,
        totalWave: 0,
      };
      existing.runs += 1;
      existing.totalWave += maxWave;
      if (run.result === "win") {
        existing.wins += 1;
      } else {
        existing.losses += 1;
      }
      starterMap.set(key, existing);
    }

    const biome = lastBiomeBeforeEnd(events);
    if (biome) {
      const existing = biomeMap.get(biome) ?? { encounters: 0, losses: 0, totalWave: 0 };
      existing.encounters += 1;
      existing.totalWave += maxWave;
      if (run.result === "loss") {
        existing.losses += 1;
      }
      biomeMap.set(biome, existing);
    }
  }

  const starterStats: StarterStat[] = [...starterMap.values()]
    .map((entry) => ({
      label: entry.label,
      speciesId: entry.speciesId,
      runs: entry.runs,
      wins: entry.wins,
      losses: entry.losses,
      avgWave: entry.runs > 0 ? entry.totalWave / entry.runs : 0,
      winRate: entry.runs > 0 ? entry.wins / entry.runs : 0,
    }))
    .sort((a, b) => b.winRate - a.winRate || b.avgWave - a.avgWave || b.runs - a.runs);

  const biomeStats: BiomeStat[] = [...biomeMap.entries()]
    .map(([biome, entry]) => ({
      biome,
      encounters: entry.encounters,
      losses: entry.losses,
      avgWave: entry.encounters > 0 ? entry.totalWave / entry.encounters : 0,
    }))
    .sort((a, b) => b.losses - a.losses || b.encounters - a.encounters);

  const bestStarter = starterStats.find((s) => s.runs >= 2) ?? starterStats[0] ?? null;
  const toughestBiome =
    biomeStats.find((b) => b.losses >= 2) ??
    biomeStats.filter((b) => b.losses > 0).sort((a, b) => b.losses - a.losses)[0] ??
    null;

  const overallWinRate = endedRuns > 0 ? wins / endedRuns : null;

  return {
    overallWinRate,
    endedRuns,
    starterStats: starterStats.slice(0, 8),
    biomeStats: biomeStats.slice(0, 8),
    bestStarter,
    toughestBiome,
    runTrend: computeRunTrends(runs),
  };
}
