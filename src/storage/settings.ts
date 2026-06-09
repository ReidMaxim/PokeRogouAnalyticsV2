import { STORAGE_KEYS } from "../shared/constants";
import { DEFAULT_SETTINGS, type ExtensionSettings } from "../shared/types";

function readPosition(raw: unknown): number | null {
  return typeof raw === "number" ? raw : null;
}

export async function getSettings(): Promise<ExtensionSettings> {
  const stored = await chrome.storage.local.get([
    STORAGE_KEYS.DISCOVERY_MODE,
    STORAGE_KEYS.DEBUG_LOGGING,
    STORAGE_KEYS.COLLECTION_ENABLED,
    STORAGE_KEYS.OVERLAY_ENABLED,
    STORAGE_KEYS.OVERLAY_LEFT,
    STORAGE_KEYS.OVERLAY_TOP,
    STORAGE_KEYS.BATTLE_CARDS_ENABLED,
    STORAGE_KEYS.BATTLE_CARDS_ALLIES_LEFT,
    STORAGE_KEYS.BATTLE_CARDS_ALLIES_TOP,
    STORAGE_KEYS.BATTLE_CARDS_ALLIES_WIDTH,
    STORAGE_KEYS.BATTLE_CARDS_ALLIES_HEIGHT,
    STORAGE_KEYS.BATTLE_CARDS_ENEMIES_LEFT,
    STORAGE_KEYS.BATTLE_CARDS_ENEMIES_TOP,
    STORAGE_KEYS.BATTLE_CARDS_ENEMIES_WIDTH,
    STORAGE_KEYS.BATTLE_CARDS_ENEMIES_HEIGHT,
    STORAGE_KEYS.AUTO_EXPORT_ON_RUN_END,
    STORAGE_KEYS.AUTO_EXPORT_FORMAT,
    // leaderboard keys
    STORAGE_KEYS.LEADERBOARD_ENABLED,
    STORAGE_KEYS.LEADERBOARD_URL,
    STORAGE_KEYS.LEADERBOARD_USERNAME,
    STORAGE_KEYS.LEADERBOARD_SECRET,
  ]);

  return {
    discoveryModeEnabled: stored[STORAGE_KEYS.DISCOVERY_MODE] ?? DEFAULT_SETTINGS.discoveryModeEnabled,
    debugLoggingEnabled: stored[STORAGE_KEYS.DEBUG_LOGGING] ?? DEFAULT_SETTINGS.debugLoggingEnabled,
    collectionEnabled: stored[STORAGE_KEYS.COLLECTION_ENABLED] ?? DEFAULT_SETTINGS.collectionEnabled,
    overlayEnabled: stored[STORAGE_KEYS.OVERLAY_ENABLED] ?? DEFAULT_SETTINGS.overlayEnabled,
    overlayLeft: readPosition(stored[STORAGE_KEYS.OVERLAY_LEFT]) ?? DEFAULT_SETTINGS.overlayLeft,
    overlayTop: readPosition(stored[STORAGE_KEYS.OVERLAY_TOP]) ?? DEFAULT_SETTINGS.overlayTop,
    battleCardsEnabled:
      stored[STORAGE_KEYS.BATTLE_CARDS_ENABLED] ?? DEFAULT_SETTINGS.battleCardsEnabled,
    battleCardsAlliesLeft:
      readPosition(stored[STORAGE_KEYS.BATTLE_CARDS_ALLIES_LEFT]) ??
      DEFAULT_SETTINGS.battleCardsAlliesLeft,
    battleCardsAlliesTop:
      readPosition(stored[STORAGE_KEYS.BATTLE_CARDS_ALLIES_TOP]) ??
      DEFAULT_SETTINGS.battleCardsAlliesTop,
    battleCardsAlliesWidth:
      readPosition(stored[STORAGE_KEYS.BATTLE_CARDS_ALLIES_WIDTH]) ??
      DEFAULT_SETTINGS.battleCardsAlliesWidth,
    battleCardsAlliesHeight:
      readPosition(stored[STORAGE_KEYS.BATTLE_CARDS_ALLIES_HEIGHT]) ??
      DEFAULT_SETTINGS.battleCardsAlliesHeight,
    battleCardsEnemiesLeft:
      readPosition(stored[STORAGE_KEYS.BATTLE_CARDS_ENEMIES_LEFT]) ??
      DEFAULT_SETTINGS.battleCardsEnemiesLeft,
    battleCardsEnemiesTop:
      readPosition(stored[STORAGE_KEYS.BATTLE_CARDS_ENEMIES_TOP]) ??
      DEFAULT_SETTINGS.battleCardsEnemiesTop,
    battleCardsEnemiesWidth:
      readPosition(stored[STORAGE_KEYS.BATTLE_CARDS_ENEMIES_WIDTH]) ??
      DEFAULT_SETTINGS.battleCardsEnemiesWidth,
    battleCardsEnemiesHeight:
      readPosition(stored[STORAGE_KEYS.BATTLE_CARDS_ENEMIES_HEIGHT]) ??
      DEFAULT_SETTINGS.battleCardsEnemiesHeight,
    autoExportOnRunEnd:
      stored[STORAGE_KEYS.AUTO_EXPORT_ON_RUN_END] ?? DEFAULT_SETTINGS.autoExportOnRunEnd,
    autoExportFormat:
      stored[STORAGE_KEYS.AUTO_EXPORT_FORMAT] === "json" ||
      stored[STORAGE_KEYS.AUTO_EXPORT_FORMAT] === "both"
        ? stored[STORAGE_KEYS.AUTO_EXPORT_FORMAT]
        : DEFAULT_SETTINGS.autoExportFormat,
    // leaderboard values
    leaderboardEnabled:
      stored[STORAGE_KEYS.LEADERBOARD_ENABLED] ?? DEFAULT_SETTINGS.leaderboardEnabled,
    leaderboardUrl: stored[STORAGE_KEYS.LEADERBOARD_URL] ?? DEFAULT_SETTINGS.leaderboardUrl,
    leaderboardUsername:
      stored[STORAGE_KEYS.LEADERBOARD_USERNAME] ?? DEFAULT_SETTINGS.leaderboardUsername,
    leaderboardSecret: stored[STORAGE_KEYS.LEADERBOARD_SECRET] ?? DEFAULT_SETTINGS.leaderboardSecret,
  };
}

