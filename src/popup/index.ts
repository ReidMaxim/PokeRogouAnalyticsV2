import { formatRecapDuration, runRecapLabel, type RunRecap } from "../analytics/run-recap";
import { formatRunSummaryText } from "../analytics/run-summary-text";
import type { DashboardStats } from "../analytics/dashboard-stats";
import { MESSAGE_SOURCE } from "../shared/constants";
import { sendBackgroundMessage } from "../shared/background-messaging";
import { createLogger } from "../shared/logger";
import { formatModifierListText, parseModifierSummary } from "../shared/modifier-summary";
import { renderPartyMemberDetailHtml } from "../shared/party-detail";
import { renderPartyIconsHtml, renderPokemonIconHtml } from "../shared/pokemon-sprites";
import type { DiscoveryReport } from "../shared/types";
import type { RunSummary } from "../storage/run-log-types";
import { getSettings, updateSettings } from "../storage/settings";
import { downloadTextFile } from "./downloads";
import { openDexPage } from "./open-dex";
import { copyRecapLink, copyRunSummaryText, openRecapPage } from "./open-recap";
import { filterRunHistory, renderRunHistoryList } from "./run-history";
import { type RunHistoryOutcomeFilter } from "./run-history-filter";
import { sortRunHistory, type RunHistorySort } from "./run-history-sort";
import { getPopupPreferences, updatePopupPreferences } from "./popup-preferences";
import { renderStarterPicker } from "./starter-picker";
import { sendTabMessage, syncActiveTabSettings } from "./tab-messaging";
const logger = createLogger("popup");

const playcardEl = document.getElementById("playcard") as HTMLDivElement;
const recapRunPickerEl = document.getElementById("recap-run-picker") as HTMLSelectElement;
const openRecapBtn = document.getElementById("open-recap-btn") as HTMLButtonElement;
const copyRecapLinkBtn = document.getElementById("copy-recap-link-btn") as HTMLButtonElement;
const copySummaryBtn = document.getElementById("copy-summary-btn") as HTMLButtonElement;
const runNoteEl = document.getElementById("run-note") as HTMLTextAreaElement;
const discoveryToggle = document.getElementById("discovery-toggle") as HTMLInputElement;
const collectionToggle = document.getElementById("collection-toggle") as HTMLInputElement;
const overlayToggle = document.getElementById("overlay-toggle") as HTMLInputElement;
const battleCardsToggle = document.getElementById("battle-cards-toggle") as HTMLInputElement;
const openDexBtn = document.getElementById("open-dex-btn") as HTMLButtonElement;
const pokedexProgressText = document.getElementById("pokedex-progress-text") as HTMLParagraphElement;
const debugToggle = document.getElementById("debug-toggle") as HTMLInputElement;
const runDiscoveryBtn = document.getElementById("run-discovery-btn") as HTMLButtonElement;
const pingBtn = document.getElementById("ping-btn") as HTMLButtonElement;
const resetOverlayBtn = document.getElementById("reset-overlay-btn") as HTMLButtonElement;
const exportJsonBtn = document.getElementById("export-json-btn") as HTMLButtonElement;
const exportCsvBtn = document.getElementById("export-csv-btn") as HTMLButtonElement;
const exportRunJsonBtn = document.getElementById("export-run-json-btn") as HTMLButtonElement;
const exportRunCsvBtn = document.getElementById("export-run-csv-btn") as HTMLButtonElement;
const exportPinnedJsonBtn = document.getElementById("export-pinned-json-btn") as HTMLButtonElement;
const exportPinnedCsvBtn = document.getElementById("export-pinned-csv-btn") as HTMLButtonElement;
const pinFilteredBtn = document.getElementById("pin-filtered-btn") as HTMLButtonElement;
const unpinFilteredBtn = document.getElementById("unpin-filtered-btn") as HTMLButtonElement;
const deleteVisibleBtn = document.getElementById("delete-visible-btn") as HTMLButtonElement;
const exportActiveJsonBtn = document.getElementById("export-active-json-btn") as HTMLButtonElement;
const exportActiveCsvBtn = document.getElementById("export-active-csv-btn") as HTMLButtonElement;
const exportVisibleJsonBtn = document.getElementById("export-visible-json-btn") as HTMLButtonElement;
const exportVisibleCsvBtn = document.getElementById("export-visible-csv-btn") as HTMLButtonElement;
const historySortEl = document.getElementById("history-sort") as HTMLSelectElement;
const historyOutcomeEl = document.getElementById("history-outcome") as HTMLSelectElement;
const historyStarterEl = document.getElementById("history-starter") as HTMLSelectElement;
const historyBiomeEl = document.getElementById("history-biome") as HTMLSelectElement;
const historyMinWaveEl = document.getElementById("history-min-wave") as HTMLInputElement;
const clearDataBtn = document.getElementById("clear-data-btn") as HTMLButtonElement;
const deleteUnpinnedBtn = document.getElementById("delete-unpinned-btn") as HTMLButtonElement;
const autoExportToggle = document.getElementById("auto-export-toggle") as HTMLInputElement;
const autoExportFormatEl = document.getElementById("auto-export-format") as HTMLSelectElement;
const statusText = document.getElementById("status-text") as HTMLParagraphElement;
const leaderboardToggle = document.getElementById("leaderboard-toggle") as HTMLInputElement;
const leaderboardUsername = document.getElementById("leaderboard-username") as HTMLInputElement;
const leaderboardUrl = document.getElementById("leaderboard-url") as HTMLInputElement;
const leaderboardTestBtn = document.getElementById("leaderboard-test-btn") as HTMLButtonElement;
const leaderboardSecretEl = document.getElementById("leaderboard-secret") as HTMLInputElement;
const leaderboardRefreshBtn = document.getElementById("leaderboard-refresh-btn") as HTMLButtonElement;
const leaderboardListEl = document.getElementById("leaderboard-list") as HTMLDivElement;
// pagination / client-side viewer state (shared)
let _leaderboardEntries: any[] = [];
let _leaderboardPage = 0;

function leaderboardFilteredEntries(): any[] {
  const filter = leaderboardFilterEl?.value?.trim().toLowerCase() ?? "";
  if (!filter) return _leaderboardEntries;
  return _leaderboardEntries.filter((e) => String(e.username ?? "").toLowerCase().includes(filter));
}

