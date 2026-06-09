import { exportRunLogsAsCsv, exportRunLogsAsJson } from "../storage/indexeddb";
import type { AutoExportFormat } from "../shared/types";
import { createLogger } from "../shared/logger";
import { getSettings } from "../storage/settings";
import type { RunSummary } from "../storage/run-log-types";

const logger = createLogger("background/auto-export");
const REVOCATION_MS = 60_000;

async function downloadText(filename: string, contents: string, mimeType: string): Promise<void> {
  const blob = new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  try {
    await chrome.downloads.download({ url, filename, saveAs: false });
    globalThis.setTimeout(() => URL.revokeObjectURL(url), REVOCATION_MS);
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

function safeRunId(runId: string): string {
  return runId.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 32);
}

export async function autoExportFinishedRun(runId: string, format: AutoExportFormat): Promise<void> {
  const safeId = safeRunId(runId);

  if (format === "csv" || format === "both") {
    const csv = await exportRunLogsAsCsv(runId);
    await downloadText(`pokerogue-run-${safeId}.csv`, csv, "text/csv");
    logger.info("Auto-exported run CSV", { runId: safeId });
  }

  if (format === "json" || format === "both") {
    const json = await exportRunLogsAsJson(runId);
    await downloadText(`pokerogue-run-${safeId}.json`, json, "application/json");
    logger.info("Auto-exported run JSON", { runId: safeId });
  }
}

export async function uploadRunToLeaderboard(summary: RunSummary): Promise<void> {
  try {
    const settings = await getSettings();
    if (!settings.leaderboardEnabled || !settings.leaderboardUrl || !settings.leaderboardUsername) {
      return;
    }

    const payload = {
      username: settings.leaderboardUsername,
      runId: summary.runId,
      maxWave: summary.maxWave ?? null,
      finalWave: summary.finalWave ?? null,
      startMoney: summary.startMoney ?? null,
      finalMoney: summary.finalMoney ?? null,
      result: summary.result ?? null,
      startedAt: summary.startedAt,
      endedAt: summary.endedAt,
      timestamp: new Date().toISOString(),
    };

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (settings.leaderboardSecret) {
      headers["X-Leaderboard-Secret"] = settings.leaderboardSecret;
    }
    await fetch(settings.leaderboardUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    logger.info("Uploaded run to leaderboard", { runId: summary.runId });
  } catch (err) {
    logger.warn("Leaderboard upload failed", { error: err });
  }
}
