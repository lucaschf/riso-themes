# Riso Themes

VS Code themes printed like a risograph: an ink on paper, a second ink, and
nothing more.

**Inks:** Touge (brick vermilion) · Pink (fluorescent) · Orange · Sunflower ·
Mustard · Green · Teal · Blue · Federal Blue · Purple · Grey — plus the duotone
**Pink × Blue**. Each one comes on three papers: near black, **Dimmed** and
**Paper** (light). 36 themes in all.

- Keywords, cursor, tabs, badges, buttons and the status bar band use the theme's ink.
- Strings, functions, types, numbers and decorators use the *other* inks of the
  family; a role that would repeat the theme's own ink falls through to a spare one.
- **Pink × Blue** is printed with two inks only: pink, blue, and the purple where
  they overprint.
- Docstrings / JSDoc print in the second ink, in italic, apart from code strings.
- Every text color is checked against its background: code reads at 4.5:1 or more
  on every paper.

## Options

Everything is one menu away: **Riso: Options…** (Command Palette) or the button
in the status bar. Each row shows the current value; picking it changes it and
the menu reopens on the same row.

## Papers

- **Normal** — near-black stock (`#0C0C0A`).
- **Dimmed** — lifted a notch (around `#191713`) with softer text, for less
  contrast. Each dimmed paper is tinted with its own ink at the same luminance,
  so none is lighter than another.
- **Paper** — light: ink on warm cream (`#F7F1E4`), the stock a riso actually
  prints on, with a sepia second ink.

*Background* in **Riso: Options…** switches between them, in the global or the
workspace theme, wherever it is set. **Riso: Toggle Dimmed Background** flips
normal ↔ dimmed.

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
keep the theme's color. 16 colors per paper: the family's inks at two weights.

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
extension) and `preview.html` (every theme on its three papers). The build fails
if any text color drops below its contrast floor (4.5:1 for code, 4:1 for
comments and docs, 3:1 for punctuation).

    npm run build
    npx @vscode/vsce package
    code --install-extension riso-themes-1.2.0.vsix

## Releasing

CI (`.github/workflows/ci.yml`) builds every push and pull request: the themes
must pass the contrast audit, the generated files must be committed, and the
packaged `.vsix` is kept as a build artifact.

To release, bump `version` in `package.json`, add its section to
`CHANGELOG.md`, commit, then push a matching tag:

    git tag v1.3.0
    git push origin v1.3.0

`.github/workflows/release.yml` then publishes that version to the VS Code
Marketplace, creates the GitHub release with the changelog section and the
`.vsix`, and — when the `OVSX_PAT` secret exists — publishes to Open VSX too.

Repository secrets: `VSCE_PAT` (Azure DevOps token, Marketplace → Manage) and,
optionally, `OVSX_PAT` (Open VSX access token).