function renderLeaderboardPage(): void {
  const entries = leaderboardFilteredEntries();
  const pageSize = Number(leaderboardPageSizeEl?.value ?? 50) || 50;
  const total = entries.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (_leaderboardPage >= pageCount) _leaderboardPage = pageCount - 1;
  if (_leaderboardPage < 0) _leaderboardPage = 0;
  const start = _leaderboardPage * pageSize;
  const page = entries.slice(start, start + pageSize);

  if (page.length === 0) {
    leaderboardListEl.innerHTML = `<p class=\"empty-hint\">No entries on this page.</p>`;
    setStatus(`Leaderboard: ${total} entr${total===1?"y":"ies"}. Page ${_leaderboardPage+1}/${pageCount}`);
    return;
  }

  const rows = page.map((e, idx) => {
    const rank = start + idx + 1;
    const user = escapeHtml(String(e.username ?? e.user ?? "unknown"));
    const maxWave = e.maxWave ?? e.finalWave ?? "—";
    const result = e.result ?? "—";
    const ts = e.timestamp ? new Date(String(e.timestamp)).toLocaleString() : e.startedAt ? new Date(String(e.startedAt)).toLocaleString() : "";
    return `<div class=\"leaderboard-row\"><div class=\"leaderboard-rank\">${rank}</div><div class=\"leaderboard-user\">${user}</div><div class=\"leaderboard-wave\">${maxWave}</div><div class=\"leaderboard-result\">${result}</div><div class=\"leaderboard-ts\">${ts}</div></div>`;
  }).join("");

  leaderboardListEl.innerHTML = `<div class=\"leaderboard-headers\"><div>Rank</div><div>User</div><div>Wave</div><div>Result</div><div>When</div></div>${rows}`;
  setStatus(`Leaderboard: ${total} entr${total===1?"y":"ies"}. Page ${_leaderboardPage+1}/${pageCount}`);
}
const leaderboardFilterEl = document.getElementById("leaderboard-filter") as HTMLInputElement;
const leaderboardPageSizeEl = document.getElementById("leaderboard-page-size") as HTMLSelectElement;
const leaderboardPrevBtn = document.getElementById("leaderboard-prev-btn") as HTMLButtonElement;
const leaderboardNextBtn = document.getElementById("leaderboard-next-btn") as HTMLButtonElement;

const statPokedexSeen = document.getElementById("stat-pokedex-seen") as HTMLSpanElement;
const statTotalRuns = document.getElementById("stat-total-runs") as HTMLSpanElement;
const statAvgWave = document.getElementById("stat-avg-wave") as HTMLSpanElement;
const statWinAvgWave = document.getElementById("stat-win-avg-wave") as HTMLSpanElement;
const statLossAvgWave = document.getElementById("stat-loss-avg-wave") as HTMLSpanElement;
const statWinLossDelta = document.getElementById("stat-win-loss-delta") as HTMLSpanElement;
const statBestRun = document.getElementById("stat-best-run") as HTMLSpanElement;
const statTopPokemon = document.getElementById("stat-top-pokemon") as HTMLSpanElement;
const statBestStarter = document.getElementById("stat-best-starter") as HTMLSpanElement;
const statTopStarterWave = document.getElementById("stat-top-starter-wave") as HTMLSpanElement;
const statWinRate = document.getElementById("stat-win-rate") as HTMLSpanElement;
const statAvgDuration = document.getElementById("stat-avg-duration") as HTMLSpanElement;
const statLongestRun = document.getElementById("stat-longest-run") as HTMLSpanElement;
const statShortestRun = document.getElementById("stat-shortest-run") as HTMLSpanElement;
const statPinnedRuns = document.getElementById("stat-pinned-runs") as HTMLSpanElement;
const statWinStreak = document.getElementById("stat-win-streak") as HTMLSpanElement;
const statRecord = document.getElementById("stat-record") as HTMLSpanElement;
const statLossStreak = document.getElementById("stat-loss-streak") as HTMLSpanElement;
const statToughBiome = document.getElementById("stat-tough-biome") as HTMLSpanElement;
const insightsPanel = document.getElementById("insights-panel") as HTMLDivElement;
const starterPickerEl = document.getElementById("starter-picker") as HTMLDivElement;
const starterInsightsEl = document.getElementById("starter-insights") as HTMLUListElement;
const biomeInsightsEl = document.getElementById("biome-insights") as HTMLUListElement;
const historyFilterEl = document.getElementById("history-filter") as HTMLInputElement;
const clearHistoryFiltersBtn = document.getElementById("clear-history-filters-btn") as HTMLButtonElement;
const historyPinnedOnlyEl = document.getElementById("history-pinned-only") as HTMLInputElement;
const runHistoryListEl = document.getElementById("run-history-list") as HTMLDivElement;

let historyRuns: RunSummary[] = [];
let noteSaveTimer: number | null = null;
let noteEditingRunId: string | null = null;

async function applyPopupPreferencesToUi(): Promise<void> {
  const prefs = await getPopupPreferences();
  historySortEl.value = prefs.historySort;
  historyOutcomeEl.value = prefs.historyOutcome;
  historyStarterEl.value = prefs.historyStarter;
  historyBiomeEl.value = prefs.historyBiome;
  historyPinnedOnlyEl.checked = prefs.historyPinnedOnly;
  historyMinWaveEl.value = prefs.historyMinWave != null ? String(prefs.historyMinWave) : "";
}

function readMinWaveFilter(): number | null {
  const raw = historyMinWaveEl.value.trim();
  if (!raw) {
    return null;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : null;
}

async function savePopupPreferencesFromUi(): Promise<void> {
  await updatePopupPreferences({
    historySort: historySortEl.value as RunHistorySort,
    historyOutcome: historyOutcomeEl.value as RunHistoryOutcomeFilter,
    historyStarter: historyStarterEl.value,
    historyBiome: historyBiomeEl.value,
    historyMinWave: readMinWaveFilter(),
    historyPinnedOnly: historyPinnedOnlyEl.checked,
  });
}

async function init(): Promise<void> {
  const settings = await getSettings();
  discoveryToggle.checked = settings.discoveryModeEnabled;
  collectionToggle.checked = settings.collectionEnabled;
  overlayToggle.checked = settings.overlayEnabled;
  battleCardsToggle.checked = settings.battleCardsEnabled;
  debugToggle.checked = settings.debugLoggingEnabled;
  autoExportToggle.checked = settings.autoExportOnRunEnd;
  autoExportFormatEl.value = settings.autoExportFormat;
  autoExportFormatEl.disabled = !settings.autoExportOnRunEnd;
  // leaderboard settings
  leaderboardToggle.checked = settings.leaderboardEnabled;
  leaderboardUsername.value = settings.leaderboardUsername ?? "";
  leaderboardUrl.value = settings.leaderboardUrl ?? "";
  leaderboardSecretEl.value = settings.leaderboardSecret ?? "";
  await applyPopupPreferencesToUi();
  setStatus("Ready. Enable Collect Run Data, play normally — changes log automatically.");

  await refreshPlaycard();
  await refreshDashboard();
  await refreshPokedexProgress();
}

// Leaderboard UI handlers
leaderboardToggle?.addEventListener("change", async () => {
  await updateSettings({ leaderboardEnabled: leaderboardToggle.checked });
  setStatus(leaderboardToggle.checked ? "Leaderboard enabled" : "Leaderboard disabled");
});

leaderboardUsername?.addEventListener("change", async () => {
  const name = leaderboardUsername.value.trim();
  await updateSettings({ leaderboardUsername: name.length ? name : null });
  setStatus("Leaderboard username saved");
});

leaderboardUrl?.addEventListener("change", async () => {
  const url = leaderboardUrl.value.trim();
  await updateSettings({ leaderboardUrl: url.length ? url : null });
  setStatus("Leaderboard URL saved");
});
leaderboardSecretEl?.addEventListener("change", async () => {
  const s = leaderboardSecretEl.value.trim();
  await updateSettings({ leaderboardSecret: s.length ? s : null });
  setStatus("Leaderboard secret saved (not visible).");
});

leaderboardTestBtn?.addEventListener("click", async () => {
  const url = leaderboardUrl.value.trim();
  const name = leaderboardUsername.value.trim();
  const secret = leaderboardSecretEl?.value?.trim();
  if (!url || !name) {
    setStatus("Provide both Leaderboard URL and Username to test.");
    return;
  }
  setStatus("Testing leaderboard upload...");
  try {
    const payload = { username: name, test: true, timestamp: new Date().toISOString() };
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (secret) headers["X-Leaderboard-Secret"] = secret;
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      setStatus(`Upload failed: ${res.status} ${res.statusText}`);
      return;
    }
    setStatus("Leaderboard test upload successful.");
  } catch (err) {
    setStatus("Leaderboard test upload failed (network or CORS)");
    logger.warn("Leaderboard test failed", err);
  }
});

