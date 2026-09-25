// Renders preview.html: sample code in every theme, colored by syntaxPalette().
// Hand-tokenized, so it shows the *intended* roles, not a real grammar's output.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { THEMES, INKS, SURFACES, surfaceFor, syntaxPalette, PAPER, FG } from "./build.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Tiny markup: {role|text}; anything outside braces is plain variable/punct text.
const PY = `{deco|@dataclass}
{decl|class} {type|WatchProgress}({type|BaseModel}):
    {doc|"""Where a profile stopped in a title.}
{doc|    Args:}
{doc|        position: seconds from the start.}
{doc|    """}

    {prop|profile_id}: {typeBuiltin|str}
    {prop|position}: {typeBuiltin|float} = {number|0.0}
    {prop|finished}: {typeBuiltin|bool} = {number|False}

    {deco|@property}
    {decl|def} {fn|percent}({self|self}, {param|duration}: {typeBuiltin|int}) -> {typeBuiltin|float}:
        {comment|# guard against empty media}
        {control|if} {param|duration} {control|is} {number|None} {control|or} {param|duration} <= {number|0}:
            {control|return} {number|0.0}
        {control|return} {fnBuiltin|round}({self|self}.{prop|position} / {param|duration} * {number|100}, {number|1})

{control|from} {module|pathlib} {control|import} {type|Path}
{number|MAX_RETRIES} = {number|3}
{variable|label} = {deco|f}{string|"}{control|{}{variable|title}{control|}}{string| — S}{control|{}{variable|season}{deco|:02}{control|}}{deco|\\n}{string|"}
{fnBuiltin|print}({variable|label}, {param|sep}={string|", "})`;

const TS = `{doc|/**}
{doc| * Fetch a movie by id.}
{doc| * }{docTag|@param}{doc| }{param|movieId}{doc| - the }{type|MovieId}{doc| to load}
{doc| */}
{control|export} {decl|async} {decl|function} {fn|useMovie}({param|movieId}: {typeBuiltin|string}): {type|Promise}<{type|Movie}> {
  {decl|const} {variable|url} = {string|\`/movies/}{control|\${}{param|movieId}{control|}}{string|\`};
  {decl|const} {variable|res} = {control|await} {fnBuiltin|fetch}({variable|url}, { {prop|method}: {string|"GET"} });
  {control|if} (!{variable|res}.{prop|ok}) {control|throw} {control|new} {typeBuiltin|Error}({string|"not found"});
  {comment|// TODO: cache per profile}
  {control|return} {variable|res}.{fn|json}() {control|as} {type|Promise}<{type|Movie}>;
}
{decl|const} {variable|pattern} = {deco|/^tt\\d+$/};
{decl|let} {variable|count} = {number|42}, {variable|done} = {number|true};`;

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function render(src, p) {
  const ITALIC = new Set(["comment", "doc", "param", "self"]);
  let out = "";
  let last = 0;
  // Manual scan: roles never nest, but text may contain a lone "{" or "}" via the
  // control role, so keep the regex simple and fall back to plain text.
  for (const m of src.matchAll(/\{(\w+)\|(.*?)\}(?=[^}]|$)/gs)) {
    out += `<span style="color:${p.punct}">${esc(src.slice(last, m.index))}</span>`;
    const [, role, text] = m;
    const color = p[role] ?? FG;
    const style = `color:${color}${ITALIC.has(role) ? ";font-style:italic" : ""}`;
    out += `<span style="${style}">${esc(text)}</span>`;
    last = m.index + m[0].length;
  }
  out += `<span style="color:${p.punct}">${esc(src.slice(last))}</span>`;
  return out;
}

// Each ink on both papers, side by side.
const panels = THEMES.flatMap((t) => Object.keys(SURFACES).map((v) => ({ t, S: surfaceFor(v, t.ink) }))).map(({ t, S }) => {
  const p = syntaxPalette(t.ink, S);
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
  main{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
  section{background:${PAPER[950]};border:1px solid ${PAPER[700]};border-radius:6px;overflow:hidden}
  header{padding:6px 12px;font-size:13px;font-weight:600}
  pre{margin:0;padding:12px 14px;font:13px/1.5 Consolas,"Cascadia Code",monospace;white-space:pre;overflow-x:auto;border-top:1px solid ${PAPER[800]}}
</style>
<main>${panels}</main>
`);
console.log("wrote preview.html");
