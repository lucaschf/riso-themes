// Runtime options for the Riso retro themes.
//
// Themes are static JSON, so the bracket / indent-guide modes are applied as
// theme-scoped entries in the user's `workbench.colorCustomizations`
// ("[Riso Touge]": {...}). Only the keys in MANAGED_KEYS are ever touched;
// anything else the user put in those scopes is left alone.
const vscode = require("vscode");
const palette = require("./palette.json");
const { RainbowIdentifiers } = require("./rainbowIdentifiers");
const { registerMenu, pickInk } = require("./menu");
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

function installedThemeLabels() {
  const labels = new Set();
  for (const ext of vscode.extensions.all) {
    for (const theme of ext.packageJSON?.contributes?.themes ?? []) {
      if (theme.label) labels.add(theme.label);
      if (theme.id) labels.add(theme.id);
    }
  }
  return labels;
}

async function sync() {
  const options = readOptions();
  const workbench = vscode.workspace.getConfiguration("workbench");
  const current = workbench.inspect("colorCustomizations")?.globalValue ?? {};
  const next = { ...current };

  // Drop scopes left behind for themes that no longer exist (a renamed or
  // removed theme), but only when they hold nothing but keys this extension
  // writes — a scope with anything of the user's in it is left alone.
  const installed = installedThemeLabels();
  for (const key of Object.keys(next)) {
    const label = /^\[([^\]*]+)\]$/.exec(key)?.[1];
    const scope = next[key];
    if (!label || installed.has(label) || typeof scope !== "object") continue;
    if (Object.keys(scope).every((k) => MANAGED_KEYS.includes(k))) {
      delete next[key];
      log.info(`sync: removed leftover colors for missing theme "${label}"`);
    }
  }

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

// Undo everything the extension wrote, for a clean uninstall (like Peacock's
// "Remove All Global and Workspace Colors"): every riso.* option goes back to
// its default, and with nothing left to apply, sync() strips the bracket and
// indent-guide colors from workbench.colorCustomizations. The color theme and
// VS Code's own settings are the user's choices and are left alone.
const OPTION_KEYS = Object.keys(require("./package.json").contributes.configuration.properties);
const MEMO_KEYS = ["last.brackets", "last.indentGuides"];

async function removeAllRisoSettings(context) {
  const config = vscode.workspace.getConfiguration();
  for (const key of OPTION_KEYS) {
    if (config.inspect(key)?.globalValue !== undefined) {
      await config.update(key, undefined, vscode.ConfigurationTarget.Global);
    }
  }
  for (const key of MEMO_KEYS) await context?.globalState.update(key, undefined);
  await sync();
  log.info("remove: riso.* options reset, bracket / indent-guide colors removed");
}

async function confirmRemoveAll(context) {
  const choice = await vscode.window.showWarningMessage(
    "Remove all Riso settings?",
    {
      modal: true,
      detail:
        "Resets every riso.* option to its default and deletes the bracket and indent-guide colors " +
        "Riso wrote to your user settings. Your color theme is not changed.",
    },
    "Remove",
  );
  if (choice !== "Remove") return;
  try {
    await removeAllRisoSettings(context);
    vscode.window.showInformationMessage("Riso settings removed. The extension can now be uninstalled cleanly.");
  } catch (err) {
    log.error("remove: could not reset the settings", err);
    vscode.window.showErrorMessage(`Riso: could not remove the settings — ${err?.message ?? err}`);
  }
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
    vscode.commands.registerCommand("riso.setWorkspaceTheme", () =>
      pickInk(vscode.ConfigurationTarget.Workspace),
    ),
    vscode.commands.registerCommand("riso.removeAllSettings", () => confirmRemoveAll(context)),
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

module.exports = { activate, deactivate() {}, removeAllRisoSettings };