leaderboardSecretEl?.addEventListener("change", async () => {
  const s = leaderboardSecretEl.value.trim();
  await updateSettings({ leaderboardSecret: s.length ? s : null });
  setStatus("Leaderboard secret saved (not visible).");
});

  function computeLeaderboardGetUrl(raw: string): string {
    const trimmed = raw.trim();
    if (!trimmed) return "";
    if (trimmed.endsWith(".json")) return trimmed;
    if (trimmed.endsWith("/")) return `${trimmed}leaderboard.json`;
    return `${trimmed.replace(/\/+$/,'')}/leaderboard.json`;
  }

  async function loadLeaderboard(): Promise<void> {
    const raw = leaderboardUrl.value.trim();
    const url = computeLeaderboardGetUrl(raw);
    if (!url) {
      setStatus("Leaderboard URL not set.");
      leaderboardListEl.innerHTML = `<p class=\"empty-hint\">Leaderboard URL not set.</p>`;
      return;
    }

    setStatus("Loading leaderboard...");
    try {
      const res = await fetch(url, { method: "GET", headers: { "Accept": "application/json" } });
      if (!res.ok) {
        setStatus(`Could not fetch leaderboard: ${res.status} ${res.statusText}`);
        leaderboardListEl.innerHTML = `<p class=\"empty-hint\">Could not fetch leaderboard.</p>`;
        return;
      }
      const data = await res.json();
      const entries: any[] = Array.isArray(data)
        ? data.filter(Boolean)
        : data && typeof data === "object"
        ? Object.entries(data).map(([k, v]) => ({ id: k, ...(v as object) }))
        : [];

      if (entries.length === 0) {
        leaderboardListEl.innerHTML = `<p class=\"empty-hint\">No entries yet.</p>`;
        setStatus("Leaderboard loaded — no entries.");
        return;
      }

      entries.sort((a, b) => {
        const aWave = typeof a.maxWave === "number" ? a.maxWave : -1;
        const bWave = typeof b.maxWave === "number" ? b.maxWave : -1;
        if (bWave !== aWave) return bWave - aWave;
        const at = a.timestamp ?? a.startedAt ?? "";
        const bt = b.timestamp ?? b.startedAt ?? "";
        return String(bt).localeCompare(String(at));
      });

      // store entries and render first page
      _leaderboardEntries = entries;
      _leaderboardPage = 0;
      renderLeaderboardPage();
    } catch (err) {
      logger.warn("Load leaderboard failed", err);
      setStatus("Failed to load leaderboard (network/CORS). Check URL and rules.");
      leaderboardListEl.innerHTML = `<p class=\"empty-hint\">Failed to load leaderboard.</p>`;
    }
  }

  function escapeHtml(text: string): string {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");
  }

  leaderboardRefreshBtn?.addEventListener("click", async () => {
    await loadLeaderboard();
  });

  leaderboardFilterEl?.addEventListener("input", () => {
    _leaderboardPage = 0;
    renderLeaderboardPage();
  });

  leaderboardPageSizeEl?.addEventListener("change", () => {
    _leaderboardPage = 0;
    renderLeaderboardPage();
  });

  leaderboardPrevBtn?.addEventListener("click", () => {
    if (_leaderboardPage > 0) {
      _leaderboardPage -= 1;
      renderLeaderboardPage();
    }
  });

  leaderboardNextBtn?.addEventListener("click", () => {
    const pageSize = Number(leaderboardPageSizeEl?.value ?? 50) || 50;
    const total = leaderboardFilteredEntries().length;
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    if (_leaderboardPage < pageCount - 1) {
      _leaderboardPage += 1;
      renderLeaderboardPage();
    }
  });

let selectedRecapRunId: string | null = null;
let currentPlaycardRecap: RunRecap | null = null;
let currentPlaycardSummary: RunSummary | null = null;

function renderPlaycard(recap: RunRecap | null): void {
  if (!recap) {
    playcardEl.innerHTML = `<p class="empty-hint">No run data yet. Enable collection, play a few waves, then open recap.</p>`;
    return;
  }

  const statusBadge =
    recap.status === "active"
      ? `<span class="playcard-badge active">In progress</span>`
      : `<span class="playcard-badge">Finished</span>`;
  const lastBiome = currentPlaycardSummary?.lastBiome ?? recap.currentBiome;
  const starterName = currentPlaycardSummary?.starterLabel ?? recap.startParty[0]?.name ?? null;
  const contextLabel =
    recap.status === "active"
      ? "In progress"
      : recap.result === "win"
        ? "Win"
        : recap.result === "loss"
          ? "Loss"
          : "Finished";
  const contextClass =
    recap.status === "active" ? "active" : recap.result === "win" ? "win" : recap.result === "loss" ? "loss" : "";
  const contextParts = [
    `<span class="playcard-context-label ${contextClass}">${contextLabel}</span>`,
    starterName ? `<span class="playcard-context-starter">${escapePlaycardHtml(starterName)}</span>` : "",
    lastBiome ? `<span class="playcard-context-biome">${escapePlaycardHtml(lastBiome)}</span>` : "",
  ].filter(Boolean);
  const contextLine =
    contextParts.length > 0
      ? `<p class="playcard-context">${contextParts.join('<span class="playcard-context-sep">·</span>')}</p>`
      : "";
  const partyIcons = (recap.currentParty ?? [])
    .map((member, idx) => `<span class="party-icon-wrapper" data-index="${idx}">${renderPokemonIconHtml(member, { size: 28, showLevel: true })}</span>`)
    .join("");
  const partyDetailsHtml = (recap.currentParty ?? [])
    .map((member, idx) => `<div class="playcard-party-detail" data-index="${idx}" style="display:${idx===0?"block":"none"}">${renderPartyMemberDetailHtml(member)}</div>`)
    .join("");
  const personalBestHtml = recap.personalBestNote
    ? `<p class="playcard-pb">${recap.personalBestNote}</p>`
    : "";
  const starterTipHtml = recap.starterRecommendationNote
    ? `<p class="playcard-tip">${recap.starterRecommendationNote}</p>`
    : "";
  const voucherHtml = recap.vouchersEarnedThisRun
    ? `<p class="playcard-vouchers">Vouchers this run: ${recap.vouchersEarnedThisRun}</p>`
    : "";
  const modifierList = parseModifierSummary(recap.modifierSummary);
  const modifiersHtml =
    recap.modifierCount > 0
      ? `<p class="playcard-modifiers">Modifiers (${recap.modifierCount}): ${formatModifierListText(modifierList, 4)}</p>`
      : "";

  const moments = (recap.keyMoments ?? [])
    .slice(0, 3)
    .map((m) => `<li>${m}</li>`)
    .join("");

  const deathHtml = recap.deathSummary
    ? `<p class="playcard-death">${recap.deathSummary}</p>`
    : "";
  const noteHtml = recap.note
    ? `<p class="playcard-note"><span>Note:</span> ${escapePlaycardHtml(recap.note)}</p>`
    : "";

  playcardEl.innerHTML = `
    <div class="playcard-badges">${statusBadge}</div>
    ${contextLine}
    <h3 class="playcard-headline">${recap.headline}</h3>
    ${recap.narrative ? `<p class="playcard-narrative">${recap.narrative}</p>` : ""}
    ${deathHtml}
    ${noteHtml}
    <p class="playcard-sub">${recap.eventCount} events · ${formatRecapDuration(recap.durationMs)}</p>
    <div class="playcard-stats">
      <div class="playcard-stat"><span>Wave</span><strong>${recap.maxWave ?? "—"}</strong></div>
      <div class="playcard-stat"><span>Money</span><strong>${recap.finalMoney ?? "—"}</strong></div>
      <div class="playcard-stat"><span>Score</span><strong>${recap.finalScore ?? "—"}</strong></div>
    </div>
    ${voucherHtml}
    ${modifiersHtml}
    ${personalBestHtml}
    ${starterTipHtml}
    <div class="playcard-party">${partyIcons || '<span class="empty-hint">No party yet</span>'}${partyDetailsHtml}</div>
    ${moments ? `<ul class="playcard-moments">${moments}</ul>` : ""}
  `;

  // wire up click handlers for party icons to show the corresponding detail block
  const iconWrap = playcardEl.querySelector('.playcard-party .party-icons') ?? playcardEl.querySelector('.playcard-party');
  if (iconWrap) {
    iconWrap.querySelectorAll('.party-icon-wrapper').forEach((el) => {
      el.addEventListener('click', () => {
        const idx = Number((el as HTMLElement).getAttribute('data-index')) || 0;
        const details = playcardEl.querySelectorAll('.playcard-party-detail');
        details.forEach((d) => {
          const di = Number((d as HTMLElement).getAttribute('data-index')) || 0;
          (d as HTMLElement).style.display = di === idx ? 'block' : 'none';
        });
        // optional active class
        iconWrap.querySelectorAll('.party-icon-wrapper').forEach((i) => i.classList.toggle('active', i === el));
      });
    });
  }
}

function escapePlaycardHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderRecapRunPicker(runs: RunSummary[], selectedRunId: string | null): void {
  recapRunPickerEl.innerHTML = "";
  if (runs.length === 0) {
    const option = document.createElement("option");
    option.textContent = "No runs";
    recapRunPickerEl.appendChild(option);
    recapRunPickerEl.disabled = true;
    return;
  }

  recapRunPickerEl.disabled = false;
  for (const run of runs) {
    const option = document.createElement("option");
    option.value = run.runId;
    option.textContent = runRecapLabel(run);
    option.selected = run.runId === selectedRunId;
    recapRunPickerEl.appendChild(option);
  }
}

async function refreshPlaycard(runId?: string): Promise<void> {
  try {
    const runsResponse = await sendBackgroundMessage<{ ok?: boolean; runs?: RunSummary[] }>(
      "LIST_RECAP_RUNS",
    );
    const runs = runsResponse.runs ?? [];
    selectedRecapRunId = runId ?? selectedRecapRunId ?? runs[0]?.runId ?? null;

    const recapResponse = await sendBackgroundMessage<{ ok?: boolean; recap?: RunRecap | null }>(
      "GET_RUN_RECAP",
      { runId: selectedRecapRunId ?? undefined },
    );

    selectedRecapRunId = recapResponse.recap?.runId ?? selectedRecapRunId;
    currentPlaycardRecap = recapResponse.recap ?? null;
    currentPlaycardSummary = runs.find((run) => run.runId === selectedRecapRunId) ?? null;
    renderRecapRunPicker(runs, selectedRecapRunId);
    renderPlaycard(currentPlaycardRecap);
    syncRunNoteField(selectedRecapRunId, recapResponse.recap?.note ?? null, historyRuns);
    await refreshDashboard(selectedRecapRunId);
    historyRuns = runs;
    renderHistoryList();
  } catch (error) {
    logger.warn("Playcard refresh failed", error);
    playcardEl.innerHTML = `<p class="empty-hint">Could not load recap.</p>`;
  }
}
function setStatus(message: string): void {
  statusText.textContent = message;
}

async function refreshPokedexProgress(): Promise<void> {
  try {
    const response = await sendBackgroundMessage<{
      progress: { seenCount: number; caughtCount: number; totalSpecies: number };
    }>("GET_POKEDEX_PROGRESS");
    const { seenCount, caughtCount, totalSpecies } = response.progress;
    pokedexProgressText.textContent = `Pokédex: ${seenCount} seen · ${caughtCount} caught (of ${totalSpecies})`;
    statPokedexSeen.textContent = `${seenCount} / ${totalSpecies}`;
  } catch (error) {
    logger.warn("Pokédex progress refresh failed", error);
    pokedexProgressText.textContent = "Pokédex: —";
    statPokedexSeen.textContent = "—";
  }
}

async function refreshDashboard(focusRunId?: string | null): Promise<void> {
  try {
    const response = await sendBackgroundMessage<{ ok?: boolean; stats?: DashboardStats }>(
      "GET_DASHBOARD_STATS",
      { runId: focusRunId ?? selectedRecapRunId ?? undefined },
    );
    const stats = response.stats;
    if (!stats) {
      return;
    }

    statTotalRuns.textContent = String(stats.totalRuns);
    statAvgWave.textContent =
      stats.averageWave != null ? stats.averageWave.toFixed(1) : "—";
    statWinAvgWave.textContent = stats.winAverageWaveDisplay;
    statLossAvgWave.textContent = stats.lossAverageWaveDisplay;
    statWinLossDelta.textContent = stats.winLossWaveDeltaDisplay;
    statBestRun.textContent = stats.bestWave != null ? String(stats.bestWave) : "—";
    statTopPokemon.textContent = stats.topPokemon
      ? `${stats.topPokemon.label} (${stats.topPokemon.count})`
      : "—";
    statBestStarter.textContent = stats.bestStarter
      ? `${stats.bestStarter.label} (avg ${stats.bestStarter.avgWave.toFixed(1)})`
      : "—";
    statTopStarterWave.textContent = stats.topStarterAvgWaveDisplay;
    statWinRate.textContent =
      stats.crossRun.overallWinRate != null
        ? `${Math.round(stats.crossRun.overallWinRate * 100)}% (${stats.crossRun.endedRuns} runs)`
        : "—";
    statAvgDuration.textContent = stats.averageDurationDisplay;
    statLongestRun.textContent = stats.longestRunDisplay;
    statShortestRun.textContent = stats.shortestRunDisplay;
    statPinnedRuns.textContent = String(stats.pinnedRuns);
    statRecord.textContent = stats.recordDisplay;
    statWinStreak.textContent = stats.winStreakDisplay;
    statLossStreak.textContent = stats.lossStreakDisplay;
    statToughBiome.textContent = stats.crossRun.toughestBiome
      ? `${stats.crossRun.toughestBiome.biome} (${stats.crossRun.toughestBiome.losses}L)`
      : "—";

    renderInsights(stats);
  } catch (error) {
    logger.warn("Dashboard refresh failed", error);
  }
}

