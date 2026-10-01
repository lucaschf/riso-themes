// JetBrains themes (PyCharm, IntelliJ IDEA, …) from the same palettes as the
// VS Code ones: for every theme an editor color scheme (.xml, the .icls
// format) and a UI theme (.theme.json), the plugin.xml listing them, and the
// installable plugin .jar in jetbrains/build/.
import { deflateRawSync } from "node:zlib";
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
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
    "PY.KEYWORD_ARGUMENT": italic(p.param),
    "PY.PARAMETER": italic(p.param),
    "PY.FUNC_DEFINITION": fg(p.fn),
    "PY.CLASS_DEFINITION": fg(p.type),
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
        underlinedTabBackground: S.paper[950],
        underlinedTabForeground: S.fg,
        underlineColor: acc.main,
        inactiveUnderlineColor: acc.dark,
        hoverBackground: S.paper[800],
        borderColor: S.paper[800],
      },
      ToolWindow: {
        background: S.paper[900],
        Header: { background: S.paper[900], inactiveBackground: S.paper[900] },
        Stripe: { background: S.paper[950] },
        Button: { selectedBackground: S.paper[700], hoverBackground: S.paper[800] },
      },
      // The status bar is a solid band of the ink, as in the VS Code themes.
      StatusBar: {
        background: acc.main,
        foreground: acc.contrast,
        borderColor: acc.main,
        Widget: { foreground: acc.contrast, hoverBackground: "#00000026" },
        Breadcrumbs: { foreground: acc.contrast, hoverBackground: "#00000026", selectionBackground: "#00000033" },
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
const pluginXml = template
  .replace(/^<!--[\s\S]*?-->\n/, "<!-- Generated by scripts/jetbrains.mjs from jetbrains/plugin.template.xml. -->\n")
  .replace("    <!-- THEME_PROVIDERS -->", providers.join("\n"));
writeFileSync(join(resources, "META-INF", "plugin.xml"), pluginXml);
writeFileSync(join(resources, "META-INF", "pluginIcon.svg"), readFileSync(join(pluginDir, "pluginIcon.svg")));
const version = /<version>([^<]+)<\/version>/.exec(template)[1];

// -- Jar (a zip) -----------------------------------------------------------------------

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let crc = 0xffffffff;
  for (const byte of buf) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

// Deflated entries, fixed timestamp (1980-01-01) so a rebuild is byte-identical.
function zip(entries) {
  const parts = [];
  const central = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, "utf8");
    const packed = deflateRawSync(data, { level: 9 });
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(33, 12); // 1980-01-01
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    parts.push(local, nameBuf, packed);

    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0);
    dir.writeUInt16LE(20, 4);
    dir.writeUInt16LE(20, 6);
    dir.writeUInt16LE(0x0800, 8);
    dir.writeUInt16LE(8, 10);
    dir.writeUInt16LE(0, 12);
    dir.writeUInt16LE(33, 14);
    dir.writeUInt32LE(crc, 16);
    dir.writeUInt32LE(packed.length, 20);
    dir.writeUInt32LE(data.length, 24);
    dir.writeUInt16LE(nameBuf.length, 28);
    dir.writeUInt32LE(offset, 42);
    central.push(dir, nameBuf);
    offset += local.length + nameBuf.length + packed.length;
  }
  const dirBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(dirBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, dirBuf, end]);
}

function filesUnder(dir, prefix = "") {
  return readdirSync(dir, { withFileTypes: true })
    .sort((x, y) => x.name.localeCompare(y.name))
    .flatMap((e) =>
      e.isDirectory()
        ? filesUnder(join(dir, e.name), `${prefix}${e.name}/`)
        : [{ name: prefix + e.name, data: readFileSync(join(dir, e.name)) }],
    );
}

const outDir = join(pluginDir, "build");
mkdirSync(outDir, { recursive: true });
const jar = join(outDir, `riso-themes-${version}.jar`);
writeFileSync(jar, zip(filesUnder(resources)));
console.log(`wrote ${VARIANTS.length} JetBrains themes + jetbrains/build/riso-themes-${version}.jar`);
