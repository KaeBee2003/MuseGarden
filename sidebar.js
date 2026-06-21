// ════════════════════════════════════════════════════════════════════
//  SIDEBAR RENDERING — multi-source file tree
// ════════════════════════════════════════════════════════════════════

function getAllTags() {
  const all = new Set();
  Object.values(songTags).forEach(tags => tags.forEach(t => all.add(t)));
  Object.values(projectTags).forEach(tags => tags.forEach(t => all.add(t)));
  return [...all].sort();
}

let tagFilterOpen = false;

function renderTagFilterSection() {
  const btn = document.getElementById("tagFilterBtn");
  const container = document.getElementById("tagFilterContainer");
  const list = document.getElementById("tagFilterList");
  if (!btn || !container || !list) return;

  const activeCount = filterTags.size;
  if (activeCount > 0) {
    btn.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px;">filter_list</span> Filter by Tag (${activeCount})`;
    btn.classList.add("has-active-filters");
  } else {
    btn.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px;">filter_list</span> Filter by Tag`;
    btn.classList.remove("has-active-filters");
  }

  if (tagFilterOpen) {
    container.classList.add("open");
  } else {
    container.classList.remove("open");
  }

  list.innerHTML = "";
  const allTags = getAllTags();
  if (allTags.length === 0) {
    list.innerHTML = `<div class="tag-filter-empty">No tags created yet.</div>`;
  } else {
    allTags.forEach(tag => {
      const tagBtn = document.createElement("button");
      tagBtn.className = "sb-tag" + (filterTags.has(tag) ? " filter-active" : "");
      tagBtn.textContent = tag;
      tagBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (filterTags.has(tag)) {
          filterTags.delete(tag);
        } else {
          filterTags.add(tag);
        }
        renderTagFilterSection();
        renderSidebarContent();
      });
      list.appendChild(tagBtn);
    });
  }
}

// Bind tag filter panel toggle
document.getElementById("tagFilterBtn").addEventListener("click", (e) => {
  e.stopPropagation();
  tagFilterOpen = !tagFilterOpen;
  renderTagFilterSection();
});

// ════════════════════════════════════════════════════════════════════
//  EXPLORER CONTEXT MENU
// ════════════════════════════════════════════════════════════════════
let explorerCtxFile = null;

function showExplorerCtxMenu(e, file) {
  explorerCtxFile = file;
  const menu = document.getElementById("explorerCtxMenu");
  menu.style.display = "block";
  menu.style.left = Math.min(e.clientX, window.innerWidth - 200) + "px";
  menu.style.top  = Math.min(e.clientY, window.innerHeight - 120) + "px";
}

document.getElementById("explorerCtxMenu").addEventListener("click", e => {
  const item = e.target.closest(".ectx-item");
  if (!item || !explorerCtxFile) return;
  document.getElementById("explorerCtxMenu").style.display = "none";
  const file = explorerCtxFile;
  switch(item.dataset.action) {
    case "tags":  openTagModal(file.path); break;
    case "play":  playFile(file); break;
    case "addToCanvas":
      if (activeTabId) createNode("audio", { filePath: file.path }, activeTabId);
      break;
  }
});

document.addEventListener("click", e => {
  if (!e.target.closest("#explorerCtxMenu")) document.getElementById("explorerCtxMenu").style.display = "none";
});

// ════════════════════════════════════════════════════════════════════
//  FILTER HELPER
// ════════════════════════════════════════════════════════════════════
function songMatchesFilter(file) {
  if (sidebarSearchTerm && !file.name.toLowerCase().includes(sidebarSearchTerm)) return false;
  if (filterTags.size > 0) {
    const tags = getSongTags(file);
    for (const ft of filterTags) if (!tags.includes(ft)) return false;
  }
  return true;
}

// ════════════════════════════════════════════════════════════════════
//  ROW BUILDERS
// ════════════════════════════════════════════════════════════════════
function makeSbSongRow(file) {
  const wrap = document.createElement("div");
  if (!songMatchesFilter(file)) { wrap.style.display = "none"; return wrap; }
  const row = document.createElement("div");
  row.className = "sb-song-row" + (nowPlayingPath === file.path ? " playing" : "");
  row.dataset.path = file.path;
  row.draggable = true;
  row.innerHTML = `<span class="material-symbols-outlined sb-song-icon">audio_file</span><span class="sb-song-name">${escHtml(baseName(file.name))}</span>`;
  row.addEventListener("click", () => playFile(file));
  row.addEventListener("dragstart", e => {
    e.stopPropagation();
    e.dataTransfer.setData("song-path", file.path);
    e.dataTransfer.effectAllowed = "copy";
  });
  row.addEventListener("contextmenu", e => {
    e.preventDefault(); e.stopPropagation();
    showExplorerCtxMenu(e, file);
  });
  wrap.appendChild(row);
  return wrap;
}