function renderInsights(stats: DashboardStats): void {
  const { crossRun } = stats;
  if (crossRun.endedRuns === 0) {
    insightsPanel.classList.add("hidden");
    return;
  }

  insightsPanel.classList.remove("hidden");
  starterInsightsEl.innerHTML = "";
  biomeInsightsEl.innerHTML = "";

  renderStarterPicker(
    starterPickerEl,
    crossRun.starterStats,
    stats.starterRecommendation,
    (starterLabel) => {
      historyStarterEl.value = starterLabel;
      void savePopupPreferencesFromUi();
      renderHistoryList();
      setStatus(`Filtered run history by ${starterLabel}.`);
    },
  );

  if (crossRun.starterStats.length === 0) {
    starterInsightsEl.innerHTML = `<li class="empty-hint">Need finished runs with party data.</li>`;
  } else {
    for (const starter of crossRun.starterStats.slice(0, 5)) {
      const li = document.createElement("li");
      li.textContent = `${starter.label}: ${Math.round(starter.winRate * 100)}% win · avg wave ${starter.avgWave.toFixed(1)} (${starter.runs} runs)`;
      starterInsightsEl.appendChild(li);
    }
  }

  if (crossRun.biomeStats.length === 0) {
    biomeInsightsEl.innerHTML = `<li class="empty-hint">No biome data yet.</li>`;
  } else {
    for (const biome of crossRun.biomeStats.slice(0, 5)) {
      const li = document.createElement("li");
      li.textContent = `${biome.biome}: ${biome.losses} losses · avg wave ${biome.avgWave.toFixed(1)}`;
      li.className = "biome-insight-item";
      li.title = `Filter run history by ${biome.biome}`;
      li.addEventListener("click", () => {
        historyBiomeEl.value = biome.biome;
        void savePopupPreferencesFromUi();
        renderHistoryList();
        setStatus(`Filtered run history by ${biome.biome}.`);
      });
      biomeInsightsEl.appendChild(li);
    }
  }
}

async function refreshRunHistory(): Promise<void> {
  try {
    const response = await sendBackgroundMessage<{ ok?: boolean; runs?: RunSummary[] }>(
      "LIST_RECAP_RUNS",
    );
    historyRuns = response.runs ?? [];
    populateHistoryStarterFilter(historyRuns);
    populateHistoryBiomeFilter(historyRuns);
    renderHistoryList();
  } catch (error) {
    logger.warn("Run history refresh failed", error);
  }
}

async function selectRunFromHistory(runId: string): Promise<void> {
  selectedRecapRunId = runId;
  recapRunPickerEl.value = runId;
  await refreshPlaycard(runId);
}

function syncRunNoteField(
  runId: string | null,
  note: string | null,
  runs: RunSummary[],
): void {
  noteEditingRunId = runId;
  const resolved = note ?? runs.find((run) => run.runId === runId)?.note ?? "";
  runNoteEl.value = resolved ?? "";
  runNoteEl.disabled = !runId;
}

async function saveRunNote(): Promise<void> {
  if (!selectedRecapRunId || noteEditingRunId !== selectedRecapRunId) {
    return;
  }

  const note = runNoteEl.value;
  try {
    await sendBackgroundMessage<{ ok?: boolean; note?: string | null }>("SET_RUN_NOTE", {
      runId: selectedRecapRunId,
      note,
    });
    const run = historyRuns.find((entry) => entry.runId === selectedRecapRunId);
    if (run) {
      run.note = note.trim() || null;
    }
    renderHistoryList();
  } catch (error) {
    logger.warn("Save run note failed", error);
    setStatus("Could not save run note.");
  }
}

function clearHistoryFilters(): void {
  historyFilterEl.value = "";
  historyOutcomeEl.value = "all";
  historyStarterEl.value = "all";
  historyBiomeEl.value = "all";
  historyMinWaveEl.value = "";
  historyPinnedOnlyEl.checked = false;
  void savePopupPreferencesFromUi();
  renderHistoryList();
  setStatus("Run history filters cleared.");
}

function populateHistoryBiomeFilter(runs: RunSummary[]): void {
  const selected = historyBiomeEl.value;
  const biomes = [...new Set(runs.map((run) => run.lastBiome).filter(Boolean))].sort() as string[];
  historyBiomeEl.innerHTML = `<option value="all">All biomes</option>`;
  for (const biome of biomes) {
    const option = document.createElement("option");
    option.value = biome;
    option.textContent = biome;
    historyBiomeEl.appendChild(option);
  }
  if (selected !== "all" && biomes.includes(selected)) {
    historyBiomeEl.value = selected;
  } else {
    historyBiomeEl.value = "all";
  }
}

function populateHistoryStarterFilter(runs: RunSummary[]): void {
  const selected = historyStarterEl.value;
  const starters = [...new Set(runs.map((run) => run.starterLabel).filter(Boolean))].sort() as string[];
  historyStarterEl.innerHTML = `<option value="all">All starters</option>`;
  for (const starter of starters) {
    const option = document.createElement("option");
    option.value = starter;
    option.textContent = starter;
    historyStarterEl.appendChild(option);
  }
  if (selected !== "all" && starters.includes(selected)) {
    historyStarterEl.value = selected;
  } else {
    historyStarterEl.value = "all";
  }
}

function getFilteredHistoryRuns(): RunSummary[] {
  return filterRunHistory(
    historyRuns,
    historyFilterEl.value,
    historyPinnedOnlyEl.checked,
    historyOutcomeEl.value as RunHistoryOutcomeFilter,
    historyStarterEl.value,
    historyBiomeEl.value,
    readMinWaveFilter(),
  );
}

function renderHistoryList(): void {
  const sortedRuns = sortRunHistory(historyRuns, historySortEl.value as RunHistorySort);
  renderRunHistoryList(
    runHistoryListEl,
    sortedRuns,
    selectedRecapRunId,
    historyFilterEl.value,
    historyPinnedOnlyEl.checked,
    historyOutcomeEl.value as RunHistoryOutcomeFilter,
    (runId) => {
      void selectRunFromHistory(runId);
    },
    (runId) => {
      void deleteRunFromHistory(runId);
    },
    (runId) => {
      void togglePinFromHistory(runId);
    },
    historyStarterEl.value,
    historyBiomeEl.value,
    readMinWaveFilter(),
  );
}

async function togglePinFromHistory(runId: string): Promise<void> {
  try {
    const response = await sendBackgroundMessage<{ ok?: boolean; pinned?: boolean; error?: string }>(
      "PIN_RUN",
      { runId },
    );
    if (!response.ok) {
      setStatus(response.error ?? "Could not update pin.");
      return;
    }
    await refreshPlaycard(selectedRecapRunId ?? undefined);
    setStatus(response.pinned ? "Run pinned." : "Run unpinned.");
  } catch (error) {
    logger.warn("Pin toggle failed", error);
    setStatus("Could not update pin.");
  }
}

