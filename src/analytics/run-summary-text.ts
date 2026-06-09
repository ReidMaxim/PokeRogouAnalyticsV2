import {
  formatRecapDuration,
  runRecapLabel,
  type EnemyEncounterEntry,
  type RunRecap,
  type TrainerBattleEntry,
  type WaveMilestoneEntry,
} from "./run-recap";
import type { RunSummary } from "../storage/run-log-types";

function formatEnemyTeamLine(enemyTeam: string | null | undefined): string {
  return enemyTeam?.trim() ? enemyTeam : "—";
}

function formatMoneySwingLines(recap: RunRecap): string[] {
  const log = recap.moneyChangeLog;
  if (log.length === 0) {
    return [];
  }

  const swings: { magnitude: number; line: string }[] = [];
  let previousMoney: number | null = null;

  for (const entry of log) {
    if (entry.money != null && previousMoney != null) {
      const delta = entry.money - previousMoney;
      if (delta !== 0) {
        swings.push({
          magnitude: Math.abs(delta),
          line: `- W${entry.wave ?? "?"} ${delta >= 0 ? "+" : ""}${delta} → $${entry.money} (${entry.label})`,
        });
      }
    }
    if (entry.money != null) {
      previousMoney = entry.money;
    }
  }

  if (swings.length === 0) {
    return log.slice(0, 6).map(
      (entry) => `- W${entry.wave ?? "?"} $${entry.money ?? "?"} (${entry.label})`,
    );
  }

  return swings
    .sort((a, b) => b.magnitude - a.magnitude)
    .slice(0, 6)
    .map((entry) => entry.line);
}

const TRAINER_BATTLE_SUMMARY_LIMIT = 8;
const ENEMY_ENCOUNTER_SUMMARY_LIMIT = 8;
const WAVE_MILESTONE_SUMMARY_LIMIT = 10;

function milestonePriority(entry: WaveMilestoneEntry): number {
  if (entry.label.startsWith("Run started") || entry.label.startsWith("Run ended")) {
    return 0;
  }
  if (entry.label.startsWith("Trainer:")) {
    return 1;
  }
  if (entry.label.startsWith("Entered")) {
    return 2;
  }
  return 3;
}

function selectWaveMilestonesForSummary(
  milestones: WaveMilestoneEntry[],
  max = WAVE_MILESTONE_SUMMARY_LIMIT,
): { entries: WaveMilestoneEntry[]; remaining: number } {
  const selected = [...milestones]
    .sort(
      (a, b) =>
        milestonePriority(a) - milestonePriority(b) || a.timestamp.localeCompare(b.timestamp),
    )
    .slice(0, max)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return { entries: selected, remaining: Math.max(0, milestones.length - selected.length) };
}

function selectTrainerBattlesForSummary(
  battles: TrainerBattleEntry[],
  max = TRAINER_BATTLE_SUMMARY_LIMIT,
): { entries: TrainerBattleEntry[]; remaining: number } {
  const bosses = battles.filter((battle) => battle.isBoss);
  const others = battles.filter((battle) => !battle.isBoss);
  const selected = [...bosses, ...others].slice(0, max);
  return { entries: selected, remaining: Math.max(0, battles.length - selected.length) };
}

function selectEnemyEncountersForSummary(
  encounters: EnemyEncounterEntry[],
  max = ENEMY_ENCOUNTER_SUMMARY_LIMIT,
): { entries: EnemyEncounterEntry[]; remaining: number } {
  const withTrainer = encounters.filter((entry) => entry.trainerName);
  const withoutTrainer = encounters.filter((entry) => !entry.trainerName);
  const selected = [...withTrainer, ...withoutTrainer].slice(0, max);
  return { entries: selected, remaining: Math.max(0, encounters.length - selected.length) };
}

