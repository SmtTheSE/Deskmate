// Deskmate desktop app: runs the help desk on this computer with a double-click.
// No Docker, no terminal. Data is stored in the user's application data folder.
import { app, BrowserWindow, Menu, dialog, shell } from 'electron';
import { createServer } from 'node:net';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

interface Prefs { shareOnNetwork: boolean; port: number }

const dataDir = join(app.getPath('userData'), 'data');
const prefsFile = join(app.getPath('userData'), 'preferences.json');
let win: BrowserWindow | null = null;
let baseUrl = '';

function loadPrefs(): Prefs {
  try { return { shareOnNetwork: false, port: 3000, ...JSON.parse(readFileSync(prefsFile, 'utf8')) }; } catch { return { shareOnNetwork: false, port: 3000 }; }
}
function savePrefs(p: Prefs) { writeFileSync(prefsFile, JSON.stringify(p, null, 2)); }

function lanAddress(): string | null {
  for (const list of Object.values(networkInterfaces())) {
    for (const i of list ?? []) if (i.family === 'IPv4' && !i.internal) return i.address;
  }
  return null;
}

function portFree(port: number, host: string) {
  return new Promise<boolean>((resolve) => {
    const s = createServer().once('error', () => resolve(false)).once('listening', () => s.close(() => resolve(true)));
    s.listen(port, host);
  });
}

async function pickPort(preferred: number, host: string) {
  for (let p = preferred; p < preferred + 50; p++) if (await portFree(p, host)) return p;
  throw new Error('No free port found');
}

async function startServer(prefs: Prefs) {
  mkdirSync(dataDir, { recursive: true });
  const host = prefs.shareOnNetwork ? '0.0.0.0' : '127.0.0.1';
  const port = await pickPort(prefs.port, host);
  const lan = prefs.shareOnNetwork ? lanAddress() : null;
  baseUrl = `http://127.0.0.1:${port}`;
  process.env.PORT = String(port);
  process.env.HOST = host;
  process.env.DATA_DIR = dataDir;
  process.env.WEB_DIR = app.isPackaged ? join(process.resourcesPath, 'web') : join(__dirname, '../../web/dist');
  process.env.PUBLIC_URL = lan ? `http://${lan}:${port}` : baseUrl;
  await import(pathToFileURL(join(__dirname, 'server.mjs')).href);
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${baseUrl}/healthz`)).ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('The help desk did not start.');
}

function firstUrl() {
  // The person who installed the app owns it, so the setup code is filled in for them.
  const codeFile = join(dataDir, 'setup-code.txt');
  if (existsSync(codeFile)) return `${baseUrl}/setup?code=${encodeURIComponent(readFileSync(codeFile, 'utf8').trim())}`;
  return `${baseUrl}/app`;
}

function buildMenu(prefs: Prefs) {
  const lan = lanAddress();
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' as const }] : []),
    {
      label: 'Help desk',
      submenu: [
        { label: 'Open help form in browser', click: () => shell.openExternal(`${process.env.PUBLIC_URL}/help`) },
        {
          label: 'Let others on our network use it',
          type: 'checkbox',
          checked: prefs.shareOnNetwork,
          click: async (item) => {
            savePrefs({ ...prefs, shareOnNetwork: item.checked });
            const detail = item.checked
              ? `After restarting, colleagues and visitors on the same network can open:\n\nHelp form: http://${lan ?? 'this-computer'}:${process.env.PORT}/help\nStaff console: http://${lan ?? 'this-computer'}:${process.env.PORT}/app\n\nKeep this computer switched on while people use it.`
              : 'After restarting, only this computer can open the help desk.';
            const r = await dialog.showMessageBox({ type: 'info', message: 'Restart Deskmate to apply this change', detail, buttons: ['Restart now', 'Later'] });
            if (r.response === 0) { app.relaunch(); app.exit(0); }
          },
        },
        { type: 'separator' },
        { label: 'Show my data folder', click: () => shell.openPath(dataDir) },
        { label: 'How to back up', click: () => dialog.showMessageBox({ type: 'info', message: 'Backing up Deskmate', detail: `Everything is in one folder:\n\n${dataDir}\n\nCopy this folder to a safe place (for example a USB drive or your cloud storage) now and then. To restore, quit Deskmate and copy it back.` }) },
      ],
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  win = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: 'Deskmate',
    backgroundColor: '#faf9f5',
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  // Links meant for other people (the help form) open in the normal browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(baseUrl)) { e.preventDefault(); shell.openExternal(url); }
  });
  win.loadURL(firstUrl());
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(async () => {
    const prefs = loadPrefs();
    try {
      await startServer(prefs);
    } catch (e: any) {
      dialog.showErrorBox('Deskmate could not start', String(e?.message ?? e));
      app.exit(1);
      return;
    }
    buildMenu(prefs);
    createWindow();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  });
  // On Windows and Linux, closing the window quits. On Mac the app stays in the Dock.
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
