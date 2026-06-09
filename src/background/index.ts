import { enrichBattleParty, getSpeciesDetail } from "../pokedex/pokeapi-client";
import {
  getPokedexProgressSummary,
  getProgressForNationalId,
  rebuildPokedexProgressFromLogs,
  updateProgressFromRunLog,
} from "../pokedex/pokedex-progress";
import type { BattleSpeciesInput } from "../pokedex/types";
import { createLogger, isExtensionMessage } from "../shared/logger";
import { MESSAGE_SOURCE } from "../shared/constants";
import type { ExtensionMessage, ExtensionSettings } from "../shared/types";
import { autoExportFinishedRun, uploadRunToLeaderboard } from "./auto-export";
import {
  clearAllData,
  deleteRunData,
  deleteRunsByIds,
  deleteUnpinnedRuns,
  exportLogsAsCsv,
  exportLogsAsJson,
  exportRunLogsAsCsv,
  exportRunLogsAsJson,
  exportRunsAsCsv,
  exportPinnedRunsAsJson,
  exportPinnedRunsEventsCsv,
  exportPinnedRunsSummaryCsv,
  exportOutcomeRunsAsJson,
  exportOutcomeRunsEventsCsv,
  exportOutcomeRunsSummaryCsv,
  exportActiveRunsAsJson,
  exportActiveRunsEventsCsv,
  exportActiveRunsSummaryCsv,
  exportRunsByIdsAsJson,
  exportRunsByIdsEventsCsv,
  exportRunsByIdsSummaryCsv,
  importBackupJson,
  setRunsPinned,
  getAllRuns,
  getRunById,
  getCrossRunAnalytics,
  getDashboardStats,
  getRunRecap,
  listRecapRuns,
  saveRunLogEntry,
  toggleRunPinned,
  setRunNote,
} from "../storage/indexeddb";
import type { RunLogEntry } from "../storage/run-log-types";
import { getSettings, onSettingsChanged, updateSettings } from "../storage/settings";

const logger = createLogger("background");

chrome.runtime.onInstalled.addListener(({ reason }) => {
  logger.info("Extension installed/updated", { reason });
  void getSettings().then((settings) => {
    logger.info("Initial settings", settings);
  });
  void rebuildPokedexProgressFromLogs().catch((error) => {
    logger.warn("Pokédex progress backfill failed", error);
  });
});

chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  if (!isExtensionMessage(message)) {
    return false;
  }

  void handleMessage(message, sender).then(sendResponse);
  return true;
});

onSettingsChanged((settings) => {
  logger.debug("Settings changed", settings);
});

