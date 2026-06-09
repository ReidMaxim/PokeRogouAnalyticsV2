import type { CrossRunAnalytics } from "../analytics/cross-run-analytics";
import { formatRunSummaryText } from "../analytics/run-summary-text";
import { formatRecapDuration, runRecapLabel, type RunRecap, type TimelineNode } from "../analytics/run-recap";
import { copyRecapLink, copyRunSummaryText } from "../popup/open-recap";
import { sendBackgroundMessage } from "../shared/background-messaging";
import { formatModifierListText, parseModifierSummary, renderModifierListHtml } from "../shared/modifier-summary";
import { saveRecapTimelineFilter, getRecapTimelineFilter } from "../shared/recap-preferences";
import { downloadBlob } from "../shared/downloads";
import type { RunSummary } from "../storage/run-log-types";
import { renderBiomeJourney } from "./biome-journey";
import { renderBiomeHeatmap } from "./biome-heatmap";
import { renderEnemyEncounterLog } from "./enemy-log";
import { renderMoneyChangeLog } from "./money-log";
import { renderModifierAcquisitionLog } from "./modifier-log";
import { renderTrainerBattleLog } from "./trainer-log";
import { renderVoucherChangeLog } from "./voucher-log";
import { renderWinRateTrendChart } from "./win-rate-chart";
import {
  defaultCompareRunIds,
  bestRunId,
  worstRunId,
  pinnedRunId,
  sameStarterRunId,
  populateCompareRunPicker,
  previousRunId,
  renderRunCompareTable,
} from "./run-compare-ui";
import { renderCompareSharePng } from "./compare-share-card";
import { renderRecapSharePng } from "./share-card";
import {
  renderDetailPanel,
  renderPartyCompare,
  renderSparkline,
  renderTimeline,
  type TimelineFilter,
  type TimelineSelection,
} from "./timeline";

const headlineEl = document.getElementById("recap-headline") as HTMLHeadingElement;
const subtitleEl = document.getElementById("recap-subtitle") as HTMLParagraphElement;
const recapNarrativeEl = document.getElementById("recap-narrative") as HTMLParagraphElement;
const recapDeathSummaryEl = document.getElementById("recap-death-summary") as HTMLParagraphElement;
const recapNoteDisplayEl = document.getElementById("recap-note-display") as HTMLParagraphElement;
const statusBadgeEl = document.getElementById("status-badge") as HTMLSpanElement;
const resultBadgeEl = document.getElementById("result-badge") as HTMLSpanElement;
const runPickerEl = document.getElementById("run-picker") as HTMLSelectElement;
const sharePngBtn = document.getElementById("share-png-btn") as HTMLButtonElement;
const copyRecapLinkBtn = document.getElementById("copy-recap-link-btn") as HTMLButtonElement;
const copySummaryBtn = document.getElementById("copy-summary-btn") as HTMLButtonElement;
const refreshBtn = document.getElementById("refresh-btn") as HTMLButtonElement;
const statRowEl = document.getElementById("stat-row") as HTMLElement;
const timelineContainer = document.getElementById("timeline-container") as HTMLElement;
const detailPanel = document.getElementById("detail-panel") as HTMLElement;
const moneyChart = document.getElementById("money-chart") as HTMLElement;
const scoreChart = document.getElementById("score-chart") as HTMLElement;
const partyCompare = document.getElementById("party-compare") as HTMLElement;
const momentsList = document.getElementById("moments-list") as HTMLUListElement;
const eventsToggle = document.getElementById("events-toggle") as HTMLButtonElement;
const eventsTableWrap = document.getElementById("events-table-wrap") as HTMLDivElement;
const eventLogSearchEl = document.getElementById("event-log-search") as HTMLInputElement;
const eventLogTypeEl = document.getElementById("event-log-type") as HTMLSelectElement;
const eventsTbody = document.getElementById("events-tbody") as HTMLTableSectionElement;
const filterChips = document.getElementById("filter-chips") as HTMLDivElement;
const resetTimelineFilterBtn = document.getElementById("reset-timeline-filter-btn") as HTMLButtonElement;
const crossStarterList = document.getElementById("cross-starter-list") as HTMLUListElement;
const crossBiomeList = document.getElementById("cross-biome-list") as HTMLUListElement;
const crossRunPanel = document.getElementById("cross-run-panel") as HTMLElement;
const winRateChartEl = document.getElementById("win-rate-chart") as HTMLElement;
const biomeHeatmapEl = document.getElementById("biome-heatmap") as HTMLElement;
const compareRunAEl = document.getElementById("compare-run-a") as HTMLSelectElement;
const compareRunBEl = document.getElementById("compare-run-b") as HTMLSelectElement;
const compareTableWrap = document.getElementById("compare-table-wrap") as HTMLElement;
const comparePanel = document.getElementById("compare-panel") as HTMLElement;
const comparePngBtn = document.getElementById("compare-png-btn") as HTMLButtonElement;
const comparePreviousBtn = document.getElementById("compare-previous-btn") as HTMLButtonElement;
const compareBestBtn = document.getElementById("compare-best-btn") as HTMLButtonElement;
const compareWorstBtn = document.getElementById("compare-worst-btn") as HTMLButtonElement;
const comparePinnedBtn = document.getElementById("compare-pinned-btn") as HTMLButtonElement;
const compareSameStarterBtn = document.getElementById("compare-same-starter-btn") as HTMLButtonElement;
const modifiersPanel = document.getElementById("modifiers-panel") as HTMLElement;
const modifiersListEl = document.getElementById("modifiers-list") as HTMLElement;
const trainerLogPanel = document.getElementById("trainer-log-panel") as HTMLElement;
const trainerLogWrapEl = document.getElementById("trainer-log-wrap") as HTMLElement;
const biomeJourneyPanel = document.getElementById("biome-journey-panel") as HTMLElement;
const biomeJourneyWrapEl = document.getElementById("biome-journey-wrap") as HTMLElement;
const modifierLogPanel = document.getElementById("modifier-log-panel") as HTMLElement;
const modifierLogWrapEl = document.getElementById("modifier-log-wrap") as HTMLElement;
const voucherLogPanel = document.getElementById("voucher-log-panel") as HTMLElement;
const voucherLogWrapEl = document.getElementById("voucher-log-wrap") as HTMLElement;
const moneyLogPanel = document.getElementById("money-log-panel") as HTMLElement;
const moneyLogWrapEl = document.getElementById("money-log-wrap") as HTMLElement;
const enemyLogPanel = document.getElementById("enemy-log-panel") as HTMLElement;
const enemyLogWrapEl = document.getElementById("enemy-log-wrap") as HTMLElement;

