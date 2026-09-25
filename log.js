// Shared "Riso Retro" channel in the Output panel.
const vscode = require("vscode");

let channel;
const get = () => (channel ??= vscode.window.createOutputChannel("Riso", { log: true }));

module.exports = {
  info: (msg) => get().info(msg),
  error: (msg, err) => get().error(`${msg}: ${err?.stack ?? err}`),
  dispose: () => channel?.dispose(),
};
