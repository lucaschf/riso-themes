// Generates themes/*.json, the package.json theme list and palette.json.
// This file is the source of truth for every color: the shared paper ramp,
// the cream second ink, and one ink scale per theme.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// -- Shared stock ---------------------------------------------------------------
export const PAPER = {
  50: "#F5EEE0", 100: "#EDE4D2", 200: "#E0D5C1", 300: "#C9BCA6", 400: "#9A8D7A",
  500: "#675D4E", 600: "#433D33", 700: "#29261F", 800: "#1B1915", 900: "#131210",
  950: "#0C0C0A",
};
export const FG = "#EFE6D5";
const MUTED = "#9A8D7A";
const COMMENT = "#807564"; // between paper 400 and 500: quiet, still readable
const CREAM = { main: "#D9C4A0", text: "#EAD9BC" };

// The paper every theme is printed on. "dimmed" lifts it a step (like GitHub
// Dark Dimmed) and softens the text, for less contrast in a bright room; the
// inks are unchanged.
export const SURFACES = {
  normal: { suffix: "", paper: PAPER, fg: FG, muted: MUTED, comment: COMMENT },
  dimmed: {
    suffix: " Dimmed",
    paper: {
      50: "#E6DDCC", 100: "#DDD3C0", 200: "#CFC4AF", 300: "#B9AD97", 400: "#938775",
      500: "#766C5C", 600: "#4E483E", 700: "#36322B", 800: "#28251F", 900: "#1F1D18",
      950: "#191713",
    },
    fg: "#DCD2BF",
    muted: "#9A8E7B",
    comment: "#8E8371",
  },
};

// Status tones (warning swaps to orange on mustard, where gold would read as the ink).
const ERROR = "#F87171";
const WARNING = "#FBBF24";
const ORANGE_WARNING = "#FB8B24";
const INFO = "#60A5FA";

// -- Inks -----------------------------------------------------------------------
export const INKS = {
  touge:   { lightest: "#F7D8CE", light: "#E07A62", main: "#C8482F", dark: "#A63A25", contrast: "#F5EEE0" },
  green:   { lightest: "#D6EBDA", light: "#6FAE7E", main: "#3E8050", dark: "#2F6740", contrast: "#F5EEE0" },
  blue:    { lightest: "#D9E5F2", light: "#6E9CCB", main: "#3A6EA5", dark: "#2D578A", contrast: "#F5EEE0" },
  purple:  { lightest: "#E6DEF1", light: "#A48BC8", main: "#7A5AA6", dark: "#62488A", contrast: "#F5EEE0" },
  grey:    { lightest: "#E0E1DC", light: "#9A9E96", main: "#6B6F68", dark: "#52564F", contrast: "#F5EEE0" },
  orange:  { lightest: "#F6DDCB", light: "#DB8A55", main: "#B85C22", dark: "#984A1A", contrast: "#F5EEE0" },
  teal:    { lightest: "#D3EAEA", light: "#5FAAAA", main: "#2E7F80", dark: "#24686A", contrast: "#F5EEE0" },
  mustard: { lightest: "#F4E8C6", light: "#DBB85E", main: "#C49A2F", dark: "#A37E22", contrast: "#0C0C0A" },
};

export const THEMES = [
  { id: "touge", label: "Riso Touge", ink: "touge" },
  { id: "green", label: "Riso Green", ink: "green" },
  { id: "blue", label: "Riso Blue", ink: "blue" },
  { id: "purple", label: "Riso Purple", ink: "purple" },
  { id: "grey", label: "Riso Grey", ink: "grey" },
  { id: "orange", label: "Riso Orange", ink: "orange" },
  { id: "teal", label: "Riso Teal", ink: "teal" },
  { id: "mustard", label: "Riso Mustard", ink: "mustard" },
];

// Syntax roles are printed with the *other* inks of the family. The theme's own
// ink takes keywords; any role that would repeat it (or sit too close to it —
// touge vs orange) falls through to a spare ink.
// Roles are listed by how much text they cover, so strings get the first spare.
const ROLE_DEFAULTS = { string: "green", fn: "mustard", type: "teal", number: "orange", deco: "purple" };
const SPARES = ["blue", "touge", "grey"];
const NEAR = { touge: ["orange"], orange: ["touge"], green: ["teal"], teal: ["green"] };

