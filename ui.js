// ════════════════════════════════════════════════════════════════════
//  KEYBOARD SHORTCUTS
// ════════════════════════════════════════════════════════════════════
document.addEventListener("keydown", e => {
  const active = e.target.closest("[contenteditable]") || e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA";

  if (e.key === " " && !active) { isSpaceDown = true; e.preventDefault(); }
  if (e.key === "?") { document.getElementById("shortcutsOverlay").classList.add("open"); }

  if (e.key === "Escape") {
    document.querySelectorAll(".modal-overlay.open").forEach(m => m.classList.remove("open"));
    document.getElementById("shortcutsOverlay").classList.remove("open");
    document.getElementById("ctxMenu").style.display = "none";
    document.getElementById("slashMenu").style.display = "none";
    selectedNodeId = null; selectedArrowId = null;
    document.querySelectorAll(".c-node.selected").forEach(n => n.classList.remove("selected"));
    if (activeTabId) renderAllArrows(activeTabId);
  }

  if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); saveToLS(); }
  if ((e.ctrlKey || e.metaKey) && e.key === "z" && !active) {
    e.preventDefault(); if (activeTabId) undo(activeTabId);
  }
  if ((e.ctrlKey || e.metaKey) && e.key === "d" && !active) {
    e.preventDefault();
    if (selectedNodeId && activeTabId) {
      const cv   = canvasData[activeTabId];
      const orig = cv && cv.nodes.find(n => n.id === selectedNodeId);
      if (orig) {
        snapshotUndo(activeTabId);
        const node = { ...JSON.parse(JSON.stringify(orig)), id: generateId(), x: orig.x + 24, y: orig.y + 24 };
        cv.nodes.push(node); renderNode(node, activeTabId); setDirty(true);
      }
    }
  }
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "F") {
    e.preventDefault(); if (activeTabId) zoomToFit(activeTabId);
  }
  if ((e.key === "Delete" || e.key === "Backspace") && !active && (selectedNodeId || selectedArrowId)) {
    e.preventDefault();
    if (selectedNodeId) {
      pendingDeleteCallback = () => deleteSelected(activeTabId);
      document.getElementById("deleteConfirm").classList.add("open");
    } else {
      deleteSelected(activeTabId);
    }
  }
});

document.addEventListener("keyup", e => { if (e.key === " ") isSpaceDown = false; });

// Space bar pan cursor
document.addEventListener("keydown", e => {
  if (e.key === " " && !e.target.closest("[contenteditable]") && e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA") {
    document.getElementById("canvasArea").classList.add("pan-ready");
  }
});
document.addEventListener("keyup", e => {
  if (e.key === " ") {
    document.getElementById("canvasArea").classList.remove("pan-ready");
    document.getElementById("canvasArea").classList.remove("panning");
  }
});

// ════════════════════════════════════════════════════════════════════
//  TOOLBAR BUTTONS
// ════════════════════════════════════════════════════════════════════
document.getElementById("saveStatus").addEventListener("click", () => saveToLS());

document.getElementById("sourcesBtn").addEventListener("click", () => openSourcesModal());
document.getElementById("settingsBtn").addEventListener("click", () => openSettingsModal());

document.getElementById("closeSettings").addEventListener("click", closeSettingsModal);
document.getElementById("cancelSettingsBtn").addEventListener("click", closeSettingsModal);
document.getElementById("saveSettingsBtn").addEventListener("click", saveSettingsUI);

document.getElementById("autoSaveToggle").addEventListener("change", e => {
  settings.autoSave = e.target.checked;
  startAutoSaveTimer();
});
document.getElementById("showWelcomeToggle").addEventListener("change", e => {
  settings.showWelcome = e.target.checked;
  if (!settings.showWelcome) closeWelcomePopup();
});
document.getElementById("autoSaveInterval").addEventListener("change", e => {
  let value = parseInt(e.target.value, 10);
  if (Number.isNaN(value) || value < 5) value = 5;
  settings.autoSaveInterval = value;
  e.target.value = value;
  startAutoSaveTimer();
});

// ════════════════════════════════════════════════════════════════════
//  CANVAS TOOLBAR BUTTONS
// ════════════════════════════════════════════════════════════════════
document.getElementById("canvasToolZoomFit").addEventListener("click", () => {
  if (activeTabId) zoomToFit(activeTabId);
});