async function handleMessage(
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender,
): Promise<unknown> {
  try {
    switch (message.type) {
      case "GET_SETTINGS":
        return getSettings();
      case "SETTINGS_UPDATED": {
        const partial = (message.payload ?? {}) as Partial<ExtensionSettings>;
        return updateSettings(partial);
      }
      case "SAVE_RUN_LOG": {
        const entry = message.payload as RunLogEntry;
        const id = await saveRunLogEntry(entry);
        logger.debug("Run log saved", { id, eventType: entry.eventType, runId: entry.runId });

        void updateProgressFromRunLog(entry).catch((error) => {
          logger.warn("Pokédex progress update failed", { error });
        });

        if (entry.eventType === "run_end") {
          const settings = await getSettings();
          if (settings.autoExportOnRunEnd) {
            void autoExportFinishedRun(entry.runId, settings.autoExportFormat).catch((error) => {
              logger.warn("Auto-export failed", { runId: entry.runId, error });
            });
          }
          // Best-effort upload to configured leaderboard
          void (async () => {
            try {
              const run = await getRunById(entry.runId);
              if (run) {
                await uploadRunToLeaderboard(run);
              }
            } catch (err) {
              logger.warn("Leaderboard upload failed", { runId: entry.runId, error: err });
            }
          })();
        }

        return { ok: true, id };
      }
      case "EXPORT_LOGS_JSON":
        return { ok: true, json: await exportLogsAsJson() };
      case "EXPORT_LOGS_CSV":
        return { ok: true, csv: await exportLogsAsCsv() };
      case "EXPORT_RUNS_CSV":
        return { ok: true, csv: await exportRunsAsCsv() };
      case "EXPORT_RUN_JSON": {
        const runId = (message.payload as { runId?: string } | undefined)?.runId;
        if (!runId) {
          return { ok: false, error: "runId required" };
        }
        return { ok: true, json: await exportRunLogsAsJson(runId) };
      }
      case "EXPORT_RUN_CSV": {
        const runId = (message.payload as { runId?: string } | undefined)?.runId;
        if (!runId) {
          return { ok: false, error: "runId required" };
        }
        return { ok: true, csv: await exportRunLogsAsCsv(runId) };
      }
      case "EXPORT_PINNED_JSON":
        return { ok: true, json: await exportPinnedRunsAsJson() };
      case "EXPORT_PINNED_CSV": {
        const eventsCsv = await exportPinnedRunsEventsCsv();
        const runsCsv = await exportPinnedRunsSummaryCsv();
        return { ok: true, eventsCsv, runsCsv };
      }
      case "EXPORT_OUTCOME_JSON": {
        const outcome = (message.payload as { outcome?: "win" | "loss" } | undefined)?.outcome;
        if (outcome !== "win" && outcome !== "loss") {
          return { ok: false, error: "outcome must be win or loss" };
        }
        return { ok: true, json: await exportOutcomeRunsAsJson(outcome) };
      }
      case "EXPORT_OUTCOME_CSV": {
        const outcome = (message.payload as { outcome?: "win" | "loss" } | undefined)?.outcome;
        if (outcome !== "win" && outcome !== "loss") {
          return { ok: false, error: "outcome must be win or loss" };
        }
        const eventsCsv = await exportOutcomeRunsEventsCsv(outcome);
        const runsCsv = await exportOutcomeRunsSummaryCsv(outcome);
        return { ok: true, eventsCsv, runsCsv };
      }
      case "SET_RUNS_PINNED": {
        const payload = message.payload as { runIds?: string[]; pinned?: boolean } | undefined;
        if (!payload?.runIds?.length || typeof payload.pinned !== "boolean") {
          return { ok: false, error: "runIds and pinned required" };
        }
        const result = await setRunsPinned(payload.runIds, payload.pinned);
        return { ok: true, ...result };
      }
      case "EXPORT_ACTIVE_JSON":
        return { ok: true, json: await exportActiveRunsAsJson() };
      case "EXPORT_ACTIVE_CSV": {
        const eventsCsv = await exportActiveRunsEventsCsv();
        const runsCsv = await exportActiveRunsSummaryCsv();
        return { ok: true, eventsCsv, runsCsv };
      }
      case "EXPORT_RUNS_BY_ID_JSON": {
        const runIds = (message.payload as { runIds?: string[] } | undefined)?.runIds;
        if (!runIds?.length) {
          return { ok: false, error: "runIds required" };
        }
        return { ok: true, json: await exportRunsByIdsAsJson(runIds) };
      }
      case "EXPORT_RUNS_BY_ID_CSV": {
        const runIds = (message.payload as { runIds?: string[] } | undefined)?.runIds;
        if (!runIds?.length) {
          return { ok: false, error: "runIds required" };
        }
        const eventsCsv = await exportRunsByIdsEventsCsv(runIds);
        const runsCsv = await exportRunsByIdsSummaryCsv(runIds);
        return { ok: true, eventsCsv, runsCsv };
      }
      case "DELETE_RUNS": {
        const runIds = (message.payload as { runIds?: string[] } | undefined)?.runIds;
        if (!runIds?.length) {
          return { ok: false, error: "runIds required" };
        }
        const result = await deleteRunsByIds(runIds);
        return { ok: true, ...result };
      }
      case "IMPORT_BACKUP_JSON": {
        const payload = message.payload as { json?: string; merge?: boolean } | undefined;
        if (!payload?.json) {
          return { ok: false, error: "json required" };
        }
        const result = await importBackupJson(payload.json, payload.merge ?? true);
        return { ok: true, ...result };
      }
      case "DELETE_UNPINNED_RUNS": {
        const result = await deleteUnpinnedRuns();
        return { ok: true, ...result };
      }
      case "CLEAR_ALL_DATA": {
        const result = await clearAllData();
        return { ok: true, ...result };
      }
      case "DELETE_RUN": {
        const runId = (message.payload as { runId?: string } | undefined)?.runId;
        if (!runId) {
          return { ok: false, error: "runId required" };
        }
        const result = await deleteRunData(runId);
        return { ok: true, ...result };
      }
      case "PIN_RUN": {
        const runId = (message.payload as { runId?: string } | undefined)?.runId;
        if (!runId) {
          return { ok: false, error: "runId required" };
        }
        const result = await toggleRunPinned(runId);
        return { ok: true, ...result };
      }
      case "SET_RUN_NOTE": {
        const payload = message.payload as { runId?: string; note?: string } | undefined;
        const runId = payload?.runId;
        if (!runId) {
          return { ok: false, error: "runId required" };
        }
        const result = await setRunNote(runId, payload?.note ?? "");
        return { ok: true, ...result };
      }
      case "GET_DASHBOARD_STATS": {
        const runId = (message.payload as { runId?: string } | undefined)?.runId;
        return { ok: true, stats: await getDashboardStats(runId) };
      }
      case "GET_CROSS_RUN_ANALYTICS":
        return { ok: true, analytics: await getCrossRunAnalytics() };
      case "GET_RUN_SUMMARIES":
        return { ok: true, runs: await getAllRuns() };
      case "GET_RUN_RECAP": {
        const runId = (message.payload as { runId?: string } | undefined)?.runId;
        const result = await getRunRecap(runId);
        return { ok: true, ...result };
      }
      case "LIST_RECAP_RUNS":
        return { ok: true, runs: await listRecapRuns() };
      case "ENRICH_BATTLE_SPECIES": {
        const payload = message.payload as
          | { allies?: BattleSpeciesInput[]; enemies?: BattleSpeciesInput[] }
          | undefined;
        const allies = payload?.allies ?? [];
        const enemies = payload?.enemies ?? [];
        const enriched = await enrichBattleParty(allies, enemies);
        return { ok: true, ...enriched };
      }
      case "GET_POKEDEX_PROGRESS":
        return { ok: true, progress: await getPokedexProgressSummary() };
      case "GET_SPECIES_DETAIL": {
        const speciesId = (message.payload as { speciesId?: number } | undefined)?.speciesId;
        if (typeof speciesId !== "number") {
          return { ok: false, error: "speciesId required" };
        }
        const stored = await getProgressForNationalId(speciesId);
        const detail = await getSpeciesDetail(speciesId, stored);
        if (!detail) {
          return { ok: false, error: "Species not found" };
        }
        return { ok: true, detail };
      }
      case "REBUILD_POKEDEX_PROGRESS": {
        const result = await rebuildPokedexProgressFromLogs();
        return { ok: true, ...result };
      }
      case "DISCOVERY_RUN": {
        const tabId = sender.tab?.id;
        if (!tabId) {
          return { ok: false, error: "No active tab" };
        }
        return chrome.tabs.sendMessage(tabId, {
          source: MESSAGE_SOURCE.BACKGROUND,
          type: "DISCOVERY_RUN",
        });
      }
      case "PING":
        return { ok: true, context: "background" };
      default:
        return { ok: false, error: `Unhandled message type: ${message.type}` };
    }
  } catch (error) {
    logger.error("Background message handler failed", { type: message.type, error });
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

logger.info("Background service worker started");
