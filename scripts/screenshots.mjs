// Renders the README images: small HTML pages built from the real palettes,
// screenshotted with headless Chrome (or Edge). `npm run screenshots`; set
// CHROME_PATH if the browser isn't found.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { THEMES, INKS, surfaceFor, syntaxPalette, bracketLevels } from "./build.mjs";
import { esc, render } from "./samples.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "images", "screenshots");
const srcDir = join(outDir, ".src"); // the generated pages, gitignored
mkdirSync(srcDir, { recursive: true });
const palette = JSON.parse(readFileSync(join(root, "palette.json"), "utf8"));

function browser() {
  const candidates = [
    process.env.CHROME_PATH,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ];
  const found = candidates.find((p) => p && existsSync(p));
  if (!found) throw new Error("No Chrome or Edge found — set CHROME_PATH.");
  return found;
}

function shoot(name, html, width, height) {
  const page = join(srcDir, `${name}.html`);
  writeFileSync(page, html);
  execFileSync(browser(), [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--force-device-scale-factor=2",
    "--default-background-color=00000000",
    `--window-size=${width},${height}`,
    `--screenshot=${join(outDir, `${name}.png`)}`,
    pathToFileURL(page).href,
  ], { stdio: "ignore" });
  console.log(`wrote images/screenshots/${name}.png`);
}

const theme = (label) => THEMES.find((t) => t.label === label);

// Page height for rows of windows showing `lines` lines of code: title bar 33,
// code padding 30, 20 per line, 18 between rows, 40 page padding, 12 of shadow.
const heightFor = (lines, rows = 1) => rows * (33 + 30 + lines * 20) + (rows - 1) * 18 + 40 + 12;

const page = (body, columns, width) => `<!doctype html>
<meta charset="utf-8">
<style>
  html, body { margin: 0; background: transparent; }
  body { padding: 20px; font-family: "Segoe UI", Inter, system-ui, sans-serif; }
  main { display: grid; grid-template-columns: repeat(${columns}, ${width}px); gap: 18px; }
  .win { border-radius: 10px; overflow: hidden; box-shadow: 0 6px 18px rgba(0, 0, 0, .28); }
  .bar { display: flex; align-items: center; gap: 7px; padding: 8px 12px; font-size: 13px; font-weight: 600; }
  .dot { width: 9px; height: 9px; border-radius: 50%; opacity: .5; }
  .bar span:last-child { margin-left: 6px; }
  pre { margin: 0; padding: 14px 16px 16px; font: 12.5px/1.6 "Cascadia Code", Consolas, monospace; font-variant-ligatures: none; white-space: pre; }
</style>
<main>${body}</main>
`;

// An editor window: the status-bar ink as the title band, the paper as the page.
function win(t, S, code, title = t.label + S.suffix) {
  const acc = INKS[t.ink];
  const dot = `<i class="dot" style="background:${acc.contrast}"></i>`;
  return `<div class="win" style="background:${S.paper[950]}">
  <div class="bar" style="background:${acc.main};color:${acc.contrast}">${dot}${dot}${dot}<span>${esc(title)}</span></div>
  <pre>${code}</pre>
</div>`;
}

// -- Hero: every ink on the near-black paper ----------------------------------------

const HERO = `{deco|@dataclass}
{decl|class} {type|Movie}({type|BaseModel}):
    {prop|title}: {typeBuiltin|str}
    {prop|year}: {typeBuiltin|int} = {number|2026}

    {decl|def} {fn|label}({self|self}) -> {typeBuiltin|str}:
        {comment|# "Riso (2026)"}
        {control|return} {deco|f}{string|"}{control|{}{self|self}.{prop|title}{control|}}{string| (}{control|{}{self|self}.{prop|year}{control|}}{string|)"}`;

shoot(
  "inks",
  page(THEMES.map((t) => {
    const S = surfaceFor("normal", t.ink);
    return win(t, S, render(HERO, syntaxPalette(t, S)));
  }).join("\n"), 3, 520),
  3 * 520 + 2 * 18 + 40,
  heightFor(8, 4),
);