let currentRunId: string | null = null;
let compareRunAId: string | null = null;
let compareRunBId: string | null = null;
let compareLeftRecap: RunRecap | null = null;
let compareRightRecap: RunRecap | null = null;
let currentRecap: RunRecap | null = null;
let currentSummary: RunSummary | null = null;
let currentFilter: TimelineFilter = "all";
let selection: TimelineSelection = { wave: null, nodeId: null };
let autoRefreshTimer: number | null = null;

const TIMELINE_FILTERS: TimelineFilter[] = [
  "all",
  "wave",
  "trainer",
  "party",
  "money",
  "biome",
  "enemy",
  "modifier",
  "voucher",
  "evolution",
];

function isTimelineFilter(value: string): value is TimelineFilter {
  return TIMELINE_FILTERS.includes(value as TimelineFilter);
}

async function loadTimelineFilterFromStorage(): Promise<TimelineFilter> {
  const saved = await getRecapTimelineFilter();
  return saved && isTimelineFilter(saved) ? saved : "all";
}

function syncFilterChips(): void {
  for (const chip of filterChips.querySelectorAll(".chip[data-filter]")) {
    chip.classList.toggle("active", (chip as HTMLElement).dataset.filter === currentFilter);
  }
}

function getRunIdFromQuery(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("runId");
}

function setQueryRunId(runId: string): void {
  const url = new URL(window.location.href);
  url.searchParams.set("runId", runId);
  window.history.replaceState({}, "", url.toString());
}

async function loadRuns(): Promise<RunSummary[]> {
  const response = await sendBackgroundMessage<{ ok?: boolean; runs?: RunSummary[] }>("LIST_RECAP_RUNS");
  return response.runs ?? [];
}

async function loadRecap(runId?: string): Promise<{ recap: RunRecap | null; summary: RunSummary | null }> {
  const response = await sendBackgroundMessage<{
    ok?: boolean;
    recap?: RunRecap | null;
    summary?: RunSummary | null;
  }>("GET_RUN_RECAP", {
    runId,
  });
  return { recap: response.recap ?? null, summary: response.summary ?? null };
}