async function deleteRunFromHistory(runId: string): Promise<void> {
  const run = historyRuns.find((entry) => entry.runId === runId);
  const label = run ? runRecapLabel(run) : runId;
  if (!window.confirm(`Delete "${label}" and all its logged events?`)) {
    return;
  }

  try {
    const response = await sendBackgroundMessage<{
      ok?: boolean;
      error?: string;
      eventsRemoved?: number;
    }>("DELETE_RUN", { runId });
    if (!response.ok) {
      setStatus(response.error ?? "Could not delete run.");
      return;
    }

    setStatus(`Deleted run (${response.eventsRemoved ?? 0} events removed).`);
    if (selectedRecapRunId === runId) {
      selectedRecapRunId = null;
    }
    await refreshPlaycard();
    await refreshDashboard();
  } catch (error) {
    logger.warn("Delete run failed", error);
    setStatus("Could not delete run.");
  }
}

async function syncActiveTabSettingsWrapper(): Promise<void> {
  const settings = await getSettings();
  await syncActiveTabSettings(settings).catch(() => undefined);
}

discoveryToggle.addEventListener("change", async () => {
  const enabled = discoveryToggle.checked;
  await updateSettings({ discoveryModeEnabled: enabled });
  await syncActiveTabSettingsWrapper().catch(() => undefined);
  setStatus(enabled ? "Discovery enabled. Run a scan or reload the tab." : "Discovery disabled.");

  if (enabled) {
    try {
      await sendTabMessage({
        source: MESSAGE_SOURCE.POPUP,
        type: "DISCOVERY_TOGGLE",
        payload: { enabled: true },
      });
      setStatus("Discovery scan triggered on active tab.");
    } catch {
      setStatus("Settings saved. Reload pokerogue.net and run scan.");
    }
  }
});

collectionToggle.addEventListener("change", async () => {
  await updateSettings({ collectionEnabled: collectionToggle.checked });
  await syncActiveTabSettingsWrapper().catch(() => undefined);
  setStatus(
    collectionToggle.checked
      ? "Collection on. Whole runs log automatically (wave, party, money, etc.)."
      : "Collection disabled.",
  );
  await refreshPlaycard();
  await refreshDashboard();
});

overlayToggle.addEventListener("change", async () => {
  await updateSettings({ overlayEnabled: overlayToggle.checked });
  await syncActiveTabSettingsWrapper().catch(() => undefined);
  setStatus(
    overlayToggle.checked
      ? "In-game overlay enabled. Reload PokéRogue tab if it does not appear."
      : "In-game overlay disabled.",
  );
});

battleCardsToggle.addEventListener("change", async () => {
  await updateSettings({ battleCardsEnabled: battleCardsToggle.checked });
  await syncActiveTabSettingsWrapper().catch(() => undefined);
  setStatus(
    battleCardsToggle.checked
      ? "Battle type cards enabled. They appear during MESSAGE/COMMAND/CONFIRM phases."
      : "Battle type cards disabled.",
  );
});

openDexBtn.addEventListener("click", () => {
  openDexPage();
});

resetOverlayBtn.addEventListener("click", async () => {
  await updateSettings({ overlayLeft: null, overlayTop: null });
  await syncActiveTabSettingsWrapper().catch(() => undefined);
  setStatus("Overlay position reset to bottom-right.");
});

autoExportToggle.addEventListener("change", async () => {
  const enabled = autoExportToggle.checked;
  autoExportFormatEl.disabled = !enabled;
  await updateSettings({ autoExportOnRunEnd: enabled });
  setStatus(
    enabled
      ? "Finished runs will auto-download when a run ends."
      : "Auto-export disabled.",
  );
});

autoExportFormatEl.addEventListener("change", async () => {
  const format = autoExportFormatEl.value as "csv" | "json" | "both";
  await updateSettings({ autoExportFormat: format });
  setStatus(`Auto-export format set to ${format.toUpperCase()}.`);
});

historyFilterEl.addEventListener("input", () => {
  renderHistoryList();
});

historyPinnedOnlyEl.addEventListener("change", () => {
  void savePopupPreferencesFromUi();
  renderHistoryList();
});

historySortEl.addEventListener("change", () => {
  void savePopupPreferencesFromUi();
  renderHistoryList();
});

historyOutcomeEl.addEventListener("change", () => {
  void savePopupPreferencesFromUi();
  renderHistoryList();
});

historyStarterEl.addEventListener("change", () => {
  void savePopupPreferencesFromUi();
  renderHistoryList();
});

historyBiomeEl.addEventListener("change", () => {
  void savePopupPreferencesFromUi();
  renderHistoryList();
});

historyMinWaveEl.addEventListener("change", () => {
  void savePopupPreferencesFromUi();
  renderHistoryList();
});

historyMinWaveEl.addEventListener("input", () => {
  renderHistoryList();
});

clearHistoryFiltersBtn.addEventListener("click", () => {
  clearHistoryFilters();
});

recapRunPickerEl.addEventListener("change", async () => {
  selectedRecapRunId = recapRunPickerEl.value;
  await refreshPlaycard(selectedRecapRunId);
});

openRecapBtn.addEventListener("click", () => {
  openRecapPage(selectedRecapRunId ?? undefined);
});

copyRecapLinkBtn.addEventListener("click", async () => {
  if (!selectedRecapRunId) {
    setStatus("Select a run to copy its recap link.");
    return;
  }
  try {
    await copyRecapLink(selectedRecapRunId);
    setStatus("Recap link copied to clipboard.");
  } catch (error) {
    logger.warn("Copy recap link failed", error);
    setStatus("Could not copy recap link.");
  }
});

copySummaryBtn.addEventListener("click", async () => {
  if (!currentPlaycardRecap) {
    setStatus("Select a run to copy its summary.");
    return;
  }
  try {
    await copyRunSummaryText(formatRunSummaryText(currentPlaycardRecap, currentPlaycardSummary));
    setStatus("Run summary copied to clipboard.");
  } catch (error) {
    logger.warn("Copy summary failed", error);
    setStatus("Could not copy run summary.");
  }
});

runNoteEl.addEventListener("input", () => {
  if (noteSaveTimer !== null) {
    window.clearTimeout(noteSaveTimer);
  }
  noteSaveTimer = window.setTimeout(() => {
    noteSaveTimer = null;
    void saveRunNote();
  }, 500);
});

runNoteEl.addEventListener("blur", () => {
  if (noteSaveTimer !== null) {
    window.clearTimeout(noteSaveTimer);
    noteSaveTimer = null;
  }
  void saveRunNote();
});

debugToggle.addEventListener("change", async () => {
  await updateSettings({ debugLoggingEnabled: debugToggle.checked });
  await syncActiveTabSettingsWrapper().catch(() => undefined);
  setStatus(`Debug logging ${debugToggle.checked ? "enabled" : "disabled"}.`);
});

