import * as esbuild from "esbuild";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const watch = process.argv.includes("--watch");
const outdir = join(__dirname, "dist");

const entryPoints = {
  background: "src/background/index.ts",
  content: "src/content/index.ts",
  "page-hook": "src/content/page-hook/index.ts",
  popup: "src/popup/index.ts",
  recap: "src/recap/index.ts",
  dex: "src/dex/index.ts",
};

function copyStaticAssets() {
  mkdirSync(outdir, { recursive: true });
  cpSync(join(__dirname, "manifest.json"), join(outdir, "manifest.json"));
  cpSync(join(__dirname, "src/popup/index.html"), join(outdir, "popup.html"));
  cpSync(join(__dirname, "src/popup/popup.css"), join(outdir, "popup.css"));
  cpSync(join(__dirname, "src/recap/index.html"), join(outdir, "recap.html"));
  cpSync(join(__dirname, "src/recap/recap.css"), join(outdir, "recap.css"));
  cpSync(join(__dirname, "src/dex/index.html"), join(outdir, "dex.html"));
  cpSync(join(__dirname, "src/dex/dex.css"), join(outdir, "dex.css"));
  cpSync(join(__dirname, "icons"), join(outdir, "icons"), { recursive: true });
}

const buildOptions = {
  entryPoints,
  bundle: true,
  outdir,
  format: "iife",
  target: ["chrome120"],
  sourcemap: true,
  logLevel: "info",
};

async function build() {
  rmSync(outdir, { recursive: true, force: true });
  copyStaticAssets();

  if (watch) {
    const ctx = await esbuild.context(buildOptions);
    await ctx.watch();
    console.log("Watching for changes...");
    return;
  }

  await esbuild.build(buildOptions);
  console.log("Build complete -> dist/");
}

build().catch((error) => {
  console.error(error);
  process.exit(1);
});
