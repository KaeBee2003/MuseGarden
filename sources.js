// ════════════════════════════════════════════════════════════════════
//  SOURCES — manage multiple audio file sources (local + GitHub)
// ════════════════════════════════════════════════════════════════════

// ── Audio file helpers ────────────────────────────────────────────
function isAudio(name) {
  return /\.(mp3|wav|flac|m4a|ogg|aac|opus|wma|aiff|aif)$/i.test(name);
}
function baseName(name) { return name.replace(/\.[^.]+$/, ""); }
function getExt(name)   { return (name.split(".").pop() || "").toUpperCase(); }
function getCommitDate(node) {
  return node.sha ? parseInt(node.sha.substring(0, 8), 16) : 0;
}

// ── Toast notification ────────────────────────────────────────────
function showToast(msg, ms = 3000, type = "") {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const t = document.createElement("div");
  t.className = "toast" + (type ? " toast-" + type : "");
  t.textContent = msg;
  container.appendChild(t);
  requestAnimationFrame(() => t.classList.add("show"));
  setTimeout(() => {
    t.classList.remove("show");
    setTimeout(() => t.remove(), 400);
  }, ms);
}

// ── Loader message ────────────────────────────────────────────────
function setLoaderMsg(msg) {
  const p = document.getElementById("loaderMsg");
  if (p) p.textContent = msg;
}

// ── Network helper ────────────────────────────────────────────────
function fetchWithTimeout(url, ms = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(t));
}

// ════════════════════════════════════════════════════════════════════
//  IndexedDB — persist FileSystem handles across sessions
// ════════════════════════════════════════════════════════════════════
let _idb = null;

async function getIDB() {
  if (_idb) return _idb;
  return new Promise((res, rej) => {
    const r = indexedDB.open("MuseGardenHandles", 1);
    r.onupgradeneeded = e =>
      e.target.result.createObjectStore("handles", { keyPath: "id" });
    r.onsuccess = e => { _idb = e.target.result; res(_idb); };
    r.onerror   = () => rej(r.error);
  });
}

