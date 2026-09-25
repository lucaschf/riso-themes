// One place for every option: "Riso: Options…" and a status bar button.
//
// The menu shows the current state on each row and stays open after a change
// (back on the same row), so several options can be tweaked in one go. The
// settings it writes are the same ones the Settings UI shows.
const vscode = require("vscode");
const palette = require("./palette.json");
const log = require("./log");

const SECTION = "riso";
const Global = vscode.ConfigurationTarget.Global;
const Workspace = vscode.ConfigurationTarget.Workspace;

const MODES = [
  { id: "rainbow", label: "Rainbow", detail: "One color per nesting level, from the family's inks" },
  { id: "duotone", label: "Duotone", detail: "The theme's ink and the cream, alternating" },
  { id: "plain", label: "Off", detail: "Every level in the punctuation tone" },
];
const modeLabel = (id) => MODES.find((m) => m.id === id)?.label ?? id;

// Friendly groups over riso.rainbowIdentifiers.kinds.
const KIND_GROUPS = [
  { label: "Parameters", kinds: ["parameter"] },
  { label: "Local variables", kinds: ["variable"] },
  { label: "Attributes", description: "class fields, self.x, obj.prop", kinds: ["property"] },
  { label: "Constants", description: "UPPER_CASE, Final, const, enum members", kinds: ["constant"] },
  { label: "Types", description: "classes, interfaces, enums, type aliases", kinds: ["class", "interface", "enum", "type"] },
  { label: "Type parameters", description: "T, K, V…", kinds: ["typeParameter"] },
  { label: "Functions", description: "replaces the shared function color", kinds: ["function"] },
  { label: "Methods", description: "replaces the shared method color", kinds: ["method"] },
];

// -- Theme helpers -------------------------------------------------------------

const workbench = () => vscode.workspace.getConfiguration("workbench");
const currentTheme = () => workbench().get("colorTheme");
const themeInfo = (label = currentTheme()) => palette.themes[label];
const shortName = (base) => base.replace(/^Riso /, "");

function labelFor(base, variant) {
  return Object.keys(palette.themes).find(
    (label) => palette.themes[label].base === base && palette.themes[label].variant === variant,
  );
}

const baseThemes = () => [...new Set(Object.values(palette.themes).map((t) => t.base))];

// Write the theme where it is currently decided: this workspace if it has its
// own, otherwise the user settings.
function themeTarget() {
  return workbench().inspect("colorTheme")?.workspaceValue !== undefined ? Workspace : Global;
}

async function setTheme(label, target = themeTarget()) {
  await workbench().update("colorTheme", label, target);
}

// -- Pickers ---------------------------------------------------------------------

// Pick an ink, keeping the current surface; previews while moving.
async function pickInk() {
  const info = themeInfo();
  const variant = info?.variant ?? "normal";
  const target = themeTarget();
  const before = currentTheme();
  const items = baseThemes().map((base) => ({
    label: shortName(base),
    base,
    description: base === info?.base ? "current" : undefined,
  }));
  const qp = vscode.window.createQuickPick();
  qp.title = `Theme ${target === Workspace ? "for this workspace" : "(global)"}`;
  qp.placeholder = "Pick an ink";
  qp.items = items;
  qp.activeItems = items.filter((i) => i.base === info?.base);
  qp.onDidChangeActive(([item]) => item && setTheme(labelFor(item.base, variant), target));
  const picked = await new Promise((resolve) => {
    qp.onDidAccept(() => resolve(qp.selectedItems[0]));
    qp.onDidHide(() => resolve(undefined));
    qp.show();
  });
  qp.dispose();
  await setTheme(picked ? labelFor(picked.base, variant) : before, target);
}

async function toggleDimmed() {
  const info = themeInfo();
  if (!info) {
    vscode.window.showInformationMessage("Riso: pick a Riso theme first.");
    return;
  }
  await setTheme(labelFor(info.base, info.variant === "dimmed" ? "normal" : "dimmed"));
}

async function pickMode(setting, title) {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  const current = cfg.get(setting);
  const picked = await vscode.window.showQuickPick(
    MODES.map((m) => ({ ...m, description: m.id === current ? "current" : undefined })),
    { title, placeHolder: modeLabel(current) },
  );
  if (picked) await cfg.update(setting, picked.id, Global);
}

async function pickKinds() {
  const cfg = vscode.workspace.getConfiguration(`${SECTION}.rainbowIdentifiers`);
  const kinds = new Set(cfg.get("kinds"));
  const items = KIND_GROUPS.map((g) => ({ ...g, picked: g.kinds.every((k) => kinds.has(k)) }));
  const picked = await vscode.window.showQuickPick(items, {
    title: "Colored by name",
    placeHolder: "What gets its own color per name",
    canPickMany: true,
  });
  if (!picked) return;
  await cfg.update("kinds", picked.flatMap((g) => g.kinds), Global);
}

