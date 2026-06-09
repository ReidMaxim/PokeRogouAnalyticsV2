import { formatRecapDuration, parsePartySummary } from "./run-recap";
import type { CrossRunAnalytics } from "./cross-run-analytics";
import { computeCrossRunAnalytics } from "./cross-run-analytics";
import {
  buildStarterRecommendation,
  type StarterRecommendation,
} from "./starter-recommendation";
import { computeWinStreakStats, type WinStreakStats } from "./win-streak";
import type { RunLogEntry, RunSummary } from "../storage/run-log-types";
import {
  formatVoucherCountsDisplay,
  parseVoucherSummary,
  type VoucherCountsSnapshot,
} from "../shared/voucher-names";

export interface DashboardStats {
  totalRuns: number;
  averageWave: number | null;
  winAverageWaveDisplay: string;
  lossAverageWaveDisplay: string;
  winLossWaveDeltaDisplay: string;
  bestWave: number | null;
  topPokemon: { label: string; count: number } | null;
  bestStarter: { label: string; avgWave: number; runs: number } | null;
  personalBestWave: number | null;
  vouchers: VoucherCountsSnapshot | null;
  voucherDisplay: string;
  crossRun: CrossRunAnalytics;
  starterRecommendation: StarterRecommendation | null;
  starterRecommendationDisplay: string;
  winStreaks: WinStreakStats;
  winStreakDisplay: string;
  lossStreakDisplay: string;
  averageDurationDisplay: string;
  activeRuns: number;
  recordDisplay: string;
  pinnedRuns: number;
  topStarterAvgWaveDisplay: string;
  longestRunDisplay: string;
  shortestRunDisplay: string;
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
  if (!startEvent) {
    return null;
  }
  return partyFromEntry(startEvent)[0] ?? null;
}

function memberLabel(member: { name: string; speciesId?: number | null }): string {
  return member.name || (member.speciesId != null ? `#${member.speciesId}` : "Unknown");
}