function makeSbFolderRow(folder, sourceName) {
  const wrap = document.createElement("div");
  wrap.className = "explorer-folder";

  const row = document.createElement("div");
  row.className = "folder-row";
  row.draggable = true;
  row.addEventListener("dragstart", e => {
    e.stopPropagation();
    e.dataTransfer.setData("folder-sourceId", folder.sourceId);
    e.dataTransfer.setData("folder-path",     folder.path);
    e.dataTransfer.setData("folder-name",     folder.name);
    e.dataTransfer.effectAllowed = "copy";
  });
  row.addEventListener("contextmenu", e => {
    e.preventDefault(); e.stopPropagation();
    openTagModal(folder.sourceId + ":" + folder.path, true, folder.name);
  });

  row.innerHTML = `
    <span class="material-symbols-outlined folder-chevron">chevron_right</span>
    <span class="material-symbols-outlined folder-icon">folder</span>
    <span class="folder-label">${escHtml(folder.name)}</span>
    <span class="folder-count">${folder.count}</span>
  `;
  const children  = document.createElement("div");
  children.className = "folder-children";
  let populated = false;

  row.addEventListener("click", () => {
    const isOpen = row.classList.toggle("open");
    children.classList.toggle("open", isOpen);
    if (isOpen && !populated) {
      populated = true;
      renderSbChildren(folder.sourceId, folder.path, children);
    }
  });

  wrap.appendChild(row);
  wrap.appendChild(children);
  return wrap;
}

function renderSbChildren(sourceId, parentPath, container) {
  container.innerHTML = "";
  const { folders, files } = getChildrenOf(sourceId, parentPath);
  folders.forEach(f => container.appendChild(makeSbFolderRow(f)));
  files.forEach(f   => container.appendChild(makeSbSongRow(f)));
}

// ════════════════════════════════════════════════════════════════════
//  SIDEBAR VIEW RENDERERS
// ════════════════════════════════════════════════════════════════════
function renderRootView(container) {
  container.innerHTML = "";

  if (sources.length === 0) {
    container.innerHTML = `<div class="no-songs">No sources added yet.<br><br>Click <strong>Sources</strong> in the toolbar to add your music folder.</div>`;
    return;
  }

  sources.forEach(src => {
    // Source header
    const hdr = document.createElement("div");
    hdr.className = "source-header";
    const icon = src.type === "github" ? "cloud" : "folder_shared";
    hdr.innerHTML = `<span class="material-symbols-outlined src-hdr-icon">${icon}</span><span class="src-hdr-name">${escHtml(src.name)}</span>`;
    hdr.draggable = true;
    hdr.addEventListener("dragstart", e => {
      e.stopPropagation();
      e.dataTransfer.setData("folder-sourceId", src.id);
      e.dataTransfer.setData("folder-path",     "");
      e.dataTransfer.setData("folder-name",     src.name);
      e.dataTransfer.effectAllowed = "copy";
    });
    hdr.addEventListener("contextmenu", e => {
      e.preventDefault(); e.stopPropagation();
      openTagModal(src.id + ":", true, src.name);
    });
    container.appendChild(hdr);

    if (!src.songs || src.songs.length === 0) {
      const empty = document.createElement("div");
      empty.className = "no-songs";
      empty.style.padding = "6px 16px";
      empty.textContent = "No audio files found.";
      container.appendChild(empty);
      return;
    }

    // Root-level folders + files
    const { folders, files } = getChildrenOf(src.id, "");
    folders.forEach(f => container.appendChild(makeSbFolderRow(f, src.name)));
    files.forEach(f   => container.appendChild(makeSbSongRow(f)));
  });
}

function renderListView(container) {
  container.innerHTML = "";
  const filtered = allSongs.filter(songMatchesFilter);
  if (filtered.length === 0) {
    container.innerHTML = `<div class="no-songs">No songs found</div>`; return;
  }
  filtered.slice().sort((a, b) => a.name.localeCompare(b.name))
    .forEach(f => container.appendChild(makeSbSongRow(f)));
}

