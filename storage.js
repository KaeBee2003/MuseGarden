// ════════════════════════════════════════════════════════════════════
//  STORAGE — localStorage-first, optional GitHub sync
// ════════════════════════════════════════════════════════════════════

const STORAGE_KEY = "musegarden_v2";
let _githubSyncEnabled = false;

const DEFAULT_SETTINGS = {
  autoSave: true,
  autoSaveInterval: 30,
  showWelcome: true,
  defaultCanvasFolder: 'Documents/MuseGarden/Canvases',
  viewType: 'root'
};

function normalizeSettings() {
  settings = Object.assign({}, DEFAULT_SETTINGS, settings || {});
  settings.autoSaveInterval = parseInt(settings.autoSaveInterval, 10) || 30;
  if (settings.autoSaveInterval < 5) settings.autoSaveInterval = 5;
  if (typeof settings.autoSave !== 'boolean') settings.autoSave = true;
  if (typeof settings.showWelcome !== 'boolean') settings.showWelcome = true;
  if ('saveToElectron' in settings) delete settings.saveToElectron;
}

// ── Load from localStorage ────────────────────────────────────────
function loadFromLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    canvasData  = data.canvases  || {};
    songTags    = data.tags      || {};
    projectTags = data.projectTags || {};
    settings    = data.settings  || {};
    normalizeSettings();
    openTabs    = data.openTabs  || [];
    activeTabId = data.activeTab || null;
    console.log("✓ Loaded from localStorage:", Object.keys(canvasData).length, "canvases");
    return true;
  } catch(e) {
    console.warn("localStorage load error:", e);
    normalizeSettings();
    return false;
  }
}

// ── Save to localStorage ──────────────────────────────────────────
function saveToLocal() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      canvases:  canvasData,
      tags:      songTags,
      projectTags: projectTags,
      settings,
      openTabs,
      activeTab: activeTabId
    }));
    return true;
  } catch(e) {
    console.error("localStorage save error:", e);
    return false;
  }
}

// ── Main save entry point (used everywhere) ───────────────────────
async function saveToLS() {
  saveToLocal();
  setDirty(false);
  if (_githubSyncEnabled) {
    saveToGitHub().catch(e => console.warn("GitHub sync error:", e));
  }
  if (window && window.electronAPI) {
    saveToElectronDefault().catch(e => console.warn("Electron disk save error:", e));
    saveElectronConfig().catch(e => console.warn("Electron config save error:", e));
  }
}

let _autoSaveTimer = null;
function startAutoSaveTimer() {
  if (_autoSaveTimer) clearInterval(_autoSaveTimer);
  if (!settings.autoSave) return;
  const interval = Math.max(5, parseInt(settings.autoSaveInterval, 10) || 30) * 1000;
  _autoSaveTimer = setInterval(() => { if (isDirty) saveToLS(); }, interval);
}

async function saveElectronConfig() {
  if (!(window && window.electronAPI && window.electronAPI.saveJSON)) return false;
  const settingsData = JSON.stringify(settings, null, 2);
  const sourceDirs = JSON.stringify(sources.map(s => ({
    id: s.id,
    type: s.type,
    name: s.name,
    path: s.path,
    owner: s.owner,
    repo: s.repo,
    worker: s.worker
  })), null, 2);
  await window.electronAPI.saveJSON('Config', 'settings.json', settingsData);
  await window.electronAPI.saveJSON('Config', 'folder_directories.json', sourceDirs);
  return true;
}

async function loadElectronConfig() {
  if (!(window && window.electronAPI && window.electronAPI.readJSON)) return false;
  try {
    const loadedSettings = await window.electronAPI.readJSON('Config', 'settings.json');
    if (loadedSettings) {
      settings = Object.assign({}, DEFAULT_SETTINGS, loadedSettings);
      normalizeSettings();
      console.log("✓ Loaded settings from Electron disk");
    }
  } catch(e) {
    console.warn("Electron settings load error or not found:", e);
  }

  try {
    const loadedSources = await window.electronAPI.readJSON('Config', 'folder_directories.json');
    if (loadedSources && Array.isArray(loadedSources)) {
      sources = loadedSources;
      saveSourcesMeta(); // Sync to localStorage
      console.log("✓ Loaded sources from Electron disk:", sources.length, "sources");
    }
  } catch(e) {
    console.warn("Electron sources load error or not found:", e);
  }
  return true;
}

