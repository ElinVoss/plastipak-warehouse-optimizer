const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');
const appVersion = require('../package.json').version;

const isDev = !app.isPackaged;

function loadRenderer(win, query = {}) {
  if (isDev) {
    const url = new URL('http://localhost:5173');
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, String(value));
    }
    win.loadURL(url.toString());
    return;
  }
  win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#0f172a',
    show: false,
    title: 'Warehouse Optimizer',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      additionalData: JSON.stringify({ version: appVersion }),
    },
  });

  // External links open in default browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  loadRenderer(win);

  if (isDev) {
    win.webContents.openDevTools({ mode: 'detach' });
  }

  win.once('ready-to-show', () => {
    win.maximize();
    win.show();
  });
}

function createMapWindow() {
  const mapWin = new BrowserWindow({
    width: 1700,
    height: 1000,
    minWidth: 1200,
    minHeight: 800,
    backgroundColor: '#0f172a',
    show: false,
    title: 'Warehouse Optimizer - Map',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      additionalData: JSON.stringify({ version: appVersion }),
    },
  });

  mapWin.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  loadRenderer(mapWin, { view: 'map' });

  if (isDev) {
    mapWin.webContents.openDevTools({ mode: 'detach' });
  }

  mapWin.once('ready-to-show', () => {
    mapWin.maximize();
    mapWin.show();
  });
}

app.whenReady().then(() => {
  ipcMain.handle('wo:open-map-window', () => {
    createMapWindow();
    return true;
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