async function idbPut(id, handle) {
  const db = await getIDB();
  return new Promise((res, rej) => {
    const tx = db.transaction("handles", "readwrite");
    tx.objectStore("handles").put({ id, handle });
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
}

async function idbGet(id) {
  const db = await getIDB();
  return new Promise((res, rej) => {
    const tx = db.transaction("handles", "readonly");
    const r  = tx.objectStore("handles").get(id);
    r.onsuccess = () => res(r.result?.handle || null);
    r.onerror   = () => rej(r.error);
  });
}

async function idbDelete(id) {
  const db = await getIDB();
  return new Promise(res => {
    const tx = db.transaction("handles", "readwrite");
    tx.objectStore("handles").delete(id);
    tx.oncomplete = res;
  });
}

// ════════════════════════════════════════════════════════════════════
//  Sources metadata (saved in localStorage, handles in IndexedDB)
// ════════════════════════════════════════════════════════════════════
const SOURCES_META_KEY = "musegarden_sources";

function saveSourcesMeta() {
  localStorage.setItem(SOURCES_META_KEY, JSON.stringify(
    sources.map(s => ({
      id: s.id, type: s.type, name: s.name,
      path: s.path,
      owner: s.owner, repo: s.repo, worker: s.worker
    }))
  ));
}

function loadSourcesMeta() {
  try {
    const raw = localStorage.getItem(SOURCES_META_KEY);
    sources = raw ? JSON.parse(raw) : [];
  } catch(e) { sources = []; }
}

// ════════════════════════════════════════════════════════════════════
//  Local folder scanning
// ════════════════════════════════════════════════════════════════════
async function scanDirHandle(dirHandle, sourceName, sourceId, parentPath = "") {
  const songs = [];
  try {
    for await (const [name, handle] of dirHandle) {
      const localPath = parentPath ? parentPath + "/" + name : name;
      if (handle.kind === "file" && isAudio(name)) {
        songs.push({
          id:         sourceId + ":" + localPath,
          name,
          path:       sourceId + ":" + localPath,
          localPath,
          parentPath,
          source:     "local",
          sourceId,
          sourceName,
          fileHandle: handle,
          type:       "blob",
          date:       0
        });
      } else if (handle.kind === "directory") {
        const sub = await scanDirHandle(handle, sourceName, sourceId, localPath);
        songs.push(...sub);
      }
    }
  } catch(e) { console.warn("scanDir error:", e); }
  return songs;
}

async function scanLocalSource(src) {
  if (window.electronAPI) {
    if (!src.path) {
      src.needsReconnect = true;
      return;
    }
    setLoaderMsg("Scanning " + src.name + "…");
    try {
      const files = await window.electronAPI.scanFolder(src.path);
      const songs = files.map(f => ({
        id:         src.id + ":" + f.relativePath,
        name:       f.name,
        path:       src.id + ":" + f.relativePath,
        localPath:  f.relativePath,
        parentPath: f.relativePath.includes("/") ? f.relativePath.slice(0, f.relativePath.lastIndexOf("/")) : "",
        source:     "local",
        sourceId:   src.id,
        sourceName: src.name,
        absolutePath: f.absolutePath,
        type:       "blob",
        date:       0
      }));
      src.songs = songs;
      songs.forEach(s => {
        if (!allSongs.find(x => x.path === s.path)) allSongs.push(s);
        repoTree[s.path] = s;
      });
      delete src.needsReconnect;
      console.log("✓ Local source \"" + src.name + "\":", songs.length, "files");
    } catch(e) {
      src.needsReconnect = true;
      console.warn("Native folder scan error:", e);
      throw e;
    }
  } else {
    const handle = src.dirHandle || (await idbGet(src.id));
    if (!handle) {
      src.needsReconnect = true;
      return;
    }
    src.dirHandle = handle;
    setLoaderMsg("Scanning " + src.name + "…");
    try {
      const songs = await scanDirHandle(handle, src.name, src.id);
      src.songs = songs;
      songs.forEach(s => {
        if (!allSongs.find(x => x.path === s.path)) allSongs.push(s);
        repoTree[s.path] = s;
      });
      delete src.needsReconnect;
      console.log("✓ Local source \"" + src.name + "\":", songs.length, "files");
    } catch(e) {
      src.needsReconnect = true;
      console.warn("Browser folder scan error:", e);
      throw e;
    }
  }
}

// ── Add local folder ──────────────────────────────────────────────
async function addLocalSource(dirHandle) {
  const id   = "local_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const name = dirHandle.name;
  const src  = { id, type: "local", name, dirHandle };
  sources.push(src);
  await idbPut(id, dirHandle);
  saveSourcesMeta();
  await scanLocalSource(src);
  return src;
}

async function reconnectLocalSource(id) {
  try {
    const src = sources.find(s => s.id === id);
    if (!src) return;

    if (window.electronAPI) {
      const folderPath = await window.electronAPI.selectFolder();
      if (!folderPath) return; // cancelled
      src.path = folderPath;
      src.name = folderPath.split(/[/\\]/).pop() || folderPath;
      delete src.needsReconnect;
      await scanLocalSource(src);
      saveSourcesMeta();
      renderSourcesList();
      renderSidebarContent();
      showToast(`Reconnected ${src.name}`, 3000);
    } else {
      if (!window.showDirectoryPicker) {
        showToast("Folder reconnect not supported in this browser.", 5000, "error");
        return;
      }
      const handle = await window.showDirectoryPicker({ mode: "read" });
      src.dirHandle = handle;
      src.name = handle.name;
      await idbPut(id, handle);
      delete src.needsReconnect;
      await scanLocalSource(src);
      saveSourcesMeta();
      renderSourcesList();
      renderSidebarContent();
      showToast(`Reconnected ${src.name}`, 3000);
    }
  } catch(e) {
    if (e.name !== "AbortError") showToast("Reconnect failed: " + e.message, 5000, "error");
  }
}

// ── Remove a source ───────────────────────────────────────────────
async function removeSource(id) {
  const src = sources.find(s => s.id === id);
  if (!src) return;
  sources    = sources.filter(s => s.id !== id);
  allSongs   = allSongs.filter(s => s.sourceId !== id);
  Object.keys(repoTree).forEach(k => {
    if (repoTree[k].sourceId === id) delete repoTree[k];
  });
  await idbDelete(id);
  saveSourcesMeta();
  if (!sources.find(s => s.type === "github")) disableGithubSync();
}

// ════════════════════════════════════════════════════════════════════
//  GitHub source scanning
// ════════════════════════════════════════════════════════════════════
async function scanGithubSource(src) {
  setLoaderMsg("Connecting to GitHub (" + src.name + ")…");
  let repoInfo;
  try {
    const res = await fetchWithTimeout(`${src.worker}/api/repos/${src.owner}/${src.repo}`);
    repoInfo  = await res.json();
  } catch(e) { throw new Error("GitHub connect failed: " + e.message); }
  if (repoInfo.message) throw new Error("GitHub: " + repoInfo.message);
  src.branch = repoInfo.default_branch || "main";

  setLoaderMsg("Fetching file tree…");
  const res2 = await fetchWithTimeout(
    `${src.worker}/api/repos/${src.owner}/${src.repo}/git/trees/${src.branch}?recursive=1`, 25000
  );
  const treeData = await res2.json();
  if (!treeData.tree) throw new Error("Empty tree from GitHub.");

  const songs = [];
  for (const node of treeData.tree) {
    const name = node.path.split("/").pop();
    if (node.type === "blob" && isAudio(name)) {
      const parentPath   = node.path.includes("/") ? node.path.slice(0, node.path.lastIndexOf("/")) : "";
      const download_url = `${src.worker}/raw/${src.owner}/${src.repo}/${src.branch}/${node.path}`;
      const song = {
        id:           src.id + ":" + node.path,
        name,
        path:         src.id + ":" + node.path,
        localPath:    node.path,
        parentPath,
        source:       "github",
        sourceId:     src.id,
        sourceName:   src.name,
        download_url,
        sha:          node.sha,
        type:         "blob",
        date:         getCommitDate(node)
      };
      songs.push(song);
      if (!allSongs.find(x => x.path === song.path)) allSongs.push(song);
      repoTree[song.path] = song;
    }
  }
  src.songs = songs;
  console.log("✓ GitHub source \"" + src.name + "\":", songs.length, "files");
}

async function addGithubSource(owner, repo, worker) {
  const id  = "github_" + Date.now().toString(36);
  const src = { id, type: "github", name: owner + "/" + repo, owner, repo, worker, branch: "main" };
  sources.push(src);
  saveSourcesMeta();
  await scanGithubSource(src);
  enableGithubSync();
  return src;
}

// ════════════════════════════════════════════════════════════════════
//  Startup restore
// ════════════════════════════════════════════════════════════════════
async function restoreLocalSources() {
  const locals = sources.filter(s => s.type === "local");
  for (const src of locals) {
    try {
      if (window.electronAPI) {
        if (!src.path) {
          src.needsReconnect = true;
          continue;
        }
        await scanLocalSource(src);
      } else {
        const handle = await idbGet(src.id);
        if (!handle) {
          src.needsReconnect = true;
          continue;
        }

        let perm = "granted";
        if (typeof handle.queryPermission === "function") {
          perm = await handle.queryPermission({ mode: "read" });
        }

        if (perm === "prompt" && typeof handle.requestPermission === "function") {
          perm = await handle.requestPermission({ mode: "read" });
        }

        if (perm !== "granted") {
          console.warn("Permission denied for source:", src.name, perm);
          src.needsReconnect = true;
          continue;
        }

        src.dirHandle = handle;
        delete src.needsReconnect;
        await scanLocalSource(src);
      }
    } catch(e) {
      src.needsReconnect = true;
      console.warn("Could not restore source:", src.name, e);
    }
  }
}

async function restoreGithubSources() {
  const ghs = sources.filter(s => s.type === "github");
  for (const src of ghs) {
    try {
      await scanGithubSource(src);
      enableGithubSync();
    } catch(e) { console.warn("Could not restore GitHub source:", src.name, e); }
  }
}

// ════════════════════════════════════════════════════════════════════
//  File resolution (local handle → object URL, github → download_url)
// ════════════════════════════════════════════════════════════════════
const _objectUrlCache = {};   // path → url (kept for session)

async function resolveFileUrl(file) {
  if (!file) return null;
  if (_objectUrlCache[file.path]) return _objectUrlCache[file.path];
  if (file.source === "github" && file.download_url) return file.download_url;
  if (file.source === "local") {
    if (window.electronAPI && file.absolutePath) {
      try {
        const buffer = await window.electronAPI.readLocalFile(file.absolutePath);
        const blob = new Blob([buffer]);
        const url = URL.createObjectURL(blob);
        _objectUrlCache[file.path] = url;
        return url;
      } catch(e) {
        console.error("Cannot read local file natively:", file.name, e);
        return null;
      }
    } else if (file.fileHandle) {
      try {
        const f   = await file.fileHandle.getFile();
        const url = URL.createObjectURL(f);
        _objectUrlCache[file.path] = url;
        return url;
      } catch(e) {
        console.error("Cannot read local file:", file.name, e);
        return null;
      }
    }
  }
  return null;
}

// ════════════════════════════════════════════════════════════════════
//  Folder helpers (for sidebar + project node)
// ════════════════════════════════════════════════════════════════════
function getSongsInFolder(sourceId, folderPath) {
  const src = sources.find(s => s.id === sourceId);
  if (!src?.songs) return [];
  if (!folderPath) return src.songs;
  const prefix = folderPath + "/";
  return src.songs.filter(s => s.localPath.startsWith(prefix) || s.localPath === folderPath);
}

// Get immediate children (sub-folders + direct audio files)
function getChildrenOf(sourceId, parentPath) {
  const src = sources.find(s => s.id === sourceId);
  if (!src?.songs) return { folders: [], files: [] };
  const prefix  = parentPath ? parentPath + "/" : "";
  const seen    = new Set();
  const folders = [], files = [];
  for (const song of src.songs) {
    if (!song.localPath.startsWith(prefix)) continue;
    const rest  = song.localPath.slice(prefix.length);
    const slash = rest.indexOf("/");
    if (slash === -1) {
      files.push(song);
    } else {
      const folderName = rest.slice(0, slash);
      const folderPath = prefix + folderName;
      if (!seen.has(folderPath)) {
        seen.add(folderPath);
        const count = src.songs.filter(s => s.localPath.startsWith(folderPath + "/")).length;
        folders.push({ name: folderName, path: folderPath, sourceId, count, type: "tree" });
      }
    }
  }
  folders.sort((a, b) => a.name.localeCompare(b.name));
  files.sort((a, b) => a.name.localeCompare(b.name));
  return { folders, files };
}

// ════════════════════════════════════════════════════════════════════
//  Sources modal UI
// ════════════════════════════════════════════════════════════════════
function openSourcesModal() {
  renderSourcesList();
  document.getElementById("sourcesModal").classList.add("open");
}
function closeSourcesModal() {
  document.getElementById("sourcesModal").classList.remove("open");
}

function getMissingSources() {
  const missing = {};
  if (typeof canvasData !== "object" || !canvasData) return [];
  Object.entries(canvasData).forEach(([cid, cv]) => {
    if (!cv || !cv.nodes) return;
    cv.nodes.forEach(n => {
      if (n.type === "project" && n.projectSourceId) {
        const exists = sources.some(s => s.id === n.projectSourceId);
        if (!exists) {
          if (!missing[n.projectSourceId]) {
            let name = "Unknown Folder";
            if (n.projectFolderPath) {
              name = n.projectFolderPath.split("/").pop();
            }
            missing[n.projectSourceId] = {
              id: n.projectSourceId,
              name: name,
              count: 0
            };
          }
          missing[n.projectSourceId].count++;
        }
      }
    });
  });
  return Object.values(missing);
}

function renderSourcesList() {
  const list = document.getElementById("sourcesList");
  if (!list) return;
  list.innerHTML = "";
  if (sources.length === 0) {
    list.innerHTML = `<div class="sources-empty">No sources yet — add a folder or GitHub repo below.</div>`;
  } else {
    sources.forEach(src => {
      const row = document.createElement("div");
      row.className = "source-row";
      const icon  = src.type === "github" ? "cloud" : "folder_shared";
      const count = src.songs ? src.songs.length : "?";
      const badge = src.type === "github" ? "GitHub" : "Local folder";
      const reconnectButton = src.type === "local" && src.needsReconnect
        ? `<button class="modal-btn small source-reconnect-btn">Reconnect</button>`
        : "";

      const fileCount = src.type === "local" && src.needsReconnect
        ? "Needs reconnect"
        : `${count} audio files`;

      row.innerHTML = `
        <span class="material-symbols-outlined source-icon">${icon}</span>
        <div class="source-info">
          <div class="source-name">${escHtml(src.name)}</div>
          <div class="source-meta">${badge} · ${fileCount}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          ${reconnectButton}
          <button class="source-remove btn-icon" title="Remove source"><span class="material-symbols-outlined">delete</span></button>
        </div>
      `;
      if (src.type === "local" && src.needsReconnect) {
        row.querySelector(".source-reconnect-btn").addEventListener("click", async () => {
          await reconnectLocalSource(src.id);
        });
      }
      row.querySelector(".source-remove").addEventListener("click", async () => {
        await removeSource(src.id);
        renderSourcesList();
        updateOnboarding();
        if (typeof renderSidebarContent === "function") renderSidebarContent();
        showToast("Source removed", 2500);
      });
      list.appendChild(row);
    });
  }

  // Handle missing sources
  const container = document.getElementById("missingSourcesContainer");
  const missingList = document.getElementById("missingSourcesList");
  if (container && missingList) {
    const missing = getMissingSources();
    if (missing.length === 0) {
      container.style.display = "none";
      missingList.innerHTML = "";
    } else {
      container.style.display = "block";
      missingList.innerHTML = "";
      missing.forEach(ms => {
        const row = document.createElement("div");
        row.className = "source-row missing-source-row";
        row.style.cssText = "padding: 8px 0; border-bottom: 1px dashed var(--border); align-items: center; display: flex; gap: 12px;";
        row.innerHTML = `
          <span class="material-symbols-outlined source-icon" style="color:var(--accent3); font-size:20px;">folder_off</span>
          <div class="source-info" style="flex:1; min-width:0;">
            <div class="source-name" style="color:var(--accent3); font-weight:600; font-size:13px;">${escHtml(ms.name)} (Missing)</div>
            <div class="source-meta" style="color:var(--muted); font-size:10px;">Referenced by ${ms.count} node${ms.count !== 1 ? "s" : ""}</div>
          </div>
          <button class="modal-btn primary relocate-missing-btn" style="margin:0; font-size:11px; padding:4px 10px; border-radius:9999px;">Relocate</button>
        `;
        row.querySelector(".relocate-missing-btn").addEventListener("click", () => {
          closeSourcesModal();
          fixAllBrokenSourceNodes(ms.id);
        });
        missingList.appendChild(row);
      });
    }
  }
}

function updateOnboarding() {
  const ob = document.getElementById("onboarding");
  if (!ob) return;
  if (!settings.showWelcome) {
    ob.style.display = "none";
    return;
  }
  ob.style.display = (allSongs.length === 0) ? "" : "none";
}

// ── Add local folder button ───────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("addLocalFolderBtn")?.addEventListener("click", async () => {
    if (window.electronAPI) {
      try {
        const folderPath = await window.electronAPI.selectFolder();
        if (!folderPath) return; // user cancelled
        const name = folderPath.split(/[/\\]/).pop() || folderPath;
        const id   = "local_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
        const src  = { id, type: "local", name, path: folderPath };
        sources.push(src);
        saveSourcesMeta();
        await scanLocalSource(src);
        renderSourcesList();
        updateOnboarding();
        if (typeof renderSidebarContent === "function") renderSidebarContent();
        showToast(`Added "${src.name}" — ${src.songs.length} files`, 4000);
      } catch(e) {
        showToast("Error: " + e.message, 5000, "error");
      }
      return;
    }

    if (!window.showDirectoryPicker) {
      showToast("File picker not supported — use Chrome or Edge", 6000, "error");
      return;
    }
    try {
      const handle = await window.showDirectoryPicker({ mode: "read" });
      const src    = await addLocalSource(handle);
      renderSourcesList();
      updateOnboarding();
      if (typeof renderSidebarContent === "function") renderSidebarContent();
      showToast(`Added "${src.name}" — ${src.songs.length} files`, 4000);
    } catch(e) {
      if (e.name !== "AbortError") showToast("Error: " + e.message, 5000, "error");
    }
  });

  // ── GitHub source form ────────────────────────────────────────
  document.getElementById("addGithubToggleBtn")?.addEventListener("click", () => {
    const form = document.getElementById("githubSourceForm");
    if (form) form.classList.toggle("open");
  });

  document.getElementById("githubSourceConfirmBtn")?.addEventListener("click", async () => {
    const owner  = document.getElementById("ghOwnerInput")?.value.trim();
    const repo   = document.getElementById("ghRepoInput")?.value.trim();
    const worker = document.getElementById("ghWorkerInput")?.value.trim() || WORKER;
    if (!owner || !repo) { showToast("Enter GitHub owner and repo name", 3000, "error"); return; }
    try {
      document.getElementById("ghConnectStatus").textContent = "Connecting…";
      const src = await addGithubSource(owner, repo, worker);
      document.getElementById("githubSourceForm").classList.remove("open");
      document.getElementById("ghConnectStatus").textContent = "";
      renderSourcesList();
      updateOnboarding();
      if (typeof renderSidebarContent === "function") renderSidebarContent();
      showToast(`Connected to ${src.name} — ${src.songs.length} files`, 4000);
    } catch(e) {
      document.getElementById("ghConnectStatus").textContent = "Error: " + e.message;
      showToast("GitHub error: " + e.message, 6000, "error");
    }
  });

  // Sources modal close button
  document.getElementById("closeSources")?.addEventListener("click", closeSourcesModal);
  document.getElementById("exportDataBtn")?.addEventListener("click", () => { closeSourcesModal(); exportToFile(); });
  document.getElementById("importDataBtn")?.addEventListener("click", () => { closeSourcesModal(); importFromFile(); });
});

