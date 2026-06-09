import type { CrossRunAnalytics, StarterStat } from "./cross-run-analytics";
import type { PartyMember } from "./run-recap";

export interface StarterRecommendation {
  label: string;
  speciesId: number | null;
  winRate: number;
  avgWave: number;
  runs: number;
  score: number;
  reason: string;
}

function starterScore(stat: StarterStat): number {
  return stat.winRate * 0.6 + Math.min(stat.avgWave / 200, 1) * 0.4;
}

function pickRecommendedStarter(crossRun: CrossRunAnalytics): StarterStat | null {
  if (crossRun.starterStats.length === 0) {
    return null;
  }

  const qualified = crossRun.starterStats.filter((s) => s.runs >= 2);
  if (qualified.length > 0) {
    return [...qualified].sort(
      (a, b) => starterScore(b) - starterScore(a) || b.avgWave - a.avgWave,
    )[0]!;
  }

  return crossRun.starterStats[0] ?? null;
}

export function buildStarterRecommendation(
  crossRun: CrossRunAnalytics,
): StarterRecommendation | null {
  const pick = pickRecommendedStarter(crossRun);
  if (!pick) {
    return null;
  }

  const reason =
    pick.runs >= 2
      ? `${Math.round(pick.winRate * 100)}% win rate across ${pick.runs} runs`
      : `Only ${pick.runs} run logged — more data will refine this`;

  return {
    label: pick.label,
    speciesId: pick.speciesId,
    winRate: pick.winRate,
    avgWave: pick.avgWave,
    runs: pick.runs,
    score: starterScore(pick),
    reason,
  };
}

export function formatStarterRecommendation(rec: StarterRecommendation): string {
  return `${rec.label} (avg wave ${rec.avgWave.toFixed(1)})`;
}

function starterMatches(
  member: PartyMember | null | undefined,
  rec: StarterRecommendation,
): boolean {
  if (!member) {
    return false;
  }
  if (rec.speciesId != null && member.speciesId != null) {
    return rec.speciesId === member.speciesId;
  }
  return member.name.toLowerCase() === rec.label.toLowerCase();
}

export function buildStarterRecommendationNote(
  currentStarter: PartyMember | null | undefined,
  recommendation: StarterRecommendation | null,
): string | null {
  if (!recommendation) {
    return null;
  }

  if (starterMatches(currentStarter, recommendation)) {
    return `You're on your best tracked starter (${formatStarterRecommendation(recommendation)}).`;
  }

  if (currentStarter?.name) {
    return `Tip: ${recommendation.label} has ${recommendation.reason.toLowerCase()}.`;
  }

  return `Recommended starter: ${formatStarterRecommendation(recommendation)} — ${recommendation.reason.toLowerCase()}.`;
}
