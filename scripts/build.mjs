// Generates themes/*.json, the package.json theme list and palette.json.
// This file is the source of truth for every color: the paper ramps, the
// second inks, and one ink scale per theme.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// -- Color math -------------------------------------------------------------------

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

export function contrast(x, y) {
  const [hi, lo] = [luminance(x), luminance(y)].sort((p, q) => q - p);
  return (hi + 0.05) / (lo + 0.05);
}

// `hex`, moved toward `edge` in small steps until it reads on `bg` at `min`.
function readable(hex, bg, min, edge) {
  for (let t = 0; t < 1; t += 0.05) {
    const c = mix(hex, edge, t);
    if (contrast(c, bg) >= min) return c;
  }
  return edge;
}

// Two inks printed over each other: each one filters the light of the other.
function overprint(x, y) {
  const q = rgbOf(y);
  return hexOf(rgbOf(x).map((v, i) => v * q[i]));
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

// -- Paper ------------------------------------------------------------------------
//
// A surface is the paper a theme is printed on. The ramp is keyed by role, not
// by lightness: 950 is always the editor, 900 the side bars, 800 the widgets,
// 700 the borders, 600 line numbers, 500 inactive text, 400–50 text. On the
// dark papers that runs from black up to cream; on "paper" it runs from cream
// down to ink black.

export const PAPER = {
  50: "#F5EEE0", 100: "#EDE4D2", 200: "#E0D5C1", 300: "#C9BCA6", 400: "#9A8D7A",
  500: "#675D4E", 600: "#433D33", 700: "#29261F", 800: "#1B1915", 900: "#131210",
  950: "#0C0C0A",
};
export const FG = "#EFE6D5";
const CREAM = { main: "#D9C4A0", text: "#EAD9BC" };

const DARK_STATUS = { error: "#F87171", warning: "#FBBF24", orangeWarning: "#FB8B24", info: "#60A5FA" };
const LIGHT_STATUS = { error: "#C53030", warning: "#A16207", orangeWarning: "#C2410C", info: "#2B6CB0" };

export const SURFACES = {
  normal: {
    suffix: "",
    type: "dark",
    paper: PAPER,
    fg: FG,
    muted: "#9A8D7A",
    comment: "#807564", // between paper 400 and 500: quiet, still readable
    second: CREAM,
    status: DARK_STATUS,
    shadow: "#00000080",
  },
  // Lifted a notch (like GitHub Dark Dimmed) with softer text, for less
  // contrast; each theme tints it with its own ink (see surfaceFor).
  dimmed: {
    suffix: " Dimmed",
    type: "dark",
    paper: {
      50: "#E6DDCC", 100: "#DDD3C0", 200: "#CFC4AF", 300: "#B9AD97", 400: "#938775",
      500: "#766C5C", 600: "#4E483E", 700: "#36322B", 800: "#28251F", 900: "#1F1D18",
      950: "#191713",
    },
    fg: "#DCD2BF",
    muted: "#9A8E7B",
    comment: "#8E8371",
    second: CREAM,
    status: DARK_STATUS,
    shadow: "#00000080",
  },
  // The stock a risograph actually prints on: warm cream, ink on top. The
  // second ink is a sepia instead of the cream, which would vanish here.
  paper: {
    suffix: " Paper",
    type: "light",
    paper: {
      50: "#1F1B15", 100: "#2E2820", 200: "#3F372C", 300: "#4F4538", 400: "#6B5F4D",
      500: "#877A64", 600: "#A89A82", 700: "#D8CCB5", 800: "#E7DDC9", 900: "#EFE7D6",
      950: "#F7F1E4",
    },
    fg: "#25201A",
    muted: "#6B5F4D",
    comment: "#76695A",
    second: { main: "#8C6B3F", text: "#6E5230" },
    status: LIGHT_STATUS,
    shadow: "#00000030",
  },
};

// -- Inks -------------------------------------------------------------------------

export const INKS = {
  touge:     { lightest: "#F7D8CE", light: "#E07A62", main: "#C8482F", dark: "#A63A25", darkest: "#6B2416", contrast: "#F5EEE0" },
  green:     { lightest: "#D6EBDA", light: "#6FAE7E", main: "#3E8050", dark: "#2F6740", darkest: "#1E4429", contrast: "#F5EEE0" },
  blue:      { lightest: "#D9E5F2", light: "#6E9CCB", main: "#3A6EA5", dark: "#2D578A", darkest: "#1D3A5C", contrast: "#F5EEE0" },
  purple:    { lightest: "#E6DEF1", light: "#A48BC8", main: "#7A5AA6", dark: "#62488A", darkest: "#41305C", contrast: "#F5EEE0" },
  grey:      { lightest: "#E0E1DC", light: "#9A9E96", main: "#6B6F68", dark: "#52564F", darkest: "#363933", contrast: "#F5EEE0" },
  orange:    { lightest: "#F6DDCB", light: "#DB8A55", main: "#B85C22", dark: "#984A1A", darkest: "#633011", contrast: "#F5EEE0" },
  teal:      { lightest: "#D3EAEA", light: "#5FAAAA", main: "#2E7F80", dark: "#24686A", darkest: "#174546", contrast: "#F5EEE0" },
  mustard:   { lightest: "#F4E8C6", light: "#DBB85E", main: "#C49A2F", dark: "#A37E22", darkest: "#6B5316", contrast: "#0C0C0A" },
  // The risograph's signature inks.
  pink:      { lightest: "#FFD6EC", light: "#FF85C8", main: "#FF48B0", dark: "#D6278C", darkest: "#8C1459", contrast: "#0C0C0A" },
  federal:   { lightest: "#D5DCEB", light: "#8E9BE0", main: "#3D5588", dark: "#2E4270", darkest: "#1D2B4B", contrast: "#F5EEE0" },
  sunflower: { lightest: "#FFEFC7", light: "#FFCB57", main: "#FFB511", dark: "#D9960A", darkest: "#8A5E05", contrast: "#0C0C0A" },
};

// `second` makes a duotone: two inks and their overprint instead of the family.
export const THEMES = [
  { id: "touge", label: "Riso Touge", ink: "touge" },
  { id: "green", label: "Riso Green", ink: "green" },
  { id: "blue", label: "Riso Blue", ink: "blue" },
  { id: "purple", label: "Riso Purple", ink: "purple" },
  { id: "grey", label: "Riso Grey", ink: "grey" },
  { id: "orange", label: "Riso Orange", ink: "orange" },
  { id: "teal", label: "Riso Teal", ink: "teal" },
  { id: "mustard", label: "Riso Mustard", ink: "mustard" },
  { id: "pink", label: "Riso Pink", ink: "pink" },
  { id: "federal-blue", label: "Riso Federal Blue", ink: "federal" },
  { id: "sunflower", label: "Riso Sunflower", ink: "sunflower" },
  { id: "pink-blue", label: "Riso Pink × Blue", ink: "pink", second: "blue" },
];

// Status warning turns orange where the gold would read as the theme's ink.
const GOLD_INKS = new Set(["mustard", "sunflower"]);

// Syntax roles are printed with the *other* inks of the family. The theme's own
// ink takes keywords; any role that would repeat it (or sit too close to it —
// touge vs orange) falls through to a spare ink.
// Roles are listed by how much text they cover, so strings get the first spare.
const ROLE_DEFAULTS = { string: "green", fn: "mustard", type: "teal", number: "orange", deco: "purple" };
const SPARES = ["blue", "touge", "grey"];
const NEAR = {
  touge: ["orange"], orange: ["touge"], green: ["teal"], teal: ["green"],
  mustard: ["sunflower"], sunflower: ["mustard"], blue: ["federal"], federal: ["blue"],
};

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

// The scale of two inks printed over each other. Full-strength inks multiply
// into near black, so the printed colour — the one you see on a riso sheet
// where pink crosses blue — comes from the lighter steps.
function overprintScale(x, y) {
  const printed = overprint(x.light, y.light);
  return {
    lightest: overprint(x.lightest, y.lightest),
    light: printed,
    main: printed,
    dark: overprint(x.main, y.light),
    darkest: overprint(x.main, y.main),
    contrast: "#F5EEE0",
  };
}

// How an ink prints on a surface: `tone` for text, `soft` and `deep` for the
// same ink at a second and third weight, `bright` for its strongest accent. On
// dark paper the weights step toward the ink's palest tint. On light paper they
// step toward black from the tone itself — a pale ink like sunflower has to be
// darkened so far to read that its own darkest shade is no longer apart from
// it. Every text tone is nudged until it reads at 4.5:1.
export function inkOn(S, scale) {
  const bg = S.paper[950];
  if (S.type === "dark") {
    const tone = readable(scale.light, bg, 4.5, "#FFFFFF");
    return {
      tone,
      soft: readable(mix(tone, scale.lightest, 0.45), bg, 4.5, "#FFFFFF"),
      deep: readable(mix(tone, scale.lightest, 0.8), bg, 4.5, "#FFFFFF"),
      bright: scale.lightest,
    };
  }
  const tone = readable(scale.main, bg, 4.5, "#000000");
  return {
    tone,
    soft: mix(tone, "#000000", 0.28),
    deep: mix(tone, "#000000", 0.5),
    bright: scale.darkest,
  };
}

// The second ink of a theme: the surface's own (cream / sepia), or for a
// duotone the partner ink.
function secondFor(theme, S) {
  if (!theme.second) return S.second;
  const b = inkOn(S, INKS[theme.second]);
  return { main: b.tone, text: b.soft };
}

// The surface one theme is printed on. The normal and paper stocks are shared
// by the whole family; the dimmed one takes a tint of the theme's own ink on
// the surface steps (text steps 50–500 stay the cream ramp).
const DIMMED_TINT = { 950: 0.2, 900: 0.19, 800: 0.17, 700: 0.14, 600: 0.11 };
export function surfaceFor(variant, ink) {
  const S = SURFACES[variant];
  if (variant !== "dimmed") return S;
  const paper = { ...S.paper };
  for (const [key, sat] of Object.entries(DIMMED_TINT)) paper[key] = tintPaper(S.paper[key], INKS[ink].main, sat);
  return { ...S, paper };
}

// Every syntax role of one theme. Declarations and built-ins are the parent
// role's ink at its second weight, so they read as the same family instead of
// adding more hues.
export function syntaxPalette(theme, S = SURFACES.normal) {
  const on = (scale) => inkOn(S, scale);
  const acc = on(INKS[theme.ink]);
  const bg = S.paper[950];
  const base = {
    control: acc.tone, // if / return / import / await
    decl: acc.soft, // def / class / const / let / function
    self: acc.soft, // self / this / cls
    doc: readable(mix(S.second.main, S.comment, 0.2), bg, 4.5, S.type === "dark" ? "#FFFFFF" : "#000000"),
    docTag: S.second.text, // @param / Args:
    variable: S.fg,
    param: S.paper[200],
    prop: S.paper[300],
    module: S.second.text,
    punct: S.muted,
    comment: S.comment,
  };

  if (theme.second) {
    // Duotone: the two inks and their overprint, each at three weights.
    const b = on(INKS[theme.second]);
    const o = on(overprintScale(INKS[theme.ink], INKS[theme.second]));
    return {
      ...base,
      fn: b.tone, fnBuiltin: b.soft,
      type: o.tone, typeBuiltin: o.soft,
      string: b.deep,
      number: acc.deep,
      deco: o.deep,
    };
  }

  const s = syntaxInks(theme.ink);
  const fn = on(s.fn);
  const type = on(s.type);
  return {
    ...base,
    fn: fn.tone, fnBuiltin: fn.soft, // print / len / console
    type: type.tone, typeBuiltin: type.soft, // int / str / string / number
    string: on(s.string).tone,
    number: on(s.number).tone, // numbers, True/None, UPPER_CONSTANTS
    deco: on(s.deco).tone, // decorators, regex, escapes
  };
}

// Six nesting levels per bracket mode. The theme ships "rainbow"; the other
// modes are applied by extension.js as theme-scoped colorCustomizations.
//   rainbow — the theme's syntax inks, ordered so neighbours never share a hue
//   duotone — the print's two inks: the theme's ink and its second, alternating
//   plain   — every level in the punctuation tone (colorization "off")
export function bracketLevels(theme, S = SURFACES.normal) {
  const acc = inkOn(S, INKS[theme.ink]);
  const second = secondFor(theme, S);
  const p = syntaxPalette(theme, S);
  return {
    rainbow: [p.fn, p.deco, p.type, p.control, p.number, p.string],
    duotone: [acc.tone, second.main, acc.soft, second.text, acc.tone, second.main],
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

// Rainbow identifiers: every ink but the graphite and the near twins, as tone
// and as second weight — 16 colors, so few names in one file share a color.
const IDENTIFIER_INKS = ["touge", "pink", "mustard", "purple", "teal", "orange", "blue", "green"];
function identifierColors(S) {
  const inks = IDENTIFIER_INKS.map((ink) => inkOn(S, INKS[ink]));
  return [...inks.map((i) => i.tone), ...inks.map((i) => i.soft)];
}

function buildTheme(theme, S, label) {
  const acc = INKS[theme.ink];
  const ink = inkOn(S, acc);
  const on = (name) => inkOn(S, INKS[name]);
  const second = secondFor(theme, S);
  const p = syntaxPalette(theme, S);
  const { error, info } = S.status;
  const warn = GOLD_INKS.has(theme.ink) ? S.status.orangeWarning : S.status.warning;
  const dark = S.type === "dark";
  const term = dark
    ? { black: S.paper[700], white: S.paper[200], brightBlack: S.paper[500], brightWhite: S.paper[50] }
    : { black: S.paper[50], white: S.paper[500], brightBlack: S.paper[400], brightWhite: S.paper[600] };

  const colors = {
    focusBorder: a(acc.main, "99"),
    foreground: S.paper[300],
    descriptionForeground: S.muted,
    errorForeground: error,
    "widget.shadow": S.shadow,
    "selection.background": a(acc.main, "66"),
    "textLink.foreground": ink.tone,
    "textLink.activeForeground": ink.bright,
    "textPreformat.foreground": second.text,
    "textBlockQuote.background": S.paper[900],
    "textBlockQuote.border": acc.main,
    "sash.hoverBorder": acc.main,
    "progressBar.background": ink.tone,

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
    "list.highlightForeground": ink.tone,
    "list.errorForeground": error,
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
    "breadcrumb.activeSelectionForeground": ink.tone,
    "breadcrumbPicker.background": S.paper[800],

    // Editor
    "editor.background": S.paper[950],
    "editor.foreground": S.fg,
    "editorLineNumber.foreground": S.paper[600],
    "editorLineNumber.activeForeground": ink.tone,
    "editorCursor.foreground": ink.tone,
    "editor.selectionBackground": a(acc.main, "55"),
    "editor.inactiveSelectionBackground": a(acc.main, "2E"),
    "editor.selectionHighlightBackground": a(second.main, "22"),
    "editor.wordHighlightBackground": a(second.main, "1F"),
    "editor.wordHighlightStrongBackground": a(acc.main, "38"),
    "editor.findMatchBackground": a(acc.main, "88"),
    "editor.findMatchBorder": ink.tone,
    "editor.findMatchHighlightBackground": a(second.main, "33"),
    "editor.lineHighlightBackground": S.paper[900],
    "editor.lineHighlightBorder": "#00000000",
    "editor.rangeHighlightBackground": a(second.main, "14"),
    "editorIndentGuide.background1": S.paper[700],
    "editorIndentGuide.activeBackground1": S.paper[500],
    "editorWhitespace.foreground": S.paper[700],
    "editorRuler.foreground": S.paper[800],
    "editorBracketMatch.background": a(acc.main, "33"),
    "editorBracketMatch.border": ink.tone,
    ...levelColors(bracketLevels(theme, S).rainbow),
    "editorBracketHighlight.unexpectedBracket.foreground": error,
    "editorCodeLens.foreground": S.paper[500],
    "editorLink.activeForeground": ink.tone,
    "editorError.foreground": error,
    "editorWarning.foreground": warn,
    "editorInfo.foreground": info,
    "editorGutter.addedBackground": on("green").tone,
    "editorGutter.modifiedBackground": on("blue").tone,
    "editorGutter.deletedBackground": error,
    "editorOverviewRuler.border": S.paper[800],
    "diffEditor.insertedTextBackground": a(INKS.green.main, "2E"),
    "diffEditor.removedTextBackground": a(error, "24"),

    // Widgets
    "editorWidget.background": S.paper[800],
    "editorWidget.border": S.paper[700],
    "editorSuggestWidget.background": S.paper[800],
    "editorSuggestWidget.border": S.paper[700],
    "editorSuggestWidget.selectedBackground": a(acc.main, "4D"),
    "editorSuggestWidget.highlightForeground": ink.tone,
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
    "button.secondaryForeground": second.text,
    "button.secondaryHoverBackground": S.paper[600],
    "badge.background": acc.main,
    "badge.foreground": acc.contrast,
    "input.background": S.paper[950],
    "input.foreground": S.fg,
    "input.border": S.paper[700],
    "input.placeholderForeground": S.paper[500],
    "inputOption.activeBorder": ink.tone,
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
    "statusBar.noFolderForeground": second.text,
    "statusBar.debuggingBackground": theme.ink === "orange" ? INKS.teal.main : INKS.orange.main,
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
    "terminalCursor.foreground": ink.tone,
    "terminal.selectionBackground": a(acc.main, "55"),
    "terminal.ansiBlack": term.black,
    "terminal.ansiRed": on("touge").tone,
    "terminal.ansiGreen": on("green").tone,
    "terminal.ansiYellow": on("mustard").tone,
    "terminal.ansiBlue": on("blue").tone,
    "terminal.ansiMagenta": on("purple").tone,
    "terminal.ansiCyan": on("teal").tone,
    "terminal.ansiWhite": term.white,
    "terminal.ansiBrightBlack": term.brightBlack,
    "terminal.ansiBrightRed": on("touge").bright,
    "terminal.ansiBrightGreen": on("green").bright,
    "terminal.ansiBrightYellow": on("mustard").bright,
    "terminal.ansiBrightBlue": on("blue").bright,
    "terminal.ansiBrightMagenta": on("purple").bright,
    "terminal.ansiBrightCyan": on("teal").bright,
    "terminal.ansiBrightWhite": term.brightWhite,

    // Git
    "gitDecoration.addedResourceForeground": on("green").tone,
    "gitDecoration.modifiedResourceForeground": on("mustard").tone,
    "gitDecoration.deletedResourceForeground": error,
    "gitDecoration.untrackedResourceForeground": on("teal").tone,
    "gitDecoration.ignoredResourceForeground": S.paper[500],
    "gitDecoration.conflictingResourceForeground": on("orange").tone,
  };

  const it = (foreground) => ({ foreground, fontStyle: "italic" });
  const rule = (scope, settings) => ({ scope, settings: typeof settings === "string" ? { foreground: settings } : settings });

  const tokenColors = [
    // Base
    rule(["variable", "variable.other.readwrite", "meta.definition.variable"], p.variable),
    rule(["keyword.operator", "punctuation", "meta.brace", "punctuation.separator", "punctuation.terminator"], p.punct),
    rule(["comment", "punctuation.definition.comment"], it(p.comment)),

    // Keywords: control flow in the ink, declarations at its second weight
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
    rule(["markup.inserted"], on("green").tone),
    rule(["markup.deleted"], error),
    rule(["markup.changed"], on("mustard").tone),
    rule(["invalid"], error),
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
    type: S.type,
    semanticHighlighting: true,
    colors,
    tokenColors,
    semanticTokenColors,
  };
}

// -- Contrast audit ---------------------------------------------------------------
//
// Every text role of every theme, measured against its editor background.
// Code must read at 4.5:1 (WCAG AA); comments and docs, quieter by design, at
// 4:1; punctuation at 3:1.
const AUDIT = [
  [4.5, ["control", "decl", "self", "fn", "fnBuiltin", "type", "typeBuiltin", "string", "number", "deco",
    "variable", "param", "prop", "module", "docTag"]],
  [4, ["comment", "doc"]],
  [3, ["punct"]],
];

function audit(label, theme, S) {
  const p = syntaxPalette(theme, S);
  const bg = S.paper[950];
  const failures = [];
  for (const [min, roles] of AUDIT) {
    for (const role of roles) {
      const ratio = contrast(p[role], bg);
      if (ratio < min) failures.push(`${label}: ${role} ${p[role]} on ${bg} = ${ratio.toFixed(2)} < ${min}`);
    }
  }
  for (const c of identifierColors(S)) {
    const ratio = contrast(c, bg);
    if (ratio < 4.5) failures.push(`${label}: identifier ${c} on ${bg} = ${ratio.toFixed(2)} < 4.5`);
  }
  return failures;
}

// -- Output -----------------------------------------------------------------------

// Every theme on every surface: "Riso Touge", "… Dimmed", "… Paper".
export const VARIANTS = THEMES.flatMap((t) =>
  Object.keys(SURFACES).map((variant) => ({
    theme: t,
    variant,
    S: surfaceFor(variant, t.ink),
    file: `riso-${t.id}${variant === "normal" ? "" : "-" + variant}.json`,
    fullLabel: t.label + SURFACES[variant].suffix,
  })),
);

const failures = VARIANTS.flatMap((v) => audit(v.fullLabel, v.theme, v.S));
if (failures.length) {
  console.error(`contrast audit failed:\n  ${failures.join("\n  ")}`);
  process.exit(1);
}

const outDir = join(root, "themes");
mkdirSync(outDir, { recursive: true });
for (const v of VARIANTS) {
  writeFileSync(join(outDir, v.file), JSON.stringify(buildTheme(v.theme, v.S, v.fullLabel), null, 2) + "\n");
}

// Keep package.json's theme list in step with what was generated.
const pkgPath = join(root, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
pkg.contributes.themes = VARIANTS.map((v) => ({
  label: v.fullLabel,
  uiTheme: v.S.type === "dark" ? "vs-dark" : "vs",
  path: `./themes/${v.file}`,
}));
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

// palette.json feeds extension.js: per theme label, its identifier colors and
// the level colors of every bracket mode.
const palette = {
  themes: Object.fromEntries(
    VARIANTS.map((v) => [
      v.fullLabel,
      {
        ink: v.theme.ink,
        base: v.theme.label, // the theme's name without the surface suffix
        variant: v.variant,
        levels: bracketLevels(v.theme, v.S),
        identifiers: identifierColors(v.S),
      },
    ]),
  ),
};
writeFileSync(join(root, "palette.json"), JSON.stringify(palette, null, 2) + "\n");
console.log(`wrote ${VARIANTS.length} themes (contrast audit passed) to ${outDir} + package.json theme list + palette.json`);
