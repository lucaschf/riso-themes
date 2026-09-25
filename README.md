# Riso Themes

Dark VS Code themes printed like a risograph: one warm printed-black paper, a
cream second ink, and a different ink per theme.

**Riso Touge** (brick vermilion) · **Riso Green** · **Riso Blue** · **Riso Purple** ·
**Riso Grey** · **Riso Orange** · **Riso Teal** · **Riso Mustard** — each also as **… Dimmed**.

- Keywords, cursor, tabs, badges, buttons and the status bar band use the theme's ink.
- Strings, functions, types, numbers and decorators use the *other* inks of the
  family; a role that would repeat the theme's own ink falls through to a spare one.
- Docstrings / JSDoc print in cream italic, apart from code strings.

## Options

Everything is one menu away: **Riso: Options…** (Command Palette) or the button
in the status bar. Each row shows the current value; picking it changes it and
the menu reopens on the same row.

## Dimmed

Every theme also comes as **… Dimmed**: the paper lifted a notch (around `#191713`
instead of `#0C0C0A`) and softer text, for less contrast. Each dimmed paper is
tinted with its own ink at the same luminance, so none is lighter than another.
**Riso: Toggle Dimmed Background** switches between the two, in the global or
the workspace theme, wherever it is set.

## Brackets and indent guides

One color per nesting level, using VS Code's native bracket pair colorization.

| Setting | Values |
|---|---|
| `riso.brackets` | `rainbow` (default), `duotone` (ink + cream), `plain` (off) |
| `riso.indentGuides` | `plain` (default), `rainbow`, `duotone` |

Commands: **Riso: Toggle Rainbow Brackets**, **Riso: Toggle Rainbow Indent Guides**.
*Bracket pair guides* in the menu cycles VS Code's `editor.guides.bracketPairs`
(off → active pair → all pairs); the guides take their level's color.

Non-default modes are written as theme-scoped entries (`"[Riso Touge]": {...}`)
in the user `workbench.colorCustomizations`; only the bracket / indent-guide keys
are managed. Scopes left behind for themes that no longer exist are removed when
they hold only those keys. Set both options back to their defaults before
uninstalling to remove them.

## Color by name

Every parameter, *local* variable, attribute, constant and class gets its own
color, derived from the name, so `movieId` is the same color on every line and in
every file (like JetBrains' semantic highlighting). Globals, imports and built-ins
keep the theme's color. 14 colors: the family's inks and their tints.

| Setting | Default |
|---|---|
| `riso.rainbowIdentifiers.enabled` | `false` |
| `riso.rainbowIdentifiers.kinds` | `["parameter", "variable", "property", "constant", "class", "interface", "enum", "type"]` (also: `typeParameter`, `function`, `method`) |

Command: **Riso: Toggle Rainbow Identifiers**. Needs semantic tokens from the
language: TS/JS are built in; Python needs Pylance; Java, C#, C/C++, Rust, Go
(`"gopls": { "ui.semanticTokens": true }`) via their language extensions. Logs go
to the **Riso** channel in the Output panel.

## Per-project theme

Like Peacock, but with the whole theme: in **Riso: Options…**, *Theme · this
project* gives the open folder its own ink (saved as `workbench.colorTheme` in
its `.vscode/settings.json`), and *Follow all projects* removes it; *Theme · all
projects* sets the global one. Both preview while you move through the list and
keep the current surface (normal / dimmed). The status bar button shows a folder
icon when the project has its own theme. Also as commands: **Riso: Set Theme for
This Workspace…** and **Riso: Use Global Theme in This Workspace**. Works
alongside Peacock, which paints the title / activity / status bars on top.

## Development

Every color lives in `scripts/build.mjs`. `npm run build` regenerates
`themes/*.json`, the theme list in `package.json`, `palette.json` (read by the
extension) and `preview.html` (every theme side by side).

    npm run build
    npx @vscode/vsce package
    code --install-extension riso-themes-1.0.0.vsix
