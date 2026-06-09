import { buildRunComparison, type RunComparisonRow } from "../analytics/run-compare";
import { runRecapLabel, type RunRecap } from "../analytics/run-recap";
import type { RunSummary } from "../storage/run-log-types";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cellClass(highlight: RunComparisonRow["highlight"], side: "left" | "right"): string {
  if (highlight === side) {
    return "compare-win";
  }
  return "";
}

export function renderRunCompareTable(
  container: HTMLElement,
  left: RunRecap,
  right: RunRecap,
): void {
  const rows = buildRunComparison(left, right);

  container.innerHTML = `
    <table class="compare-table">
      <thead>
        <tr>
          <th>Stat</th>
          <th>Run A</th>
          <th>Run B</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (row) => `
          <tr>
            <td>${escapeHtml(row.label)}</td>
            <td class="${cellClass(row.highlight, "left")}">${escapeHtml(row.left)}</td>
            <td class="${cellClass(row.highlight, "right")}">${escapeHtml(row.right)}</td>
          </tr>`,
          )
          .join("")}
      </tbody>
    </table>
  `;
}

export function populateCompareRunPicker(
  select: HTMLSelectElement,
  runs: RunSummary[],
  selectedRunId: string | null,
  placeholder: string,
): void {
  select.innerHTML = "";
  if (runs.length === 0) {
    const option = document.createElement("option");
    option.textContent = placeholder;
    select.appendChild(option);
    select.disabled = true;
    return;
  }

  select.disabled = false;
  for (const run of runs) {
    const option = document.createElement("option");
    option.value = run.runId;
    option.textContent = runRecapLabel(run);
    option.selected = run.runId === selectedRunId;
    select.appendChild(option);
  }
}

export function defaultCompareRunIds(
  runs: RunSummary[],
  primaryRunId: string | null,
): { left: string | null; right: string | null } {
  if (runs.length === 0) {
    return { left: null, right: null };
  }

  const left = primaryRunId ?? runs[0]?.runId ?? null;
  const right = runs.find((run) => run.runId !== left)?.runId ?? left;
  return { left, right };
}

export function previousRunId(runs: RunSummary[], currentRunId: string): string | null {
  const sorted = [...runs].sort((a, b) =>
    (b.endedAt ?? b.startedAt).localeCompare(a.endedAt ?? a.startedAt),
  );
  const index = sorted.findIndex((run) => run.runId === currentRunId);
  if (index < 0 || index >= sorted.length - 1) {
    return null;
  }

  return sorted[index + 1]?.runId ?? null;
}

export function bestRunId(runs: RunSummary[], currentRunId: string | null): string | null {
  const candidates = runs.filter(
    (run) => run.runId !== currentRunId && typeof run.maxWave === "number" && run.outcome === "ended",
  );
  if (candidates.length === 0) {
    return null;
  }

  return (
    [...candidates].sort((a, b) => (b.maxWave ?? 0) - (a.maxWave ?? 0) || (b.endedAt ?? "").localeCompare(a.endedAt ?? ""))[0]
      ?.runId ?? null
  );
}

export function worstRunId(runs: RunSummary[], currentRunId: string | null): string | null {
  const candidates = runs.filter(
    (run) => run.runId !== currentRunId && typeof run.maxWave === "number" && run.outcome === "ended",
  );
  if (candidates.length === 0) {
    return null;
  }

  return (
    [...candidates].sort((a, b) => (a.maxWave ?? 0) - (b.maxWave ?? 0) || (b.endedAt ?? "").localeCompare(a.endedAt ?? ""))[0]
      ?.runId ?? null
  );
}

export function pinnedRunId(runs: RunSummary[], currentRunId: string | null): string | null {
  const pinned = runs.filter((run) => run.pinned && run.runId !== currentRunId);
  if (pinned.length === 0) {
    return null;
  }

  return (
    [...pinned].sort((a, b) => (b.endedAt ?? b.startedAt).localeCompare(a.endedAt ?? a.startedAt))[0]?.runId ??
    null
  );
}

export function sameStarterRunId(runs: RunSummary[], currentRunId: string): string | null {
  const current = runs.find((run) => run.runId === currentRunId);
  const starter = current?.starterLabel;
  if (!starter) {
    return null;
  }

  const matches = runs.filter((run) => run.runId !== currentRunId && run.starterLabel === starter);
  if (matches.length === 0) {
    return null;
  }

  return (
    [...matches].sort((a, b) => (b.endedAt ?? b.startedAt).localeCompare(a.endedAt ?? a.startedAt))[0]?.runId ??
    null
  );
}