document.getElementById("canvasToolZoomSel").addEventListener("click", () => {
  if (activeTabId && selectedNodeIds.size > 0) {
    const cv = canvasData[activeTabId];
    if (!cv) return;
    const nodesToFit = cv.nodes.filter(n => selectedNodeIds.has(n.id));
    if (nodesToFit.length === 0) return;
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodesToFit.forEach(n => {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.w);
      maxY = Math.max(maxY, n.y + n.h);
    });
    
    const boxW = maxX - minX;
    const boxH = maxY - minY;
    const centerX = minX + boxW / 2;
    const centerY = minY + boxH / 2;
    
    const t = getTransform(activeTabId);
    const canvasEl = document.getElementById("canvasArea");
    
    const pad = 40;
    const scaleX = (canvasEl.offsetWidth - pad * 2) / boxW;
    const scaleY = (canvasEl.offsetHeight - pad * 2) / boxH;
    t.scale = Math.max(0.2, Math.min(2.5, Math.min(scaleX, scaleY)));
    
    t.x = canvasEl.offsetWidth / 2 - centerX * t.scale;
    t.y = canvasEl.offsetHeight / 2 - centerY * t.scale;
    
    const nodesEl = document.getElementById("nodes-" + activeTabId);
    if (nodesEl) applyTransform(nodesEl, activeTabId);
    renderAllArrows(activeTabId);
  }
});

document.getElementById("canvasToolPanSel").addEventListener("click", () => {
  if (activeTabId && selectedNodeIds.size > 0) {
    const cv = canvasData[activeTabId];
    if (!cv) return;
    const nodesToFit = cv.nodes.filter(n => selectedNodeIds.has(n.id));
    if (nodesToFit.length === 0) return;
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodesToFit.forEach(n => {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.w);
      maxY = Math.max(maxY, n.y + n.h);
    });
    
    const boxW = maxX - minX;
    const boxH = maxY - minY;
    const centerX = minX + boxW / 2;
    const centerY = minY + boxH / 2;
    
    const t = getTransform(activeTabId);
    const canvasEl = document.getElementById("canvasArea");
    
    t.x = canvasEl.offsetWidth / 2 - centerX * t.scale;
    t.y = canvasEl.offsetHeight / 2 - centerY * t.scale;
    
    const nodesEl = document.getElementById("nodes-" + activeTabId);
    if (nodesEl) applyTransform(nodesEl, activeTabId);
    renderAllArrows(activeTabId);
  }
});

document.getElementById("canvasToolNewNode").addEventListener("click", () => {
  if (activeTabId) createNode("rect", {}, activeTabId);
});

document.getElementById("canvasToolAddCanvas").addEventListener("click", () => {
  if (!activeTabId) return;
  // Show modal asking to create new or use existing canvas
  showCanvasNodeAddModal(activeTabId);
});

// Warn before closing if unsaved
window.addEventListener("beforeunload", e => {
  if (isDirty) { e.preventDefault(); e.returnValue = ""; }
});

// ════════════════════════════════════════════════════════════════════
//  INIT
// ════════════════════════════════════════════════════════════════════
function isElectronDesktop() {
  return typeof navigator === 'object' && /Electron/.test(navigator.userAgent);
}