runDiscoveryBtn.addEventListener("click", async () => {
  setStatus("Running discovery scan… check the PokéRogue tab console.");
  try {
    const report = await sendTabMessage<DiscoveryReport>({
      source: MESSAGE_SOURCE.POPUP,
      type: "DISCOVERY_RUN",
    });
    const wave = report?.gameState?.wave;
    setStatus(
      wave != null
        ? `Discovery OK — wave ${wave}, ${report.candidates.length} paths mapped.`
        : `Discovery done — reload tab if game not captured. ${report?.notes?.[0] ?? ""}`,
    );
    await refreshPlaycard();
    await refreshDashboard();
  } catch (error) {
    setStatus("Discovery failed. Reload pokerogue.net with the extension enabled.");
    logger.error("Discovery run failed", error);
  }
});

pingBtn.addEventListener("click", async () => {
  try {
    const response = await sendTabMessage<{
      ok?: boolean;
      pageHookReady?: boolean;
      gameCaptured?: boolean;
      state?: { wave?: number | null };
      url?: string;
    }>({
      source: MESSAGE_SOURCE.POPUP,
      type: "PING",
    });
    const wave = response?.state?.wave;
    setStatus(
      `Ping OK. game=${String(response?.gameCaptured)} wave=${wave ?? "n/a"} url=${response?.url ?? "unknown"}`,
    );
  } catch {
    setStatus("Ping failed. Open pokerogue.net and reload the page.");
  }
});

exportJsonBtn.addEventListener("click", async () => {
  setStatus("Exporting JSON…");
  try {
    const response = await sendBackgroundMessage<{ ok?: boolean; json?: string }>("EXPORT_LOGS_JSON");
    await downloadTextFile("pokerogue-analytics.json", response.json ?? "{}", "application/json");
    await refreshDashboard();
    setStatus(
      response.json && response.json !== '{"runs":[],"events":[]}'
        ? "JSON downloaded."
        : "JSON downloaded (no events yet — play with collection on, then reload PokéRogue tab).",
    );
  } catch (error) {
    setStatus(`Export failed: ${formatError(error)}`);
    logger.error("JSON export failed", error);
  }
});

exportCsvBtn.addEventListener("click", async () => {
  setStatus("Exporting CSV…");
  try {
    const eventsResponse = await sendBackgroundMessage<{ ok?: boolean; csv?: string }>(
      "EXPORT_LOGS_CSV",
    );
    const runsResponse = await sendBackgroundMessage<{ ok?: boolean; csv?: string }>(
      "EXPORT_RUNS_CSV",
    );
    const eventsCsv = eventsResponse.csv ?? "";
    const runsCsv = runsResponse.csv ?? "";

    await downloadTextFile("pokerogue-analytics-events.csv", eventsCsv, "text/csv");
    await downloadTextFile("pokerogue-analytics-runs.csv", runsCsv, "text/csv");

    const eventRows = Math.max(0, eventsCsv.split("\n").length - 1);
    const runRows = Math.max(0, runsCsv.split("\n").length - 1);
    setStatus(
      eventRows > 0 || runRows > 0
        ? `Downloaded ${eventRows} event row(s) and ${runRows} run summary row(s).`
        : "CSV downloaded (headers only). Play a run with collection on, reload the tab, then export again.",
    );
  } catch (error) {
    setStatus(`Export failed: ${formatError(error)}`);
    logger.error("CSV export failed", error);
  }
});

exportRunJsonBtn.addEventListener("click", async () => {
  if (!selectedRecapRunId) {
    setStatus("Select a run in the recap picker first.");
    return;
  }
  setStatus("Exporting selected run as JSON…");
  try {
    const response = await sendBackgroundMessage<{ ok?: boolean; json?: string }>("EXPORT_RUN_JSON", {
      runId: selectedRecapRunId,
    });
    const safeId = selectedRecapRunId.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 24);
    await downloadTextFile(`pokerogue-run-${safeId}.json`, response.json ?? "{}", "application/json");
    setStatus("Selected run JSON downloaded.");
  } catch (error) {
    setStatus(`Export failed: ${formatError(error)}`);
  }
});

exportRunCsvBtn.addEventListener("click", async () => {
  if (!selectedRecapRunId) {
    setStatus("Select a run in the recap picker first.");
    return;
  }
  setStatus("Exporting selected run as CSV…");
  try {
    const response = await sendBackgroundMessage<{ ok?: boolean; csv?: string }>("EXPORT_RUN_CSV", {
      runId: selectedRecapRunId,
    });
    const safeId = selectedRecapRunId.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 24);
    await downloadTextFile(`pokerogue-run-${safeId}.csv`, response.csv ?? "", "text/csv");
    setStatus("Selected run CSV downloaded.");
  } catch (error) {
    setStatus(`Export failed: ${formatError(error)}`);
  }
});

exportPinnedJsonBtn.addEventListener("click", async () => {
  setStatus("Exporting pinned runs as JSON…");
  try {
    const response = await sendBackgroundMessage<{ ok?: boolean; json?: string }>("EXPORT_PINNED_JSON");
    await downloadTextFile("pokerogue-analytics-pinned.json", response.json ?? "{}", "application/json");
    setStatus(
      response.json && response.json !== '{"runs":[],"events":[]}'
        ? "Pinned runs JSON downloaded."
        : "Pinned JSON downloaded (no pinned runs yet — star a run in history first).",
    );
  } catch (error) {
    setStatus(`Export failed: ${formatError(error)}`);
    logger.error("Pinned JSON export failed", error);
  }
});

exportPinnedCsvBtn.addEventListener("click", async () => {
  setStatus("Exporting pinned runs as CSV…");
  try {
    const response = await sendBackgroundMessage<{
      ok?: boolean;
      eventsCsv?: string;
      runsCsv?: string;
    }>("EXPORT_PINNED_CSV");
    const eventsCsv = response.eventsCsv ?? "";
    const runsCsv = response.runsCsv ?? "";
    await downloadTextFile("pokerogue-analytics-pinned-events.csv", eventsCsv, "text/csv");
    await downloadTextFile("pokerogue-analytics-pinned-runs.csv", runsCsv, "text/csv");
    const eventRows = Math.max(0, eventsCsv.split("\n").length - 1);
    const runRows = Math.max(0, runsCsv.split("\n").length - 1);
    setStatus(
      eventRows > 0 || runRows > 0
        ? `Downloaded ${runRows} pinned run(s) and ${eventRows} event row(s).`
        : "Pinned CSV downloaded (headers only). Star runs in history first.",
    );
  } catch (error) {
    setStatus(`Export failed: ${formatError(error)}`);
    logger.error("Pinned CSV export failed", error);
  }
});

async function setFilteredPins(pinned: boolean): Promise<void> {
  const filtered = getFilteredHistoryRuns();
  const targets = filtered.filter((run) => Boolean(run.pinned) !== pinned);
  if (targets.length === 0) {
    setStatus(pinned ? "All visible runs are already pinned." : "No pinned runs in the current filter.");
    return;
  }

  const action = pinned ? "Pin" : "Unpin";
  if (!window.confirm(`${action} ${targets.length} visible run(s)?`)) {
    return;
  }

  const response = await sendBackgroundMessage<{ ok?: boolean; updated?: number; error?: string }>(
    "SET_RUNS_PINNED",
    { runIds: targets.map((run) => run.runId), pinned },
  );
  if (!response.ok) {
    throw new Error(response.error ?? "Could not update pins.");
  }

  await refreshPlaycard(selectedRecapRunId ?? undefined);
  setStatus(`${action}ned ${response.updated ?? 0} run(s).`);
}

