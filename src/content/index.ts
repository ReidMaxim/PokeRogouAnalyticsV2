import { DOM_EVENT_CHANNEL, MESSAGE_SOURCE } from "../shared/constants";
import { createLogger } from "../shared/logger";
import type { DiscoveryReport, ExtensionMessage, ExtensionSettings } from "../shared/types";
import { getAllRunLogs } from "../storage/indexeddb";
import type { RunLogEntry } from "../storage/run-log-types";
import { getSettings, onSettingsChanged, updateSettings } from "../storage/settings";
import { BattleCardsController } from "../pokedex/battle-cards/controller";
import type { GameStateSnapshot } from "./game-access/types";
import { AnalyticsOverlay, overlayStateFromSnapshot } from "./overlay/overlay";

const logger = createLogger("content");

const pendingRequests = new Map<
  string,
  {
    resolve: (value: unknown) => void;
    reject: (reason?: unknown) => void;
    timer: number;
  }
>();

let pageHookReady = false;
let settings: ExtensionSettings | null = null;
const overlay = new AnalyticsOverlay();
const battleCards = new BattleCardsController(
  () =>
    postToPage<GameStateSnapshot | null>({
      source: MESSAGE_SOURCE.CONTENT,
      type: "GET_GAME_STATE",
    }),
  () => settings,
);
let overlayTimer: number | null = null;

export async function initializeContentScript(): Promise<void> {
  logger.info("Content script initializing");

  settings = await getSettings();
  logger.setDebugEnabled(settings.debugLoggingEnabled);

  listenForPageMessages();
  listenForRuntimeMessages();

  await syncSettingsToPage();

  onSettingsChanged(async (nextSettings) => {
    settings = nextSettings;
    logger.setDebugEnabled(nextSettings.debugLoggingEnabled);
    await syncSettingsToPage();

    if (nextSettings.discoveryModeEnabled) {
      logger.info("Discovery mode enabled; scheduling scan");
      scheduleDiscoveryScan(1500);
    }

    applyOverlaySettings(nextSettings);
    applyBattleCardsSettings(nextSettings);
  });

  if (settings.discoveryModeEnabled) {
    scheduleDiscoveryScan(1500);
  }

  applyOverlaySettings(settings);
  applyBattleCardsSettings(settings);

  void migratePageLogsToBackground();
  exposeDebugHelpers();
}

async function syncSettingsToPage(): Promise<void> {
  if (!settings) {
    return;
  }

  try {
    const response = await postToPage<{ ok?: boolean; gameCaptured?: boolean }>({
      source: MESSAGE_SOURCE.CONTENT,
      type: "SETTINGS_SYNC",
      payload: settings,
    });
    pageHookReady = Boolean(response?.ok);
    logger.info("Settings synced to page hook", {
      gameCaptured: response?.gameCaptured,
    });
  } catch (error) {
    pageHookReady = false;
    logger.warn("Page hook not reachable yet (reload tab if this persists)", error);
  }
}

function listenForPageMessages(): void {
  window.addEventListener(DOM_EVENT_CHANNEL, (event) => {
    const customEvent = event as CustomEvent<ExtensionMessage>;
    const message = customEvent.detail;
    if (!message || message.source !== MESSAGE_SOURCE.INJECTED) {
      return;
    }

    if (message.type === "DEBUG_LOG") {
      logger.debug("Page hook log", message.payload);
      return;
    }

    if (message.type === "COLLECTOR_LOG") {
      void saveLogToBackground(message.payload as RunLogEntry).catch((error) => {
        logger.error("Failed to save run log entry", error);
      });
      return;
    }

    if (message.requestId && pendingRequests.has(message.requestId)) {
      const pending = pendingRequests.get(message.requestId);
      pendingRequests.delete(message.requestId);
      window.clearTimeout(pending!.timer);
      pending!.resolve(message.payload);
    }

    if (message.type === "DISCOVERY_RESULT") {
      const report = message.payload as DiscoveryReport;
      logger.info("Discovery result received", {
        wave: report.gameState?.wave,
        candidates: report.candidates.length,
        durationMs: report.durationMs,
      });
    }
  });
}

function listenForRuntimeMessages(): void {
  chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
    if (!message || typeof message !== "object") {
      return false;
    }

    void handleRuntimeMessage(message).then(sendResponse);
    return true;
  });
}

async function handleRuntimeMessage(message: ExtensionMessage): Promise<unknown> {
  switch (message.type) {
    case "DISCOVERY_RUN":
      return runDiscoveryScan();
    case "DISCOVERY_TOGGLE": {
      const enabled = Boolean((message.payload as { enabled?: boolean } | undefined)?.enabled);
      settings = await import("../storage/settings").then((mod) =>
        mod.updateSettings({ discoveryModeEnabled: enabled }),
      );
      await syncSettingsToPage();
      if (enabled) {
        return runDiscoveryScan();
      }
      return { enabled };
    }
    case "GET_GAME_STATE":
      return postToPage({ source: MESSAGE_SOURCE.CONTENT, type: "GET_GAME_STATE" });
    case "SETTINGS_SYNC": {
      if (message.payload) {
        settings = message.payload as ExtensionSettings;
      }
      await syncSettingsToPage();
      if (settings) {
        applyOverlaySettings(settings);
        applyBattleCardsSettings(settings);
      }
      return { ok: true };
    }
    case "PING": {
      const pagePing = await postToPage<Record<string, unknown>>({
        source: MESSAGE_SOURCE.CONTENT,
        type: "PING",
      }).catch(() => null);
      return {
        ok: true,
        context: "content",
        pageHookReady,
        url: window.location.href,
        gameCaptured: pagePing?.gameCaptured,
        state: pagePing?.state,
      };
    }
    default:
      return { ok: false, error: "Unsupported message type" };
  }
}

