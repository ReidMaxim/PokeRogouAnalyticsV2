import type { WaveMilestoneEntry } from "../analytics/run-recap";

export function renderWaveMilestones(container: HTMLElement, entries: WaveMilestoneEntry[]): void {
  if (entries.length === 0) {
    container.innerHTML = `<p class="empty-hint">No wave milestones logged yet.</p>`;
    return;
  }

  const rows = entries
    .map(
      (entry) => `
      <tr>
        <td>${entry.wave ?? "—"}</td>
        <td>${new Date(entry.timestamp).toLocaleTimeString()}</td>
        <td>${escapeHtml(entry.label)}</td>
      </tr>
    `,
    )
    .join("");

  container.innerHTML = `
    <table class="journey-table">
      <thead>
        <tr>
          <th>Wave</th>
          <th>Time</th>
          <th>Milestone</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
