import { runRecapLabel, formatRecapDuration } from "../analytics/run-recap";
import type { RunSummary } from "../storage/run-log-types";
import { matchesOutcomeFilter, type RunHistoryOutcomeFilter } from "./run-history-filter";

export function filterRunHistory(
  runs: RunSummary[],
  filterText: string,
  pinnedOnly: boolean,
  outcomeFilter: RunHistoryOutcomeFilter,
  starterFilter = "all",
  biomeFilter = "all",
  minWave: number | null = null,
): RunSummary[] {
  const query = filterText.trim().toLowerCase();
  let filtered = pinnedOnly ? runs.filter((run) => run.pinned) : runs;
  filtered = filtered.filter((run) => matchesOutcomeFilter(run, outcomeFilter));
  if (starterFilter && starterFilter !== "all") {
    filtered = filtered.filter((run) => (run.starterLabel ?? "") === starterFilter);
  }
  if (biomeFilter && biomeFilter !== "all") {
    filtered = filtered.filter((run) => (run.lastBiome ?? "") === biomeFilter);
  }
  if (minWave != null && minWave > 0) {
    filtered = filtered.filter((run) => (run.maxWave ?? 0) >= minWave);
  }
  filtered = query
    ? filtered.filter((run) => {
        const haystack = [
          run.runId,
          runRecapLabel(run),
          resultLabel(run),
          run.starterLabel ?? "",
          run.lastBiome ?? "",
          run.note ?? "",
          String(run.maxWave ?? ""),
          run.pinned ? "pinned" : "",
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(query);
      })
    : filtered;
  return filtered;
}

function formatHistoryDuration(run: RunSummary): string {
  const start = new Date(run.startedAt).getTime();
  const end = run.endedAt ? new Date(run.endedAt).getTime() : Date.now();
  return formatRecapDuration(Math.max(0, end - start));
}
function resultLabel(run: RunSummary): string {
  if (run.outcome === "active") {
    return "Active";
  }
  if (run.result === "win") {
    return "Win";
  }
  if (run.result === "loss") {
    return "Loss";
  }
  return "Ended";
}

function resultClass(run: RunSummary): string {
  if (run.outcome === "active") {
    return "active";
  }
  return run.result ?? "unknown";
}

function historyTitle(run: RunSummary): string {
  const pin = run.pinned ? "★ " : "";
  const starter = run.starterLabel ? `${run.starterLabel} · ` : "";
  return `${pin}${starter}${runRecapLabel(run)}`;
}

export function renderRunHistoryList(
  container: HTMLElement,
  runs: RunSummary[],
  selectedRunId: string | null,
  filterText: string,
  pinnedOnly: boolean,
  outcomeFilter: RunHistoryOutcomeFilter,
  onSelect: (runId: string) => void,
  onDelete?: (runId: string) => void,
  onTogglePin?: (runId: string) => void,
  starterFilter = "all",
  biomeFilter = "all",
  minWave: number | null = null,
): void {
  container.innerHTML = "";

  const filtered = filterRunHistory(
    runs,
    filterText,
    pinnedOnly,
    outcomeFilter,
    starterFilter,
    biomeFilter,
    minWave,
  );

  if (filtered.length === 0) {
    const emptyMessage = runs.length === 0
      ? "No runs logged yet."
      : pinnedOnly
        ? "No pinned runs yet. Star a run to pin it."
        : outcomeFilter !== "all"
          ? `No ${outcomeFilter === "active" ? "active" : outcomeFilter} runs match your filters.`
          : "No runs match your filter.";
    container.innerHTML = `<p class="empty-hint">${emptyMessage}</p>`;
    return;
  }

  for (const run of filtered) {
    const row = document.createElement("div");
    row.className = `history-row${run.runId === selectedRunId ? " selected" : ""}${run.pinned ? " pinned" : ""}`;

    const selectBtn = document.createElement("button");
    selectBtn.type = "button";
    selectBtn.className = "history-select";
    selectBtn.innerHTML = `
      <span class="history-main">${historyTitle(run)}</span>
      <span class="history-meta">
        <span class="history-badge ${resultClass(run)}">${resultLabel(run)}</span>
        <span>W${run.maxWave ?? "?"}</span>
        <span>${formatHistoryDuration(run)}</span>
        ${run.lastBiome ? `<span class="history-biome">${run.lastBiome}</span>` : ""}
        <span>${run.entryCount} events</span>
      </span>
    `;
    selectBtn.addEventListener("click", () => onSelect(run.runId));
    row.appendChild(selectBtn);

    if (onTogglePin) {
      const pinBtn = document.createElement("button");
      pinBtn.type = "button";
      pinBtn.className = `history-pin${run.pinned ? " active" : ""}`;
      pinBtn.title = run.pinned ? "Unpin run" : "Pin run";
      pinBtn.setAttribute("aria-label", run.pinned ? "Unpin run" : "Pin run");
      pinBtn.textContent = "★";
      pinBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        onTogglePin(run.runId);
      });
      row.appendChild(pinBtn);
    }

    if (onDelete) {
      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "history-delete";
      deleteBtn.title = "Delete run";
      deleteBtn.setAttribute("aria-label", `Delete ${historyTitle(run)}`);
      deleteBtn.textContent = "×";
      deleteBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        onDelete(run.runId);
      });
      row.appendChild(deleteBtn);
    }

    container.appendChild(row);
  }
}
