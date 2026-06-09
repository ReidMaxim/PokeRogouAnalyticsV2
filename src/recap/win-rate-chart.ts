import type { RunTrendPoint } from "../analytics/run-trends";

const CHART_WIDTH = 640;
const CHART_HEIGHT = 200;
const PAD_LEFT = 44;
const PAD_RIGHT = 16;
const PAD_TOP = 16;
const PAD_BOTTOM = 36;

export function renderWinRateTrendChart(container: HTMLElement, points: RunTrendPoint[]): void {
  container.innerHTML = "";

  if (points.length === 0) {
    container.innerHTML = `<p class="empty-hint">Finish a few runs to see win-rate trends.</p>`;
    return;
  }

  const plotWidth = CHART_WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotHeight = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "win-rate-chart-svg");
  svg.setAttribute("viewBox", `0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`);
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", String(CHART_HEIGHT));

  for (let tick = 0; tick <= 100; tick += 25) {
    const y = PAD_TOP + plotHeight - (tick / 100) * plotHeight;
    const grid = document.createElementNS("http://www.w3.org/2000/svg", "line");
    grid.setAttribute("x1", String(PAD_LEFT));
    grid.setAttribute("x2", String(PAD_LEFT + plotWidth));
    grid.setAttribute("y1", String(y));
    grid.setAttribute("y2", String(y));
    grid.setAttribute("class", "trend-grid-line");
    svg.appendChild(grid);

    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", String(PAD_LEFT - 8));
    label.setAttribute("y", String(y + 4));
    label.setAttribute("class", "trend-axis-label");
    label.setAttribute("text-anchor", "end");
    label.textContent = `${tick}%`;
    svg.appendChild(label);
  }

  const xForIndex = (index: number): number => {
    if (points.length === 1) {
      return PAD_LEFT + plotWidth / 2;
    }
    return PAD_LEFT + ((index - 1) / (points.length - 1)) * plotWidth;
  };

  const yForRate = (rate: number): number => PAD_TOP + plotHeight - rate * plotHeight;

  const linePoints = points
    .map((point) => `${xForIndex(point.runIndex)},${yForRate(point.cumulativeWinRate)}`)
    .join(" ");

  const line = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  line.setAttribute("points", linePoints);
  line.setAttribute("class", "trend-line");
  svg.appendChild(line);

  for (const point of points) {
    const cx = xForIndex(point.runIndex);
    const cy = yForRate(point.cumulativeWinRate);
    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dot.setAttribute("cx", String(cx));
    dot.setAttribute("cy", String(cy));
    dot.setAttribute("r", "5");
    dot.setAttribute("class", `trend-dot ${point.result}`);
    svg.appendChild(dot);

    const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
    title.textContent = `${point.label} — ${point.result.toUpperCase()} · ${Math.round(point.cumulativeWinRate * 100)}% cumulative · wave ${point.maxWave ?? "?"}`;
    dot.appendChild(title);
  }

  const firstLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
  firstLabel.setAttribute("x", String(PAD_LEFT));
  firstLabel.setAttribute("y", String(CHART_HEIGHT - 8));
  firstLabel.setAttribute("class", "trend-axis-label");
  firstLabel.textContent = "Run 1";
  svg.appendChild(firstLabel);

  const lastLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
  lastLabel.setAttribute("x", String(PAD_LEFT + plotWidth));
  lastLabel.setAttribute("y", String(CHART_HEIGHT - 8));
  lastLabel.setAttribute("class", "trend-axis-label");
  lastLabel.setAttribute("text-anchor", "end");
  lastLabel.textContent = `Run ${points.length}`;
  svg.appendChild(lastLabel);

  container.appendChild(svg);
}