async function refreshCompare(runs: RunSummary[]): Promise<void> {
  compareLeftRecap = null;
  compareRightRecap = null;

  if (runs.length < 2) {
    comparePanel.classList.add("hidden");
    comparePngBtn.disabled = true;
    return;
  }

  comparePanel.classList.remove("hidden");
  const defaults = defaultCompareRunIds(runs, currentRunId);
  compareRunAId = compareRunAId ?? defaults.left;
  compareRunBId = compareRunBId ?? defaults.right;

  populateCompareRunPicker(compareRunAEl, runs, compareRunAId, "Run A");
  populateCompareRunPicker(compareRunBEl, runs, compareRunBId, "Run B");

  if (!compareRunAId || !compareRunBId) {
    compareTableWrap.innerHTML = `<p class="empty-hint">Select two runs to compare.</p>`;
    comparePngBtn.disabled = true;
    return;
  }

  const [leftResult, rightResult] = await Promise.all([
    loadRecap(compareRunAId),
    loadRecap(compareRunBId),
  ]);
  const leftRecap = leftResult.recap;
  const rightRecap = rightResult.recap;

  if (!leftRecap || !rightRecap) {
    compareTableWrap.innerHTML = `<p class="empty-hint">Could not load one or both runs.</p>`;
    comparePngBtn.disabled = true;
    return;
  }

  compareLeftRecap = leftRecap;
  compareRightRecap = rightRecap;
  comparePngBtn.disabled = false;
  renderRunCompareTable(compareTableWrap, leftRecap, rightRecap);
}

async function loadCrossRunAnalytics(): Promise<CrossRunAnalytics | null> {
  const response = await sendBackgroundMessage<{ ok?: boolean; analytics?: CrossRunAnalytics }>(
    "GET_CROSS_RUN_ANALYTICS",
  );
  return response.analytics ?? null;
}

function renderCrossRunInsights(analytics: CrossRunAnalytics | null): void {
  crossStarterList.innerHTML = "";
  crossBiomeList.innerHTML = "";

  if (!analytics || analytics.endedRuns === 0) {
    crossRunPanel.classList.add("hidden");
    return;
  }

  crossRunPanel.classList.remove("hidden");
  renderWinRateTrendChart(winRateChartEl, analytics.runTrend);
  renderBiomeHeatmap(biomeHeatmapEl, analytics.biomeStats);

  if (analytics.starterStats.length === 0) {
    crossStarterList.innerHTML = `<li class="empty-hint">Need finished runs with starter data.</li>`;
  } else {
    for (const starter of analytics.starterStats) {
      const li = document.createElement("li");
      li.textContent = `${starter.label}: ${Math.round(starter.winRate * 100)}% wins · avg wave ${starter.avgWave.toFixed(1)} (${starter.runs})`;
      crossStarterList.appendChild(li);
    }
  }

  if (analytics.biomeStats.length === 0) {
    crossBiomeList.innerHTML = `<li class="empty-hint">No biome outcomes yet.</li>`;
  } else {
    for (const biome of analytics.biomeStats) {
      const li = document.createElement("li");
      li.textContent = `${biome.biome}: ${biome.losses} losses · avg wave ${biome.avgWave.toFixed(1)}`;
      crossBiomeList.appendChild(li);
    }
  }
}

function renderRunPicker(runs: RunSummary[], selectedRunId: string | null): void {
  runPickerEl.innerHTML = "";
  if (runs.length === 0) {
    const option = document.createElement("option");
    option.textContent = "No runs yet";
    runPickerEl.appendChild(option);
    runPickerEl.disabled = true;
    return;
  }

  runPickerEl.disabled = false;
  for (const run of runs) {
    const option = document.createElement("option");
    option.value = run.runId;
    option.textContent = runRecapLabel(run);
    option.selected = run.runId === selectedRunId;
    runPickerEl.appendChild(option);
  }
}