function renderSidebarCanvases(container) {
  container.innerHTML = "";
  const ids = Object.keys(canvasData);
  if (ids.length === 0) {
    container.innerHTML = `<div class="no-songs">No canvases yet.<br>Create one with + tab.</div>`; return;
  }
  ids.forEach(id => {
    const cv   = canvasData[id];
    const item = document.createElement("div");
    item.className = "canvas-list-item" + (openTabs.includes(id) ? " active" : "");
    item.innerHTML = `<span class="material-symbols-outlined canvas-list-icon">insert_drive_file</span><span class="canvas-list-name">${escHtml(cv.name)}</span>`;
    item.draggable = true;
    item.addEventListener("dragstart", e => { e.dataTransfer.setData("canvas-id", id); e.dataTransfer.effectAllowed = "copy"; });
    item.addEventListener("click", () => {
      if (openTabs.includes(id)) switchTab(id);
      else { openTabs.push(id); renderTabs(); switchTab(id); }
    });
    container.appendChild(item);
  });
}

function renderSidebarContent() {
  const container = document.getElementById("sidebarContent");
  container.className = "";
  if (activeSidebarTab === "canvases") {
    renderSidebarCanvases(container);
    document.getElementById("viewControls").style.display = "none";
    return;
  }
  document.getElementById("viewControls").style.display = "flex";
  if (activeViewType === "list") renderListView(container);
  else renderRootView(container);
}

// ── Search ────────────────────────────────────────────────────────
document.getElementById("sidebarSearchInput").addEventListener("input", function() {
  sidebarSearchTerm = this.value.toLowerCase().trim();
  renderSidebarContent();
});

// ── Sidebar tabs ──────────────────────────────────────────────────
document.querySelectorAll(".sidebar-tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".sidebar-tab-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    activeSidebarTab = btn.dataset.tab;
    renderSidebarContent();
  });
});

// ── View buttons ──────────────────────────────────────────────────
document.querySelectorAll(".view-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".view-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    activeViewType = btn.dataset.view;
    settings.viewType = activeViewType;
    setDirty(true);
    renderSidebarContent();
  });
});

// ── Sidebar resize ────────────────────────────────────────────────
(function() {
  const resizer = document.getElementById("sidebarResizer");
  const sidebar = document.getElementById("sidebar");
  let startX, startW;
  resizer.addEventListener("mousedown", e => {
    startX = e.clientX; startW = sidebar.offsetWidth;
    document.body.style.cursor    = "col-resize";
    document.body.style.userSelect = "none";
    const onMove = e2 => {
      const newW = Math.max(180, Math.min(480, startW + e2.clientX - startX));
      sidebar.style.width = newW + "px";
      document.documentElement.style.setProperty("--sidebar-w", newW + "px");
    };
    const onUp = () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  });
})();

// ── Hamburger ─────────────────────────────────────────────────────
document.getElementById("hamburger").addEventListener("click", () => {
  document.getElementById("sidebar").classList.toggle("collapsed");
});

// ════════════════════════════════════════════════════════════════════
//  TAG MODAL
// ════════════════════════════════════════════════════════════════════
function openTagModal(filePath, isFolder = false, folderName = "") {
  tagModalFilePath = filePath;
  tagModalIsFolder = isFolder;
  const nameEl = document.getElementById("tagModalSongName");
  if (isFolder) {
    nameEl.textContent = folderName || filePath || "Project / Folder";
  } else if (filePath) {
    const file = allSongs.find(s => s.path === filePath);
    nameEl.textContent = file ? baseName(file.name) : baseName(filePath);
  } else {
    nameEl.textContent = "Global tag pool";
  }
  renderTagModalList();
  document.getElementById("tagModal").classList.add("open");
  document.getElementById("tagNameInput").value = "";
  document.getElementById("tagNameInput").focus();
}