export function computeDashboardStats(
  runs: RunSummary[],
  allEvents: RunLogEntry[],
  focusRunId?: string | null,
): DashboardStats {
  const maxWaves = runs.map((run) => run.maxWave).filter((wave): wave is number => typeof wave === "number");
  const winWaves = runs
    .filter((run) => run.outcome === "ended" && run.result === "win")
    .map((run) => run.maxWave)
    .filter((wave): wave is number => typeof wave === "number");
  const winAverageWaveDisplay =
    winWaves.length > 0
      ? (winWaves.reduce((sum, wave) => sum + wave, 0) / winWaves.length).toFixed(1)
      : "—";
  const lossWaves = runs
    .filter((run) => run.outcome === "ended" && run.result === "loss")
    .map((run) => run.maxWave)
    .filter((wave): wave is number => typeof wave === "number");
  const lossAverageWaveDisplay =
    lossWaves.length > 0
      ? (lossWaves.reduce((sum, wave) => sum + wave, 0) / lossWaves.length).toFixed(1)
      : "—";
  const winAverageWave =
    winWaves.length > 0 ? winWaves.reduce((sum, wave) => sum + wave, 0) / winWaves.length : null;
  const lossAverageWave =
    lossWaves.length > 0 ? lossWaves.reduce((sum, wave) => sum + wave, 0) / lossWaves.length : null;
  const winLossWaveDeltaDisplay =
    winAverageWave != null && lossAverageWave != null
      ? `${winAverageWave - lossAverageWave >= 0 ? "+" : ""}${(winAverageWave - lossAverageWave).toFixed(1)} vs losses`
      : "—";

  const speciesCounts = new Map<string, { label: string; count: number }>();
  const starterWaves = new Map<string, { label: string; totalWave: number; runs: number }>();

  const eventsByRun = new Map<string, RunLogEntry[]>();
  for (const event of allEvents) {
    const list = eventsByRun.get(event.runId) ?? [];
    list.push(event);
    eventsByRun.set(event.runId, list);
  }

  for (const run of runs) {
    const events = (eventsByRun.get(run.runId) ?? []).sort((a, b) =>
      a.timestamp.localeCompare(b.timestamp),
    );
    const starter = starterFromRun(events);
    const maxWave = run.maxWave;

    if (starter && typeof maxWave === "number") {
      const key = starter.speciesId != null ? `id:${starter.speciesId}` : `name:${starter.name}`;
      const existing = starterWaves.get(key) ?? { label: memberLabel(starter), totalWave: 0, runs: 0 };
      existing.totalWave += maxWave;
      existing.runs += 1;
      starterWaves.set(key, existing);
    }

    for (const event of events) {
      if (event.eventType !== "party_change" && event.eventType !== "run_start" && event.eventType !== "wave_change") {
        continue;
      }
      for (const member of partyFromEntry(event)) {
        const key = member.speciesId != null ? `id:${member.speciesId}` : `name:${member.name}`;
        const existing = speciesCounts.get(key) ?? { label: memberLabel(member), count: 0 };
        existing.count += 1;
        speciesCounts.set(key, existing);
      }
    }
  }

  const topPokemon = [...speciesCounts.values()].sort((a, b) => b.count - a.count)[0] ?? null;

  const bestStarterEntry = [...starterWaves.values()]
    .map((entry) => ({ ...entry, avgWave: entry.totalWave / entry.runs }))
    .filter((entry) => entry.runs >= 1)
    .sort((a, b) => b.avgWave - a.avgWave || b.runs - a.runs)[0];

  const bestStarter = bestStarterEntry
    ? { label: bestStarterEntry.label, avgWave: bestStarterEntry.avgWave, runs: bestStarterEntry.runs }
    : null;

  const personalBestWave = maxWaves.length ? Math.max(...maxWaves) : null;
  const focusRun = focusRunId ? runs.find((run) => run.runId === focusRunId) : null;
  const crossRun = computeCrossRunAnalytics(runs, allEvents);
  const starterRecommendation = buildStarterRecommendation(crossRun);

  const latestVoucherEvent = [...allEvents]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .find((event) => event.voucherSummary || event.rawSnapshot?.voucherSummary);

  const vouchers = latestVoucherEvent
    ? parseVoucherSummary(
        latestVoucherEvent.voucherSummary ?? latestVoucherEvent.rawSnapshot?.voucherSummary ?? "",
      )
    : null;
  const winStreaks = computeWinStreakStats(runs);
  const winStreakDisplay =
    winStreaks.bestWinStreak > 0 || winStreaks.currentWinStreak > 0
      ? `Current ${winStreaks.currentWinStreak} · Best ${winStreaks.bestWinStreak}`
      : "—";
  const lossStreakDisplay =
    winStreaks.bestLossStreak > 0 || winStreaks.currentLossStreak > 0
      ? `Current ${winStreaks.currentLossStreak} · Best ${winStreaks.bestLossStreak}`
      : "—";
  const finishedDurations = runs
    .filter((run) => run.endedAt)
    .map((run) => Math.max(0, new Date(run.endedAt!).getTime() - new Date(run.startedAt).getTime()));
  const averageDurationMs =
    finishedDurations.length > 0
      ? finishedDurations.reduce((sum, duration) => sum + duration, 0) / finishedDurations.length
      : null;
  const averageDurationDisplay =
    averageDurationMs != null ? formatRecapDuration(averageDurationMs) : "—";
  const activeRuns = runs.filter((run) => run.outcome === "active").length;
  const endedWins = runs.filter((run) => run.outcome === "ended" && run.result === "win").length;
  const endedLosses = runs.filter((run) => run.outcome === "ended" && run.result === "loss").length;
  const recordDisplay =
    endedWins + endedLosses > 0 ? `${endedWins}W / ${endedLosses}L` : "—";
  const pinnedRuns = runs.filter((run) => run.pinned).length;
  const topStarterAvgWaveDisplay = bestStarter
    ? `${bestStarter.avgWave.toFixed(1)} (${bestStarter.label})`
    : "—";
  let longestRunMs = 0;
  let longestRun: RunSummary | null = null;
  for (const run of runs) {
    if (!run.endedAt) {
      continue;
    }
    const durationMs = Math.max(0, new Date(run.endedAt).getTime() - new Date(run.startedAt).getTime());
    if (durationMs > longestRunMs) {
      longestRunMs = durationMs;
      longestRun = run;
    }
  }
  const longestRunDisplay = longestRun
    ? `${formatRecapDuration(longestRunMs)} (W${longestRun.maxWave ?? "?"})`
    : "—";
  let shortestRunMs = Number.POSITIVE_INFINITY;
  let shortestRun: RunSummary | null = null;
  for (const run of runs) {
    if (!run.endedAt) {
      continue;
    }
    const durationMs = Math.max(0, new Date(run.endedAt).getTime() - new Date(run.startedAt).getTime());
    if (durationMs < shortestRunMs) {
      shortestRunMs = durationMs;
      shortestRun = run;
    }
  }
  const shortestRunDisplay = shortestRun
    ? `${formatRecapDuration(shortestRunMs)} (W${shortestRun.maxWave ?? "?"})`
    : "—";

  return {
    totalRuns: runs.length,
    averageWave: maxWaves.length ? maxWaves.reduce((sum, wave) => sum + wave, 0) / maxWaves.length : null,
    winAverageWaveDisplay,
    lossAverageWaveDisplay,
    winLossWaveDeltaDisplay,
    bestWave: personalBestWave,
    topPokemon,
    bestStarter,
    personalBestWave:
      focusRun && typeof focusRun.maxWave === "number" && personalBestWave != null
        ? personalBestWave
        : personalBestWave,
    vouchers,
    voucherDisplay: vouchers ? formatVoucherCountsDisplay(vouchers) : "—",
    crossRun,
    starterRecommendation,
    starterRecommendationDisplay: starterRecommendation
      ? `${starterRecommendation.label} (${Math.round(starterRecommendation.winRate * 100)}% · avg ${starterRecommendation.avgWave.toFixed(1)})`
      : "—",
    winStreaks,
    winStreakDisplay,
    lossStreakDisplay,
    averageDurationDisplay,
    activeRuns,
    recordDisplay,
    pinnedRuns,
    topStarterAvgWaveDisplay,
    longestRunDisplay,
    shortestRunDisplay,
  };
}

export function formatPersonalBestNote(
  runMaxWave: number | null,
  globalBestWave: number | null,
): string | null {
  if (runMaxWave == null || globalBestWave == null) {
    return null;
  }
  if (runMaxWave >= globalBestWave) {
    return runMaxWave === globalBestWave && globalBestWave > 0 ? "Personal best!" : null;
  }
  const gap = globalBestWave - runMaxWave;
  return `${gap} wave${gap === 1 ? "" : "s"} below your best (${globalBestWave})`;
}
