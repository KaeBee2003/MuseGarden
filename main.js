const { app, BrowserWindow, ipcMain, dialog, nativeTheme } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

let mainWindow = null;

function createWindow() {
  // Force dark mode so Windows draws the native title bar/frame using its
  // dark theme instead of whatever the OS default happens to be — this is
  // what was causing the title bar strip to show as a different (often
  // lighter/bluer) grey than the app's own background.
  nativeTheme.themeSource = 'dark';

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'MuseGarden',
    icon: path.join(__dirname, 'icon.ico'),
    autoHideMenuBar: true,
    backgroundColor: '#1a1b26', // matches --bg in theme.css, avoids a flash/mismatch on load

    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow = win;
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
  });
  win.loadFile('index.html');
}

function showMessage(options) {
  return mainWindow
    ? dialog.showMessageBox(mainWindow, options)
    : dialog.showMessageBox(options);
}

function setupAutoUpdater() {
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = false;

  autoUpdater.on('update-available', async (info) => {
    const { response } = await showMessage({
      type: 'info',
      title: 'Update available',
      message: `MuseGarden ${info.version} is available.`,
      detail: `You are running ${app.getVersion()}. Download the update now?`,
      buttons: ['Download', 'Later'],
      defaultId: 0,
      cancelId: 1
    });
    if (response === 0) {
      autoUpdater.downloadUpdate().catch((err) => {
        console.error('Update download failed:', err);
      });
    }
  });

  autoUpdater.on('update-downloaded', async () => {
    const { response } = await showMessage({
      type: 'info',
      title: 'Update ready',
      message: 'The update has been downloaded.',
      detail: 'Restart MuseGarden to install it.',
      buttons: ['Restart now', 'Later'],
      defaultId: 0,
      cancelId: 1
    });
    if (response === 0) autoUpdater.quitAndInstall(false, true);
  });

  autoUpdater.on('error', (err) => {
    console.error('Auto-update error:', err);
  });

  const check = () => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.error('Update check failed:', err);
    });
  };

  setTimeout(check, 8000);
  setInterval(check, 4 * 60 * 60 * 1000);
}

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

app.whenReady().then(() => {
  createWindow();
  setupAutoUpdater();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});