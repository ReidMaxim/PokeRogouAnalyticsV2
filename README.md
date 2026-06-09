# PokéRogue Analytics

Chrome extension (Manifest V3) that automatically collects PokéRogue gameplay data locally, shows run recaps, and exports CSV/JSON for spreadsheets or AI analysis.

**Current version: 3.1.0** — analytics + Pokédex layer (alpha).

## Quick start

```bash
npm install
node scripts/generate-icons.mjs
npm run build
```

Load the **`dist/`** folder at `chrome://extensions` (Developer mode → Load unpacked).

**Important:** After installing or updating the extension, **reload the PokéRogue tab** so the early Phaser hook can capture the game.

## How it works

Production PokéRogue does **not** expose `window.globalScene`. Game state lives inside a bundled ES module.

This extension:

1. Injects at **`document_start`** in the page **MAIN** world
2. Wraps **`Phaser.Game`** before PokéRogue creates the game
3. Reads state from **`game.scene.getScene("battle")`**
4. Polls every ~1.5s and logs to IndexedDB when wave, party, money, biome, modifiers, vouchers, etc. **change**
5. Stores data in the **background service worker** IndexedDB (popup/recap read the same database)

## Pokédex layer (v3.1+)

Inspired by [RogueDex](https://github.com/roguedex-dev/roguedex) (MIT) — type effectiveness math and Roguelike→PokeAPI species ID mapping adapted with attribution.

- **In-Battle Type Cards** — RogueDex-style ally/enemy panels during `MESSAGE` / `COMMAND` / `CONFIRM` phases: sprites, types, weaknesses, resistances, immunities, ability tooltips. Draggable panels with party pagination.
- **Open Pokédex** — browse national dex (#1–1025), search/filter, species detail with flavor text and type chart.
- **Seen / Caught progress** — tracked automatically from run logs (seen = encountered in party or enemy teams; caught = used on your team). Dashboard shows seen count.

## Popup features

- **Collect Run Data** — automatic whole-run logging
- **In-Game Overlay** — optional HUD on pokerogue.net (wave, money, score, starter, biome, trainer, phase, **boss fight indicator**, modifier count, voucher total, logging status); **drag the header to reposition**; **Reset Overlay Position** restores bottom-right default
- **Run Recap playcard** — wave, money, party sprites, **result · starter · biome on one line**, vouchers earned, personal-best note, starter tip, **auto narrative summary**, **death summary on losses**, **saved run notes**, **personal run notes** editor
- **Run History** — searchable list of logged runs with **wave, duration, and last biome**; click a row to load it in the playcard; **pin ★** favorite runs; **Clear Filters** resets outcome/starter/biome/min wave/search/pinned; **sort** by date, wave, **lowest/highest wave**, result, **longest first**, or **shortest first**; **Pin Visible / Unpin Visible / Delete Visible / Export Visible (JSON/CSV)** bulk actions; filter **Pinned only**, by **outcome** (Active / Wins / Losses), **starter**, **last biome**, or **minimum wave**; delete with ×
- **Copy Recap Link / Copy Summary** — share a direct recap link or copy a plain-text run summary (biome journey, evolutions, money history, money swings, modifiers, vouchers, milestones, encounters, and boss fights)
- **Open Recap** — full interactive timeline page
- **Dashboard** — total runs, **active runs**, **pinned runs**, average wave, **avg wave (wins only)**, **avg wave (losses only)**, **win vs loss wave delta**, best run, **top starter avg wave**, **longest run**, **shortest run**, **average run duration**, most-used Pokémon, best starter, **recommended starter**, **W/L record**, **win streak** and **loss streak**, voucher inventory, win rate, toughest biome
- **Cross-run insights** — starter win rates, biome loss breakdown, **starter picker** (click to filter run history)
- **Export All / Export This Run / Export Pinned / Export Wins / Export Losses / Export Active / Export Visible** — JSON and CSV downloads (outcome and active exports include events + run summaries)
- **Import Backup (JSON)** — merge new runs or replace all local data from a prior export
- **Delete Unpinned Runs** — bulk-remove runs that aren't starred
- **Auto-export finished runs** — optional CSV/JSON/Both download when a run ends
- **Clear All Data** — wipe local IndexedDB

## Recap page

Open from the popup or `recap.html?runId=...` in the extension.

- Interactive SVG timeline with filters (wave, trainer, party, money, biome, **enemy**, **modifiers**, **vouchers**, **evolution**); **sticky filter chips** stay visible while scrolling; **Reset** returns to All; **last filter persists in chrome.storage** across recap visits and browser restarts
- Money/score sparklines
- Party compare (start vs end/current) with Pokémon sprites, **moves, abilities, and held items**
- **Run Modifiers** — full modifier list for the current run
- **Biome Journey** — biomes visited during the run with wave ranges
- **Modifier History** — log of modifier acquisitions and changes
- **Voucher History** — log of voucher inventory changes during the run
- **Party Evolution Log** — party roster changes with wave and reason
- **Money History** — log of money changes during the run
- **Wave Milestones** — run start/end, biome entries, trainers, and every 10th wave
- **Enemy Encounters** — log of enemy team changes with trainer and wave
- **Trainer Battles** — table of every trainer fight with wave, biome, enemy team, and **boss badge**
- **Death summary** — loss runs highlight where the run ended, including last enemy faced
- **Run notes** — personal notes shown on recap when saved from the popup
- **Compare Runs** — side-by-side stat table for any two logged runs (**biome** and **modifier count** included); quick actions on a **wrapping action bar** (**Compare Previous**, **Compare Best**, **Compare Worst**, **Compare Pinned**, **Compare Same Starter**); **Share Compare PNG** export
- **Run narrative** — short prose summary under the recap headline
- Key moments and collapsible **searchable event log** (text + type filter)
- **Copy Summary** — copy a plain-text run recap to clipboard (condensed milestones prioritizing trainers/start/end, encounters, bosses, money history)
- **Biome loss heatmap** across all logged runs
- **Win rate over time** — cumulative win-rate trend chart across finished runs
- **Cross-run insights** panel (starter win rates, biome losses)
- **Share PNG** — download a shareable recap card
- **Auto-refreshes every 5s** while a run is still in progress

## In-game overlay

Enable **In-Game Overlay** in the popup, then reload PokéRogue. A small panel appears bottom-right showing live wave, money, score, starter, biome, trainer, phase, boss fight status, modifier count, voucher total, and whether collection is actively logging. **Drag the overlay header** to move it — position is saved automatically. Click **−** to collapse.

## DevTools commands (PokéRogue tab console)

```javascript
__POKEROGUE_ANALYTICS__.getState()
__POKEROGUE_ANALYTICS__.discovery.run()
```

If `getState()` shows `gameCaptured: false`, reload the tab with the extension enabled.

## Data collected

Per event: run ID (seed + slot), wave, money, score, biome name, phase, trainer, party/enemy (name, level, speciesId, **ability, moves, held items**), modifier count/summary, voucher inventory, run result on game over.

CSV exports include `partyAbilities`, `partyMoves`, `partyHeldItems`, and matching **enemy** columns aligned to party slot order.

Event types: `run_start`, `run_end`, `wave_change`, `money_change`, `party_change`, `enemy_change`, `trainer_battle`, `biome_change`, `modifier_change`, `voucher_change`

## Project structure

```
src/
  content/page-hook/     document_start MAIN world (Phaser hook)
  content/game-access/   Battle scene reader
  content/overlay/       In-game HUD (draggable)
  content/collectors/    Change-detection polling
  background/            Service worker + IndexedDB owner
  popup/                 Extension popup UI
  recap/                 Full run recap page + compare + heatmap + PNG
  analytics/             Recap builder, dashboard, cross-run stats, recommendations
  storage/               IndexedDB + settings
  shared/                Biome names, sprites, vouchers, validation, messaging
  pokedex/               PokeAPI client, type effectiveness, battle cards overlay
  dex/                   Browseable Pokédex extension page
```

## Credits

- [RogueDex](https://github.com/roguedex-dev/roguedex) (MIT) — inspiration for in-battle type matchup cards, species ID conversion table, and dual-type effectiveness rules.
- [PokeAPI](https://pokeapi.co/) — species types, abilities, flavor text, and sprites.

## Development

```bash
npm run watch
npm run typecheck
```

After rebuild: reload extension on `chrome://extensions`, then reload PokéRogue.

## UI preferences (v3.0+)

Run history **sort**, **outcome**, **starter**, **biome**, **minimum wave**, and **pinned-only** filters are saved in `chrome.storage.local` and restored when you reopen the popup. The recap timeline filter uses the same storage, so your last chip selection survives browser restarts.

## Project status

**v3.1.0** adds the Pokédex layer (battle type cards + browseable dex). **v3.0.0** completed the core analytics roadmap: local run collection, recap timeline, cross-run dashboard, compare tools, exports/imports, and overlay HUD.