function applyBattleCardsSettings(next: ExtensionSettings): void {
  if (next.battleCardsEnabled) {
    battleCards.applySettings(next);
    battleCards.start();
  } else {
    battleCards.stop();
  }
}

function applyOverlaySettings(next: ExtensionSettings): void {
  if (next.overlayEnabled) {
    ensureDocumentBody(() => {
      overlay.mount((left, top) => {
        void updateSettings({ overlayLeft: left, overlayTop: top });
      });
      overlay.applyPosition(next.overlayLeft, next.overlayTop);
      startOverlayPolling(next);
    });
  } else {
    stopOverlayPolling();
    overlay.unmount();
  }
}

function ensureDocumentBody(callback: () => void): void {
  if (document.body) {
    callback();
    return;
  }
  document.addEventListener("DOMContentLoaded", callback, { once: true });
}

function startOverlayPolling(_next: ExtensionSettings): void {
  stopOverlayPolling();

  const tick = async (): Promise<void> => {
    if (!settings?.overlayEnabled) {
      return;
    }
    try {
      const snapshot = await postToPage<GameStateSnapshot | null>({
        source: MESSAGE_SOURCE.CONTENT,
        type: "GET_GAME_STATE",
      });
      overlay.update(overlayStateFromSnapshot(snapshot, settings.collectionEnabled));
    } catch {
      overlay.update(overlayStateFromSnapshot(null, settings?.collectionEnabled ?? false));
    }
  };

  void tick();
  overlayTimer = window.setInterval(() => {
    void tick();
  }, 2000);
}

function stopOverlayPolling(): void {
  if (overlayTimer !== null) {
    window.clearInterval(overlayTimer);
    overlayTimer = null;
  }
}

function scheduleDiscoveryScan(delayMs: number): void {
  window.setTimeout(() => {
    void runDiscoveryScan().catch((error) => {
      logger.error("Scheduled discovery scan failed", error);
    });
  }, delayMs);
}

export async function runDiscoveryScan(): Promise<DiscoveryReport> {
  logger.info("Running GAME_STATE_DISCOVERY via page hook");
  const report = (await postToPage<DiscoveryReport>({
    source: MESSAGE_SOURCE.CONTENT,
    type: "DISCOVERY_RUN",
  })) as DiscoveryReport;

  await chrome.storage.local.set({
    lastDiscoveryReport: report,
    lastDiscoveryAt: report.timestamp,
  });

  return report;
}

function postToPage<T>(message: ExtensionMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID();
    const timer = window.setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(new Error("Timed out waiting for page hook response"));
    }, 15000);

    pendingRequests.set(requestId, { resolve: resolve as (value: unknown) => void, reject, timer });

    window.dispatchEvent(
      new CustomEvent(DOM_EVENT_CHANNEL, {
        detail: { ...message, requestId },
      }),
    );
  });
}

function saveLogToBackground(entry: RunLogEntry): Promise<void> {
  return chrome.runtime
    .sendMessage({
      source: MESSAGE_SOURCE.CONTENT,
      type: "SAVE_RUN_LOG",
      payload: entry,
    })
    .then((response) => {
      if (response && typeof response === "object" && "error" in response && response.error) {
        throw new Error(String(response.error));
      }
    });
}

async function migratePageLogsToBackground(): Promise<void> {
  const stored = await chrome.storage.local.get("pageIdbMigratedToBackground");
  if (stored.pageIdbMigratedToBackground) {
    return;
  }

  try {
    const logs = await getAllRunLogs();
    if (logs.length === 0) {
      return;
    }

    logger.info(`Migrating ${logs.length} log entries from page storage to extension storage`);
    for (const entry of logs) {
      const { id: _id, ...rest } = entry;
      await saveLogToBackground(rest);
    }
    await chrome.storage.local.set({ pageIdbMigratedToBackground: true });
    logger.info("Page storage migration complete");
  } catch (error) {
    logger.warn("Page storage migration skipped or failed", error);
  }
}

function exposeDebugHelpers(): void {
  (window as unknown as Record<string, unknown>).__POKEROGUE_ANALYTICS_CONTENT__ = {
    runDiscovery: () => runDiscoveryScan(),
    getState: () => postToPage({ source: MESSAGE_SOURCE.CONTENT, type: "GET_GAME_STATE" }),
    ping: () => postToPage({ source: MESSAGE_SOURCE.CONTENT, type: "PING" }),
    syncSettings: () => syncSettingsToPage(),
  };

  logger.info("Content debug helpers at window.__POKEROGUE_ANALYTICS_CONTENT__");
}

void initializeContentScript();
