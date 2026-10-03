// JetBrains themes (PyCharm, IntelliJ IDEA, …) from the same palettes as the
// VS Code ones: for every theme an editor color scheme (.xml, the .icls
// format) and a UI theme (.theme.json), the plugin.xml listing them, and the
// palettes for the plugin's Kotlin code. Gradle (jetbrains/) builds the plugin.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { INKS, VARIANTS, inkOn, mix, secondFor, syntaxPalette } from "./build.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pluginDir = join(root, "jetbrains");
const resources = join(pluginDir, "src", "main", "resources");
const themesDir = join(resources, "themes");

const hex = (c) => c.replace("#", "").toUpperCase();
const xmlEscape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// .icls font types and effect types.
const ITALIC = 2;
const BOLD_ITALIC = 3;
const LINE_UNDERSCORE = 1;
const WAVE_UNDERSCORE = 2;

// -- Editor color scheme ---------------------------------------------------------------

function editorScheme(theme, S, name) {
  const p = syntaxPalette(theme, S);
  const acc = INKS[theme.ink];
  const ink = inkOn(S, acc);
  const on = (n) => inkOn(S, INKS[n]);
  const second = secondFor(theme, S);
  const bg = S.paper[950];
  // Schemes have no alpha: overlays are blended into the paper.
  const tint = (c, t) => mix(bg, c, t);
  const warn = theme.ink === "mustard" || theme.ink === "sunflower" ? S.status.orangeWarning : S.status.warning;

  const colors = {
    CARET_COLOR: ink.tone,
    CARET_ROW_COLOR: S.paper[900],
    SELECTION_BACKGROUND: tint(acc.main, 0.35),
    GUTTER_BACKGROUND: bg,
    LINE_NUMBERS_COLOR: S.paper[600],
    LINE_NUMBER_ON_CARET_ROW_COLOR: ink.tone,
    INDENT_GUIDE: S.paper[700],
    SELECTED_INDENT_GUIDE: S.paper[500],
    SOFT_WRAP_SIGN_COLOR: S.paper[600],
    RIGHT_MARGIN_COLOR: S.paper[800],
    WHITESPACES: S.paper[700],
    TEARLINE_COLOR: S.paper[800],
    SELECTED_TEARLINE_COLOR: S.paper[600],
    METHOD_SEPARATORS_COLOR: S.paper[700],
    CONSOLE_BACKGROUND_KEY: S.paper[900],
    DOCUMENTATION_COLOR: S.paper[800],
    LOOKUP_COLOR: S.paper[800],
    NOTIFICATION_BACKGROUND: S.paper[800],
    ANNOTATIONS_COLOR: S.muted,
    ADDED_LINES_COLOR: on("green").tone,
    MODIFIED_LINES_COLOR: on("blue").tone,
    DELETED_LINES_COLOR: S.status.error,
    VISUAL_INDENT_GUIDE: S.paper[700],
    BREADCRUMBS_BACKGROUND: bg,
  };

  const fg = (foreground, extra = {}) => ({ FOREGROUND: foreground, ...extra });
  const italic = (foreground) => fg(foreground, { FONT_TYPE: ITALIC });
  const attributes = {
    TEXT: { FOREGROUND: p.variable, BACKGROUND: bg },

    // Language defaults — every language inherits these.
    DEFAULT_KEYWORD: fg(p.control),
    DEFAULT_IDENTIFIER: fg(p.variable),
    DEFAULT_STRING: fg(p.string),
    DEFAULT_VALID_STRING_ESCAPE: fg(p.deco),
    DEFAULT_INVALID_STRING_ESCAPE: fg(S.status.error),
    DEFAULT_NUMBER: fg(p.number),
    DEFAULT_CONSTANT: fg(p.number),
    DEFAULT_PREDEFINED_SYMBOL: fg(p.fnBuiltin),
    DEFAULT_LINE_COMMENT: italic(p.comment),
    DEFAULT_BLOCK_COMMENT: italic(p.comment),
    DEFAULT_DOC_COMMENT: italic(p.doc),
    DEFAULT_DOC_COMMENT_TAG: fg(p.docTag),
    DEFAULT_DOC_COMMENT_TAG_VALUE: italic(p.param),
    DEFAULT_DOC_MARKUP: fg(p.doc),
    DEFAULT_OPERATION_SIGN: fg(p.punct),
    DEFAULT_BRACES: fg(p.punct),
    DEFAULT_BRACKETS: fg(p.punct),
    DEFAULT_PARENTHS: fg(p.punct),
    DEFAULT_COMMA: fg(p.punct),
    DEFAULT_DOT: fg(p.punct),
    DEFAULT_SEMICOLON: fg(p.punct),
    DEFAULT_FUNCTION_DECLARATION: fg(p.fn),
    DEFAULT_FUNCTION_CALL: fg(p.fn),
    DEFAULT_INSTANCE_METHOD: fg(p.fn),
    DEFAULT_STATIC_METHOD: fg(p.fn),
    DEFAULT_CLASS_NAME: fg(p.type),
    DEFAULT_CLASS_REFERENCE: fg(p.type),
    DEFAULT_INTERFACE_NAME: fg(p.type),
    DEFAULT_PARAMETER: italic(p.param),
    DEFAULT_LOCAL_VARIABLE: fg(p.variable),
    DEFAULT_REASSIGNED_LOCAL_VARIABLE: fg(p.variable),
    DEFAULT_GLOBAL_VARIABLE: fg(p.variable),
    DEFAULT_INSTANCE_FIELD: fg(p.prop),
    DEFAULT_STATIC_FIELD: fg(p.number),
    DEFAULT_METADATA: fg(p.deco),
    DEFAULT_LABEL: fg(p.control),
    DEFAULT_TAG: fg(p.control),
    DEFAULT_ATTRIBUTE: italic(p.fn),
    DEFAULT_ENTITY: fg(p.number),

    // Python
    "PY.KEYWORD": fg(p.control),
    "PY.DOC_COMMENT": italic(p.doc),
    "PY.DECORATOR": fg(p.deco),
    "PY.BUILTIN_NAME": fg(p.fnBuiltin),
    "PY.PREDEFINED_DEFINITION": fg(p.fnBuiltin),
    "PY.PREDEFINED_USAGE": italic(p.self),
    "PY.SELF_PARAMETER": italic(p.self),
    // No foreground on what the plugin's color by name paints (parameters,
    // keyword arguments, locals, class names): PyCharm highlights these on the
    // same layer, and with two foregrounds there the IDE picks either one.
    // Without the feature they fall back to the text color; params stay italic.
    "PY.KEYWORD_ARGUMENT": { FONT_TYPE: ITALIC },
    "PY.PARAMETER": { FONT_TYPE: ITALIC },
    "PY.LOCAL_VARIABLE": {},
    "PY.FUNC_DEFINITION": fg(p.fn),
    "PY.CLASS_DEFINITION": {},
    "PY.FUNCTION_CALL": fg(p.fn),
    "PY.METHOD_CALL": fg(p.fn),

    // Editor feedback
    MATCHED_BRACE_ATTRIBUTES: { BACKGROUND: tint(acc.main, 0.25), FONT_TYPE: 1 },
    UNMATCHED_BRACE_ATTRIBUTES: { BACKGROUND: tint(S.status.error, 0.3) },
    SEARCH_RESULT_ATTRIBUTES: { BACKGROUND: tint(acc.main, 0.4) },
    WRITE_SEARCH_RESULT_ATTRIBUTES: { BACKGROUND: tint(acc.main, 0.5) },
    TEXT_SEARCH_RESULT_ATTRIBUTES: { BACKGROUND: tint(second.main, 0.3) },
    IDENTIFIER_UNDER_CARET_ATTRIBUTES: { BACKGROUND: tint(second.main, 0.16) },
    WRITE_IDENTIFIER_UNDER_CARET_ATTRIBUTES: { BACKGROUND: tint(acc.main, 0.22) },
    ERRORS_ATTRIBUTES: { EFFECT_COLOR: S.status.error, EFFECT_TYPE: WAVE_UNDERSCORE },
    WARNING_ATTRIBUTES: { EFFECT_COLOR: warn, EFFECT_TYPE: WAVE_UNDERSCORE },
    WEAK_WARNING_ATTRIBUTES: { EFFECT_COLOR: S.muted, EFFECT_TYPE: WAVE_UNDERSCORE },
    NOT_USED_ELEMENT_ATTRIBUTES: { FOREGROUND: S.paper[500] },
    HYPERLINK_ATTRIBUTES: { FOREGROUND: ink.tone, EFFECT_COLOR: ink.tone, EFFECT_TYPE: LINE_UNDERSCORE },
    TODO_DEFAULT_ATTRIBUTES: { FOREGROUND: p.fn, FONT_TYPE: BOLD_ITALIC },
    INJECTED_LANGUAGE_FRAGMENT: { BACKGROUND: S.paper[900] },

    // Run console, in the same inks as VS Code's terminal
    CONSOLE_NORMAL_OUTPUT: fg(p.variable),
    CONSOLE_ERROR_OUTPUT: fg(S.status.error),
    CONSOLE_SYSTEM_OUTPUT: fg(S.muted),
    CONSOLE_USER_INPUT: italic(on("green").tone),
    CONSOLE_RED_OUTPUT: fg(on("touge").tone),
    CONSOLE_GREEN_OUTPUT: fg(on("green").tone),
    CONSOLE_YELLOW_OUTPUT: fg(on("mustard").tone),
    CONSOLE_BLUE_OUTPUT: fg(on("blue").tone),
    CONSOLE_MAGENTA_OUTPUT: fg(on("purple").tone),
    CONSOLE_CYAN_OUTPUT: fg(on("teal").tone),
    CONSOLE_RED_BRIGHT_OUTPUT: fg(on("touge").bright),
    CONSOLE_GREEN_BRIGHT_OUTPUT: fg(on("green").bright),
    CONSOLE_YELLOW_BRIGHT_OUTPUT: fg(on("mustard").bright),
    CONSOLE_BLUE_BRIGHT_OUTPUT: fg(on("blue").bright),
    CONSOLE_MAGENTA_BRIGHT_OUTPUT: fg(on("purple").bright),
    CONSOLE_CYAN_BRIGHT_OUTPUT: fg(on("teal").bright),
  };

  const option = (name, value) => `    <option name="${name}" value="${value}"/>`;
  const attrXml = Object.entries(attributes).map(([key, values]) => {
    const inner = Object.entries(values)
      .map(([k, v]) => `        <option name="${k}" value="${typeof v === "number" ? v : hex(v)}"/>`)
      .join("\n");
    return `    <option name="${key}">\n      <value>\n${inner}\n      </value>\n    </option>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generated by scripts/jetbrains.mjs — edit the palettes in scripts/build.mjs. -->
<scheme name="${xmlEscape(name)}" version="142" parent_scheme="${S.type === "dark" ? "Darcula" : "Default"}">
  <colors>
${Object.entries(colors).map(([k, v]) => option(k, hex(v))).join("\n")}
  </colors>
  <attributes>
${attrXml.join("\n")}
  </attributes>
</scheme>
`;
}

// -- UI theme --------------------------------------------------------------------------

function uiTheme(theme, S, name, schemeFile) {
  const acc = INKS[theme.ink];
  const ink = inkOn(S, acc);
  const a = (c, alpha) => c + alpha;
  const selection = a(acc.main, "4D");
  return {
    name,
    dark: S.type === "dark",
    author: "Lucas Cristovam",
    editorScheme: `/themes/${schemeFile}`,
    parentTheme: S.type === "dark" ? "ExperimentalDark" : "ExperimentalLight",
    ui: {
      "*": {
        background: S.paper[900],
        foreground: S.paper[300],
        infoForeground: S.muted,
        disabledForeground: S.paper[500],
        selectionBackground: selection,
        selectionForeground: S.fg,
        selectionInactiveBackground: S.paper[700],
        selectionBackgroundInactive: S.paper[700],
        hoverBackground: S.paper[800],
        borderColor: S.paper[800],
        separatorColor: S.paper[800],
        focusColor: a(acc.main, "99"),
        focusedBorderColor: a(acc.main, "99"),
        inactiveBackground: S.paper[900],
      },
      MainWindow: { background: S.paper[950] },
      MainToolbar: { background: S.paper[950], foreground: S.muted },
      Editor: { background: S.paper[950], foreground: S.fg, SearchField: { background: S.paper[950] } },
      EditorTabs: {
        background: S.paper[900],
        underlinedTabBackground: mix(S.paper[950], acc.main, 0.14),
        underlinedTabForeground: S.fg,
        underlineColor: ink.tone,
        inactiveUnderlineColor: a(ink.tone, "66"),
        hoverBackground: S.paper[800],
        borderColor: S.paper[800],
      },
      ToolWindow: {
        background: S.paper[900],
        Header: { background: S.paper[900], inactiveBackground: S.paper[900] },
        Stripe: { background: S.paper[950] },
        Button: { selectedBackground: S.paper[700], hoverBackground: S.paper[800] },
      },
      // Paper, with a line of ink on top. Not the VS Code ink band: some IDE
      // versions keep the paper behind the status bar text, and the band's
      // label tone (near-black on pink, mustard, sunflower) then vanishes.
      StatusBar: {
        background: S.paper[950],
        foreground: S.muted,
        borderColor: ink.tone,
        Widget: { foreground: S.paper[300], hoverBackground: S.paper[800], pressedBackground: S.paper[700] },
        Breadcrumbs: {
          foreground: S.paper[300],
          hoverForeground: S.fg,
          hoverBackground: S.paper[800],
          selectionForeground: S.fg,
          selectionBackground: a(acc.main, "4D"),
          floatingBackground: S.paper[900],
          floatingForeground: S.paper[300],
        },
      },
      Button: {
        focusedBorderColor: ink.tone,
        startBackground: S.paper[800],
        endBackground: S.paper[800],
        startBorderColor: S.paper[700],
        endBorderColor: S.paper[700],
        default: {
          startBackground: acc.main,
          endBackground: acc.main,
          startBorderColor: acc.main,
          endBorderColor: acc.main,
          foreground: acc.contrast,
          focusedBorderColor: ink.tone,
        },
      },
      TextField: { background: S.paper[950], borderColor: S.paper[700], focusedBorderColor: a(acc.main, "99") },
      ComboBox: { background: S.paper[950], nonEditableBackground: S.paper[900] },
      List: { background: S.paper[900], selectionBackground: selection, selectionInactiveBackground: S.paper[700] },
      Tree: { background: S.paper[900], selectionBackground: selection, selectionInactiveBackground: S.paper[700] },
      Table: { background: S.paper[900], selectionBackground: selection },
      Popup: { background: S.paper[800], borderColor: S.paper[700] },
      PopupMenu: { background: S.paper[800] },
      Menu: { background: S.paper[800], selectionBackground: selection },
      CompletionPopup: { background: S.paper[800], selectionBackground: selection, matchForeground: ink.tone },
      Notification: { background: S.paper[800], borderColor: S.paper[700] },
      Link: { activeForeground: ink.tone, hoverForeground: ink.bright, pressedForeground: ink.tone, visitedForeground: ink.soft },
      ProgressBar: { progressColor: ink.tone, indeterminateStartColor: ink.tone, indeterminateEndColor: acc.main },
      ScrollBar: { Mac: { thumbColor: a(S.paper[600], "99") }, thumbColor: a(S.paper[600], "99") },
      Counter: { background: acc.main, foreground: acc.contrast },
      Component: { focusColor: a(acc.main, "99"), focusedBorderColor: a(acc.main, "99") },
    },
    // Action icons and accents print in the theme's ink instead of the IDE's blue.
    // Old-UI icons go by palette name; the new UI's draw with fixed blues,
    // remapped by value.
    icons: {
      ColorPalette: {
        "Actions.Blue": ink.tone,
        "Objects.Blue": ink.tone,
        "#3574F0": ink.tone,
        "#548AF7": ink.tone,
      },
    },
  };
}

// -- Plugin ----------------------------------------------------------------------------

rmSync(themesDir, { recursive: true, force: true });
mkdirSync(themesDir, { recursive: true });
mkdirSync(join(resources, "META-INF"), { recursive: true });

const providers = [];
for (const v of VARIANTS) {
  const base = v.file.replace(/\.json$/, "");
  const schemeFile = `${base}.xml`;
  writeFileSync(join(themesDir, schemeFile), editorScheme(v.theme, v.S, v.fullLabel));
  writeFileSync(
    join(themesDir, `${base}.theme.json`),
    JSON.stringify(uiTheme(v.theme, v.S, v.fullLabel, schemeFile), null, 2) + "\n",
  );
  providers.push(`    <themeProvider id="${base}" path="/themes/${base}.theme.json"/>`);
}

const template = readFileSync(join(pluginDir, "plugin.template.xml"), "utf8");
const version = /^pluginVersion=(.+)$/m.exec(readFileSync(join(pluginDir, "gradle.properties"), "utf8"))[1].trim();
const pluginXml = template
  .replace(/^<!--[\s\S]*?-->\n/, "<!-- Generated by scripts/jetbrains.mjs from jetbrains/plugin.template.xml. -->\n")
  .replace("PLUGIN_VERSION", version)
  .replace("    <!-- THEME_PROVIDERS -->", providers.join("\n"));
writeFileSync(join(resources, "META-INF", "plugin.xml"), pluginXml);
writeFileSync(join(resources, "META-INF", "pluginIcon.svg"), readFileSync(join(pluginDir, "pluginIcon.svg")));

// The palettes the plugin's Kotlin code paints with, one line per theme:
// label, the 16 color-by-name colors, the 6 rainbow bracket levels — the same
// colors the VS Code extension reads from palette.json.
const palette = JSON.parse(readFileSync(join(root, "palette.json"), "utf8"));
const tsv = Object.entries(palette.themes).map(
  ([label, t]) => `${label}\t${t.identifiers.join(",")}\t${t.levels.rainbow.join(",")}`,
);
writeFileSync(
  join(resources, "riso-palette.tsv"),
  ["# Generated by scripts/jetbrains.mjs: label, identifier colors, bracket level colors.", ...tsv].join("\n") + "\n",
);
console.log(`wrote ${VARIANTS.length} JetBrains themes, plugin.xml (v${version}) and riso-palette.tsv`);