export async function updateSettings(partial: Partial<ExtensionSettings>): Promise<ExtensionSettings> {
  const updates: Record<string, boolean | number | null | string> = {};

  if (partial.discoveryModeEnabled !== undefined) {
    updates[STORAGE_KEYS.DISCOVERY_MODE] = partial.discoveryModeEnabled;
  }
  if (partial.debugLoggingEnabled !== undefined) {
    updates[STORAGE_KEYS.DEBUG_LOGGING] = partial.debugLoggingEnabled;
  }
  if (partial.collectionEnabled !== undefined) {
    updates[STORAGE_KEYS.COLLECTION_ENABLED] = partial.collectionEnabled;
  }
  if (partial.overlayEnabled !== undefined) {
    updates[STORAGE_KEYS.OVERLAY_ENABLED] = partial.overlayEnabled;
  }
  if (partial.overlayLeft !== undefined) {
    updates[STORAGE_KEYS.OVERLAY_LEFT] = partial.overlayLeft;
  }
  if (partial.overlayTop !== undefined) {
    updates[STORAGE_KEYS.OVERLAY_TOP] = partial.overlayTop;
  }
  if (partial.battleCardsEnabled !== undefined) {
    updates[STORAGE_KEYS.BATTLE_CARDS_ENABLED] = partial.battleCardsEnabled;
  }
  if (partial.battleCardsAlliesLeft !== undefined) {
    updates[STORAGE_KEYS.BATTLE_CARDS_ALLIES_LEFT] = partial.battleCardsAlliesLeft;
  }
  if (partial.battleCardsAlliesTop !== undefined) {
    updates[STORAGE_KEYS.BATTLE_CARDS_ALLIES_TOP] = partial.battleCardsAlliesTop;
  }
  if (partial.battleCardsAlliesWidth !== undefined) {
    updates[STORAGE_KEYS.BATTLE_CARDS_ALLIES_WIDTH] = partial.battleCardsAlliesWidth;
  }
  if (partial.battleCardsAlliesHeight !== undefined) {
    updates[STORAGE_KEYS.BATTLE_CARDS_ALLIES_HEIGHT] = partial.battleCardsAlliesHeight;
  }
  if (partial.battleCardsEnemiesLeft !== undefined) {
    updates[STORAGE_KEYS.BATTLE_CARDS_ENEMIES_LEFT] = partial.battleCardsEnemiesLeft;
  }
  if (partial.battleCardsEnemiesTop !== undefined) {
    updates[STORAGE_KEYS.BATTLE_CARDS_ENEMIES_TOP] = partial.battleCardsEnemiesTop;
  }
  if (partial.battleCardsEnemiesWidth !== undefined) {
    updates[STORAGE_KEYS.BATTLE_CARDS_ENEMIES_WIDTH] = partial.battleCardsEnemiesWidth;
  }
  if (partial.battleCardsEnemiesHeight !== undefined) {
    updates[STORAGE_KEYS.BATTLE_CARDS_ENEMIES_HEIGHT] = partial.battleCardsEnemiesHeight;
  }
  if (partial.autoExportOnRunEnd !== undefined) {
    updates[STORAGE_KEYS.AUTO_EXPORT_ON_RUN_END] = partial.autoExportOnRunEnd;
  }
  if (partial.autoExportFormat !== undefined) {
    updates[STORAGE_KEYS.AUTO_EXPORT_FORMAT] = partial.autoExportFormat;
  }

  // persist leaderboard settings
  if (partial.leaderboardEnabled !== undefined) {
    updates[STORAGE_KEYS.LEADERBOARD_ENABLED] = partial.leaderboardEnabled;
  }
  if (partial.leaderboardUrl !== undefined) {
    updates[STORAGE_KEYS.LEADERBOARD_URL] = partial.leaderboardUrl;
  }
  if (partial.leaderboardUsername !== undefined) {
    updates[STORAGE_KEYS.LEADERBOARD_USERNAME] = partial.leaderboardUsername;
  }
  if (partial.leaderboardSecret !== undefined) {
    updates[STORAGE_KEYS.LEADERBOARD_SECRET] = partial.leaderboardSecret;
  }

  await chrome.storage.local.set(updates);
  return getSettings();
}

export function onSettingsChanged(
  listener: (settings: ExtensionSettings) => void,
): () => void {
  const handler = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string,
  ) => {
    if (areaName !== "local") {
      return;
    }

    const relevant = Object.keys(changes).some((key) =>
      Object.values(STORAGE_KEYS).includes(key as (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS]),
    );

    if (relevant) {
      void getSettings().then(listener);
    }
  };

  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
}
