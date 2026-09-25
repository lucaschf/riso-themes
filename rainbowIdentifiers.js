// Rainbow identifiers: every parameter / variable name gets its own color,
// picked by hashing the name — `movieId` is the same color on every line and
// in every file. Like JetBrains' semantic highlighting.
//
// The names come from the language's semantic tokens (TS/JS built in; Python
// via Pylance), fetched with the same commands VS Code uses to color them, and
// are painted as text decorations. Only active under a Riso theme.
const vscode = require("vscode");
const palette = require("./palette.json");
const log = require("./log");

const SECTION = "riso.rainbowIdentifiers";
const DEFAULT_KINDS = ["parameter", "variable", "property", "constant", "class", "interface", "enum", "type"];
const TYPE_KINDS = new Set(["class", "interface", "enum", "type", "typeParameter"]);
// Semantic tokens are not ready until the language server has analyzed the
// file — Pylance indexing a large project can take a minute. Back off to ~2 min.
const RETRY_MS = [500, 1000, 2000, 4000, 8000, 15000, 30000, 60000];
const DEBOUNCE_MS = 250;

// FNV-1a: stable across sessions, so a name keeps its color.
function hash(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

function options() {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  return {
    enabled: cfg.get("enabled", false),
    kinds: new Set(cfg.get("kinds", DEFAULT_KINDS)),
  };
}

function isRisoTheme() {
  const label = vscode.workspace.getConfiguration("workbench").get("colorTheme");
  return Boolean(palette.themes[label]);
}

const modifierMask = (legend, names) =>
  names.reduce((mask, name) => {
    const bit = legend.tokenModifiers.indexOf(name);
    return bit < 0 ? mask : mask | (1 << bit);
  }, 0);

// Like JetBrains, only *local* variables get a per-name color; globals and
// imports keep the theme's color. TypeScript marks locals with a `local`
// modifier. Pylance (and most servers) don't, so a variable counts as local
// when one of its declarations sits on an indented line — module-level
// assignments and imports are at column 0.
function localVariableFilter(doc, legend, tokens) {
  const local = modifierMask(legend, ["local"]);
  if (local) return (t) => (t.mods & local) !== 0;

  const declaration = modifierMask(legend, ["declaration"]);
  const classMember = modifierMask(legend, ["classMember"]);
  const names = new Set();
  for (const t of tokens) {
    if (t.type !== "variable" || !(t.mods & declaration) || t.mods & classMember) continue;
    if (doc.lineAt(t.line).firstNonWhitespaceCharacterIndex > 0) names.add(t.name);
  }
  return (t) => names.has(t.name);
}

// Decode the semantic token stream into ranges bucketed by color index.
function bucketize(doc, legend, data, kinds, colorCount) {
  const tokens = [];
  let line = 0;
  let char = 0;
  for (let i = 0; i < data.length; i += 5) {
    const deltaLine = data[i];
    line += deltaLine;
    char = deltaLine ? data[i + 1] : char + data[i + 1];
    const range = new vscode.Range(line, char, line, char + data[i + 2]);
    tokens.push({ line, range, type: legend.tokenTypes[data[i + 3]], mods: data[i + 4], name: doc.getText(range) });
  }

  // Values: skip window / document, print / range and imported library
  // symbols. Types: library classes (BaseModel, Protocol) do get a color, like
  // in JetBrains; only built-ins (str, int, Error) keep the theme's.
  const skipValue = modifierMask(legend, ["defaultLibrary", "builtin", "library"]);
  const skipType = modifierMask(legend, ["defaultLibrary", "builtin"]);
  const classMember = modifierMask(legend, ["classMember"]);
  const readonly = modifierMask(legend, ["readonly"]);
  const isLocal = localVariableFilter(doc, legend, tokens);

  // The setting's vocabulary: semantic token types, plus "constant" (readonly
  // values, enum members). Pylance reports fields as variable + classMember.
  const kindOf = (t) => {
    if (TYPE_KINDS.has(t.type)) return t.type;
    if (t.type === "enumMember") return "constant";
    if (t.type === "variable" || t.type === "property") {
      if (t.mods & classMember) return t.mods & readonly ? "constant" : "property";
      if (t.type === "property") return "property";
      if (isLocal(t)) return "variable";
      return t.mods & readonly ? "constant" : undefined; // a plain global (`bp = …`)
    }
    return t.type;
  };

  const buckets = Array.from({ length: colorCount }, () => []);
  for (const t of tokens) {
    const kind = kindOf(t);
    if (!kind || !kinds.has(kind)) continue;
    if (t.mods & (TYPE_KINDS.has(kind) ? skipType : skipValue)) continue;
    buckets[hash(t.name) % colorCount].push(t.range);
  }
  return buckets;
}

class RainbowIdentifiers {
  constructor() {
    this.decorations = [];
    this.timers = new Map();
    this.generation = new Map(); // per document; a new schedule() cancels older retries
  }

  // (Re)create one decoration type per color, or none when inactive.
  // Disposing a type also clears it from every editor.
  // A theme switch fires both a configuration and a color-theme event; coalesce
  // them so the decorations are rebuilt once.
  requestReset() {
    clearTimeout(this.resetTimer);
    this.resetTimer = setTimeout(() => this.reset(), 50);
  }

  reset() {
    for (const d of this.decorations) d.dispose();
    this.decorations = [];
    const { enabled, kinds } = options();
    const state = `enabled=${enabled} risoTheme=${isRisoTheme()} kinds=${[...kinds].join(",")}`;
    if (state !== this.lastState) log.info(`identifiers: ${state}`);
    this.lastState = state;
    if (enabled && isRisoTheme()) {
      // Each surface has its own set: pale inks on dark paper, deep inks on light.
      const label = vscode.workspace.getConfiguration("workbench").get("colorTheme");
      this.decorations = palette.themes[label].identifiers.map((color) =>
        vscode.window.createTextEditorDecorationType({ color }),
      );
    }
    for (const editor of vscode.window.visibleTextEditors) this.schedule(editor.document, 0);
  }

  schedule(doc, delay = DEBOUNCE_MS) {
    if (!this.decorations.length) return;
    const key = doc.uri.toString();
    const gen = (this.generation.get(key) ?? 0) + 1;
    this.generation.set(key, gen);
    this.retryLater(doc, gen, 0, delay);
  }

  retryLater(doc, gen, attempt, delay) {
    const key = doc.uri.toString();
    clearTimeout(this.timers.get(key));
    this.timers.set(key, setTimeout(() => this.paint(doc, gen, attempt), delay));
  }

  async paint(doc, gen, attempt) {
    const key = doc.uri.toString();
    if (this.generation.get(key) !== gen) return; // superseded
    const editors = vscode.window.visibleTextEditors.filter((e) => e.document === doc);
    if (!editors.length || !this.decorations.length) return;

    const version = doc.version;
    let legend;
    let tokens;
    try {
      legend = await vscode.commands.executeCommand("vscode.provideDocumentSemanticTokensLegend", doc.uri);
      tokens = await vscode.commands.executeCommand("vscode.provideDocumentSemanticTokens", doc.uri);
    } catch (err) {
      log.error(`identifiers: semantic tokens failed for ${doc.fileName}`, err);
      return;
    }
    const empty = !tokens || (tokens.data.length === 0 && doc.lineCount > 1);
    if (!legend || empty) {
      if (attempt < RETRY_MS.length) {
        this.retryLater(doc, gen, attempt + 1, RETRY_MS[attempt]);
      } else {
        log.info(`identifiers: no semantic tokens for ${doc.fileName} (${doc.languageId}); gave up`);
      }
      return;
    }
    if (doc.version !== version || this.generation.get(key) !== gen) return; // a newer paint is scheduled

    const decorations = this.decorations;
    const buckets = bucketize(doc, legend, tokens.data, options().kinds, decorations.length);
    for (const editor of editors) {
      decorations.forEach((d, i) => editor.setDecorations(d, buckets[i]));
    }
    const painted = buckets.reduce((n, b) => n + b.length, 0);
    log.info(`identifiers: ${painted} names painted in ${doc.fileName} (attempt ${attempt + 1})`);
  }

  register(context) {
    context.subscriptions.push(
      { dispose: () => this.decorations.forEach((d) => d.dispose()) },
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration(SECTION) || e.affectsConfiguration("workbench.colorTheme")) this.requestReset();
      }),
      vscode.window.onDidChangeActiveColorTheme(() => this.requestReset()),
      vscode.workspace.onDidChangeTextDocument((e) => this.schedule(e.document)),
      vscode.window.onDidChangeActiveTextEditor((editor) => editor && this.schedule(editor.document, 0)),
      vscode.window.onDidChangeVisibleTextEditors((editors) => {
        for (const editor of editors) this.schedule(editor.document, 0);
      }),
      vscode.commands.registerCommand("riso.toggleRainbowIdentifiers", async () => {
        const cfg = vscode.workspace.getConfiguration(SECTION);
        const next = !cfg.get("enabled", false);
        await cfg.update("enabled", next, vscode.ConfigurationTarget.Global);
        vscode.window.setStatusBarMessage(`Riso: rainbow identifiers ${next ? "on" : "off"}`, 2500);
      }),
    );
    this.reset();
  }
}

module.exports = { RainbowIdentifiers, bucketize, hash };