// -- Papers: one ink on the three stocks ---------------------------------------------

const PAPERS = `{decl|def} {fn|percent}({self|self}, {param|duration}: {typeBuiltin|int}) -> {typeBuiltin|float}:
    {doc|"""Share of the title watched, 0–100."""}
    {comment|# guard against empty media}
    {control|if} {param|duration} {control|is} {number|None} {control|or} {param|duration} <= {number|0}:
        {control|return} {number|0.0}
    {control|return} {fnBuiltin|round}({self|self}.{prop|position} / {param|duration} * {number|100}, {number|1})`;

for (const [name, label] of [["papers", "Riso Touge"], ["duotone", "Riso Pink × Blue"]]) {
  const t = theme(label);
  shoot(
    name,
    page(["normal", "dimmed", "paper"].map((v) => {
      const S = surfaceFor(v, t.ink);
      return win(t, S, render(PAPERS, syntaxPalette(t, S)));
    }).join("\n"), 3, 590),
    3 * 590 + 2 * 18 + 40,
    heightFor(6),
  );
}

// -- Color by name: the same code with the feature off and on ------------------------
//
// Mirrors rainbowIdentifiers.js: FNV-1a of the name picks one of the paper's
// identifier colors; brackets take their nesting level's rainbow color.

function hash(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

// `{i<role>|name}` marks an identifier the extension paints (its role when off).
const BY_NAME = `{decl|def} {fn|watched}({iparam|progress}, {iparam|catalog}):
    {ivariable|done} = []
    {control|for} {ivariable|entry} {control|in} {iparam|progress}:
        {ivariable|movie} = {iparam|catalog}.{fn|get}({ivariable|entry}.{iprop|movie_id})
        {control|if} {ivariable|movie} {control|and} {ivariable|entry}.{iprop|position} >= {ivariable|movie}.{iprop|runtime} * {number|0.9}:
            {ivariable|done}.{fn|append}(({ivariable|movie}.{iprop|title}, {fnBuiltin|round}({ivariable|entry}.{iprop|position} / {number|60})))
    {control|return} {fnBuiltin|sorted}({ivariable|done}, {iparam|key}={decl|lambda} {iparam|pair}: {iparam|pair}[{number|1}])`;

function renderByName(src, p, { ids, levels }) {
  const ITALIC = new Set(["comment", "doc", "param", "self"]);
  let depth = 0;
  const plain = (text) =>
    [...text].map((ch) => {
      let color = p.punct;
      if (levels && "([{".includes(ch)) color = levels[depth++ % levels.length];
      else if (levels && ")]}".includes(ch)) color = levels[--depth % levels.length];
      return `<span style="color:${color}">${esc(ch)}</span>`;
    }).join("");
  let out = "";
  let last = 0;
  for (const m of src.matchAll(/\{(\w+)\|(.*?)\}(?=[^}]|$)/gs)) {
    out += plain(src.slice(last, m.index));
    const [, tag, text] = m;
    const role = tag.startsWith("i") && p[tag.slice(1)] ? tag.slice(1) : tag;
    const color = ids && role !== tag ? ids[hash(text) % ids.length] : p[role] ?? p.variable;
    out += `<span style="color:${color}${ITALIC.has(role) ? ";font-style:italic" : ""}">${esc(text)}</span>`;
    last = m.index + m[0].length;
  }
  return out + plain(src.slice(last));
}

{
  const t = theme("Riso Touge");
  const S = surfaceFor("normal", t.ink);
  const p = syntaxPalette(t, S);
  const on = { ids: palette.themes[t.label].identifiers, levels: bracketLevels(t, S).rainbow };
  shoot(
    "color-by-name",
    page([
      win(t, S, renderByName(BY_NAME, p, {}), "Color by name — off"),
      win(t, S, renderByName(BY_NAME, p, on), "Color by name — on, with rainbow brackets"),
    ].join("\n"), 2, 790),
    2 * 790 + 18 + 40,
    heightFor(7),
  );
}
