// Renders preview.html: the sample code in every theme on its three papers.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { THEMES, INKS, SURFACES, surfaceFor, syntaxPalette, PAPER, FG } from "./build.mjs";
import { PY, TS, render } from "./samples.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Each ink on both papers, side by side.
const panels = THEMES.flatMap((t) => Object.keys(SURFACES).map((v) => ({ t, S: surfaceFor(v, t.ink) }))).map(({ t, S }) => {
  const p = syntaxPalette(t, S);
  const acc = INKS[t.ink];
  return `<section style="background:${S.paper[950]};border-color:${S.paper[700]}">
  <header style="background:${acc.main};color:${acc.contrast}">${t.label}${S.suffix}</header>
  <pre>${render(PY, p)}</pre>
  <pre>${render(TS, p)}</pre>
</section>`;
}).join("\n");

writeFileSync(join(root, "preview.html"), `<!doctype html>
<meta charset="utf-8"><title>Riso Preview</title>
<style>
  body{margin:0;padding:16px;background:${PAPER[950]};font-family:Inter,system-ui,sans-serif;color:${FG}}
  main{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
  section{background:${PAPER[950]};border:1px solid ${PAPER[700]};border-radius:6px;overflow:hidden}
  header{padding:6px 12px;font-size:13px;font-weight:600}
  pre{margin:0;padding:12px 14px;font:13px/1.5 Consolas,"Cascadia Code",monospace;white-space:pre;overflow-x:auto;border-top:1px solid ${PAPER[800]}}
</style>
<main>${panels}</main>
`);
console.log("wrote preview.html");