function renderHeader(recap: RunRecap): void {
  headlineEl.textContent = recap.headline;
  subtitleEl.textContent = `${recap.eventCount} events logged · ${formatRecapDuration(recap.durationMs)}`;

  statusBadgeEl.textContent = recap.status === "active" ? "In progress" : "Finished";
  statusBadgeEl.className = `badge ${recap.status === "active" ? "active-run" : ""}`;

  if (recap.result && recap.status === "ended") {
    resultBadgeEl.classList.remove("hidden");
    resultBadgeEl.textContent = recap.result.toUpperCase();
    resultBadgeEl.className = `badge ${recap.result === "win" ? "win" : recap.result === "loss" ? "loss" : ""}`;
  } else {
    resultBadgeEl.classList.add("hidden");
  }

  if (recap.narrative) {
    recapNarrativeEl.textContent = recap.narrative;
    recapNarrativeEl.classList.remove("hidden");
  } else {
    recapNarrativeEl.textContent = "";
    recapNarrativeEl.classList.add("hidden");
  }

  if (recap.deathSummary) {
    recapDeathSummaryEl.textContent = recap.deathSummary;
    recapDeathSummaryEl.classList.remove("hidden");
  } else {
    recapDeathSummaryEl.textContent = "";
    recapDeathSummaryEl.classList.add("hidden");
  }

  if (recap.note) {
    recapNoteDisplayEl.textContent = `Note: ${recap.note}`;
    recapNoteDisplayEl.classList.remove("hidden");
  } else {
    recapNoteDisplayEl.textContent = "";
    recapNoteDisplayEl.classList.add("hidden");
  }
}

function renderStats(recap: RunRecap): void {
  const biomeLine = recap.currentBiome
    ? `<div class="stat-card"><span>Biome</span><strong>${recap.currentBiome}</strong></div>`
    : "";
  const pbLine = recap.personalBestNote
    ? `<div class="stat-card highlight"><span>Record</span><strong>${recap.personalBestNote}</strong></div>`
    : "";
  const voucherLine = recap.vouchersEarnedThisRun
    ? `<div class="stat-card highlight"><span>Vouchers</span><strong>${recap.vouchersEarnedThisRun}</strong></div>`
    : "";
  const starterTipLine = recap.starterRecommendationNote
    ? `<div class="stat-card highlight"><span>Starter tip</span><strong>${recap.starterRecommendationNote}</strong></div>`
    : "";

  statRowEl.innerHTML = `
    <div class="stat-card"><span>Max Wave</span><strong>${recap.maxWave ?? "—"}</strong></div>
    <div class="stat-card"><span>Duration</span><strong>${formatRecapDuration(recap.durationMs)}</strong></div>
    <div class="stat-card"><span>Money</span><strong>${recap.finalMoney ?? "—"} <small>(${recap.moneyDelta >= 0 ? "+" : ""}${recap.moneyDelta})</small></strong></div>
    <div class="stat-card"><span>Score</span><strong>${recap.finalScore ?? "—"}</strong></div>
    ${biomeLine}
    ${pbLine}
    ${voucherLine}
    ${starterTipLine}
  `;
}

function renderMoments(recap: RunRecap): void {
  momentsList.innerHTML = "";
  if (recap.keyMoments.length === 0) {
    momentsList.innerHTML = `<li class="empty-hint">Play a bit more to populate key moments.</li>`;
    return;
  }
  for (const moment of recap.keyMoments) {
    const li = document.createElement("li");
    li.textContent = moment;
    momentsList.appendChild(li);
  }
}

