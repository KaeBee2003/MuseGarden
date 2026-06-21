const { contextBridge, shell, ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');

const defaultFolder = path.join(os.homedir(), 'Documents', 'MuseGarden');
const canvasesFolder = path.join(defaultFolder, 'Canvases');

async function ensureFolder(folder) {
  try {
    await fs.promises.mkdir(folder, { recursive: true });
  } catch (e) {
    // ignore
  }
}

async function scanFolderRecursive(dir, baseDir) {
  const results = [];
  const list = await fs.promises.readdir(dir, { withFileTypes: true });
  for (const entry of list) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = await scanFolderRecursive(fullPath, baseDir);
      results.push(...sub);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (/\.(mp3|wav|flac|m4a|ogg|aac|opus|wma|aiff|aif)$/.test(ext)) {
        const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
        results.push({
          name: entry.name,
          absolutePath: fullPath,
          relativePath: relativePath
        });
      }
    }
  }
  return results;
}

contextBridge.exposeInMainWorld('electronAPI', {
  saveFile: async (filename, data) => {
    await ensureFolder(defaultFolder);
    const full = path.join(defaultFolder, filename);
    await fs.promises.writeFile(full, data, 'utf8');
    return full;
  },
  saveJSON: async (subFolder, filename, data) => {
    const folder = path.join(defaultFolder, subFolder);
    await ensureFolder(folder);
    const full = path.join(folder, filename);
    await fs.promises.writeFile(full, data, 'utf8');
    return full;
  },
  readFile: async (filename) => {
    const full = path.join(defaultFolder, filename);
    return fs.promises.readFile(full, 'utf8');
  },
  readJSON: async (subFolder, filename) => {
    const full = path.join(defaultFolder, subFolder, filename);
    const text = await fs.promises.readFile(full, 'utf8');
    return JSON.parse(text);
  },
  listFiles: async () => {
    await ensureFolder(defaultFolder);
    const files = await fs.promises.readdir(defaultFolder);
    return files;
  },
  getDefaultFolder: () => defaultFolder,
  getDefaultCanvasFolder: () => canvasesFolder,
  openDefaultCanvasFolder: async () => {
    await ensureFolder(canvasesFolder);
    return shell.openPath(canvasesFolder);
  },
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  scanFolder: async (folderPath) => {
    return scanFolderRecursive(folderPath, folderPath);
  },
  readLocalFile: async (absolutePath) => {
    return fs.promises.readFile(absolutePath);
  }
});
