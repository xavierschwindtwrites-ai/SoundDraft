const { contextBridge, ipcRenderer } = require("electron");
const calls = [
  "load",
  "importAudio",
  "saveRecording",
  "createProject",
  "updateDraft",
  "updateSettings",
  "saveKey",
  "models",
  "transcribe",
  "format",
  "decision",
  "cancel",
  "exportDraft",
  "exportMetrics",
  "revealLibrary",
  "addDemo",
  "microphone",
  "recordStart",
  "recordAppend",
  "recordFinish",
];
const api = Object.fromEntries(
  calls.map((name) => [
    name,
    (...args) => ipcRenderer.invoke("sd:" + name, ...args),
  ]),
);
api.onUpdate = (callback) => {
  const handler = () => callback();
  ipcRenderer.on("sd:update", handler);
  return () => ipcRenderer.removeListener("sd:update", handler);
};
contextBridge.exposeInMainWorld("sounddraft", api);
