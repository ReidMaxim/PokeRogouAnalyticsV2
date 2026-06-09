import { buildRunRecap } from "../analytics/run-recap";
import type { RunRecap } from "../analytics/run-recap";
import {
  computeDashboardStats,
  formatPersonalBestNote,
} from "../analytics/dashboard-stats";
import { computeCrossRunAnalytics } from "../analytics/cross-run-analytics";
import { buildStarterRecommendation } from "../analytics/starter-recommendation";
import { formatBiomeName } from "../shared/biome-names";
import {
  isDiscardedRunSummary,
  isExportableRunSummary,
  isValidRunId,
} from "../shared/run-validation";
import { createLogger } from "../shared/logger";
import type { RunLogEntry, RunSummary } from "./run-log-types";

const logger = createLogger("storage/indexeddb");
const DB_NAME = "pokerogue-analytics";
const DB_VERSION = 3;

export type { RunLogEntry, RunSummary } from "./run-log-types";
export type { RunRecap } from "../analytics/run-recap";
export { runRecapLabel } from "../analytics/run-recap";

export async function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      const oldVersion = event.oldVersion;

      if (!db.objectStoreNames.contains("runLogs")) {
        db.createObjectStore("runLogs", { keyPath: "id", autoIncrement: true });
      }

      if (!db.objectStoreNames.contains("runs")) {
        db.createObjectStore("runs", { keyPath: "runId" });
      }

      if (oldVersion < 2) {
        const tx = event.target ? (event.target as IDBOpenDBRequest).transaction : null;
        if (tx) {
          const logStore = tx.objectStore("runLogs");
          if (!logStore.indexNames.contains("runId")) {
            logStore.createIndex("runId", "runId", { unique: false });
          }
          if (!logStore.indexNames.contains("timestamp")) {
            logStore.createIndex("timestamp", "timestamp", { unique: false });
          }
        }
      }

      if (!db.objectStoreNames.contains("pokeapiCache")) {
        db.createObjectStore("pokeapiCache", { keyPath: "key" });
      }

      if (!db.objectStoreNames.contains("pokedexProgress")) {
        db.createObjectStore("pokedexProgress", { keyPath: "speciesId" });
      }

      logger.info("IndexedDB schema initialized", { version: DB_VERSION });
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveRunLogEntry(entry: RunLogEntry): Promise<number | null> {
  if (!isValidRunId(entry.runId)) {
    logger.debug("Skipping log for invalid runId", { runId: entry.runId, eventType: entry.eventType });
    return null;
  }

  const db = await openDatabase();
  const id = await new Promise<number>((resolve, reject) => {
    const tx = db.transaction("runLogs", "readwrite");
    const store = tx.objectStore("runLogs");
    const request = store.add(entry);
    request.onsuccess = () => resolve(request.result as number);
    request.onerror = () => reject(request.error);
  });

  await updateRunSummaryFromEntry(entry);

  if (entry.eventType === "run_start") {
    await cleanupDiscardedRuns();
  }

  return id;
}

async function updateRunSummaryFromEntry(entry: RunLogEntry): Promise<void> {
  const db = await openDatabase();
  const existing = await new Promise<RunSummary | undefined>((resolve, reject) => {
    const tx = db.transaction("runs", "readonly");
    const request = tx.objectStore("runs").get(entry.runId);
    request.onsuccess = () => resolve(request.result as RunSummary | undefined);
    request.onerror = () => reject(request.error);
  });

  const wave = entry.wave;
  const summary: RunSummary = existing ?? {
    runId: entry.runId,
    startedAt: entry.timestamp,
    endedAt: null,
    outcome: "active",
    result: null,
    finalWave: wave,
    maxWave: wave,
    startMoney: entry.money,
    finalMoney: entry.money,
    entryCount: 0,
  };

  summary.entryCount += 1;
  summary.finalMoney = entry.money;
  summary.finalWave = wave;

  if (typeof wave === "number") {
    summary.maxWave =
      typeof summary.maxWave === "number" ? Math.max(summary.maxWave, wave) : wave;
  }

  if (entry.eventType === "run_start" && !existing) {
    summary.startedAt = entry.timestamp;
    summary.startMoney = entry.money;
    const starterName = entry.partySummary.split("|")[0]?.split(":")[0]?.trim();
    if (starterName) {
      summary.starterLabel = starterName;
    }
  }

  if (entry.eventType === "run_end") {
    summary.endedAt = entry.timestamp;
    summary.outcome = "ended";
    summary.result = entry.runResult ?? "unknown";
  }

  if (entry.biome) {
    summary.lastBiome = formatBiomeName(entry.biome);
  }

  if (isDiscardedRunSummary(summary)) {
    await deleteRunSummary(entry.runId);
    return;
  }

  await putRunSummary(summary);
}