function syntaxInks(accent) {
  const taken = new Set([accent, ...(NEAR[accent] ?? [])]);
  const roles = {};
  for (const [role, ink] of Object.entries(ROLE_DEFAULTS)) {
    if (!taken.has(ink)) {
      roles[role] = ink;
      taken.add(ink);
    }
  }
  for (const role of Object.keys(ROLE_DEFAULTS)) {
    if (roles[role]) continue;
    const spare = SPARES.find((ink) => !taken.has(ink));
    roles[role] = spare;
    taken.add(spare);
  }
  return Object.fromEntries(Object.entries(roles).map(([r, ink]) => [r, INKS[ink]]));
}

const a = (hex, alpha) => hex + alpha; // "#RRGGBB" + "AA"

// Linear mix of two "#RRGGBB" colors; t=0 -> x, t=1 -> y.
function mix(x, y, t) {
  const ch = (h, i) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  const out = [0, 1, 2].map((i) => Math.round(ch(x, i) + (ch(y, i) - ch(x, i)) * t));
  return "#" + out.map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
}

const rgbOf = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const hexOf = (rgb) =>
  "#" + rgb.map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("").toUpperCase();

function hslOf(hex) {
  const [r, g, b] = rgbOf(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}

function fromHsl(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return hexOf([r + m, g + m, b + m]);
}

// WCAG relative luminance — what the eye reads as "how light".
function luminance(hex) {
  const lin = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = rgbOf(hex).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// `hex` recolored to the ink's hue at a low saturation, keeping its luminance:
// every tinted paper is exactly as light as the shared one it replaces, so no
// ink's dimmed theme ends up brighter than another's.
function tintPaper(hex, inkHex, saturation) {
  const [inkHue, inkSat] = hslOf(inkHex);
  const s = Math.min(saturation, inkSat); // graphite stays nearly neutral
  const target = luminance(hex);
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (luminance(fromHsl(inkHue, s, mid)) < target) lo = mid;
    else hi = mid;
  }
  return fromHsl(inkHue, s, (lo + hi) / 2);
}

// The surface one theme is printed on. The normal paper is shared by the whole
// family; the dimmed one takes a tint of the theme's own ink on
// the surface steps (text steps 50–500 stay the cream ramp).
const DIMMED_TINT = { 950: 0.2, 900: 0.19, 800: 0.17, 700: 0.14, 600: 0.11 };
export function surfaceFor(variant, ink) {
  const S = SURFACES[variant];
  if (variant !== "dimmed") return S;
  const paper = { ...S.paper };
  for (const [key, sat] of Object.entries(DIMMED_TINT)) paper[key] = tintPaper(S.paper[key], INKS[ink].main, sat);
  return { ...S, paper };
}

// Every syntax role of one theme. Declarations and built-ins are *tints* of
// their parent role (same hue, closer to the paper-white) so they read as the
// same family with a different weight, instead of adding more hues.
export function syntaxPalette(ink, S = SURFACES.normal) {
  const acc = INKS[ink];
  const s = syntaxInks(ink);
  const tint = (scale) => mix(scale.light, scale.lightest, 0.45);
  return {
    control: acc.light, // if / return / import / await
    decl: tint(acc), // def / class / const / let / function
    self: tint(acc), // self / this / cls
    fn: s.fn.light,
    fnBuiltin: tint(s.fn), // print / len / console
    type: s.type.light,
    typeBuiltin: tint(s.type), // int / str / string / number
    string: s.string.light,
    doc: mix(CREAM.main, S.comment, 0.2), // docstrings: printed prose, not code
    docTag: CREAM.text, // @param / Args:
    number: s.number.light, // numbers, True/None, UPPER_CONSTANTS
    deco: s.deco.light, // decorators, regex, escapes
    variable: S.fg,
    param: S.paper[200],
    prop: S.paper[300],
    module: CREAM.text,
    punct: S.muted,
    comment: S.comment,
  };
}

// Six nesting levels per bracket mode. The theme ships "rainbow"; the other
// modes are applied by extension.js as theme-scoped colorCustomizations.
//   rainbow — the theme's syntax inks, ordered so neighbours never share a hue
//   duotone — the print's two inks: the theme's ink and the cream, alternating
//   plain   — every level in the punctuation tone (colorization "off")
export function bracketLevels(ink, S = SURFACES.normal) {
  const acc = INKS[ink];
  const p = syntaxPalette(ink, S);
  return {
    rainbow: [p.fn, p.deco, p.type, p.control, p.number, p.string],
    duotone: [acc.light, CREAM.main, mix(acc.light, acc.lightest, 0.45), CREAM.text, acc.light, CREAM.main],
    plain: Array(6).fill(S.muted),
  };
}

// Colors for bracket highlights, bracket-pair guides and (optionally) indent guides.
export function levelColors(levels, { brackets = true, indent = false } = {}) {
  const out = {};
  levels.forEach((c, i) => {
    const n = i + 1;
    if (brackets) {
      out[`editorBracketHighlight.foreground${n}`] = c;
      out[`editorBracketPairGuide.background${n}`] = a(c, "40");
      out[`editorBracketPairGuide.activeBackground${n}`] = a(c, "B3");
    }
    if (indent) {
      out[`editorIndentGuide.background${n}`] = a(c, "38");
      out[`editorIndentGuide.activeBackground${n}`] = a(c, "B3");
    }
  });
  return out;
}

function buildTheme({ label, ink }, S) {
  const acc = INKS[ink];
  const p = syntaxPalette(ink, S);
  const warn = ink === "mustard" ? ORANGE_WARNING : WARNING;

  const colors = {
    focusBorder: a(acc.main, "99"),
    foreground: S.paper[300],
    descriptionForeground: S.muted,
    errorForeground: ERROR,
    "widget.shadow": "#00000080",
    "selection.background": a(acc.main, "66"),
    "textLink.foreground": acc.light,
    "textLink.activeForeground": acc.lightest,
    "textPreformat.foreground": CREAM.text,
    "textBlockQuote.background": S.paper[900],
    "textBlockQuote.border": acc.main,
    "sash.hoverBorder": acc.main,
    "progressBar.background": acc.light,

    // Title / activity / side bar
    "titleBar.activeBackground": S.paper[950],
    "titleBar.activeForeground": S.muted,
    "titleBar.inactiveBackground": S.paper[950],
    "titleBar.inactiveForeground": S.paper[500],
    "titleBar.border": S.paper[800],
    "activityBar.background": S.paper[950],
    "activityBar.foreground": S.fg,
    "activityBar.inactiveForeground": S.paper[500],
    "activityBar.activeBorder": acc.main,
    "activityBar.border": S.paper[800],
    "activityBarBadge.background": acc.main,
    "activityBarBadge.foreground": acc.contrast,
    "sideBar.background": S.paper[900],
    "sideBar.foreground": S.paper[300],
    "sideBar.border": S.paper[800],
    "sideBarTitle.foreground": S.muted,
    "sideBarSectionHeader.background": S.paper[900],
    "sideBarSectionHeader.foreground": S.muted,
    "sideBarSectionHeader.border": S.paper[800],

    // Lists
    "list.activeSelectionBackground": a(acc.main, "4D"),
    "list.activeSelectionForeground": S.fg,
    "list.inactiveSelectionBackground": S.paper[700],
    "list.inactiveSelectionForeground": S.fg,
    "list.hoverBackground": S.paper[800],
    "list.focusOutline": a(acc.main, "99"),
    "list.highlightForeground": acc.light,
    "list.errorForeground": ERROR,
    "list.warningForeground": warn,
    "tree.indentGuidesStroke": S.paper[600],

    // Tabs / editor groups
    "editorGroup.border": S.paper[800],
    "editorGroupHeader.tabsBackground": S.paper[900],
    "editorGroupHeader.tabsBorder": S.paper[800],
    "tab.activeBackground": S.paper[950],
    "tab.activeForeground": S.fg,
    "tab.activeBorderTop": acc.main,
    "tab.inactiveBackground": S.paper[900],
    "tab.inactiveForeground": S.paper[500],
    "tab.border": S.paper[800],
    "tab.hoverBackground": S.paper[800],
    "tab.unfocusedActiveBorderTop": acc.dark,
    "breadcrumb.foreground": S.muted,
    "breadcrumb.focusForeground": S.fg,
    "breadcrumb.activeSelectionForeground": acc.light,
    "breadcrumbPicker.background": S.paper[800],

    // Editor
    "editor.background": S.paper[950],
    "editor.foreground": S.fg,
    "editorLineNumber.foreground": S.paper[600],
    "editorLineNumber.activeForeground": acc.light,
    "editorCursor.foreground": acc.light,
    "editor.selectionBackground": a(acc.main, "55"),
    "editor.inactiveSelectionBackground": a(acc.main, "2E"),
    "editor.selectionHighlightBackground": a(CREAM.main, "22"),
    "editor.wordHighlightBackground": a(CREAM.main, "1F"),
    "editor.wordHighlightStrongBackground": a(acc.main, "38"),
    "editor.findMatchBackground": a(acc.main, "88"),
    "editor.findMatchBorder": acc.light,
    "editor.findMatchHighlightBackground": a(CREAM.main, "33"),
    "editor.lineHighlightBackground": S.paper[900],
    "editor.lineHighlightBorder": "#00000000",
    "editor.rangeHighlightBackground": a(CREAM.main, "14"),
    "editorIndentGuide.background1": S.paper[700],
    "editorIndentGuide.activeBackground1": S.paper[500],
    "editorWhitespace.foreground": S.paper[700],
    "editorRuler.foreground": S.paper[800],
    "editorBracketMatch.background": a(acc.main, "33"),
    "editorBracketMatch.border": acc.light,
    ...levelColors(bracketLevels(ink, S).rainbow),
    "editorBracketHighlight.unexpectedBracket.foreground": ERROR,
    "editorCodeLens.foreground": S.paper[500],
    "editorLink.activeForeground": acc.light,
    "editorError.foreground": ERROR,
    "editorWarning.foreground": warn,
    "editorInfo.foreground": INFO,
    "editorGutter.addedBackground": INKS.green.light,
    "editorGutter.modifiedBackground": INKS.blue.light,
    "editorGutter.deletedBackground": ERROR,
    "editorOverviewRuler.border": S.paper[800],
    "diffEditor.insertedTextBackground": a(INKS.green.main, "2E"),
    "diffEditor.removedTextBackground": a(ERROR, "24"),

    // Widgets
    "editorWidget.background": S.paper[800],
    "editorWidget.border": S.paper[700],
    "editorSuggestWidget.background": S.paper[800],
    "editorSuggestWidget.border": S.paper[700],
    "editorSuggestWidget.selectedBackground": a(acc.main, "4D"),
    "editorSuggestWidget.highlightForeground": acc.light,
    "editorHoverWidget.background": S.paper[800],
    "editorHoverWidget.border": S.paper[700],
    "peekView.border": acc.main,
    "peekViewTitle.background": S.paper[800],
    "peekViewEditor.background": S.paper[900],
    "peekViewResult.background": S.paper[800],
    "peekViewEditor.matchHighlightBackground": a(acc.main, "55"),
    "peekViewResult.matchHighlightBackground": a(acc.main, "55"),
    "quickInput.background": S.paper[900],
    "quickInputList.focusBackground": a(acc.main, "4D"),
    "notifications.background": S.paper[800],
    "notifications.border": S.paper[700],
    "notificationCenterHeader.background": S.paper[800],
    "menu.background": S.paper[900],
    "menu.selectionBackground": a(acc.main, "4D"),
    "menu.separatorBackground": S.paper[700],

    // Controls
    "button.background": acc.main,
    "button.foreground": acc.contrast,
    "button.hoverBackground": acc.dark,
    "button.secondaryBackground": S.paper[700],
    "button.secondaryForeground": CREAM.text,
    "button.secondaryHoverBackground": S.paper[600],
    "badge.background": acc.main,
    "badge.foreground": acc.contrast,
    "input.background": S.paper[950],
    "input.foreground": S.fg,
    "input.border": S.paper[700],
    "input.placeholderForeground": S.paper[500],
    "inputOption.activeBorder": acc.light,
    "inputOption.activeBackground": a(acc.main, "40"),
    "dropdown.background": S.paper[900],
    "dropdown.border": S.paper[700],
    "checkbox.background": S.paper[900],
    "checkbox.border": S.paper[700],
    "scrollbarSlider.background": a(S.paper[600], "66"),
    "scrollbarSlider.hoverBackground": a(S.paper[600], "99"),
    "scrollbarSlider.activeBackground": a(S.paper[500], "CC"),

    // Status bar — a solid block of the ink, like a poster's title band
    "statusBar.background": acc.main,
    "statusBar.foreground": acc.contrast,
    "statusBar.border": acc.main,
    "statusBar.noFolderBackground": S.paper[700],
    "statusBar.noFolderForeground": CREAM.text,
    "statusBar.debuggingBackground": ink === "orange" ? INKS.teal.main : INKS.orange.main,
    "statusBar.debuggingForeground": "#F5EEE0",
    "statusBarItem.remoteBackground": acc.dark,
    "statusBarItem.remoteForeground": acc.contrast,
    "statusBarItem.hoverBackground": a("#000000", "26"),

    // Panel / terminal
    "panel.background": S.paper[900],
    "panel.border": S.paper[800],
    "panelTitle.activeBorder": acc.main,
    "panelTitle.activeForeground": S.fg,
    "panelTitle.inactiveForeground": S.paper[500],
    "terminal.background": S.paper[900],
    "terminal.foreground": S.fg,
    "terminalCursor.foreground": acc.light,
    "terminal.selectionBackground": a(acc.main, "55"),
    "terminal.ansiBlack": S.paper[700],
    "terminal.ansiRed": INKS.touge.light,
    "terminal.ansiGreen": INKS.green.light,
    "terminal.ansiYellow": INKS.mustard.light,
    "terminal.ansiBlue": INKS.blue.light,
    "terminal.ansiMagenta": INKS.purple.light,
    "terminal.ansiCyan": INKS.teal.light,
    "terminal.ansiWhite": S.paper[200],
    "terminal.ansiBrightBlack": S.paper[500],
    "terminal.ansiBrightRed": INKS.touge.lightest,
    "terminal.ansiBrightGreen": INKS.green.lightest,
    "terminal.ansiBrightYellow": INKS.mustard.lightest,
    "terminal.ansiBrightBlue": INKS.blue.lightest,
    "terminal.ansiBrightMagenta": INKS.purple.lightest,
    "terminal.ansiBrightCyan": INKS.teal.lightest,
    "terminal.ansiBrightWhite": S.paper[50],

    // Git
    "gitDecoration.addedResourceForeground": INKS.green.light,
    "gitDecoration.modifiedResourceForeground": INKS.mustard.light,
    "gitDecoration.deletedResourceForeground": ERROR,
    "gitDecoration.untrackedResourceForeground": INKS.teal.light,
    "gitDecoration.ignoredResourceForeground": S.paper[500],
    "gitDecoration.conflictingResourceForeground": INKS.orange.light,
  };

  const it = (foreground) => ({ foreground, fontStyle: "italic" });
  const rule = (scope, settings) => ({ scope, settings: typeof settings === "string" ? { foreground: settings } : settings });

  const tokenColors = [
    // Base
    rule(["variable", "variable.other.readwrite", "meta.definition.variable"], p.variable),
    rule(["keyword.operator", "punctuation", "meta.brace", "punctuation.separator", "punctuation.terminator"], p.punct),
    rule(["comment", "punctuation.definition.comment"], it(p.comment)),

    // Keywords: control flow in the ink, declarations in its tint
    rule(["keyword", "keyword.control", "keyword.control.import", "keyword.control.from", "keyword.control.export", "keyword.control.as",
      "keyword.operator.new", "keyword.operator.expression", "keyword.operator.word", "keyword.operator.logical.python",
      "keyword.operator.spread", "keyword.operator.rest", "keyword.operator.optional", "keyword.operator.definiteassignment"], p.control),
    rule(["storage", "storage.type", "storage.modifier", "storage.type.function", "storage.type.class", "keyword.declaration"], p.decl),

    // Strings
    rule(["string", "punctuation.definition.string"], p.string),
    rule(["storage.type.string.python", "storage.type.format.python", "constant.character.escape", "string.regexp",
      "constant.other.placeholder", "constant.character.format.placeholder.other.python"], p.deco),
    rule(["punctuation.definition.template-expression", "punctuation.section.embedded",
      "meta.fstring.python constant.character.format.placeholder.other.python"], p.control),
    rule(["meta.template.expression", "meta.embedded.line"], p.variable),

    // Documentation: docstrings and JSDoc read as printed prose
    rule(["string.quoted.docstring", "string.quoted.docstring punctuation.definition.string",
      "comment.block.documentation", "comment.block.documentation punctuation.definition.comment"], it(p.doc)),
    rule(["storage.type.class.jsdoc", "punctuation.definition.block.tag.jsdoc", "comment.block.documentation storage.type"], p.docTag),
    rule(["comment.block.documentation entity.name.type", "entity.name.type.instance.jsdoc"], it(p.type)),
    rule(["comment.block.documentation variable", "variable.other.jsdoc"], it(p.param)),

    // Constants
    rule(["constant.numeric", "constant.language", "constant.other", "support.constant", "variable.other.constant",
      "variable.other.enummember", "keyword.other.unit", "constant.other.color"], p.number),

    // Functions
    rule(["entity.name.function", "meta.function-call.generic", "variable.function", "support.function",
      "entity.name.function.member"], p.fn),
    rule(["support.function.builtin", "support.function.magic", "support.function.console", "support.function.dom"], p.fnBuiltin),

    // Types
    rule(["entity.name.type", "entity.name.class", "support.class", "entity.other.inherited-class",
      "entity.name.type.enum", "entity.name.type.interface", "entity.name.type.alias", "support.class.component"], p.type),
    rule(["support.type.builtin", "support.type.primitive", "support.type.python", "support.class.builtin"], p.typeBuiltin),
    rule(["entity.name.type.parameter"], it(p.type)),

    // Decorators
    rule(["entity.name.decorator", "meta.decorator", "punctuation.decorator", "entity.name.function.decorator",
      "punctuation.definition.decorator"], p.deco),

    // Variables
    rule(["variable.parameter", "variable.parameter.function"], it(p.param)),
    rule(["variable.language", "variable.language.this", "variable.language.super",
      "variable.parameter.function.language.special.self", "variable.parameter.function.language.special.cls",
      "support.variable.magic"], it(p.self)),
    rule(["variable.other.property", "variable.other.object.property", "support.variable.property",
      "meta.object-literal.key", "entity.name.variable.field"], p.prop),
    rule(["entity.name.namespace", "entity.name.module", "entity.name.type.module"], p.module),

    // Markup: HTML / JSX / CSS
    rule(["entity.name.tag"], p.control),
    rule(["punctuation.definition.tag"], p.punct),
    rule(["entity.other.attribute-name"], it(p.fn)),
    rule(["entity.other.attribute-name.class.css", "entity.other.attribute-name.class"], p.fn),
    rule(["entity.other.attribute-name.id"], p.number),
    rule(["entity.other.attribute-name.pseudo-class", "entity.other.attribute-name.pseudo-element"], p.deco),
    rule(["support.type.property-name", "support.type.vendored.property-name"], p.param),
    rule(["support.constant.property-value"], p.number),

    // Data: JSON / YAML / TOML keys in the ink
    rule(["support.type.property-name.json", "entity.name.tag.yaml", "support.type.property-name.toml",
      "keyword.key.toml"], p.control),

    // Markdown
    rule(["markup.heading", "entity.name.section", "punctuation.definition.heading"], { foreground: p.control, fontStyle: "bold" }),
    rule(["markup.bold"], { fontStyle: "bold" }),
    rule(["markup.italic"], { fontStyle: "italic" }),
    rule(["markup.inline.raw", "markup.fenced_code", "markup.raw"], p.string),
    rule(["markup.underline.link", "string.other.link"], p.type),
    rule(["markup.quote"], it(p.doc)),
    rule(["punctuation.definition.list", "beginning.punctuation.definition.list"], p.control),
    rule(["markup.inserted"], INKS.green.light),
    rule(["markup.deleted"], ERROR),
    rule(["markup.changed"], INKS.mustard.light),
    rule(["invalid"], ERROR),
  ];

  const semanticTokenColors = {
    namespace: p.module,
    module: p.module,
    class: p.type,
    interface: p.type,
    enum: p.type,
    type: p.type,
    typeParameter: { foreground: p.type, italic: true },
    "class.defaultLibrary": p.typeBuiltin,
    "type.defaultLibrary": p.typeBuiltin,
    function: p.fn,
    method: p.fn,
    "function.defaultLibrary": p.fnBuiltin,
    "method.defaultLibrary": p.fnBuiltin,
    magicFunction: p.fnBuiltin,
    decorator: p.deco,
    parameter: { foreground: p.param, italic: true },
    property: p.prop,
    enumMember: p.number,
    builtinConstant: p.number,
    variable: p.variable,
    "variable.defaultLibrary": p.typeBuiltin,
    selfParameter: { foreground: p.self, italic: true },
    clsParameter: { foreground: p.self, italic: true },
  };

  return {
    $schema: "vscode://schemas/color-theme",
    name: label,
    type: "dark",
    semanticHighlighting: true,
    colors,
    tokenColors,
    semanticTokenColors,
  };
}

// Every theme in both surfaces: "Riso Touge" + "Riso Touge Dimmed".
const VARIANTS = THEMES.flatMap((t) =>
  Object.keys(SURFACES).map((variant) => ({
    ...t,
    variant,
    S: surfaceFor(variant, t.ink),
    file: `riso-${t.id}${variant === "normal" ? "" : "-" + variant}.json`,
    fullLabel: t.label + SURFACES[variant].suffix,
  })),
);

const outDir = join(root, "themes");
mkdirSync(outDir, { recursive: true });
for (const v of VARIANTS) {
  const theme = buildTheme({ label: v.fullLabel, ink: v.ink }, v.S);
  writeFileSync(join(outDir, v.file), JSON.stringify(theme, null, 2) + "\n");
}

// Keep package.json's theme list in step with what was generated.
const pkgPath = join(root, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
pkg.contributes.themes = VARIANTS.map((v) => ({ label: v.fullLabel, uiTheme: "vs-dark", path: `./themes/${v.file}` }));
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

// Rainbow identifiers: every ink but the graphite, at full strength and as a
// tint — 14 colors, so few names in one file end up sharing a color.
const IDENTIFIER_INKS = ["touge", "mustard", "purple", "teal", "orange", "blue", "green"];
const identifierColors = [
  ...IDENTIFIER_INKS.map((ink) => INKS[ink].light),
  ...IDENTIFIER_INKS.map((ink) => mix(INKS[ink].light, INKS[ink].lightest, 0.45)),
];

// palette.json feeds extension.js: the identifier colors, and per theme label
// the level colors of every bracket mode.
const palette = {
  identifiers: identifierColors,
  themes: Object.fromEntries(
    VARIANTS.map((v) => [
      v.fullLabel,
      {
        ink: v.ink,
        base: v.label, // the ink's name without the surface suffix
        variant: v.variant,
        levels: bracketLevels(v.ink, v.S),
      },
    ]),
  ),
};
writeFileSync(join(root, "palette.json"), JSON.stringify(palette, null, 2) + "\n");
console.log(`wrote ${VARIANTS.length} themes to ${outDir} + package.json theme list + palette.json`);
