import type { EnemyEncounterEntry } from "../analytics/run-recap";

export function renderEnemyEncounterLog(container: HTMLElement, entries: EnemyEncounterEntry[]): void {
  if (entries.length === 0) {
    container.innerHTML = `<p class="empty-hint">No enemy encounters logged yet.</p>`;
    return;
  }

  const rows = entries
    .map(
      (entry) => `
      <tr>
        <td>${entry.wave ?? "—"}</td>
        <td>${escapeHtml(entry.trainerName ?? "—")}</td>
        <td>${escapeHtml(entry.enemyTeam ?? "—")}</td>
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
          <th>Trainer</th>
          <th>Enemy Team</th>
          <th>Change</th>
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