async function putRunSummary(summary: RunSummary): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("runs", "readwrite");
    const request = tx.objectStore("runs").put(summary);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function deleteRunSummary(runId: string): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("runs", "readwrite");
    const request = tx.objectStore("runs").delete(runId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function deleteLogsForRun(runId: string): Promise<void> {
  const db = await openDatabase();
  const logs = await getAllRunLogs();
  const toDelete = logs.filter((log) => log.runId === runId && log.id !== undefined);

  if (toDelete.length === 0) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("runLogs", "readwrite");
    const store = tx.objectStore("runLogs");
    for (const log of toDelete) {
      store.delete(log.id!);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getAllRunsRaw(): Promise<RunSummary[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("runs", "readonly");
    const request = tx.objectStore("runs").getAll();
    request.onsuccess = () => resolve(request.result as RunSummary[]);
    request.onerror = () => reject(request.error);
  });
}

async function cleanupDiscardedRuns(): Promise<void> {
  const runs = await getAllRunsRaw();
  const discarded = runs.filter((run) => isDiscardedRunSummary(run));

  for (const run of discarded) {
    await deleteRunSummary(run.runId);
    await deleteLogsForRun(run.runId);
    logger.debug("Removed discarded run", { runId: run.runId });
  }
}

export async function getAllRunLogs(): Promise<RunLogEntry[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("runLogs", "readonly");
    const request = tx.objectStore("runLogs").getAll();
    request.onsuccess = () => resolve(request.result as RunLogEntry[]);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllRuns(): Promise<RunSummary[]> {
  await cleanupDiscardedRuns();
  const runs = await getAllRunsRaw();
  return runs.filter((run) => isExportableRunSummary(run));
}

export async function getRunById(runId: string): Promise<RunSummary | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("runs", "readonly");
    const request = tx.objectStore("runs").get(runId);
    request.onsuccess = () => resolve((request.result as RunSummary | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
}

export async function getEventsForRun(runId: string): Promise<RunLogEntry[]> {
  const logs = await getAllRunLogs();
  return logs
    .filter((log) => log.runId === runId && isValidRunId(log.runId))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

function resolveLastBiomeFromEvents(events: RunLogEntry[]): string | null {
  const sorted = [...events].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const endIndex = sorted.findIndex((event) => event.eventType === "run_end");
  const slice = endIndex >= 0 ? sorted.slice(0, endIndex + 1) : sorted;

  for (let index = slice.length - 1; index >= 0; index--) {
    const biome = formatBiomeName(slice[index]?.biome);
    if (biome) {
      return biome;
    }
  }

  return null;
}

async function backfillRunSummaryBiomes(): Promise<void> {
  const runs = await getAllRunsRaw();
  const needsBackfill = runs.filter((run) => !run.lastBiome);
  if (needsBackfill.length === 0) {
    return;
  }

  const allEvents = await getAllRunLogs();
  const eventsByRun = new Map<string, RunLogEntry[]>();
  for (const event of allEvents) {
    const list = eventsByRun.get(event.runId) ?? [];
    list.push(event);
    eventsByRun.set(event.runId, list);
  }

  for (const run of needsBackfill) {
    const lastBiome = resolveLastBiomeFromEvents(eventsByRun.get(run.runId) ?? []);
    if (!lastBiome) {
      continue;
    }

    await putRunSummary({ ...run, lastBiome });
  }
}

export async function listRecapRuns(): Promise<RunSummary[]> {
  await cleanupDiscardedRuns();
  await backfillRunSummaryBiomes();
  const runs = await getAllRunsRaw();
  return runs
    .filter((run) => isValidRunId(run.runId) && run.entryCount >= 1 && !isDiscardedRunSummary(run))
    .sort((a, b) => {
      if (Boolean(b.pinned) !== Boolean(a.pinned)) {
        return a.pinned ? -1 : 1;
      }
      const aTime = a.endedAt ?? a.startedAt;
      const bTime = b.endedAt ?? b.startedAt;
      return bTime.localeCompare(aTime);
    });
}

export async function toggleRunPinned(runId: string): Promise<{ pinned: boolean }> {
  const run = await getRunById(runId);
  if (!run) {
    throw new Error("Run not found");
  }

  const pinned = !run.pinned;
  await putRunSummary({ ...run, pinned });
  return { pinned };
}

export async function setRunPinned(runId: string, pinned: boolean): Promise<{ pinned: boolean }> {
  const run = await getRunById(runId);
  if (!run) {
    throw new Error("Run not found");
  }

  await putRunSummary({ ...run, pinned });
  return { pinned };
}

export async function setRunsPinned(
  runIds: string[],
  pinned: boolean,
): Promise<{ updated: number }> {
  let updated = 0;

  for (const runId of runIds) {
    const run = await getRunById(runId);
    if (!run || Boolean(run.pinned) === pinned) {
      continue;
    }

    await putRunSummary({ ...run, pinned });
    updated += 1;
  }

  return { updated };
}

export async function setRunNote(runId: string, note: string): Promise<{ note: string | null }> {
  const run = await getRunById(runId);
  if (!run) {
    throw new Error("Run not found");
  }

  const trimmed = note.trim();
  const nextNote = trimmed.length > 0 ? trimmed : null;
  await putRunSummary({ ...run, note: nextNote });
  return { note: nextNote };
}

export async function resolveRecapRun(preferredRunId?: string): Promise<RunSummary | null> {
  if (preferredRunId) {
    const run = await getRunById(preferredRunId);
    if (run && isValidRunId(run.runId) && run.entryCount >= 1) {
      return run;
    }
    return null;
  }

  const runs = await listRecapRuns();
  return runs[0] ?? null;
}

export async function getRunRecap(preferredRunId?: string): Promise<{
  recap: RunRecap | null;
  summary: RunSummary | null;
  eventCount: number;
}> {
  const summary = await resolveRecapRun(preferredRunId);
  if (!summary) {
    return { recap: null, summary: null, eventCount: 0 };
  }

  const events = await getEventsForRun(summary.runId);
  if (events.length === 0) {
    return { recap: null, summary, eventCount: 0 };
  }

  const allRuns = await getAllRuns();
  const allEvents = (await getAllRunLogs()).filter((log) => isValidRunId(log.runId));
  const dashboard = computeDashboardStats(allRuns, allEvents, summary.runId);
  const personalBestNote = formatPersonalBestNote(summary.maxWave, dashboard.bestWave);
  const starterRecommendation = dashboard.starterRecommendation;

  return {
    recap: buildRunRecap(summary, events, { personalBestNote, starterRecommendation }),
    summary,
    eventCount: events.length,
  };
}

export async function getCrossRunAnalytics() {
  const runs = await getAllRuns();
  const events = (await getAllRunLogs()).filter((log) => isValidRunId(log.runId));
  return computeCrossRunAnalytics(runs, events);
}

export async function getDashboardStats(focusRunId?: string | null) {
  const runs = await getAllRuns();
  const events = (await getAllRunLogs()).filter((log) => isValidRunId(log.runId));
  return computeDashboardStats(runs, events, focusRunId);
}

export async function deleteRunData(runId: string): Promise<{ eventsRemoved: number }> {
  const logs = await getAllRunLogs();
  const eventsRemoved = logs.filter((log) => log.runId === runId).length;
  await deleteLogsForRun(runId);
  await deleteRunSummary(runId);
  logger.info("Deleted run data", { runId, eventsRemoved });
  return { eventsRemoved };
}

export async function deleteUnpinnedRuns(): Promise<{ runsRemoved: number; eventsRemoved: number }> {
  const runs = (await getAllRunsRaw()).filter((run) => !run.pinned && isExportableRunSummary(run));
  let eventsRemoved = 0;

  for (const run of runs) {
    const result = await deleteRunData(run.runId);
    eventsRemoved += result.eventsRemoved;
  }

  logger.info("Deleted unpinned runs", { runsRemoved: runs.length, eventsRemoved });
  return { runsRemoved: runs.length, eventsRemoved };
}

export async function deleteRunsByIds(
  runIds: string[],
): Promise<{ runsRemoved: number; eventsRemoved: number }> {
  let eventsRemoved = 0;
  let runsRemoved = 0;

  for (const runId of runIds) {
    const run = await getRunById(runId);
    if (!run) {
      continue;
    }
    const result = await deleteRunData(runId);
    runsRemoved += 1;
    eventsRemoved += result.eventsRemoved;
  }

  logger.info("Deleted runs by id", { runsRemoved, eventsRemoved });
  return { runsRemoved, eventsRemoved };
}

export async function clearAllData(): Promise<{ runsRemoved: number; eventsRemoved: number }> {
  const db = await openDatabase();
  const logs = await getAllRunLogs();
  const runs = await getAllRunsRaw();

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(["runLogs", "runs", "pokedexProgress"], "readwrite");
    const logStore = tx.objectStore("runLogs");
    const runStore = tx.objectStore("runs");
    const progressStore = tx.objectStore("pokedexProgress");
    for (const log of logs) {
      if (log.id !== undefined) {
        logStore.delete(log.id);
      }
    }
    for (const run of runs) {
      runStore.delete(run.runId);
    }
    progressStore.clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  logger.info("Cleared all analytics data", { runs: runs.length, events: logs.length });
  return { runsRemoved: runs.length, eventsRemoved: logs.length };
}

function formatLogCsvRow(log: RunLogEntry): string {
  return CSV_COLUMNS.map((column) => {
    if (column === "id") {
      return csvEscape(log.id);
    }
    const value = log[column];
    if (column === "biome") {
      return csvEscape(formatBiomeName(value as string | number | null));
    }
    return csvEscape(value);
  }).join(",");
}

export async function exportRunLogsAsJson(runId: string): Promise<string> {
  const summary = await getRunById(runId);
  const events = await getEventsForRun(runId);
  return JSON.stringify({ run: summary, events }, null, 2);
}

export async function exportRunLogsAsCsv(runId: string): Promise<string> {
  const events = await getEventsForRun(runId);
  const header = CSV_COLUMNS.join(",");
  const rows = events.map(formatLogCsvRow);
  return [header, ...rows].join("\n");
}

const CSV_COLUMNS: Array<keyof RunLogEntry | "id"> = [
  "id",
  "timestamp",
  "runId",
  "eventType",
  "changeReasons",
  "runResult",
  "wave",
  "biome",
  "money",
  "score",
  "phase",
  "trainerName",
  "battleType",
  "isBoss",
  "partyCount",
  "partySummary",
  "partyAbilities",
  "partyMoves",
  "partyHeldItems",
  "enemySummary",
  "enemyAbilities",
  "enemyMoves",
  "enemyHeldItems",
  "modifierCount",
  "modifierSummary",
  "voucherTotal",
  "voucherSummary",
];

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) {
    return '""';
  }
  if (Array.isArray(value)) {
    return `"${value.join("; ").replace(/"/g, '""')}"`;
  }
  return `"${String(value).replace(/"/g, '""')}"`;
}

export async function exportLogsAsJson(): Promise<string> {
  const logs = (await getAllRunLogs()).filter((log) => isValidRunId(log.runId));
  const runs = (await getAllRuns()).filter((run) => isExportableRunSummary(run));
  return JSON.stringify({ runs, events: logs }, null, 2);
}

export async function exportLogsAsCsv(): Promise<string> {
  const logs = (await getAllRunLogs()).filter((log) => isValidRunId(log.runId));
  const header = CSV_COLUMNS.join(",");
  const rows = logs.map(formatLogCsvRow);
  return [header, ...rows].join("\n");
}

export async function exportRunsAsCsv(): Promise<string> {
  const runs = (await getAllRuns()).filter((run) => isExportableRunSummary(run));
  const headers = [
    "runId",
    "startedAt",
    "endedAt",
    "outcome",
    "result",
    "finalWave",
    "maxWave",
    "startMoney",
    "finalMoney",
    "entryCount",
    "starterLabel",
    "lastBiome",
    "pinned",
    "note",
  ];
  const rows = runs.map((run) =>
    headers.map((key) => csvEscape(run[key as keyof RunSummary])).join(","),
  );
  return [headers.join(","), ...rows].join("\n");
}

async function getPinnedRunIds(): Promise<Set<string>> {
  const runs = (await getAllRuns()).filter((run) => run.pinned && isExportableRunSummary(run));
  return new Set(runs.map((run) => run.runId));
}

export async function exportPinnedRunsAsJson(): Promise<string> {
  const runs = (await getAllRuns()).filter((run) => run.pinned && isExportableRunSummary(run));
  const runIds = new Set(runs.map((run) => run.runId));
  const logs = (await getAllRunLogs()).filter((log) => runIds.has(log.runId) && isValidRunId(log.runId));
  return JSON.stringify({ runs, events: logs }, null, 2);
}

export async function exportPinnedRunsEventsCsv(): Promise<string> {
  const runIds = await getPinnedRunIds();
  const logs = (await getAllRunLogs()).filter((log) => runIds.has(log.runId) && isValidRunId(log.runId));
  const header = CSV_COLUMNS.join(",");
  const rows = logs.map(formatLogCsvRow);
  return [header, ...rows].join("\n");
}

export async function exportPinnedRunsSummaryCsv(): Promise<string> {
  const runs = (await getAllRuns()).filter((run) => run.pinned && isExportableRunSummary(run));
  const headers = [
    "runId",
    "startedAt",
    "endedAt",
    "outcome",
    "result",
    "finalWave",
    "maxWave",
    "startMoney",
    "finalMoney",
    "entryCount",
    "starterLabel",
    "lastBiome",
    "pinned",
    "note",
  ];
  const rows = runs.map((run) =>
    headers.map((key) => csvEscape(run[key as keyof RunSummary])).join(","),
  );
  return [headers.join(","), ...rows].join("\n");
}

function filterRunsByOutcome(result: "win" | "loss"): (run: RunSummary) => boolean {
  return (run) => run.outcome === "ended" && run.result === result && isExportableRunSummary(run);
}

export async function exportOutcomeRunsAsJson(result: "win" | "loss"): Promise<string> {
  const runs = (await getAllRuns()).filter(filterRunsByOutcome(result));
  const runIds = new Set(runs.map((run) => run.runId));
  const logs = (await getAllRunLogs()).filter((log) => runIds.has(log.runId) && isValidRunId(log.runId));
  return JSON.stringify({ runs, events: logs }, null, 2);
}

export async function exportOutcomeRunsEventsCsv(result: "win" | "loss"): Promise<string> {
  const runs = (await getAllRuns()).filter(filterRunsByOutcome(result));
  const runIds = new Set(runs.map((run) => run.runId));
  const logs = (await getAllRunLogs()).filter((log) => runIds.has(log.runId) && isValidRunId(log.runId));
  const header = CSV_COLUMNS.join(",");
  const rows = logs.map(formatLogCsvRow);
  return [header, ...rows].join("\n");
}

export async function exportOutcomeRunsSummaryCsv(result: "win" | "loss"): Promise<string> {
  const runs = (await getAllRuns()).filter(filterRunsByOutcome(result));
  const headers = [
    "runId",
    "startedAt",
    "endedAt",
    "outcome",
    "result",
    "finalWave",
    "maxWave",
    "startMoney",
    "finalMoney",
    "entryCount",
    "starterLabel",
    "lastBiome",
    "pinned",
    "note",
  ];
  const rows = runs.map((run) =>
    headers.map((key) => csvEscape(run[key as keyof RunSummary])).join(","),
  );
  return [headers.join(","), ...rows].join("\n");
}

export async function exportActiveRunsAsJson(): Promise<string> {
  const runs = (await getAllRuns()).filter((run) => run.outcome === "active" && isExportableRunSummary(run));
  const runIds = new Set(runs.map((run) => run.runId));
  const logs = (await getAllRunLogs()).filter((log) => runIds.has(log.runId) && isValidRunId(log.runId));
  return JSON.stringify({ runs, events: logs }, null, 2);
}

export async function exportActiveRunsEventsCsv(): Promise<string> {
  const runs = (await getAllRuns()).filter((run) => run.outcome === "active" && isExportableRunSummary(run));
  const runIds = new Set(runs.map((run) => run.runId));
  const logs = (await getAllRunLogs()).filter((log) => runIds.has(log.runId) && isValidRunId(log.runId));
  const header = CSV_COLUMNS.join(",");
  const rows = logs.map(formatLogCsvRow);
  return [header, ...rows].join("\n");
}

export async function exportActiveRunsSummaryCsv(): Promise<string> {
  const runs = (await getAllRuns()).filter((run) => run.outcome === "active" && isExportableRunSummary(run));
  const headers = [
    "runId",
    "startedAt",
    "endedAt",
    "outcome",
    "result",
    "finalWave",
    "maxWave",
    "startMoney",
    "finalMoney",
    "entryCount",
    "starterLabel",
    "lastBiome",
    "pinned",
    "note",
  ];
  const rows = runs.map((run) =>
    headers.map((key) => csvEscape(run[key as keyof RunSummary])).join(","),
  );
  return [headers.join(","), ...rows].join("\n");
}

export async function exportRunsByIdsAsJson(runIds: string[]): Promise<string> {
  const idSet = new Set(runIds.filter((runId) => isValidRunId(runId)));
  const runs = (await getAllRuns()).filter((run) => idSet.has(run.runId));
  const logs = (await getAllRunLogs()).filter((log) => idSet.has(log.runId) && isValidRunId(log.runId));
  return JSON.stringify({ runs, events: logs }, null, 2);
}

export async function exportRunsByIdsEventsCsv(runIds: string[]): Promise<string> {
  const idSet = new Set(runIds.filter((runId) => isValidRunId(runId)));
  const logs = (await getAllRunLogs()).filter((log) => idSet.has(log.runId) && isValidRunId(log.runId));
  const header = CSV_COLUMNS.join(",");
  const rows = logs.map(formatLogCsvRow);
  return [header, ...rows].join("\n");
}

export async function exportRunsByIdsSummaryCsv(runIds: string[]): Promise<string> {
  const idSet = new Set(runIds.filter((runId) => isValidRunId(runId)));
  const runs = (await getAllRuns()).filter((run) => idSet.has(run.runId));
  const headers = [
    "runId",
    "startedAt",
    "endedAt",
    "outcome",
    "result",
    "finalWave",
    "maxWave",
    "startMoney",
    "finalMoney",
    "entryCount",
    "starterLabel",
    "lastBiome",
    "pinned",
    "note",
  ];
  const rows = runs.map((run) =>
    headers.map((key) => csvEscape(run[key as keyof RunSummary])).join(","),
  );
  return [headers.join(","), ...rows].join("\n");
}

interface BackupPayload {
  runs?: RunSummary[];
  run?: RunSummary;
  events?: RunLogEntry[];
}

export interface ImportBackupResult {
  runsImported: number;
  eventsImported: number;
  runsSkipped: number;
}

async function addRunLogEntryDirect(entry: RunLogEntry): Promise<void> {
  const { id: _id, ...rest } = entry;
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("runLogs", "readwrite");
    const request = tx.objectStore("runLogs").add(rest);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function normalizeBackupPayload(parsed: BackupPayload): { runs: RunSummary[]; events: RunLogEntry[] } {
  const runs = parsed.runs ?? (parsed.run ? [parsed.run] : []);
  const events = parsed.events ?? [];
  return { runs, events };
}

export async function importBackupJson(jsonText: string, merge = true): Promise<ImportBackupResult> {
  let parsed: BackupPayload;
  try {
    parsed = JSON.parse(jsonText) as BackupPayload;
  } catch {
    throw new Error("Invalid JSON backup file");
  }

  const { runs, events } = normalizeBackupPayload(parsed);
  if (runs.length === 0 && events.length === 0) {
    throw new Error("Backup file contains no runs or events");
  }

  if (!merge) {
    await clearAllData();
  }

  const existingRunIds = new Set((await getAllRunsRaw()).map((run) => run.runId));
  const importedRunIds = new Set<string>();
  let runsImported = 0;
  let runsSkipped = 0;
  let eventsImported = 0;

  for (const run of runs) {
    if (!isValidRunId(run.runId) || isDiscardedRunSummary(run)) {
      continue;
    }

    if (merge && existingRunIds.has(run.runId)) {
      const existing = await getRunById(run.runId);
      if (existing && (run.pinned || run.note)) {
        await putRunSummary({
          ...existing,
          pinned: run.pinned ?? existing.pinned,
          note: run.note ?? existing.note,
        });
      }
      runsSkipped += 1;
      continue;
    }

    await putRunSummary(run);
    importedRunIds.add(run.runId);
    runsImported += 1;
  }

  const eventRunIds = merge
    ? importedRunIds
    : new Set(events.map((event) => event.runId).filter((runId) => isValidRunId(runId)));

  for (const event of events) {
    if (!isValidRunId(event.runId) || !eventRunIds.has(event.runId)) {
      continue;
    }

    await addRunLogEntryDirect(event);
    eventsImported += 1;
  }

  logger.info("Imported backup data", { runsImported, eventsImported, runsSkipped, merge });
  return { runsImported, eventsImported, runsSkipped };
}