function renderTagModalList() {
  const list = document.getElementById("tagsModalList");
  list.innerHTML = "";
  let tags = [];
  if (tagModalFilePath) {
    if (tagModalIsFolder) {
      tags = projectTags[tagModalFilePath] || [];
    } else {
      tags = songTags[tagModalFilePath] || [];
    }
  } else {
    tags = getAllTags();
  }
  tags.forEach(tag => {
    const row = document.createElement("div");
    row.className = "tag-manage-row";
    row.innerHTML = `<span class="tag-badge">${escHtml(tag)}</span>`;
    const rmBtn = document.createElement("button");
    rmBtn.className = "tag-remove"; rmBtn.textContent = "×";
    rmBtn.addEventListener("click", () => {
      if (tagModalFilePath) {
        if (tagModalIsFolder) {
          projectTags[tagModalFilePath] = (projectTags[tagModalFilePath] || []).filter(t => t !== tag);
        } else {
          songTags[tagModalFilePath] = (songTags[tagModalFilePath] || []).filter(t => t !== tag);
        }
      } else {
        Object.keys(songTags).forEach(p => { songTags[p] = songTags[p].filter(t => t !== tag); });
        Object.keys(projectTags).forEach(p => { projectTags[p] = projectTags[p].filter(t => t !== tag); });
      }
      setDirty(true);
      renderTagModalList(); renderTagFilterSection(); renderSidebarContent();
      if (window.refreshCanvasNodes) window.refreshCanvasNodes();
      if (window.updateBottomBarTags) window.updateBottomBarTags();
    });
    row.appendChild(rmBtn);
    list.appendChild(row);
  });

  // Global tags pool (available tags not yet applied to this song/folder)
  const poolContainer = document.getElementById("tagModalGlobalPool");
  if (poolContainer) {
    poolContainer.innerHTML = "";
    const allTags = getAllTags();
    const availableTags = allTags.filter(t => !tags.includes(t));
    if (availableTags.length > 0 && tagModalFilePath) {
      const title = document.createElement("div");
      title.style.fontSize = "11px";
      title.style.color = "var(--text-muted)";
      title.style.marginBottom = "8px";
      title.textContent = "Quick-add existing tags:";
      poolContainer.appendChild(title);

      const badgesWrap = document.createElement("div");
      badgesWrap.style.display = "flex";
      badgesWrap.style.flexWrap = "wrap";
      badgesWrap.style.gap = "6px";

      availableTags.forEach(tag => {
        const btn = document.createElement("button");
        btn.className = "sb-tag";
        btn.style.fontSize = "10px";
        btn.style.padding = "4px 10px";
        btn.textContent = tag;
        btn.addEventListener("click", () => {
          if (tagModalIsFolder) {
            if (!projectTags[tagModalFilePath]) projectTags[tagModalFilePath] = [];
            if (!projectTags[tagModalFilePath].includes(tag)) projectTags[tagModalFilePath].push(tag);
          } else {
            if (!songTags[tagModalFilePath]) songTags[tagModalFilePath] = [];
            if (!songTags[tagModalFilePath].includes(tag)) songTags[tagModalFilePath].push(tag);
          }
          setDirty(true);
          renderTagModalList(); renderTagFilterSection(); renderSidebarContent();
          if (window.refreshCanvasNodes) window.refreshCanvasNodes();
          if (window.updateBottomBarTags) window.updateBottomBarTags();
        });
        badgesWrap.appendChild(btn);
      });
      poolContainer.appendChild(badgesWrap);
    }
  }
}

document.getElementById("addTagBtn").addEventListener("click", () => {
  const val = document.getElementById("tagNameInput").value.trim();
  if (!val) return;
  if (tagModalFilePath) {
    if (tagModalIsFolder) {
      if (!projectTags[tagModalFilePath]) projectTags[tagModalFilePath] = [];
      if (!projectTags[tagModalFilePath].includes(val)) projectTags[tagModalFilePath].push(val);
    } else {
      if (!songTags[tagModalFilePath]) songTags[tagModalFilePath] = [];
      if (!songTags[tagModalFilePath].includes(val)) songTags[tagModalFilePath].push(val);
    }
  }
  document.getElementById("tagNameInput").value = "";
  setDirty(true);
  renderTagModalList(); renderTagFilterSection(); renderSidebarContent();
  if (window.refreshCanvasNodes) window.refreshCanvasNodes();
});

document.getElementById("tagNameInput").addEventListener("keydown", e => {
  if (e.key === "Enter") document.getElementById("addTagBtn").click();
});

document.getElementById("tagDoneBtn").addEventListener("click", () => {
  document.getElementById("tagModal").classList.remove("open");
  saveToLS();
  if (window.refreshCanvasNodes) window.refreshCanvasNodes();
});
