import type { StarterStat } from "../analytics/cross-run-analytics";
import type { StarterRecommendation } from "../analytics/starter-recommendation";
import { renderPokemonIconHtml } from "../shared/pokemon-sprites";

export function renderStarterPicker(
  container: HTMLElement,
  starters: StarterStat[],
  recommendation: StarterRecommendation | null,
  onSelect: (starterLabel: string) => void,
): void {
  container.innerHTML = "";

  if (starters.length === 0) {
    container.innerHTML = `<p class="empty-hint">Finish runs with party data to build starter stats.</p>`;
    return;
  }

  for (const starter of starters.slice(0, 6)) {
    const isRecommended =
      recommendation != null &&
      ((recommendation.speciesId != null &&
        starter.speciesId != null &&
        recommendation.speciesId === starter.speciesId) ||
        recommendation.label.toLowerCase() === starter.label.toLowerCase());

    const button = document.createElement("button");
    button.type = "button";
    button.className = `starter-card${isRecommended ? " recommended" : ""}`;
    button.innerHTML = `
      ${renderPokemonIconHtml(
        { name: starter.label, level: null, speciesId: starter.speciesId },
        { size: 36, showLevel: false },
      )}
      <span class="starter-card-name">${starter.label}</span>
      <span class="starter-card-stats">${Math.round(starter.winRate * 100)}% win · avg ${starter.avgWave.toFixed(0)}</span>
      <span class="starter-card-runs">${starter.runs} run${starter.runs === 1 ? "" : "s"}</span>
      ${isRecommended ? `<span class="starter-card-badge">Recommended</span>` : ""}
    `;
    button.addEventListener("click", () => onSelect(starter.label));
    container.appendChild(button);
  }
}