async function init() {
  try {
    setLoaderMsg("Loading saved data…");
    const browserBanner = document.getElementById('browserBanner');
    if (browserBanner) {
      if (isElectronDesktop() || (window && window.electronAPI && window.electronAPI.getDefaultCanvasFolder)) {
        browserBanner.style.display = 'none';
      } else {
        browserBanner.style.display = 'flex';
      }
    }

    // Step 1: Load canvas/tags from localStorage/Electron disk
    loadSourcesMeta();
    let hasLocal = loadFromLocal();

    if (window && window.electronAPI && window.electronAPI.readJSON) {
      // First load configuration (settings & directories) from disk
      await loadElectronConfig();
      // Try to load latest canvas data from disk
      const hasElectronData = await loadFromElectronDefault();
      if (hasElectronData) {
        hasLocal = true;
        console.log('Loaded restore data from Electron disk storage');
      }
    }

    // Step 2: Restore local folder sources (requests permission if needed)
    if (sources.filter(s => s.type === "local").length > 0) {
      setLoaderMsg("Re-connecting to your music folders…");
      await restoreLocalSources();
    }

    // Step 3: Restore GitHub sources (requires internet)
    if (sources.filter(s => s.type === "github").length > 0) {
      setLoaderMsg("Connecting to GitHub…");
      try {
        await restoreGithubSources();
        // If no local data yet, try loading canvas data from GitHub
        if (!hasLocal) {
          setLoaderMsg("Downloading canvas data from GitHub…");
          await loadFromGitHub();
        }
      } catch(e) {
        showToast("GitHub source error: " + e.message, 7000, "error");
      }
    }

    // Step 4: Restore tabs / create default canvas
    openTabs = openTabs.filter(id => canvasData[id]);
    if (openTabs.length === 0 && Object.keys(canvasData).length === 0) {
      const id  = generateId();
      canvasData[id] = { name: "Canvas 1", nodes: [], arrows: [] };
      openTabs.push(id);
    } else if (openTabs.length === 0) {
      openTabs = Object.keys(canvasData).slice(0, 3);
    }

    // Restore view setting
    if (settings.viewType) {
      activeViewType = settings.viewType;
      document.querySelectorAll(".view-btn").forEach(b => {
        b.classList.toggle("active", b.dataset.view === activeViewType);
      });
    }

    renderTabs();
    if (activeTabId && openTabs.includes(activeTabId)) switchTab(activeTabId);
    else { activeTabId = openTabs[0]; switchTab(activeTabId); }

    renderTagFilterSection();
    renderSidebarContent();
    updateOnboarding();
    if (!settings.showWelcome) closeWelcomePopup();
    startAutoSaveTimer();

    document.getElementById("loader").classList.add("done");
    setDirty(false);

  } catch(e) {
    console.error(e);
    showLoaderError("Startup error:\n\n" + (e.message || String(e)));
  }
}

function openSettingsModal() {
  document.getElementById('settingsModal').classList.add('open');
  document.getElementById('autoSaveToggle').checked = settings.autoSave;
  document.getElementById('showWelcomeToggle').checked = settings.showWelcome;
  document.getElementById('autoSaveInterval').value = settings.autoSaveInterval;

  const folderPathEl = document.getElementById('defaultFolderPath');
  const openBtn = document.getElementById('openBackupFolderBtn');
  if (isElectronDesktop() || (window && window.electronAPI && window.electronAPI.getDefaultCanvasFolder)) {
    folderPathEl.textContent = window.electronAPI && window.electronAPI.getDefaultCanvasFolder
      ? window.electronAPI.getDefaultCanvasFolder()
      : 'Documents/MuseGarden/Canvases';
    openBtn.style.display = 'block';
    document.getElementById('backupNote').textContent =
      'Your desktop app saves canvas state automatically to this folder in Documents. The file is named musegarden-latest.json.';
  } else {
    folderPathEl.textContent = 'Desktop app only';
    openBtn.style.display = 'none';
    document.getElementById('backupNote').textContent =
      'You are running MuseGarden in a browser. Desktop backup folder access requires the Electron app. Your work is stored in browser localStorage only.';
  }
}

function closeSettingsModal() {
  document.getElementById('settingsModal').classList.remove('open');
}

function saveSettingsUI() {
  settings.autoSave = document.getElementById('autoSaveToggle').checked;
  settings.autoSaveInterval = parseInt(document.getElementById('autoSaveInterval').value, 10) || 30;
  normalizeSettings();
  saveToLS();
  closeSettingsModal();
  showToast('Settings saved', 2500);
}

document.getElementById('openBackupFolderBtn')?.addEventListener('click', async () => {
  if (window && window.electronAPI && window.electronAPI.openDefaultCanvasFolder) {
    const result = await window.electronAPI.openDefaultCanvasFolder();
    if (result) {
      showToast('Could not open folder: ' + result, 5000, 'error');
    }
  } else {
    showToast('Open folder is only available in the Electron desktop app.', 5000, 'error');
  }
});

function closeWelcomePopup() {
  const welcome = document.getElementById('onboarding');
  if (welcome) welcome.style.display = 'none';
}

init();
