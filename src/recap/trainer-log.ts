import type { TrainerBattleEntry } from "../analytics/run-recap";

export function renderTrainerBattleLog(container: HTMLElement, entries: TrainerBattleEntry[]): void {
  if (entries.length === 0) {
    container.innerHTML = `<p class="empty-hint">No trainer battles logged yet.</p>`;
    return;
  }

  const rows = entries
    .map(
      (entry) => `
      <tr>
        <td>${entry.wave ?? "—"}</td>
        <td>${escapeHtml(entry.trainerName)}${entry.isBoss ? ' <span class="boss-badge">Boss</span>' : ""}</td>
        <td>${escapeHtml(entry.biome ?? "—")}</td>
        <td>${escapeHtml(entry.enemyTeam ?? "—")}</td>
      </tr>
    `,
    )
    .join("");

  container.innerHTML = `
    <table class="trainer-log-table">
      <thead>
        <tr>
          <th>Wave</th>
          <th>Trainer</th>
          <th>Biome</th>
          <th>Enemy Team</th>
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
