const { app, BrowserWindow, ipcMain, dialog, nativeTheme } = require('electron');
const path = require('path');

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

  win.loadFile('index.html');
}

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});