// -- Menu ------------------------------------------------------------------------

function menuItems() {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  const rid = vscode.workspace.getConfiguration(`${SECTION}.rainbowIdentifiers`);
  const info = themeInfo();
  const inspected = workbench().inspect("colorTheme");
  const ridKinds = new Set(rid.get("kinds"));
  const kindsLabel = KIND_GROUPS.filter((g) => g.kinds.every((k) => ridKinds.has(k)))
    .map((g) => g.label)
    .join(", ");
  const sep = (label) => ({ label, kind: vscode.QuickPickItemKind.Separator });

  return [
    sep("Theme"),
    {
      id: "ink",
      label: "$(symbol-color) Theme",
      description: info ? shortName(info.base) : `${currentTheme()} (not Riso)`,
      detail: themeTarget() === Workspace ? "Set for this workspace" : "Global",
    },
    {
      id: "dimmed",
      label: "$(color-mode) Background",
      description: info ? (info.variant === "dimmed" ? "Dimmed" : "Normal") : "—",
      detail: "Dimmed lifts the paper a step for less contrast",
    },
    {
      id: "workspace",
      label: "$(root-folder) This workspace",
      description: inspected?.workspaceValue ? shortName(inspected.workspaceValue) : "follows global",
      detail: "Give this project its own ink",
    },
    sep("Code"),
    { id: "brackets", label: "$(bracket) Brackets", description: modeLabel(cfg.get("brackets")) },
    { id: "indent", label: "$(list-tree) Indent guides", description: modeLabel(cfg.get("indentGuides")) },
    { id: "rid", label: "$(symbol-variable) Color by name", description: rid.get("enabled") ? "On" : "Off" },
    { id: "kinds", label: "$(checklist) Colored by name", description: kindsLabel || "nothing" },
    sep(""),
    {
      id: "statusbar",
      label: "$(layout-statusbar) Status bar button",
      description: cfg.get("statusBarItem") ? "Shown" : "Hidden",
    },
    { id: "settings", label: "$(gear) All settings…" },
  ];
}

async function run(id) {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  const rid = vscode.workspace.getConfiguration(`${SECTION}.rainbowIdentifiers`);
  switch (id) {
    case "ink": return pickInk();
    case "dimmed": return toggleDimmed();
    case "workspace": return vscode.commands.executeCommand("riso.setWorkspaceTheme");
    case "brackets": return pickMode("brackets", "Brackets");
    case "indent": return pickMode("indentGuides", "Indent guides");
    case "rid": return rid.update("enabled", !rid.get("enabled"), Global);
    case "kinds": return pickKinds();
    case "statusbar": return cfg.update("statusBarItem", !cfg.get("statusBarItem"), Global);
    case "settings":
      return vscode.commands.executeCommand("workbench.action.openSettings", "@ext:lucaschf.riso-themes");
  }
}

async function showMenu(activeId) {
  const qp = vscode.window.createQuickPick();
  qp.title = "Riso";
  qp.placeholder = "Pick an option to change it";
  qp.items = menuItems();
  qp.activeItems = qp.items.filter((i) => i.id === (activeId ?? "ink"));
  const picked = await new Promise((resolve) => {
    qp.onDidAccept(() => resolve(qp.selectedItems[0]));
    qp.onDidHide(() => resolve(undefined));
    qp.show();
  });
  qp.dispose();
  if (!picked?.id) return;
  log.info(`menu: ${picked.id}`);
  await run(picked.id);
  // Settings opens its own editor; everything else returns to the menu.
  if (picked.id !== "settings") await showMenu(picked.id);
}

// -- Status bar ------------------------------------------------------------------

function registerStatusBar(context) {
  const item = vscode.window.createStatusBarItem("riso.options", vscode.StatusBarAlignment.Right, 10);
  item.name = "Riso";
  item.command = "riso.options";
  const refresh = () => {
    const info = themeInfo();
    const show = info && vscode.workspace.getConfiguration(SECTION).get("statusBarItem");
    if (!show) return item.hide();
    item.text = `$(symbol-color) ${shortName(info.base)}${info.variant === "dimmed" ? " · dim" : ""}`;
    item.tooltip = `${currentTheme()} — Riso options`;
    item.show();
  };
  context.subscriptions.push(
    item,
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("workbench.colorTheme") || e.affectsConfiguration(SECTION)) refresh();
    }),
  );
  refresh();
}

function registerMenu(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand("riso.options", () => showMenu()),
    vscode.commands.registerCommand("riso.toggleDimmed", toggleDimmed),
  );
  registerStatusBar(context);
}

module.exports = { registerMenu };
