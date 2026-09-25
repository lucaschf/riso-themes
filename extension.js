// Runtime options for the Riso retro themes.
//
// Themes are static JSON, so the bracket / indent-guide modes are applied as
// theme-scoped entries in the user's `workbench.colorCustomizations`
// ("[Riso Touge]": {...}). Only the keys in MANAGED_KEYS are ever touched;
// anything else the user put in those scopes is left alone.
const vscode = require("vscode");
const palette = require("./palette.json");
const { RainbowIdentifiers } = require("./rainbowIdentifiers");
const { registerMenu } = require("./menu");
const log = require("./log");

const SECTION = "riso";
const LEVELS = [1, 2, 3, 4, 5, 6];
const MANAGED_KEYS = LEVELS.flatMap((n) => [
  `editorBracketHighlight.foreground${n}`,
  `editorBracketPairGuide.background${n}`,
  `editorBracketPairGuide.activeBackground${n}`,
  `editorIndentGuide.background${n}`,
  `editorIndentGuide.activeBackground${n}`,
]);

// Same mapping as levelColors() in scripts/build.mjs.
function levelColors(levels, { brackets, indent }) {
  const out = {};
  levels.forEach((c, i) => {
    const n = i + 1;
    if (brackets) {
      out[`editorBracketHighlight.foreground${n}`] = c;
      out[`editorBracketPairGuide.background${n}`] = c + "40";
      out[`editorBracketPairGuide.activeBackground${n}`] = c + "B3";
    }
    if (indent) {
      out[`editorIndentGuide.background${n}`] = c + "38";
      out[`editorIndentGuide.activeBackground${n}`] = c + "B3";
    }
  });
  return out;
}

function readOptions() {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  return {
    brackets: cfg.get("brackets", "rainbow"),
    indentGuides: cfg.get("indentGuides", "plain"),
  };
}

// Overrides one theme needs on top of what its JSON ships (rainbow brackets,
// neutral indent guides). Empty when the options match the shipped defaults.
function overridesFor(theme, { brackets, indentGuides }) {
  const out = {};
  if (brackets !== "rainbow" && theme.levels[brackets]) {
    Object.assign(out, levelColors(theme.levels[brackets], { brackets: true }));
  }
  if (indentGuides !== "plain" && theme.levels[indentGuides]) {
    Object.assign(out, levelColors(theme.levels[indentGuides], { indent: true }));
  }
  return out;
}

async function sync() {
  const options = readOptions();
  const workbench = vscode.workspace.getConfiguration("workbench");
  const current = workbench.inspect("colorCustomizations")?.globalValue ?? {};
  const next = { ...current };

  for (const [label, theme] of Object.entries(palette.themes)) {
    const key = `[${label}]`;
    const scope = { ...(next[key] ?? {}) };
    for (const k of MANAGED_KEYS) delete scope[k];
    Object.assign(scope, overridesFor(theme, options));
    if (Object.keys(scope).length) next[key] = scope;
    else delete next[key];
  }

  if (JSON.stringify(next) === JSON.stringify(current)) {
    log.info(`sync: brackets=${options.brackets} indentGuides=${options.indentGuides}, already applied`);
    return;
  }
  try {
    await workbench.update(
      "colorCustomizations",
      Object.keys(next).length ? next : undefined,
      vscode.ConfigurationTarget.Global,
    );
    log.info(`sync: brackets=${options.brackets} indentGuides=${options.indentGuides}, written to user settings`);
  } catch (err) {
    log.error("sync: could not write workbench.colorCustomizations", err);
    vscode.window.showErrorMessage(`Riso: could not apply bracket / indent guide colors — ${err?.message ?? err}`);
  }
}

// Flip a mode between "plain" and the last non-plain value (default `on`).
async function toggle(context, setting, on) {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  const current = cfg.get(setting);
  const memo = `last.${setting}`;
  let next;
  if (current === "plain") {
    next = context.globalState.get(memo, on);
  } else {
    await context.globalState.update(memo, current);
    next = "plain";
  }
  await cfg.update(setting, next, vscode.ConfigurationTarget.Global);
  vscode.window.setStatusBarMessage(`Riso: ${setting} → ${next}`, 2500);
}

async function setWorkspaceTheme() {
  if (!vscode.workspace.workspaceFolders?.length) {
    vscode.window.showWarningMessage("Riso: open a folder or workspace first.");
    return;
  }
  const workbench = vscode.workspace.getConfiguration("workbench");
  const inspected = workbench.inspect("colorTheme");
  const workspaceTheme = inspected?.workspaceValue;

  const GLOBAL = "$(globe) Use the global theme";
  const items = [
    ...Object.keys(palette.themes).map((label) => ({
      label,
      description: label === workspaceTheme ? "current in this workspace" : undefined,
    })),
    { label: "", kind: vscode.QuickPickItemKind.Separator },
    { label: GLOBAL, description: inspected?.globalValue ? `(${inspected.globalValue})` : undefined },
  ];

  // Live preview while moving through the list; restored on cancel.
  const picked = await vscode.window.showQuickPick(items, {
    title: "Riso theme for this workspace",
    placeHolder: "Pick an ink for this project",
    onDidSelectItem: (item) => {
      if (palette.themes[item.label]) {
        workbench.update("colorTheme", item.label, vscode.ConfigurationTarget.Workspace);
      }
    },
  });

  const final = !picked ? workspaceTheme : picked.label === GLOBAL ? undefined : picked.label;
  await workbench.update("colorTheme", final, vscode.ConfigurationTarget.Workspace);
}

function activate(context) {
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(SECTION)) sync();
    }),
    vscode.commands.registerCommand("riso.toggleBrackets", () =>
      toggle(context, "brackets", "rainbow"),
    ),
    vscode.commands.registerCommand("riso.toggleIndentGuides", () =>
      toggle(context, "indentGuides", "rainbow"),
    ),
    vscode.commands.registerCommand("riso.setWorkspaceTheme", setWorkspaceTheme),
    vscode.commands.registerCommand("riso.useGlobalTheme", () =>
      vscode.workspace
        .getConfiguration("workbench")
        .update("colorTheme", undefined, vscode.ConfigurationTarget.Workspace),
    ),
  );
  context.subscriptions.push(log);
  log.info(`activate: theme=${vscode.workspace.getConfiguration("workbench").get("colorTheme")}`);
  new RainbowIdentifiers().register(context);
  registerMenu(context);
  // Re-apply on start so palette changes in an update reach existing overrides.
  sync();
}

module.exports = { activate, deactivate() {} };