// ════════════════════════════════════════════════════════════════════
//  Fix All Broken Source Nodes  (batch remap from one source picker)
// ════════════════════════════════════════════════════════════════════
function fixAllBrokenSourceNodes(oldSourceId) {
  const broken = [];
  Object.entries(canvasData).forEach(([cid, cv]) => {
    cv.nodes.forEach(n => {
      if (n.type === "project" && n.projectSourceId === oldSourceId) {
        broken.push({ node: n, canvasId: cid });
      }
    });
  });

  if (broken.length === 0) {
    showToast("No nodes reference this missing source.", 3000);
    return;
  }

  if (sources.length === 0) {
    showToast("No sources found. Re-add your folder in Sources first, then click Fix All again.", 5000, "error");
    openSourcesModal();
    return;
  }

  const modal = document.getElementById("relocateModal");
  document.querySelector("#relocateModal h3").innerHTML =
    '<span class="material-symbols-outlined">folder_shared</span> Fix All — Pick Replacement Source';
  document.getElementById("relocateSearch").disabled = true;
  document.getElementById("relocateSearch").placeholder = "Choose replacement source";
  document.getElementById("relocateSearch").value = "";

  const list = document.getElementById("relocateList");
  list.innerHTML = "";

  const info = document.createElement("div");
  info.style.cssText = "padding:10px 14px 8px;font-size:11px;color:var(--muted);line-height:1.6;border-bottom:1px solid var(--border);margin-bottom:4px;";
  info.innerHTML = "Remapping <strong style='color:var(--accent)'>" + broken.length + " project node" + (broken.length !== 1 ? "s" : "") + "</strong> across all canvases. Pick the replacement source:";
  list.appendChild(info);

  let pickedSourceId = null;

  sources.forEach(src => {
    const item = document.createElement("div");
    item.className = "relocate-item";
    const icon = src.type === "github" ? "cloud" : "folder_shared";
    const count = src.songs ? src.songs.length : "?";
    item.innerHTML = "<span class='material-symbols-outlined' style='font-size:18px;'>" + icon + "</span><span style='flex:1'>" + escHtml(src.name) + "</span><span style='font-size:10px;color:var(--muted)'>" + count + " files</span>";
    item.addEventListener("click", () => {
      list.querySelectorAll(".relocate-item").forEach(i => i.classList.remove("selected"));
      item.classList.add("selected");
      pickedSourceId = src.id;
    });
    list.appendChild(item);
  });

  modal.classList.add("open");

  document.getElementById("relocateConfirmBtn").onclick = () => {
    if (!pickedSourceId) { showToast("Select a source first.", 2500, "error"); return; }
    modal.classList.remove("open");
    document.getElementById("relocateSearch").disabled = false;
    document.getElementById("relocateSearch").placeholder = "Search songs...";
    broken.forEach(({ node }) => { node.projectSourceId = pickedSourceId; });
    const affected = [...new Set(broken.map(b => b.canvasId))];
    affected.forEach(cid => {
      const oldPage = document.getElementById("cv-" + cid);
      if (oldPage) oldPage.remove();
      if (cid === activeTabId) switchTab(cid);
    });
    setDirty(true);
    saveToLS();
    const srcName = sources.find(s => s.id === pickedSourceId)?.name || pickedSourceId;
    showToast("Fixed " + broken.length + " node" + (broken.length !== 1 ? "s" : "") + " -> \"" + srcName + "\"", 4000);
  };

  document.getElementById("relocateCancelBtn").onclick = () => {
    modal.classList.remove("open");
    document.getElementById("relocateSearch").disabled = false;
    document.getElementById("relocateSearch").placeholder = "Search songs...";
  };
}