export function formatRunSummaryText(recap: RunRecap, summary?: RunSummary | null): string {
  const lines: string[] = [recap.headline];

  if (summary) {
    lines.push(runRecapLabel(summary));
  }

  if (recap.narrative) {
    lines.push("", recap.narrative);
  }

  if (recap.deathSummary) {
    lines.push("", recap.deathSummary);
  }

  if (recap.note) {
    lines.push("", `Note: ${recap.note}`);
  }

  lines.push(
    "",
    `Duration: ${formatRecapDuration(recap.durationMs)}`,
    `Max wave: ${recap.maxWave ?? "—"}`,
    `Money: ${recap.startMoney ?? "—"} → ${recap.finalMoney ?? "—"} (${recap.moneyDelta >= 0 ? "+" : ""}${recap.moneyDelta})`,
    `Score: ${recap.finalScore ?? "—"}`,
    `Biome: ${recap.currentBiome ?? "—"}`,
  );

  if (recap.vouchersEarnedThisRun) {
    lines.push(`Vouchers earned: ${recap.vouchersEarnedThisRun}`);
  }

  if (recap.biomeJourney.length > 0) {
    lines.push(
      "",
      "Biome journey:",
      ...recap.biomeJourney.map((entry) => {
        const range =
          entry.fromWave != null && entry.toWave != null
            ? `W${entry.fromWave}–${entry.toWave}`
            : entry.fromWave != null
              ? `from W${entry.fromWave}`
              : "—";
        return `- ${entry.biome} (${range})`;
      }),
    );
  }

  if (recap.modifierCount > 0 && recap.modifierSummary) {
    lines.push(
      `Modifiers (${recap.modifierCount}): ${recap.modifierSummary.split("|").join(", ")}`,
    );
  }

  if (recap.modifierAcquisitionLog.length > 0) {
    lines.push(
      "",
      "Modifier changes:",
      ...recap.modifierAcquisitionLog.slice(0, 10).map(
        (entry) => `- W${entry.wave ?? "?"} ${entry.label}`,
      ),
    );
    if (recap.modifierAcquisitionLog.length > 10) {
      lines.push(`- …and ${recap.modifierAcquisitionLog.length - 10} more`);
    }
  }

  if (recap.voucherChangeLog.length > 0) {
    lines.push(
      "",
      "Voucher changes:",
      ...recap.voucherChangeLog.slice(0, 10).map(
        (entry) => `- W${entry.wave ?? "?"} ${entry.label}`,
      ),
    );
    if (recap.voucherChangeLog.length > 10) {
      lines.push(`- …and ${recap.voucherChangeLog.length - 10} more`);
    }
  }

  const moneySwings = formatMoneySwingLines(recap);
  if (moneySwings.length > 0) {
    lines.push("", "Top money swings:", ...moneySwings);
  }

  if (recap.moneyChangeLog.length > 0) {
    lines.push(
      "",
      "Money history:",
      ...recap.moneyChangeLog.slice(0, 10).map(
        (entry) => `- W${entry.wave ?? "?"} $${entry.money ?? "?"} (${entry.label})`,
      ),
    );
    if (recap.moneyChangeLog.length > 10) {
      lines.push(`- …and ${recap.moneyChangeLog.length - 10} more`);
    }
  }

  if (recap.startParty.length > 0) {
    lines.push(
      "",
      "Start party:",
      ...recap.startParty.map((member) =>
        member.level != null ? `- ${member.name} Lv${member.level}` : `- ${member.name}`,
      ),
    );
  }

  if (recap.currentParty.length > 0) {
    lines.push(
      "",
      recap.status === "active" ? "Current party:" : "End party:",
      ...recap.currentParty.map((member) =>
        member.level != null ? `- ${member.name} Lv${member.level}` : `- ${member.name}`,
      ),
    );
  }

  if (recap.evolutionLog.length > 0) {
    lines.push(
      "",
      "Party evolutions:",
      ...recap.evolutionLog.map(
        (entry) => `- W${entry.wave ?? "?"} ${entry.pokemon} (${entry.reason})`,
      ),
    );
  }

  if (recap.trainerBattleLog.length > 0) {
    const { entries, remaining } = selectTrainerBattlesForSummary(recap.trainerBattleLog);
    lines.push("", "Trainer battles:");
    for (const battle of entries) {
      const bossTag = battle.isBoss ? " [BOSS]" : "";
      lines.push(
        `- W${battle.wave ?? "?"} ${battle.trainerName}${bossTag}${battle.biome ? ` (${battle.biome})` : ""}: ${formatEnemyTeamLine(battle.enemyTeam)}`,
      );
    }
    if (remaining > 0) {
      lines.push(`- …and ${remaining} more trainer battle(s)`);
    }
  }

  if (recap.waveMilestones.length > 0) {
    const { entries, remaining } = selectWaveMilestonesForSummary(recap.waveMilestones);
    lines.push(
      "",
      "Wave milestones:",
      ...entries.map((entry) => `- W${entry.wave ?? "?"} ${entry.label}`),
    );
    if (remaining > 0) {
      lines.push(`- …and ${remaining} more milestone(s)`);
    }
  }

  if (recap.enemyEncounterLog.length > 0) {
    const { entries, remaining } = selectEnemyEncountersForSummary(recap.enemyEncounterLog);
    lines.push(
      "",
      "Enemy encounters:",
      ...entries.map((entry) => {
        const trainer = entry.trainerName ? ` vs ${entry.trainerName}` : "";
        const team = entry.enemyTeam ? `: ${entry.enemyTeam}` : "";
        return `- W${entry.wave ?? "?"}${trainer}${team || `: ${entry.label}`}`;
      }),
    );
    if (remaining > 0) {
      lines.push(`- …and ${remaining} more encounter(s)`);
    }
  }

  if (recap.keyMoments.length > 0) {
    lines.push("", "Key moments:", ...recap.keyMoments.map((moment) => `- ${moment}`));
  }

  if (summary?.runId) {
    lines.push("", `Run ID: ${summary.runId}`);
  }

  return lines.filter((line, index, all) => line !== "" || all[index - 1] !== "").join("\n").trim();
}