pinFilteredBtn.addEventListener("click", async () => {
  setStatus("Pinning visible runs…");
  try {
    await setFilteredPins(true);
  } catch (error) {
    setStatus(`Pin failed: ${formatError(error)}`);
    logger.error("Bulk pin failed", error);
  }
});

unpinFilteredBtn.addEventListener("click", async () => {
  setStatus("Unpinning visible runs…");
  try {
    await setFilteredPins(false);
  } catch (error) {
    setStatus(`Unpin failed: ${formatError(error)}`);
    logger.error("Bulk unpin failed", error);
  }
});

deleteVisibleBtn.addEventListener("click", async () => {
  const filtered = getFilteredHistoryRuns();
  if (filtered.length === 0) {
    setStatus("No visible runs to delete.");
    return;
  }

  const pinnedCount = filtered.filter((run) => run.pinned).length;
  const warning =
    pinnedCount > 0
      ? `Delete ${filtered.length} visible run(s), including ${pinnedCount} pinned? This cannot be undone.`
      : `Delete ${filtered.length} visible run(s)? This cannot be undone.`;
  if (!window.confirm(warning)) {
    return;
  }

  setStatus("Deleting visible runs…");
  try {
    const response = await sendBackgroundMessage<{
      ok?: boolean;
      runsRemoved?: number;
      eventsRemoved?: number;
      error?: string;
    }>("DELETE_RUNS", { runIds: filtered.map((run) => run.runId) });
    if (!response.ok) {
      setStatus(response.error ?? "Could not delete runs.");
      return;
    }

    await refreshPlaycard();
    setStatus(`Deleted ${response.runsRemoved ?? 0} run(s) (${response.eventsRemoved ?? 0} events).`);
  } catch (error) {
    setStatus(`Delete failed: ${formatError(error)}`);
    logger.error("Delete visible runs failed", error);
  }
});

exportActiveJsonBtn.addEventListener("click", async () => {
  setStatus("Exporting active runs as JSON…");
  try {
    const response = await sendBackgroundMessage<{ ok?: boolean; json?: string }>("EXPORT_ACTIVE_JSON");
    await downloadTextFile("pokerogue-analytics-active.json", response.json ?? "{}", "application/json");
    setStatus(
      response.json && response.json !== '{"runs":[],"events":[]}'
        ? "Active runs JSON downloaded."
        : "Active JSON downloaded (no in-progress runs right now).",
    );
  } catch (error) {
    setStatus(`Export failed: ${formatError(error)}`);
    logger.error("Active JSON export failed", error);
  }
});

exportActiveCsvBtn.addEventListener("click", async () => {
  setStatus("Exporting active runs as CSV…");
  try {
    const response = await sendBackgroundMessage<{
      ok?: boolean;
      eventsCsv?: string;
      runsCsv?: string;
    }>("EXPORT_ACTIVE_CSV");
    const eventsCsv = response.eventsCsv ?? "";
    const runsCsv = response.runsCsv ?? "";
    await downloadTextFile("pokerogue-analytics-active-events.csv", eventsCsv, "text/csv");
    await downloadTextFile("pokerogue-analytics-active-runs.csv", runsCsv, "text/csv");
    setStatus("Active runs CSV downloaded.");
  } catch (error) {
    setStatus(`Export failed: ${formatError(error)}`);
    logger.error("Active CSV export failed", error);
  }
});

exportVisibleJsonBtn.addEventListener("click", async () => {
  const filtered = getFilteredHistoryRuns();
  if (filtered.length === 0) {
    setStatus("No visible runs to export.");
    return;
  }

  setStatus("Exporting visible runs as JSON…");
  try {
    const response = await sendBackgroundMessage<{ ok?: boolean; json?: string; error?: string }>(
      "EXPORT_RUNS_BY_ID_JSON",
      { runIds: filtered.map((run) => run.runId) },
    );
    if (!response.ok) {
      setStatus(response.error ?? "Export failed.");
      return;
    }
    await downloadTextFile("pokerogue-analytics-visible.json", response.json ?? "{}", "application/json");
    setStatus(`Exported ${filtered.length} visible run(s) as JSON.`);
  } catch (error) {
    setStatus(`Export failed: ${formatError(error)}`);
    logger.error("Visible JSON export failed", error);
  }
});

exportVisibleCsvBtn.addEventListener("click", async () => {
  const filtered = getFilteredHistoryRuns();
  if (filtered.length === 0) {
    setStatus("No visible runs to export.");
    return;
  }

  setStatus("Exporting visible runs as CSV…");
  try {
    const response = await sendBackgroundMessage<{
      ok?: boolean;
      eventsCsv?: string;
      runsCsv?: string;
      error?: string;
    }>("EXPORT_RUNS_BY_ID_CSV", { runIds: filtered.map((run) => run.runId) });
    if (!response.ok) {
      setStatus(response.error ?? "Export failed.");
      return;
    }
    const eventsCsv = response.eventsCsv ?? "";
    const runsCsv = response.runsCsv ?? "";
    await downloadTextFile("pokerogue-analytics-visible-events.csv", eventsCsv, "text/csv");
    await downloadTextFile("pokerogue-analytics-visible-runs.csv", runsCsv, "text/csv");
    setStatus(`Exported ${filtered.length} visible run(s) as CSV.`);
  } catch (error) {
    setStatus(`Export failed: ${formatError(error)}`);
    logger.error("Visible CSV export failed", error);
  }
});

deleteUnpinnedBtn.addEventListener("click", async () => {
  const confirmed = window.confirm(
    "Delete all unpinned runs and their events? Pinned ★ runs will be kept.",
  );
  if (!confirmed) {
    return;
  }

  setStatus("Deleting unpinned runs…");
  try {
    const response = await sendBackgroundMessage<{
      ok?: boolean;
      runsRemoved?: number;
      eventsRemoved?: number;
      error?: string;
    }>("DELETE_UNPINNED_RUNS");
    if (!response.ok) {
      setStatus(response.error ?? "Could not delete unpinned runs.");
      return;
    }

    await refreshPlaycard();
    setStatus(
      `Deleted ${response.runsRemoved ?? 0} unpinned run(s) (${response.eventsRemoved ?? 0} events).`,
    );
  } catch (error) {
    setStatus(`Delete failed: ${formatError(error)}`);
    logger.error("Delete unpinned runs failed", error);
  }
});

clearDataBtn.addEventListener("click", async () => {
  const confirmed = window.confirm(
    "Delete all saved runs and events? This cannot be undone.",
  );
  if (!confirmed) {
    return;
  }
  setStatus("Clearing all data…");
  try {
    const response = await sendBackgroundMessage<{
      ok?: boolean;
      runsRemoved?: number;
      eventsRemoved?: number;
    }>("CLEAR_ALL_DATA");
    selectedRecapRunId = null;
    await refreshPlaycard();
    await refreshDashboard();
    setStatus(
      `Cleared ${response.eventsRemoved ?? 0} event(s) and ${response.runsRemoved ?? 0} run(s).`,
    );
  } catch (error) {
    setStatus(`Clear failed: ${formatError(error)}`);
  }
});

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

void init();
