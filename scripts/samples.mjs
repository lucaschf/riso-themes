// Sample code shared by preview.mjs and screenshots.mjs, hand-tokenized by
// syntax role so it shows the *intended* colors, not a real grammar's output.

// Tiny markup: {role|text}; anything outside braces is plain variable/punct text.
export const PY = `{deco|@dataclass}
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

export const TS = `{doc|/**}
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

export const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function render(src, p) {
  const ITALIC = new Set(["comment", "doc", "param", "self"]);
  let out = "";
  let last = 0;
  // Manual scan: roles never nest, but text may contain a lone "{" or "}" via the
  // control role, so keep the regex simple and fall back to plain text.
  for (const m of src.matchAll(/\{(\w+)\|(.*?)\}(?=[^}]|$)/gs)) {
    out += `<span style="color:${p.punct}">${esc(src.slice(last, m.index))}</span>`;
    const [, role, text] = m;
    const color = p[role] ?? p.variable;
    const style = `color:${color}${ITALIC.has(role) ? ";font-style:italic" : ""}`;
    out += `<span style="${style}">${esc(text)}</span>`;
    last = m.index + m[0].length;
  }
  out += `<span style="color:${p.punct}">${esc(src.slice(last))}</span>`;
  return out;
}