// ── Export canvas data to a JSON file ────────────────────────────
function exportToFile() {
  const data = JSON.stringify({
    canvases:  canvasData,
    tags:      songTags,
    projectTags: projectTags,
    settings,
    openTabs,
    activeTab: activeTabId
  }, null, 2);
  // If running inside Electron, save silently into the user's Documents/MuseGarden folder
  if (window && window.electronAPI && window.electronAPI.saveFile) {
    const filename = "musegarden-" + new Date().toISOString().slice(0, 10) + ".json";
    window.electronAPI.saveFile(filename, data)
      .then(full => showToast("Saved to " + full, 3000))
      .catch(e => { console.error(e); showToast("Save failed: " + e.message, 5000, "error"); });
    return;
  }

  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(new Blob([data], { type: "application/json" })),
    download: "musegarden-" + new Date().toISOString().slice(0, 10) + ".json"
  });
  a.click();
  URL.revokeObjectURL(a.href);
  showToast("Exported to file!", 3000);
}

// ── Import canvas data from a JSON file ──────────────────────────
function importFromFile() {
  const input = Object.assign(document.createElement("input"), {
    type: "file", accept: ".json"
  });
  input.onchange = async () => {
    try {
      const data = JSON.parse(await input.files[0].text());
      canvasData  = data.canvases  || {};
      songTags    = data.tags      || {};
      projectTags = data.projectTags || {};
      settings    = data.settings  || {};
      normalizeSettings();
      openTabs    = data.openTabs  || [];
      activeTabId = data.activeTab || null;
      saveToLocal();
      showToast("Imported! Reloading...", 2000);
      setTimeout(() => location.reload(), 2100);
    } catch(e) {
      showToast("Import failed: " + e.message, 5000, "error");
    }
  };
  input.click();
}

async function loadFromElectronDefault() {
  if (!(window && window.electronAPI && window.electronAPI.readJSON)) return false;
  try {
    const data = await window.electronAPI.readJSON('Canvases', 'musegarden-latest.json');
    canvasData  = data.canvases  || {};
    songTags    = data.tags      || {};
    projectTags = data.projectTags || {};
    settings    = data.settings  || {};
    normalizeSettings();
    openTabs    = data.openTabs  || [];
    activeTabId = data.activeTab || null;
    saveToLocal();
    console.log("✓ Loaded from Electron disk storage");
    return true;
  } catch(e) {
    console.warn("Electron file load error:", e);
    return false;
  }
}

// Read a named file from the default Electron folder (if available)
async function importFromElectronFile(filename) {
  if (!(window && window.electronAPI && window.electronAPI.readFile)) {
    throw new Error('Electron file API not available');
  }
  const txt = await window.electronAPI.readFile(filename);
  const data = JSON.parse(txt);
  canvasData  = data.canvases  || {};
  songTags    = data.tags      || {};
  projectTags = data.projectTags || {};
  settings    = data.settings  || {};
  openTabs    = data.openTabs  || [];
  activeTabId = data.activeTab || null;
  saveToLocal();
  showToast("Imported from " + filename + "! Reloading...", 2000);
  setTimeout(() => location.reload(), 2100);
}

// Save current state to the Electron default folder (silent, no dialog)
async function saveToElectronDefault() {
  if (!(window && window.electronAPI && window.electronAPI.saveJSON)) return false;
  const data = JSON.stringify({
    canvases:  canvasData,
    tags:      songTags,
    projectTags: projectTags,
    settings,
    openTabs,
    activeTab: activeTabId
  }, null, 2);
  try {
    await window.electronAPI.saveJSON('Canvases', 'musegarden-latest.json', data);
    console.log('Saved canvas state to Documents/MuseGarden/Canvases');
    return true;
  } catch (e) {
    console.error('Electron save error', e);
    return false;
  }
}

// ── Save status UI ────────────────────────────────────────────────
function setDirty(v) {
  isDirty = v;
  const el    = document.getElementById("saveStatus");
  const txt   = document.getElementById("saveStatusText");
  if (!el) return;
  if (v) {
    el.className = "unsaved";
    if (txt) txt.textContent = "Unsaved changes";
  } else {
    el.className = "saved";
    if (txt) txt.textContent = "Changes saved";
  }
}

function setSaveStatus(state, errMsg) {
  const el    = document.getElementById("saveStatus");
  const txt   = document.getElementById("saveStatusText");
  if (!el) return;
  if (state === "saving") {
    el.className = "saving";
    if (txt) txt.textContent = "Saving…";
  } else if (state === "error") {
    el.className = "unsaved";
    if (txt) txt.textContent = "Save error";
    if (errMsg) console.error("Save error:", errMsg);
  }
}

function enableGithubSync()  { _githubSyncEnabled = true; }
function disableGithubSync() { _githubSyncEnabled = false; }

// Autosave timer is managed by settings.
startAutoSaveTimer();
