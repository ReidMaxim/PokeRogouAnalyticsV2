import type { GameStateSnapshot } from "../content/game-access/types";
import { createLogger } from "../shared/logger";
import { getAllRunLogs, openDatabase } from "../storage/indexeddb";
import type { RunLogEntry } from "../storage/run-log-types";
import { toPokeApiSpeciesId } from "./species-id-map";
import { NATIONAL_DEX_MAX, type PokedexProgressEntry, type PokedexProgressSummary } from "./types";

const logger = createLogger("pokedex/progress");

export interface StoredProgressEntry {
  speciesId: number;
  seen: boolean;
  caught: boolean;
  firstSeenAt: string | null;
  encounterCount: number;
}

function extractSpeciesFromSnapshot(snapshot: GameStateSnapshot | undefined): {
  seen: number[];
  caught: number[];
} {
  const seen = new Set<number>();
  const caught = new Set<number>();

  if (!snapshot) {
    return { seen: [], caught: [] };
  }

  for (const member of snapshot.party ?? []) {
    if (typeof member.speciesId === "number" && member.speciesId > 0) {
      seen.add(member.speciesId);
      caught.add(member.speciesId);
    }
  }

  for (const member of snapshot.enemyParty ?? []) {
    if (typeof member.speciesId === "number" && member.speciesId > 0) {
      seen.add(member.speciesId);
    }
  }

  return { seen: [...seen], caught: [...caught] };
}

export async function getProgressForNationalId(
  nationalId: number,
): Promise<StoredProgressEntry | null> {
  const entries = await getAllProgressEntries();
  let best: StoredProgressEntry | null = null;
  for (const entry of entries) {
    if (toPokeApiSpeciesId(entry.speciesId) !== nationalId) {
      continue;
    }
    if (!best || entry.encounterCount > best.encounterCount) {
      best = entry;
    }
  }
  return best;
}

export async function getProgressEntry(speciesId: number): Promise<StoredProgressEntry | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("pokedexProgress", "readonly");
    const request = tx.objectStore("pokedexProgress").get(speciesId);
    request.onsuccess = () => resolve((request.result as StoredProgressEntry | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
}

async function putProgressEntry(entry: StoredProgressEntry): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("pokedexProgress", "readwrite");
    const request = tx.objectStore("pokedexProgress").put(entry);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function updateProgressFromSnapshot(
  snapshot: GameStateSnapshot | undefined,
  timestamp: string,
): Promise<void> {
  const { seen, caught } = extractSpeciesFromSnapshot(snapshot);
  if (seen.length === 0 && caught.length === 0) {
    return;
  }

  const caughtSet = new Set(caught);
  for (const speciesId of seen) {
    const existing = await getProgressEntry(speciesId);
    const entry: StoredProgressEntry = {
      speciesId,
      seen: true,
      caught: existing?.caught ?? caughtSet.has(speciesId),
      firstSeenAt: existing?.firstSeenAt ?? timestamp,
      encounterCount: (existing?.encounterCount ?? 0) + 1,
    };
    if (caughtSet.has(speciesId)) {
      entry.caught = true;
    }
    await putProgressEntry(entry);
  }
}

export async function updateProgressFromRunLog(entry: RunLogEntry): Promise<void> {
  if (entry.rawSnapshot) {
    await updateProgressFromSnapshot(entry.rawSnapshot, entry.timestamp);
    return;
  }

  const seenIds = new Set<number>();
  const caughtIds = new Set<number>();

  const parseParty = (summary: string | undefined, isParty: boolean): void => {
    if (!summary) {
      return;
    }
    for (const slot of summary.split("|")) {
      const parts = slot.split(":");
      const id = Number(parts[2]);
      if (Number.isFinite(id) && id > 0) {
        seenIds.add(id);
        if (isParty) {
          caughtIds.add(id);
        }
      }
    }
  };

  parseParty(entry.partySummary, true);
  parseParty(entry.enemySummary, false);

  for (const speciesId of seenIds) {
    const existing = await getProgressEntry(speciesId);
    await putProgressEntry({
      speciesId,
      seen: true,
      caught: existing?.caught ?? caughtIds.has(speciesId),
      firstSeenAt: existing?.firstSeenAt ?? entry.timestamp,
      encounterCount: (existing?.encounterCount ?? 0) + 1,
    });
  }
}

export async function getAllProgressEntries(): Promise<StoredProgressEntry[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("pokedexProgress", "readonly");
    const request = tx.objectStore("pokedexProgress").getAll();
    request.onsuccess = () => resolve((request.result as StoredProgressEntry[]) ?? []);
    request.onerror = () => reject(request.error);
  });
}

export async function getPokedexProgressSummary(): Promise<PokedexProgressSummary> {
  const entries = await getAllProgressEntries();
  const mapped: PokedexProgressEntry[] = entries.map((e) => ({
    speciesId: e.speciesId,
    seen: e.seen,
    caught: e.caught,
    firstSeenAt: e.firstSeenAt,
    encounterCount: e.encounterCount,
  }));

  return {
    entries: mapped,
    seenCount: mapped.filter((e) => e.seen).length,
    caughtCount: mapped.filter((e) => e.caught).length,
    totalSpecies: NATIONAL_DEX_MAX,
  };
}

export async function rebuildPokedexProgressFromLogs(): Promise<{ speciesUpdated: number }> {
  logger.info("Rebuilding Pokédex progress from run logs");
  const logs = await getAllRunLogs();
  let speciesUpdated = 0;

  for (const log of logs) {
    const before = await getAllProgressEntries();
    const beforeCount = before.length;
    await updateProgressFromRunLog(log);
    const after = await getAllProgressEntries();
    if (after.length > beforeCount) {
      speciesUpdated += after.length - beforeCount;
    }
  }

  logger.info("Pokédex progress rebuild complete", { logs: logs.length, speciesUpdated });
  return { speciesUpdated: (await getAllProgressEntries()).length };
}

export async function clearPokedexProgress(): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("pokedexProgress", "readwrite");
    const request = tx.objectStore("pokedexProgress").clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
