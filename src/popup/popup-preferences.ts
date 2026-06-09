import type { RunHistoryOutcomeFilter } from "./run-history-filter";
import type { RunHistorySort } from "./run-history-sort";

const POPUP_STORAGE_KEYS = {
  HISTORY_SORT: "popupHistorySort",
  HISTORY_OUTCOME: "popupHistoryOutcome",
  HISTORY_STARTER: "popupHistoryStarter",
  HISTORY_BIOME: "popupHistoryBiome",
  HISTORY_MIN_WAVE: "popupHistoryMinWave",
  HISTORY_PINNED_ONLY: "popupHistoryPinnedOnly",
  RECAP_TIMELINE_FILTER: "popupRecapTimelineFilter",
} as const;

const VALID_SORTS: RunHistorySort[] = [
  "newest",
  "oldest",
  "highest-wave",
  "lowest-wave",
  "wins-first",
  "longest-first",
  "shortest-first",
];

const VALID_OUTCOMES: RunHistoryOutcomeFilter[] = ["all", "active", "win", "loss"];

export interface PopupPreferences {
  historySort: RunHistorySort;
  historyOutcome: RunHistoryOutcomeFilter;
  historyStarter: string;
  historyBiome: string;
  historyMinWave: number | null;
  historyPinnedOnly: boolean;
  recapTimelineFilter: string;
}

export const DEFAULT_POPUP_PREFERENCES: PopupPreferences = {
  historySort: "newest",
  historyOutcome: "all",
  historyStarter: "all",
  historyBiome: "all",
  historyMinWave: null,
  historyPinnedOnly: false,
  recapTimelineFilter: "all",
};

function parseSort(value: unknown): RunHistorySort {
  return typeof value === "string" && VALID_SORTS.includes(value as RunHistorySort)
    ? (value as RunHistorySort)
    : DEFAULT_POPUP_PREFERENCES.historySort;
}

function parseOutcome(value: unknown): RunHistoryOutcomeFilter {
  return typeof value === "string" && VALID_OUTCOMES.includes(value as RunHistoryOutcomeFilter)
    ? (value as RunHistoryOutcomeFilter)
    : DEFAULT_POPUP_PREFERENCES.historyOutcome;
}

function parseMinWave(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : null;
}

export async function getPopupPreferences(): Promise<PopupPreferences> {
  const stored = await chrome.storage.local.get(Object.values(POPUP_STORAGE_KEYS));

  return {
    historySort: parseSort(stored[POPUP_STORAGE_KEYS.HISTORY_SORT]),
    historyOutcome: parseOutcome(stored[POPUP_STORAGE_KEYS.HISTORY_OUTCOME]),
    historyStarter:
      typeof stored[POPUP_STORAGE_KEYS.HISTORY_STARTER] === "string"
        ? stored[POPUP_STORAGE_KEYS.HISTORY_STARTER]
        : DEFAULT_POPUP_PREFERENCES.historyStarter,
    historyBiome:
      typeof stored[POPUP_STORAGE_KEYS.HISTORY_BIOME] === "string"
        ? stored[POPUP_STORAGE_KEYS.HISTORY_BIOME]
        : DEFAULT_POPUP_PREFERENCES.historyBiome,
    historyMinWave: parseMinWave(stored[POPUP_STORAGE_KEYS.HISTORY_MIN_WAVE]),
    historyPinnedOnly: stored[POPUP_STORAGE_KEYS.HISTORY_PINNED_ONLY] === true,
    recapTimelineFilter:
      typeof stored[POPUP_STORAGE_KEYS.RECAP_TIMELINE_FILTER] === "string"
        ? stored[POPUP_STORAGE_KEYS.RECAP_TIMELINE_FILTER]
        : DEFAULT_POPUP_PREFERENCES.recapTimelineFilter,
  };
}

export async function updatePopupPreferences(
  partial: Partial<PopupPreferences>,
): Promise<PopupPreferences> {
  const updates: Record<string, string | number | boolean | null> = {};

  if (partial.historySort !== undefined) {
    updates[POPUP_STORAGE_KEYS.HISTORY_SORT] = partial.historySort;
  }
  if (partial.historyOutcome !== undefined) {
    updates[POPUP_STORAGE_KEYS.HISTORY_OUTCOME] = partial.historyOutcome;
  }
  if (partial.historyStarter !== undefined) {
    updates[POPUP_STORAGE_KEYS.HISTORY_STARTER] = partial.historyStarter;
  }
  if (partial.historyBiome !== undefined) {
    updates[POPUP_STORAGE_KEYS.HISTORY_BIOME] = partial.historyBiome;
  }
  if (partial.historyMinWave !== undefined) {
    updates[POPUP_STORAGE_KEYS.HISTORY_MIN_WAVE] = partial.historyMinWave;
  }
  if (partial.historyPinnedOnly !== undefined) {
    updates[POPUP_STORAGE_KEYS.HISTORY_PINNED_ONLY] = partial.historyPinnedOnly;
  }
  if (partial.recapTimelineFilter !== undefined) {
    updates[POPUP_STORAGE_KEYS.RECAP_TIMELINE_FILTER] = partial.recapTimelineFilter;
  }

  if (Object.keys(updates).length > 0) {
    await chrome.storage.local.set(updates);
  }

  return getPopupPreferences();
}
