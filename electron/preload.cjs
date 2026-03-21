const { contextBridge, ipcRenderer } = require('electron');

// Reserved for future OS integrations (dialogs, filesystem exports, etc.).
// Keep surface area minimal for safety.
let appVersion = '2.4.3'; // fallback
try {
  const data = JSON.parse(process.additionalData || '{}');
  if (data.version) appVersion = data.version;
} catch {}

contextBridge.exposeInMainWorld('wo', {
  version: appVersion,
  openMapWindow: () => ipcRenderer.invoke('wo:open-map-window'),
});
