import { formatRecapDuration, type RunRecap } from "./run-recap";

export function buildRunNarrative(recap: RunRecap): string {
  const starter = recap.startParty[0]?.name ?? "your starter";
  const wave = recap.maxWave ?? "?";
  const parts: string[] = [];

  if (recap.status === "active") {
    parts.push(`Mid-run with ${starter} at wave ${wave}.`);
  } else if (recap.result === "win") {
    parts.push(`${starter} reached wave ${wave} for a victory.`);
  } else if (recap.result === "loss") {
    const biomePart = recap.currentBiome ? ` in ${recap.currentBiome}` : "";
    parts.push(`${starter} fell at wave ${wave}${biomePart}.`);
  } else {
    parts.push(`${starter} finished at wave ${wave}.`);
  }

  if (recap.moneyDelta !== 0) {
    const sign = recap.moneyDelta >= 0 ? "+" : "";
    parts.push(`Money ${sign}${recap.moneyDelta} over ${formatRecapDuration(recap.durationMs)}.`);
  }

  if (recap.trainerBattles.length > 0) {
    parts.push(
      recap.trainerBattles.length === 1
        ? `Beat ${recap.trainerBattles[0]}.`
        : `Cleared ${recap.trainerBattles.length} trainer battles.`,
    );
  }

  if (recap.vouchersEarnedThisRun) {
    parts.push(`Earned ${recap.vouchersEarnedThisRun} this run.`);
  }

  if (recap.personalBestNote) {
    parts.push(`${recap.personalBestNote}.`);
  }

  return parts.join(" ");
}