function renderEventsTable(recap: RunRecap): void {
  eventsTbody.innerHTML = "";
  const query = eventLogSearchEl.value.trim().toLowerCase();
  const typeFilter = eventLogTypeEl.value;

  const nodes = recap.timelineNodes.filter((node) => {
    if (typeFilter !== "all" && node.eventType !== typeFilter) {
      return false;
    }
    if (!query) {
      return true;
    }
    const haystack = [String(node.wave ?? ""), node.eventType, node.label, String(node.money ?? ""), String(node.score ?? "")]
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });

  if (nodes.length === 0) {
    const row = document.createElement("tr");
    row.innerHTML = `<td colspan="5" class="empty-hint">No events match your filter.</td>`;
    eventsTbody.appendChild(row);
    return;
  }

  for (const node of nodes) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${node.wave ?? "—"}</td>
      <td>${node.eventType}</td>
      <td>${node.label}</td>
      <td>${node.money ?? "—"}</td>
      <td>${node.score ?? "—"}</td>
    `;
    eventsTbody.appendChild(row);
  }
}

function handleSelection(nextSelection: TimelineSelection, node: TimelineNode | null): void {
  selection = nextSelection;
  renderDetailPanel(detailPanel, node);
  renderChartsAndTimeline();
}

function renderChartsAndTimeline(): void {
  if (!currentRecap) {
    return;
  }

  renderTimeline(timelineContainer, currentRecap, currentFilter, selection, handleSelection);

  renderSparkline(moneyChart, "Money by wave", currentRecap.chartSeries, "money", selection, (wave) => {
    handleSelection({ wave, nodeId: null }, currentRecap!.timelineNodes.find((n) => n.wave === wave) ?? null);
  });
  renderSparkline(scoreChart, "Score by wave", currentRecap.chartSeries, "score", selection, (wave) => {
    handleSelection({ wave, nodeId: null }, currentRecap!.timelineNodes.find((n) => n.wave === wave) ?? null);
  });
}

function renderBiomeJourneyPanel(recap: RunRecap): void {
  if (recap.biomeJourney.length === 0) {
    biomeJourneyPanel.classList.add("hidden");
    return;
  }

  biomeJourneyPanel.classList.remove("hidden");
  renderBiomeJourney(biomeJourneyWrapEl, recap.biomeJourney);
}

function renderModifierLogPanel(recap: RunRecap): void {
  if (recap.modifierAcquisitionLog.length === 0) {
    modifierLogPanel.classList.add("hidden");
    return;
  }

  modifierLogPanel.classList.remove("hidden");
  renderModifierAcquisitionLog(modifierLogWrapEl, recap.modifierAcquisitionLog);
}

function renderVoucherLogPanel(recap: RunRecap): void {
  if (recap.voucherChangeLog.length === 0) {
    voucherLogPanel.classList.add("hidden");
    return;
  }

  voucherLogPanel.classList.remove("hidden");
  renderVoucherChangeLog(voucherLogWrapEl, recap.voucherChangeLog);
}

function renderMoneyLogPanel(recap: RunRecap): void {
  if (recap.moneyChangeLog.length === 0) {
    moneyLogPanel.classList.add("hidden");
    return;
  }

  moneyLogPanel.classList.remove("hidden");
  renderMoneyChangeLog(moneyLogWrapEl, recap.moneyChangeLog);
}

function renderEnemyLogPanel(recap: RunRecap): void {
  if (recap.enemyEncounterLog.length === 0) {
    enemyLogPanel.classList.add("hidden");
    return;
  }

  enemyLogPanel.classList.remove("hidden");
  renderEnemyEncounterLog(enemyLogWrapEl, recap.enemyEncounterLog);
}

function renderTrainerLog(recap: RunRecap): void {
  if (recap.trainerBattleLog.length === 0) {
    trainerLogPanel.classList.add("hidden");
    return;
  }

  trainerLogPanel.classList.remove("hidden");
  renderTrainerBattleLog(trainerLogWrapEl, recap.trainerBattleLog);
}

function renderModifiers(recap: RunRecap): void {
  const modifiers = parseModifierSummary(recap.modifierSummary);
  if (modifiers.length === 0 && recap.modifierCount <= 0) {
    modifiersPanel.classList.add("hidden");
    return;
  }

  modifiersPanel.classList.remove("hidden");
  modifiersListEl.innerHTML = renderModifierListHtml(modifiers);
}

function renderAll(): void {
  if (!currentRecap) {
    headlineEl.textContent = "No run data yet";
    subtitleEl.textContent = "Enable Collect Run Data, play a few waves, then refresh.";
    recapNarrativeEl.textContent = "";
    recapNarrativeEl.classList.add("hidden");
    recapDeathSummaryEl.textContent = "";
    recapDeathSummaryEl.classList.add("hidden");
    recapNoteDisplayEl.textContent = "";
    recapNoteDisplayEl.classList.add("hidden");
    modifiersPanel.classList.add("hidden");
    trainerLogPanel.classList.add("hidden");
    biomeJourneyPanel.classList.add("hidden");
    modifierLogPanel.classList.add("hidden");
    voucherLogPanel.classList.add("hidden");
    moneyLogPanel.classList.add("hidden");
    enemyLogPanel.classList.add("hidden");
    return;
  }

  renderHeader(currentRecap);
  renderStats(currentRecap);
  renderModifiers(currentRecap);
  renderTrainerLog(currentRecap);
  renderBiomeJourneyPanel(currentRecap);
  renderModifierLogPanel(currentRecap);
  renderVoucherLogPanel(currentRecap);
  renderMoneyLogPanel(currentRecap);
  renderEnemyLogPanel(currentRecap);
  renderMoments(currentRecap);
  renderEventsTable(currentRecap);
  renderChartsAndTimeline();

  const selectedNode =
    currentRecap.timelineNodes.find((n) => n.id === selection.nodeId) ??
    currentRecap.timelineNodes.find((n) => n.wave === selection.wave) ??
    null;
  renderDetailPanel(detailPanel, selectedNode);

  renderPartyCompare(
    partyCompare,
    "Start",
    currentRecap.startParty,
    currentRecap.status === "active" ? "Current" : "End",
    currentRecap.currentParty,
  );
}

async function refresh(runId?: string | null): Promise<void> {
  const runs = await loadRuns();
  const preferred = runId ?? currentRunId ?? getRunIdFromQuery() ?? undefined;
  const loaded = await loadRecap(preferred);
  currentRecap = loaded.recap;
  currentSummary = loaded.summary;
  currentRunId = currentRecap?.runId ?? preferred ?? null;

  if (currentRunId) {
    setQueryRunId(currentRunId);
  }

  renderRunPicker(runs, currentRunId);
  selection = { wave: null, nodeId: null };
  renderAll();
  setupAutoRefresh();
  const analytics = await loadCrossRunAnalytics();
  renderCrossRunInsights(analytics);
  await refreshCompare(runs);
}

function setupAutoRefresh(): void {
  if (autoRefreshTimer !== null) {
    window.clearInterval(autoRefreshTimer);
    autoRefreshTimer = null;
  }

  if (currentRecap?.status === "active") {
    autoRefreshTimer = window.setInterval(() => {
      void refresh(currentRunId);
    }, 5000);
  }
}

filterChips.addEventListener("click", (event) => {
  const target = (event.target as HTMLElement).closest("[data-filter]") as HTMLButtonElement | null;
  if (!target) {
    return;
  }

  currentFilter = target.dataset.filter as TimelineFilter;
  void saveRecapTimelineFilter(currentFilter);
  for (const chip of filterChips.querySelectorAll(".chip[data-filter]")) {
    chip.classList.toggle("active", chip === target);
  }
  renderAll();
});

resetTimelineFilterBtn.addEventListener("click", () => {
  currentFilter = "all";
  void saveRecapTimelineFilter(currentFilter);
  syncFilterChips();
  renderAll();
});

runPickerEl.addEventListener("change", () => {
  compareRunAId = runPickerEl.value;
  void refresh(runPickerEl.value);
});

compareRunAEl.addEventListener("change", () => {
  compareRunAId = compareRunAEl.value;
  void loadRuns().then((runs) => refreshCompare(runs));
});

compareRunBEl.addEventListener("change", () => {
  compareRunBId = compareRunBEl.value;
  void loadRuns().then((runs) => refreshCompare(runs));
});

refreshBtn.addEventListener("click", () => {
  void refresh(currentRunId);
});

sharePngBtn.addEventListener("click", async () => {
  if (!currentRecap) {
    return;
  }
  sharePngBtn.disabled = true;
  sharePngBtn.textContent = "Generating…";
  try {
    const blob = await renderRecapSharePng(currentRecap);
    const safeId = (currentRecap.runId ?? "run").replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 24);
    await downloadBlob(`pokerogue-recap-${safeId}.png`, blob);
  } finally {
    sharePngBtn.disabled = false;
    sharePngBtn.textContent = "Share PNG";
  }
});

copyRecapLinkBtn.addEventListener("click", async () => {
  if (!currentRunId) {
    return;
  }
  try {
    await copyRecapLink(currentRunId);
    copyRecapLinkBtn.textContent = "Copied!";
    window.setTimeout(() => {
      copyRecapLinkBtn.textContent = "Copy Link";
    }, 1500);
  } catch {
    copyRecapLinkBtn.textContent = "Copy failed";
    window.setTimeout(() => {
      copyRecapLinkBtn.textContent = "Copy Link";
    }, 1500);
  }
});

copySummaryBtn.addEventListener("click", async () => {
  if (!currentRecap) {
    return;
  }
  try {
    await copyRunSummaryText(formatRunSummaryText(currentRecap, currentSummary));
    copySummaryBtn.textContent = "Copied!";
    window.setTimeout(() => {
      copySummaryBtn.textContent = "Copy Summary";
    }, 1500);
  } catch {
    copySummaryBtn.textContent = "Copy failed";
    window.setTimeout(() => {
      copySummaryBtn.textContent = "Copy Summary";
    }, 1500);
  }
});

comparePreviousBtn.addEventListener("click", async () => {
  if (!currentRunId) {
    return;
  }

  const runs = await loadRuns();
  const previousId = previousRunId(runs, currentRunId);
  if (!previousId) {
    comparePreviousBtn.textContent = "No prior run";
    window.setTimeout(() => {
      comparePreviousBtn.textContent = "Compare Previous";
    }, 1500);
    return;
  }

  compareRunAId = currentRunId;
  compareRunBId = previousId;
  await refreshCompare(runs);
  comparePanel.scrollIntoView({ behavior: "smooth", block: "start" });
});

compareBestBtn.addEventListener("click", async () => {
  if (!currentRunId) {
    return;
  }

  const runs = await loadRuns();
  const bestId = bestRunId(runs, currentRunId);
  if (!bestId) {
    compareBestBtn.textContent = "No other run";
    window.setTimeout(() => {
      compareBestBtn.textContent = "Compare Best";
    }, 1500);
    return;
  }

  compareRunAId = currentRunId;
  compareRunBId = bestId;
  await refreshCompare(runs);
  comparePanel.scrollIntoView({ behavior: "smooth", block: "start" });
});

compareWorstBtn.addEventListener("click", async () => {
  if (!currentRunId) {
    return;
  }

  const runs = await loadRuns();
  const worstId = worstRunId(runs, currentRunId);
  if (!worstId) {
    compareWorstBtn.textContent = "No other run";
    window.setTimeout(() => {
      compareWorstBtn.textContent = "Compare Worst";
    }, 1500);
    return;
  }

  compareRunAId = currentRunId;
  compareRunBId = worstId;
  await refreshCompare(runs);
  comparePanel.scrollIntoView({ behavior: "smooth", block: "start" });
});

comparePinnedBtn.addEventListener("click", async () => {
  if (!currentRunId) {
    return;
  }

  const runs = await loadRuns();
  const pinnedId = pinnedRunId(runs, currentRunId);
  if (!pinnedId) {
    comparePinnedBtn.textContent = "No pinned run";
    window.setTimeout(() => {
      comparePinnedBtn.textContent = "Compare Pinned";
    }, 1500);
    return;
  }

  compareRunAId = currentRunId;
  compareRunBId = pinnedId;
  await refreshCompare(runs);
  comparePanel.scrollIntoView({ behavior: "smooth", block: "start" });
});

compareSameStarterBtn.addEventListener("click", async () => {
  if (!currentRunId) {
    return;
  }

  const runs = await loadRuns();
  const sameStarterId = sameStarterRunId(runs, currentRunId);
  if (!sameStarterId) {
    compareSameStarterBtn.textContent = "No same-starter run";
    window.setTimeout(() => {
      compareSameStarterBtn.textContent = "Compare Same Starter";
    }, 1500);
    return;
  }

  compareRunAId = currentRunId;
  compareRunBId = sameStarterId;
  await refreshCompare(runs);
  comparePanel.scrollIntoView({ behavior: "smooth", block: "start" });
});

comparePngBtn.addEventListener("click", async () => {
  if (!compareLeftRecap || !compareRightRecap) {
    return;
  }
  comparePngBtn.disabled = true;
  comparePngBtn.textContent = "Generating…";
  try {
    const blob = await renderCompareSharePng(compareLeftRecap, compareRightRecap);
    await downloadBlob("pokerogue-compare.png", blob);
  } finally {
    comparePngBtn.disabled = !compareLeftRecap || !compareRightRecap;
    comparePngBtn.textContent = "Share Compare PNG";
  }
});

eventsToggle.addEventListener("click", () => {
  eventsTableWrap.classList.toggle("hidden");
  eventsToggle.textContent = eventsTableWrap.classList.contains("hidden") ? "Event log ▾" : "Event log ▴";
});

eventLogSearchEl.addEventListener("input", () => {
  if (currentRecap) {
    renderEventsTable(currentRecap);
  }
});

eventLogTypeEl.addEventListener("change", () => {
  if (currentRecap) {
    renderEventsTable(currentRecap);
  }
});

void (async () => {
  currentFilter = await loadTimelineFilterFromStorage();
  syncFilterChips();
  void refresh(getRunIdFromQuery());
})();
