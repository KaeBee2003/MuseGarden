// ════════════════════════════════════════════════════════════════════
//  CANVAS TABS
// ════════════════════════════════════════════════════════════════════

let _tabAddWired = false;
let editingArrowNoteId = null;

function renderTabs() {
  const container = document.getElementById("canvasTabs");
  // Only remove tab elements — preserve #tabAddWrap which lives inside #canvasTabs
  container.querySelectorAll(".canvas-tab").forEach(t => t.remove());

  const addWrap = document.getElementById("tabAddWrap");
  openTabs.forEach(id => {
    const cv = canvasData[id];
    if (!cv) return;
    const tab = document.createElement("div");
    tab.className = "canvas-tab" + (id === activeTabId ? " active" : "");
    tab.dataset.id = id;
    tab.innerHTML = `<span style="flex:1">${cv.name}</span>`;
    const closeBtn = document.createElement("button");
    closeBtn.className = "tab-close"; closeBtn.textContent = "\u00d7";
    closeBtn.title = "Close tab";
    closeBtn.addEventListener("click", e => { e.stopPropagation(); closeTab(id); });
    tab.appendChild(closeBtn);
    tab.addEventListener("click", () => switchTab(id));
    // Insert before the + wrap so tabs always appear left of it
    container.insertBefore(tab, addWrap);
  });

  // Update back button visibility
  updateBackButtonVisibility();

  // Wire + tab button listeners only once
  if (!_tabAddWired) {
    _tabAddWired = true;
    const addBtn = document.getElementById("tabAddBtn");
    if (addBtn) {
      addBtn.addEventListener("click", e => {
        e.stopPropagation();
        openAddCanvasModal();
      });
    }
    
    const backBtn = document.getElementById("canvasBackBtn");
    if (backBtn) {
      backBtn.addEventListener("click", e => {
        e.stopPropagation();
        goBackFromCanvasNode();
      });
    }
  }
}

function updateBackButtonVisibility() {
  const backBtn = document.getElementById("canvasBackBtn");
  if (backBtn) {
    backBtn.style.display = canvasNavHistory.length > 0 ? "flex" : "none";
  }
}

function openExistingCanvasPicker() {
  // Open the canvas picker modal populated with all canvases not yet in open tabs
  const modal = document.getElementById("relocateModal");
  document.querySelector("#relocateModal h3").innerHTML = '<span class="material-symbols-outlined">insert_drive_file</span> Open Canvas';
  document.getElementById("relocateSearch").value = "";
  document.getElementById("relocateSearch").disabled = false;
  document.getElementById("relocateSearch").placeholder = "Search canvases…";
  const list = document.getElementById("relocateList");
  list.innerHTML = "";
  let selectedCanvasId = null;

  const allIds = Object.keys(canvasData);
  if (allIds.length === 0) {
    list.innerHTML = `<div style="padding:12px;font-size:12px;color:var(--muted);text-align:center;">No canvases yet.</div>`;
  } else {
    allIds.forEach(id => {
      const cv = canvasData[id];
      const item = document.createElement("div");
      item.className = "relocate-item" + (openTabs.includes(id) ? " selected" : "");
      item.innerHTML = `<span class="material-symbols-outlined" style="font-size:18px;">insert_drive_file</span><span style="flex:1">${escHtml(cv.name)}</span><span style="font-size:10px;color:var(--muted)">${cv.nodes.length} nodes${openTabs.includes(id) ? " · open" : ""}</span>`;
      item.addEventListener("click", () => {
        list.querySelectorAll(".relocate-item").forEach(i => i.classList.remove("selected"));
        item.classList.add("selected");
        selectedCanvasId = id;
      });
      list.appendChild(item);
    });
  }

  // Search filter
  document.getElementById("relocateSearch").oninput = function() {
    const term = this.value.toLowerCase();
    list.querySelectorAll(".relocate-item").forEach(item => {
      const name = item.querySelector("span:nth-child(2)")?.textContent?.toLowerCase() || "";
      item.style.display = name.includes(term) ? "" : "none";
    });
  };

  modal.classList.add("open");
  document.getElementById("relocateConfirmBtn").onclick = () => {
    modal.classList.remove("open");
    document.getElementById("relocateSearch").oninput = null;
    if (!selectedCanvasId) return;
    if (!openTabs.includes(selectedCanvasId)) openTabs.push(selectedCanvasId);
    renderTabs();
    switchTab(selectedCanvasId);
    setDirty(true);
  };
  document.getElementById("relocateCancelBtn").onclick = () => {
    modal.classList.remove("open");
    document.getElementById("relocateSearch").oninput = null;
    document.getElementById("relocateSearch").disabled = false;
    document.getElementById("relocateSearch").placeholder = "Search songs…";
  };
}


function switchTab(id) {
  if (!canvasData[id]) return;
  // Deactivate all canvas pages
  document.querySelectorAll(".canvas-page").forEach(p => p.classList.remove("active"));
  // Activate this one (create if missing)
  let page = document.getElementById("cv-" + id);
  if (!page) page = createCanvasPage(id);
  page.classList.add("active");
  activeTabId = id;
  renderTabs();
  if (activeSidebarTab === "canvases") renderSidebarContent();
}

function closeTab(id) {
  openTabs = openTabs.filter(t => t !== id);
  const page = document.getElementById("cv-" + id);
  if (page) page.remove();
  if (activeTabId === id) {
    activeTabId = openTabs[openTabs.length - 1] || null;
    if (activeTabId) switchTab(activeTabId);
    else document.querySelectorAll(".canvas-page").forEach(p => p.classList.remove("active"));
  }
  renderTabs();
  saveToLS();
}

function openAddCanvasModal() {
  const modal = document.getElementById("addCanvasModal");
  if (!modal) return;

  // Set default name for new canvas
  document.getElementById("newCanvasNameInput").value = "Canvas " + (Object.keys(canvasData).length + 1);
  document.getElementById("existingCanvasSearch").value = "";

  // Populate existing canvases list
  const list = document.getElementById("existingCanvasList");
  list.innerHTML = "";
  let selectedCanvasId = null;

  const openBtn = document.getElementById("openExistingCanvasBtn");
  openBtn.style.display = "none";

  const allIds = Object.keys(canvasData);
  
  if (allIds.length === 0) {
    list.innerHTML = `<div style="padding:12px;font-size:12px;color:var(--muted);text-align:center;">No existing canvases yet.</div>`;
  } else {
    allIds.forEach(id => {
      const cv = canvasData[id];
      const isOpen = openTabs.includes(id);
      const item = document.createElement("div");
      item.className = "relocate-item" + (isOpen ? " selected" : "");
      item.style.opacity = isOpen ? "0.6" : "1";
      
      item.innerHTML = `
        <span class="material-symbols-outlined" style="font-size:18px;">insert_drive_file</span>
        <span style="flex:1;">${escHtml(cv.name)}</span>
        <span style="font-size:10px;color:var(--muted)">${cv.nodes.length} nodes${isOpen ? " (open)" : ""}</span>
      `;
      
      if (!isOpen) {
        item.addEventListener("click", () => {
          list.querySelectorAll(".relocate-item").forEach(i => i.classList.remove("selected"));
          item.classList.add("selected");
          selectedCanvasId = id;
          openBtn.style.display = "block";
        });
        item.addEventListener("dblclick", () => {
          modal.classList.remove("open");
          if (!openTabs.includes(id)) openTabs.push(id);
          renderTabs();
          switchTab(id);
          setDirty(true);
        });
      } else {
        item.addEventListener("click", () => {
          modal.classList.remove("open");
          switchTab(id);
        });
      }
      
      list.appendChild(item);
    });
  }

  // Search filter
  document.getElementById("existingCanvasSearch").oninput = function() {
    const term = this.value.toLowerCase();
    list.querySelectorAll(".relocate-item").forEach(item => {
      const name = item.querySelector("span:nth-child(2)")?.textContent?.toLowerCase() || "";
      item.style.display = name.includes(term) ? "" : "none";
    });
  };

  modal.classList.add("open");
  document.getElementById("newCanvasNameInput").focus();
  document.getElementById("newCanvasNameInput").select();

  // Create button handler
  document.getElementById("createNewCanvasBtn").onclick = () => {
    const name = document.getElementById("newCanvasNameInput").value.trim() || "Untitled";
    modal.classList.remove("open");
    const id = generateId();
    canvasData[id] = { name, nodes: [], arrows: [] };
    openTabs.push(id);
    renderTabs();
    switchTab(id);
    setDirty(true);
  };

  // Open existing button handler
  openBtn.onclick = () => {
    if (!selectedCanvasId) return;
    modal.classList.remove("open");
    if (!openTabs.includes(selectedCanvasId)) openTabs.push(selectedCanvasId);
    renderTabs();
    switchTab(selectedCanvasId);
    setDirty(true);
  };

  // Cancel button handler
  document.getElementById("addCanvasCancelBtn").onclick = () => {
    modal.classList.remove("open");
  };

  document.getElementById("newCanvasNameInput").onkeydown = e => {
    if (e.key === "Enter") {
      document.getElementById("createNewCanvasBtn").click();
    }
  };
}

function showCanvasNodeAddModal(canvasId) {
  const modal = document.getElementById("addCanvasModal");
  if (!modal || !canvasId) return;

  // Set default name for new canvas
  document.getElementById("newCanvasNameInput").value = "Canvas " + (Object.keys(canvasData).length + 1);
  document.getElementById("existingCanvasSearch").value = "";

  // Populate existing canvases list (exclude self)
  const list = document.getElementById("existingCanvasList");
  list.innerHTML = "";
  let selectedCanvasId = null;

  const openBtn = document.getElementById("openExistingCanvasBtn");
  openBtn.style.display = "none";

  const allIds = Object.keys(canvasData).filter(id => id !== canvasId);
  
  if (allIds.length === 0) {
    list.innerHTML = `<div style="padding:12px;font-size:12px;color:var(--muted);text-align:center;">No other canvases available.</div>`;
  } else {
    allIds.forEach(id => {
      const cv = canvasData[id];
      const item = document.createElement("div");
      item.className = "relocate-item";
      
      item.innerHTML = `
        <span class="material-symbols-outlined" style="font-size:18px;">insert_drive_file</span>
        <span style="flex:1;">${escHtml(cv.name)}</span>
        <span style="font-size:10px;color:var(--muted)">${cv.nodes.length} nodes</span>
      `;
      
      item.addEventListener("click", () => {
        list.querySelectorAll(".relocate-item").forEach(i => i.classList.remove("selected"));
        item.classList.add("selected");
        selectedCanvasId = id;
        openBtn.style.display = "block";
        openBtn.textContent = "Add Existing Canvas";
      });
      
      list.appendChild(item);
    });
  }

  // Search filter
  document.getElementById("existingCanvasSearch").oninput = function() {
    const term = this.value.toLowerCase();
    list.querySelectorAll(".relocate-item").forEach(item => {
      const name = item.querySelector("span:nth-child(2)")?.textContent?.toLowerCase() || "";
      item.style.display = name.includes(term) ? "" : "none";
    });
  };

  modal.classList.add("open");
  document.getElementById("newCanvasNameInput").focus();
  document.getElementById("newCanvasNameInput").select();

  // Create new canvas node handler
  document.getElementById("createNewCanvasBtn").onclick = () => {
    const name = document.getElementById("newCanvasNameInput").value.trim() || "Untitled";
    modal.classList.remove("open");
    const newId = generateId();
    canvasData[newId] = { name, nodes: [], arrows: [] };
    snapshotUndo(canvasId);
    // Create canvas node in current canvas
    const node = { id: generateId(), type: "canvas", x: 100, y: 100, w: 240, h: 90, refCanvasId: newId };
    canvasData[canvasId].nodes.push(node);
    renderNode(node, canvasId);
    setDirty(true);
  };

  // Add existing canvas node handler
  openBtn.onclick = () => {
    if (!selectedCanvasId) return;
    modal.classList.remove("open");
    snapshotUndo(canvasId);
    // Create canvas node in current canvas
    const node = { id: generateId(), type: "canvas", x: 100, y: 100, w: 240, h: 90, refCanvasId: selectedCanvasId };
    canvasData[canvasId].nodes.push(node);
    renderNode(node, canvasId);
    setDirty(true);
  };

  // Cancel button handler
  document.getElementById("addCanvasCancelBtn").onclick = () => {
    modal.classList.remove("open");
  };

  document.getElementById("newCanvasNameInput").onkeydown = e => {
    if (e.key === "Enter") {
      document.getElementById("createNewCanvasBtn").click();
    }
  };
}

// ════════════════════════════════════════════════════════════════════
//  CANVAS ENGINE
// ════════════════════════════════════════════════════════════════════
function getTransform(id) {
  if (!transforms[id]) transforms[id] = { x: 0, y: 0, scale: 1 };
  return transforms[id];
}

function applyTransform(nodesEl, id) {
  const t = getTransform(id);
  nodesEl.style.transform = `translate(${t.x}px,${t.y}px) scale(${t.scale})`;
}

function createCanvasPage(id) {
  const cv = canvasData[id];
  const page = document.createElement("div");
  page.className = "canvas-page";
  page.id = "cv-" + id;

  // SVG layer
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add("canvas-svg");
  svg.id = "svg-" + id;

  // Nodes layer
  const nodes = document.createElement("div");
  nodes.className = "canvas-nodes";
  nodes.id = "nodes-" + id;

  // Empty hint
  const hint = document.createElement("div");
  hint.className = "canvas-empty";
  hint.id = "hint-" + id;
  hint.innerHTML = `<div class="big-hint">Double-click to create a node</div><div class="small-hint">or press / for the slash menu · drag songs from sidebar</div>`;

  page.appendChild(hint);
  page.appendChild(svg);
  page.appendChild(nodes);

  // Bind events
  bindCanvasEvents(page, id, nodes, svg);

  // Append to DOM first so layout is established before rendering
  document.getElementById("canvasArea").appendChild(page);

  // Render existing nodes
  applyTransform(nodes, id);
  cv.nodes.forEach(n => renderNode(n, id));
  updateEmptyHint(id);

  // Defer arrow rendering until after the browser has laid out the nodes
  requestAnimationFrame(() => renderAllArrows(id));

  return page;
}

function updateEmptyHint(id) {
  const hint = document.getElementById("hint-" + id);
  if (!hint) return;
  const cv = canvasData[id];
  hint.style.display = cv && cv.nodes.length > 0 ? "none" : "";
}

// ────────────────────────────────────────────────────────────────────
//  NODE TYPES
// ────────────────────────────────────────────────────────────────────
function createNode(type, extra, id) {
  const cv = canvasData[id];
  if (!cv) return;
  const t = getTransform(id);
  const canvasEl = document.getElementById("canvasArea");
  const cx = (canvasEl.offsetWidth  / 2 - t.x) / t.scale;
  const cy = (canvasEl.offsetHeight / 2 - t.y) / t.scale;
  const defaultW = type === "youtube" ? 360 : type === "spotify" ? 300 : type === "project" ? 320 : 280;
  const defaultH = type === "youtube" ? 240 : type === "spotify" ? 152 : type === "project" ? 300 : 160;
  const node = {
    id: generateId(), type,
    x: cx - defaultW / 2, y: cy - defaultH / 2,
    w: defaultW, h: defaultH,
    title:    extra.title    || "",
    content:  extra.content  || "",
    filePath: extra.filePath || null,
    ytUrl:    extra.ytUrl    || null,
    spUrl:    extra.spUrl    || null,
    ...extra
  };
  snapshotUndo(id);
  cv.nodes.push(node);
  renderNode(node, id);
  updateEmptyHint(id);
  setDirty(true);
  return node;
}

function renderNode(node, canvasId) {
  const nodesEl = document.getElementById("nodes-" + canvasId);
  if (!nodesEl) return;
  let el;
  if (node.type === "youtube")  el = makeYtNode(node, canvasId);
  else if (node.type === "spotify") el = makeSpNode(node, canvasId);
  else if (node.type === "audio")   el = makeAudioNode(node, canvasId);
  else if (node.type === "project") el = makeProjectNode(node, canvasId);
  else if (node.type === "canvas")  el = makeCanvasRefNode(node, canvasId);
  else el = makeRectNode(node, canvasId);
  el.id = "node-" + node.id;
  el.style.left = node.x + "px";
  el.style.top = node.y + "px";
  el.style.width = node.w + "px";
  el.style.height = node.h + "px";
  bindNodeDrag(el, node, canvasId);
  bindNodeResize(el, node, canvasId);
  bindConnectors(el, node, canvasId);
  nodesEl.appendChild(el);
  return el;
}

// ────────────────────────────────────────────────────────────────────
//  CANVAS-AS-NODE  (embed another canvas as a linked node)
// ────────────────────────────────────────────────────────────────────
function makeCanvasRefNode(node, canvasId) {
  const el = document.createElement("div");
  el.className = "c-node c-canvas-ref-node";
  el.dataset.nodeId = node.id;

  function rebuild() {
    const refCv = node.refCanvasId ? canvasData[node.refCanvasId] : null;
    const name = refCv ? refCv.name : "— pick a canvas —";
    const nodeCount = refCv ? refCv.nodes.length : 0;
    const arrowCount = refCv ? refCv.arrows.length : 0;
    el.innerHTML = `
      <div class="c-canvas-ref-content">
        <div class="c-canvas-ref-center" title="Double-click to open canvas">
          <div class="c-canvas-ref-name">${escHtml(name)}</div>
        </div>
        <div class="c-canvas-ref-footer">
          <span>${nodeCount} node${nodeCount!==1?"s":""} · ${arrowCount} arrow${arrowCount!==1?"s":""}</span>
        </div>
        ${!node.refCanvasId ? `<button class="c-canvas-ref-pick">Choose Canvas…</button>` : ""}
      </div>
      <div class="resize-handle"></div>
      <div class="conn-dot right"></div><div class="conn-dot left"></div>
      <div class="conn-dot bottom"></div><div class="conn-dot top"></div>
    `;

    // Double-click to open the referenced canvas with zoom animation
    const centerDiv = el.querySelector(".c-canvas-ref-center");
    if (centerDiv && node.refCanvasId && refCv) {
      centerDiv.addEventListener("dblclick", e => {
        e.stopPropagation();
        openCanvasNodeWithAnimation(node.refCanvasId, canvasId, node.id);
      });
      centerDiv.style.cursor = "pointer";
    }

    const pickBtn = el.querySelector(".c-canvas-ref-pick");
    if (pickBtn) {
      pickBtn.addEventListener("click", e => {
        e.stopPropagation();
        openCanvasPickerModal(canvasId, node, rebuild);
      });
    }
  }

  rebuild();
  el.addEventListener("click", e => { e.stopPropagation(); });
  el.addEventListener("contextmenu", e => { e.preventDefault(); e.stopPropagation(); selectNode(node.id, canvasId, e.shiftKey); showCtxMenu(e, { type: "node", nodeId: node.id, canvasId }); });
  return el;
}

function openCanvasPickerModal(currentCanvasId, node, onPick) {
  // Build a quick inline picker using the relocate modal pattern
  const modal = document.getElementById("relocateModal");
  document.querySelector("#relocateModal h3").innerHTML = '<span class="material-symbols-outlined">insert_drive_file</span> Choose Canvas';
  document.getElementById("relocateSearch").value = "";
  const list = document.getElementById("relocateList");
  list.innerHTML = "";

  // List all canvases except current
  Object.entries(canvasData).forEach(([id, cv]) => {
    if (id === currentCanvasId) return; // can't embed self
    const item = document.createElement("div");
    item.className = "relocate-item" + (node.refCanvasId === id ? " selected" : "");
    item.innerHTML = `<span class="material-symbols-outlined" style="font-size:18px;">insert_drive_file</span><span style="flex:1">${escHtml(cv.name)}</span><span style="font-size:10px;color:var(--muted)">${cv.nodes.length} nodes</span>`;
    item.addEventListener("click", () => {
      list.querySelectorAll(".relocate-item").forEach(i => i.classList.remove("selected"));
      item.classList.add("selected");
      node.refCanvasId = id;
    });
    list.appendChild(item);
  });

  modal.classList.add("open");
  document.getElementById("relocateConfirmBtn").onclick = () => {
    modal.classList.remove("open");
    if (node.refCanvasId) { onPick(); setDirty(true); }
  };
  document.getElementById("relocateCancelBtn").onclick = () => modal.classList.remove("open");
  // Disable search for canvas picker
  document.getElementById("relocateSearch").disabled = true;
  document.getElementById("relocateSearch").placeholder = "Canvas list";
}

function makeRectNode(node, canvasId) {
  const el = document.createElement("div");
  el.className = "c-node";
  el.dataset.nodeId = node.id;
  el.innerHTML = `
    <div class="c-node-desc" contenteditable="true" data-placeholder="Description, markdown, notes..." spellcheck="false"></div>
    <div class="resize-handle"></div>
    <div class="conn-dot right"></div>
    <div class="conn-dot left"></div>
    <div class="conn-dot bottom"></div>
    <div class="conn-dot top"></div>
  `;
  const descEl = el.querySelector(".c-node-desc");

  // Initialize desc
  if (node.content) {
    renderMarkdownInNode(descEl, node.content);
  } else {
    descEl.innerText = "";
  }

  // First click on an unselected node: just select it, don't edit yet.
  // Second click while already selected: enter edit mode.
  // (Selection normally happens via bindNodeDrag's mousedown, but that
  // handler explicitly skips [contenteditable] targets, so the desc text
  // needs to handle its own selection step here.)
  descEl.addEventListener("click", e => {
    e.stopPropagation();
    if (descEl.contentEditable === "false") {
      const wasSelected = selectedNodeIds.has(node.id);
      if (!wasSelected) {
        selectNode(node.id, canvasId, e.shiftKey);
        return; // first click: select only, don't open the editor yet
      }
      switchToEditMode(descEl, node);
      descEl.focus();
    }
  });

  descEl.addEventListener("input", () => { node.content = descEl.innerText; setDirty(true); });

  // Blur: render markdown
  descEl.addEventListener("blur", () => {
    node.content = descEl.innerText;
    if (node.content.trim()) {
      renderMarkdownInNode(descEl, node.content);
    }
    setDirty(true);
  });

  descEl.addEventListener("keydown", e => {
    if (e.key === "/" && (descEl.innerText.endsWith("\n") || descEl.innerText === "")) {
      e.preventDefault();
      openSlashMenu(e, canvasId, node.id);
    }
  });
  el.addEventListener("click", e => { e.stopPropagation(); });
  el.addEventListener("contextmenu", e => { e.preventDefault(); e.stopPropagation(); selectNode(node.id, canvasId, e.shiftKey); showCtxMenu(e, { type: "node", nodeId: node.id, canvasId }); });
  return el;
}

function makeAudioNode(node, canvasId) {
  const el = document.createElement("div");
  el.className = "c-node c-audio-node";
  el.dataset.nodeId = node.id;
  const file      = node.filePath ? allSongs.find(s => s.path === node.filePath) : null;
  const isMissing = node.filePath && !file;
  const name      = file ? baseName(file.name) : (node.filePath ? node.filePath.split("/").pop() : "Unknown");
  el.innerHTML = `
    <div class="c-audio-title" style="display:flex;align-items:center;gap:8px;">
      <span class="material-symbols-outlined" style="font-size:18px;">audio_file</span>
      <span>${escHtml(name)}</span>
      ${isMissing ? `<span style="color:#ff6b6b;font-size:9px;margin-left:6px">MISSING</span>` : ""}
    </div>
    <div class="c-audio-desc" contenteditable="true" data-placeholder="Notes about this track...">${escHtml(node.content || "")}</div>
    <div class="c-audio-player">
      ${isMissing
        ? `<button class="c-relocate-btn" data-node-id="${node.id}" data-canvas-id="${canvasId}">Relocate File</button>`
        : `<button class="c-play-btn" data-path="${escHtml(node.filePath)}">
            <span class="material-symbols-outlined" style="font-size:14px;">play_arrow</span>
           </button>
           <div class="c-mini-prog"><div class="c-mini-prog-fill" data-path="${escHtml(node.filePath)}"></div></div>
           <div class="c-audio-time" data-path="${escHtml(node.filePath)}">0:00 / --:--</div>`
      }
    </div>
    <div class="resize-handle"></div>
    <div class="conn-dot right"></div><div class="conn-dot left"></div>
    <div class="conn-dot bottom"></div><div class="conn-dot top"></div>
  `;
  const descEl = el.querySelector(".c-audio-desc");
  descEl.addEventListener("input", () => { node.content = descEl.innerText; setDirty(true); });

  if (!isMissing && file) {
    const playBtn  = el.querySelector(".c-play-btn");
    const miniProg = el.querySelector(".c-mini-prog");
    playBtn.addEventListener("click", e => { e.stopPropagation(); playFile(file); });
    miniProg.addEventListener("click", e => {
      e.stopPropagation();
      if (!nowPlayingFile || nowPlayingFile.path !== file.path) return;
      const rect = miniProg.getBoundingClientRect();
      const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      if (fallbackAudio) { fallbackAudio.currentTime = pct * (fallbackAudio.duration || 0); return; }
      if (currentBuffer) {
        const offset = pct * currentDuration;
        const was    = isPlaying; playGeneration++;
        if (currentSource) { try { currentSource.stop(); } catch(e) {} currentSource = null; }
        cancelAnimationFrame(animFrame); isPlaying = false;
        if (was) playBuffer(currentBuffer, offset, nowPlayingFile);
        else { pauseOffset = offset; updateBarProgress(offset, currentDuration); }
      }
    });
  }
  if (isMissing) {
    el.querySelector(".c-relocate-btn").addEventListener("click", e => {
      e.stopPropagation(); openRelocateModal(node.id, canvasId);
    });
  }

  // Tags row
  if (node.filePath) {
    const tagsRow = document.createElement("div");
    tagsRow.className = "c-audio-tags-row";
    const updateTags = () => {
      tagsRow.innerHTML = "";
      const resolvedTags = getSongTags(file || { path: node.filePath, name: name, sourceId: node.projectSourceId });
      resolvedTags.forEach(tag => {
        const span = document.createElement("span");
        span.className = "sb-tag";
        span.textContent = tag;
        tagsRow.appendChild(span);
      });
      const editBtn = document.createElement("button");
      editBtn.className = "c-tag-edit-btn";
      const hasOwn = songTags[node.filePath] && songTags[node.filePath].length > 0;
      if (hasOwn) editBtn.classList.add("active");
      editBtn.title = hasOwn ? "Tags: " + songTags[node.filePath].join(", ") : "Manage song tags";
      editBtn.innerHTML = `<span class="material-symbols-outlined" style="font-size:12px;">label</span>`;
      editBtn.addEventListener("click", e => {
        e.stopPropagation();
        openTagModal(node.filePath);
      });
      tagsRow.appendChild(editBtn);
    };
    updateTags();
    el.appendChild(tagsRow);
    el.updateTags = updateTags;
  }

  el.addEventListener("click", e => { e.stopPropagation(); });
  el.addEventListener("contextmenu", e => { e.preventDefault(); e.stopPropagation(); selectNode(node.id, canvasId, e.shiftKey); showCtxMenu(e, { type: "node", nodeId: node.id, canvasId }); });
  return el;
}

// ────────────────────────────────────────────────────────────────────
//  PROJECT NODE  (folder of tracks — scrollable playlist)
// ────────────────────────────────────────────────────────────────────
function makeProjectNode(node, canvasId) {
  const el = document.createElement("div");
  el.className = "c-node c-project-node";
  el.dataset.nodeId = node.id;

  function getTracklist() {
    if (node.projectSourceId && node.projectFolderPath !== undefined) {
      return getSongsInFolder(node.projectSourceId, node.projectFolderPath);
    }
    // Fallback: show all songs
    return allSongs.slice(0, 100);
  }

  function buildTrackRow(file) {
    const row = document.createElement("div");
    row.className = "proj-track-row" + (nowPlayingPath === file.path ? " playing" : "");
    row.dataset.path = file.path;
    const ext = getExt(file.name);
    row.innerHTML = `
      <button class="proj-play-btn" data-path="${escHtml(file.path)}" title="Play">
        <span class="material-symbols-outlined" style="font-size:12px;">play_arrow</span>
      </button>
      <span class="proj-track-name" title="${escHtml(file.name)}">${escHtml(baseName(file.name))}</span>
      <span class="proj-track-ext">${ext}</span>
    `;
    row.querySelector(".proj-play-btn").addEventListener("click", e => {
      e.stopPropagation(); playFile(file);
    });
    row.addEventListener("dblclick", e => { e.stopPropagation(); playFile(file); });
    row.addEventListener("dragstart", e => {
      e.dataTransfer.setData("song-path", file.path);
      e.dataTransfer.effectAllowed = "copy";
    });
    row.draggable = true;

    // Add tag button
    const tagBtn = document.createElement("button");
    tagBtn.className = "proj-track-tag-btn";
    tagBtn.innerHTML = `<span class="material-symbols-outlined" style="font-size:11px;">label</span>`;
    tagBtn.addEventListener("click", e => {
      e.stopPropagation();
      openTagModal(file.path);
    });
    row.appendChild(tagBtn);

    return row;
  }

  function rebuild() {
    const tracks     = getTracklist();
    const sourceObj  = sources.find(s => s.id === node.projectSourceId);
    const sourceMissing = node.projectSourceId && !sourceObj;
    const hasNoTracks   = node.projectSourceId && sourceObj && tracks.length === 0;

    const folderName = node.projectFolderPath
      ? node.projectFolderPath.split("/").pop()
      : (sourceObj?.name || "Project");
    const srcIcon = (() => {
      return sourceObj?.type === "github"
        ? `<span class="material-symbols-outlined">cloud</span>`
        : `<span class="material-symbols-outlined">folder</span>`;
    })();

    el.innerHTML = `
      <div class="proj-header">
        <span class="proj-icon">${srcIcon}</span>
        <span class="proj-title" title="${escHtml(node.projectFolderPath || "")}">${escHtml(folderName)}</span>
        <span class="proj-count">${tracks.length}</span>
        ${!node.projectSourceId ? `<button class="proj-pick-btn">Pick folder…</button>` : ""}
      </div>
      <div class="proj-tags-row"></div>
      <div class="proj-tracklist"></div>
      <div class="proj-notes-wrap">
        <div class="proj-notes" contenteditable="true" data-placeholder="Notes about this project…">${escHtml(node.content || "")}</div>
      </div>
      <div class="resize-handle"></div>
      <div class="conn-dot right"></div><div class="conn-dot left"></div>
      <div class="conn-dot bottom"></div><div class="conn-dot top"></div>
    `;

    const tracklist = el.querySelector(".proj-tracklist");

    // ── Warning banner: source folder missing (removed & re-added gets new ID) ──
    if (sourceMissing) {
      tracklist.innerHTML = `
        <div class="proj-warning">
          <div class="proj-warning-msg">
            <span class="material-symbols-outlined">folder_off</span>
            <span>Source folder missing. It was likely removed and re-added (new ID). Open <strong>Sources</strong> and re-add the same folder — then click <em>Fix All</em> to remap all affected nodes at once.</span>
          </div>
          <div class="proj-warning-btns">
            <button class="proj-warn-btn relocate">Fix All Nodes…</button>
            <button class="proj-warn-btn remove">Remove Node</button>
          </div>
        </div>
      `;
      tracklist.querySelector(".proj-warn-btn.relocate").addEventListener("click", e => {
        e.stopPropagation();
        fixAllBrokenSourceNodes(node.projectSourceId);
      });
      tracklist.querySelector(".proj-warn-btn.remove").addEventListener("click", e => {
        e.stopPropagation();
        pendingDeleteCallback = () => deleteSelected(canvasId);
        selectNode(node.id, canvasId);
        document.getElementById("deleteConfirm").classList.add("open");
      });
    } else if (hasNoTracks) {
      // ── Warning banner: source exists but folder has no audio ──
      tracklist.innerHTML = `
        <div class="proj-warning">
          <div class="proj-warning-msg">
            <span class="material-symbols-outlined">audio_file</span>
            <span>No audio files found in this folder. The folder might be empty or you may need to re-open MuseGarden after re-adding it.</span>
          </div>
          <div class="proj-warning-btns">
            <button class="proj-warn-btn relocate">Pick Different Folder</button>
            <button class="proj-warn-btn remove">Remove Node</button>
          </div>
        </div>
      `;
      tracklist.querySelector(".proj-warn-btn.relocate").addEventListener("click", e => {
        e.stopPropagation();
        openProjectFolderPicker(node, canvasId, rebuild);
      });
      tracklist.querySelector(".proj-warn-btn.remove").addEventListener("click", e => {
        e.stopPropagation();
        pendingDeleteCallback = () => deleteSelected(canvasId);
        selectNode(node.id, canvasId);
        document.getElementById("deleteConfirm").classList.add("open");
      });
    } else if (tracks.length === 0) {
      tracklist.innerHTML = `<div class="proj-empty">${node.projectSourceId ? "No audio files in this folder" : "Pick a folder to see tracks"}</div>`;
    } else {
      tracks.forEach(f => tracklist.appendChild(buildTrackRow(f)));
    }

    // Notes
    const notesEl = el.querySelector(".proj-notes");
    notesEl.addEventListener("input",  () => { node.content = notesEl.innerText; setDirty(true); });
    notesEl.addEventListener("click",  e  => e.stopPropagation());

    // Pick folder button
    const pickBtn = el.querySelector(".proj-pick-btn");
    if (pickBtn) {
      pickBtn.addEventListener("click", e => { e.stopPropagation(); openProjectFolderPicker(node, canvasId, rebuild); });
    }

    const updateProjectNode = () => {
      const tagsRow = el.querySelector(".proj-tags-row");
      if (tagsRow) {
        tagsRow.innerHTML = "";
        const folderKey = node.projectSourceId + ":" + (node.projectFolderPath || "");
        const folderTags = projectTags[folderKey] || [];
        folderTags.forEach(tag => {
          const span = document.createElement("span");
          span.className = "sb-tag";
          span.textContent = tag;
          tagsRow.appendChild(span);
        });

        if (node.projectSourceId) {
          const editBtn = document.createElement("button");
          editBtn.className = "c-tag-edit-btn";
          const hasOwn = folderTags.length > 0;
          if (hasOwn) editBtn.classList.add("active");
          editBtn.title = hasOwn ? "Folder tags: " + folderTags.join(", ") : "Manage folder tags";
          editBtn.innerHTML = `<span class="material-symbols-outlined" style="font-size:12px;">label</span>`;
          editBtn.addEventListener("click", e => {
            e.stopPropagation();
            const folderName = node.projectFolderPath
              ? node.projectFolderPath.split("/").pop()
              : (sources.find(s => s.id === node.projectSourceId)?.name || "Project");
            openTagModal(folderKey, true, folderName);
          });
          tagsRow.appendChild(editBtn);
        }
      }

      el.querySelectorAll(".proj-track-row").forEach(row => {
        const path = row.dataset.path;
        const file = allSongs.find(s => s.path === path);
        const tagBtn = row.querySelector(".proj-track-tag-btn");
        if (tagBtn && file) {
          const hasOwn = songTags[path] && songTags[path].length > 0;
          const allTags = getSongTags(file);
          tagBtn.className = "proj-track-tag-btn" + (hasOwn ? " active" : "");
          tagBtn.title = allTags.length > 0 ? "Tags: " + allTags.join(", ") : "Manage song tags";
        }
      });
    };

    updateProjectNode();
    el.updateProjectNode = updateProjectNode;
  }

  rebuild();

  el.addEventListener("click",  e  => { e.stopPropagation(); });
  el.addEventListener("contextmenu", e => {
    e.preventDefault(); e.stopPropagation();
    selectNode(node.id, canvasId, e.shiftKey);
    showCtxMenu(e, { type: "node", nodeId: node.id, canvasId });
  });
  return el;
}

function openProjectFolderPicker(node, canvasId, onPick) {
  // Build a quick picker using the relocate modal
  const modal = document.getElementById("relocateModal");
  document.querySelector("#relocateModal h3").innerHTML = '<span class="material-symbols-outlined">folder</span> Pick Project Folder';
  document.getElementById("relocateSearch").disabled = true;
  document.getElementById("relocateSearch").placeholder = "Choose a source folder";
  document.getElementById("relocateSearch").value = "";

  const list = document.getElementById("relocateList");
  list.innerHTML = "";

  let pickedSourceId = node.projectSourceId || null;
  let pickedPath     = node.projectFolderPath !== undefined ? node.projectFolderPath : null;

  sources.forEach(src => {
    // Source header
    const hdr = document.createElement("div");
    hdr.className = "relocate-source-hdr";
    hdr.style.display = "flex";
    hdr.style.alignItems = "center";
    hdr.style.gap = "8px";
    hdr.innerHTML = `<span class="material-symbols-outlined" style="font-size:18px;">${src.type === "github" ? "cloud" : "folder"}</span><strong>${escHtml(src.name)}</strong> (root)`;
    hdr.addEventListener("click", () => {
      list.querySelectorAll(".relocate-item").forEach(i => i.classList.remove("selected"));
      hdr.classList.add("selected");
      pickedSourceId = src.id; pickedPath = "";
    });
    list.appendChild(hdr);

    // All unique folder paths within this source
    if (src.songs) {
      const foldersSeen = new Set();
      foldersSeen.add(""); // root already shown above
      src.songs.forEach(s => {
        const parts = s.localPath.split("/");
        for (let i = 1; i < parts.length; i++) {
          const fp = parts.slice(0, i).join("/");
          foldersSeen.add(fp);
        }
      });
      [...foldersSeen].filter(f => f !== "").sort().forEach(fp => {
        const item  = document.createElement("div");
        item.className = "relocate-item" +
          (pickedSourceId === src.id && pickedPath === fp ? " selected" : "");
        const depth = fp.split("/").length - 1;
        item.innerHTML = `<span style="padding-left:${depth * 12}px; display:inline-flex; align-items:center; gap:4px;"><span class="material-symbols-outlined" style="font-size:18px;">folder</span></span><span style="flex:1">${escHtml(fp.split("/").pop())}</span><span style="font-size:10px;color:var(--muted)">${escHtml(fp)}</span>`;
        item.addEventListener("click", () => {
          list.querySelectorAll(".relocate-item, .relocate-source-hdr").forEach(i => i.classList.remove("selected"));
          item.classList.add("selected");
          pickedSourceId = src.id; pickedPath = fp;
        });
        list.appendChild(item);
      });
    }
  });

  modal.classList.add("open");
  document.getElementById("relocateConfirmBtn").onclick = () => {
    if (pickedSourceId === null) return;
    modal.classList.remove("open");
    document.getElementById("relocateSearch").disabled = false;
    document.getElementById("relocateSearch").placeholder = "Search songs…";
    node.projectSourceId   = pickedSourceId;
    node.projectFolderPath = pickedPath;
    onPick();
    setDirty(true);
  };
  document.getElementById("relocateCancelBtn").onclick = () => {
    modal.classList.remove("open");
    document.getElementById("relocateSearch").disabled = false;
    document.getElementById("relocateSearch").placeholder = "Search songs…";
  };
}

function makeYtNode(node, canvasId) {
  const el = document.createElement("div");
  el.className = "c-node c-yt-node";
  el.dataset.nodeId = node.id;
  const ytId = extractYtId(node.ytUrl || "");
  el.innerHTML = `
    <div class="c-yt-title" style="display:flex;align-items:center;gap:6px;"><span class="material-symbols-outlined" style="font-size:16px;">smart_display</span>YouTube</div>
    <div class="c-yt-frame-wrap">
      <iframe src="https://www.youtube.com/embed/${ytId}?enablejsapi=1" allowfullscreen allow="autoplay"></iframe>
      <div class="c-yt-overlay">
        <div class="c-yt-play-icon">
          <svg width="20" height="14" viewBox="0 0 20 14" fill="white"><path d="M8 10V4l6 3-6 3z"/></svg>
        </div>
      </div>
    </div>
    <div class="resize-handle"></div>
    <div class="conn-dot right"></div><div class="conn-dot left"></div>
    <div class="conn-dot bottom"></div><div class="conn-dot top"></div>
  `;
  // Click overlay to enable interaction (stop main audio)
  el.querySelector(".c-yt-overlay").addEventListener("click", e => {
    e.stopPropagation();
    stopAll();
    el.querySelector(".c-yt-overlay").classList.add("hidden");
    el.querySelector("iframe").style.pointerEvents = "auto";
  });
  el.addEventListener("click", e => { e.stopPropagation(); });
  el.addEventListener("contextmenu", e => { e.preventDefault(); e.stopPropagation(); selectNode(node.id, canvasId, e.shiftKey); showCtxMenu(e, { type: "node", nodeId: node.id, canvasId }); });
  return el;
}

function makeSpNode(node, canvasId) {
  const el = document.createElement("div");
  el.className = "c-node c-sp-node";
  el.dataset.nodeId = node.id;
  const spUrl = convertSpotifyUrl(node.spUrl || "");
  el.innerHTML = `
    <iframe class="c-sp-frame" src="${spUrl}" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" height="152" loading="lazy" style="pointer-events:none;"></iframe>
    <div class="resize-handle"></div>
    <div class="conn-dot right"></div><div class="conn-dot left"></div>
    <div class="conn-dot bottom"></div><div class="conn-dot top"></div>
  `;
  // Enable iframe on click
  el.addEventListener("click", e => {
    e.stopPropagation();
    selectNode(node.id, canvasId);
    stopAll();
    el.querySelector("iframe").style.pointerEvents = "auto";
  });
  el.addEventListener("contextmenu", e => { e.preventDefault(); e.stopPropagation(); selectNode(node.id, canvasId); showCtxMenu(e, { type: "node", nodeId: node.id, canvasId }); });
  return el;
}

function extractYtId(url) {
  const m = url.match(/(?:youtu\.be\/|v=|embed\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : "";
}

function convertSpotifyUrl(url) {
  return url.replace("open.spotify.com/", "open.spotify.com/embed/");
}

// ────────────────────────────────────────────────────────────────────
//  NODE DRAG & RESIZE
// ────────────────────────────────────────────────────────────────────
function bindNodeDrag(el, node, canvasId) {
  el.addEventListener("mousedown", e => {
    if (e.target.closest(".conn-dot") || e.target.closest(".resize-handle") ||
        e.target.closest("[contenteditable]") || e.target.closest("button") ||
        e.target.closest("iframe") || e.target.closest(".c-mini-prog")) return;
    if (isSpaceDown) return;
    e.stopPropagation();

    let hasDragged = false;
    let wasAlreadySelected = selectedNodeIds.has(node.id);

    if (e.shiftKey) {
      selectNode(node.id, canvasId, true);
    } else {
      if (!wasAlreadySelected) {
        selectNode(node.id, canvasId, false);
      }
    }

    const t = getTransform(canvasId);
    const cv = canvasData[canvasId];
    
    // Save starting offsets of all selected nodes
    const dragNodes = [];
    if (selectedNodeIds.has(node.id)) {
      selectedNodeIds.forEach(nid => {
        const nObj = cv && cv.nodes.find(n => n.id === nid);
        const nEl = document.getElementById("node-" + nid);
        if (nObj && nEl) {
          dragNodes.push({
            obj: nObj,
            el: nEl,
            startX: nObj.x,
            startY: nObj.y
          });
        }
      });
    } else {
      dragNodes.push({
        obj: node,
        el,
        startX: node.x,
        startY: node.y
      });
    }

    const mouseStartX = e.clientX;
    const mouseStartY = e.clientY;
    isDragging = true;

    const onMove = e2 => {
      if (!isDragging) return;
      const dx = (e2.clientX - mouseStartX) / t.scale;
      const dy = (e2.clientY - mouseStartY) / t.scale;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        hasDragged = true;
      }
      
      dragNodes.forEach(dn => {
        dn.obj.x = dn.startX + dx;
        dn.obj.y = dn.startY + dy;
        dn.el.style.left = dn.obj.x + "px";
        dn.el.style.top = dn.obj.y + "px";
      });
      
      renderAllArrows(canvasId);
    };
    const onUp = () => {
      isDragging = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      
      // If we clicked a selected node without shift and did not drag, select only this node on release
      if (!hasDragged && wasAlreadySelected && !e.shiftKey) {
        selectNode(node.id, canvasId, false);
      }
      setDirty(true);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  });
}

function bindNodeResize(el, node, canvasId) {
  // Remove existing resize handles
  el.querySelectorAll(".resize-edge, .resize-corner, .resize-handle").forEach(h => h.remove());

  // Create segmented resize edges (leaving a gap in the center of each edge)
  const segments = [
    { name: "top-l", edge: "top" },
    { name: "top-r", edge: "top" },
    { name: "bottom-l", edge: "bottom" },
    { name: "bottom-r", edge: "bottom" },
    { name: "left-t", edge: "left" },
    { name: "left-b", edge: "left" },
    { name: "right-t", edge: "right" },
    { name: "right-b", edge: "right" }
  ];

  segments.forEach(seg => {
    const div = document.createElement("div");
    div.className = `resize-edge ${seg.name}`;
    div.dataset.edge = seg.edge;
    el.appendChild(div);
  });
  
  const corner = document.createElement("div");
  corner.className = "resize-corner bottom-right";
  corner.dataset.edge = "bottom-right";
  el.appendChild(corner);

  // Bind mousedown to all handles
  el.querySelectorAll(".resize-edge, .resize-corner").forEach(handle => {
    handle.addEventListener("mousedown", e => {
      e.stopPropagation();
      e.preventDefault();
      const edge = handle.dataset.edge;
      const t = getTransform(canvasId);
      const startX = e.clientX, startY = e.clientY;
      const startW = node.w, startH = node.h;
      const startNodeX = node.x, startNodeY = node.y;
      isResizing = true;
      
      const onMove = e2 => {
        const dx = (e2.clientX - startX) / t.scale;
        const dy = (e2.clientY - startY) / t.scale;
        
        if (edge === "right") {
          node.w = Math.max(180, startW + dx);
        } else if (edge === "left") {
          const newW = Math.max(180, startW - dx);
          node.x = startNodeX + startW - newW;
          node.w = newW;
        } else if (edge === "bottom") {
          node.h = Math.max(80, startH + dy);
        } else if (edge === "top") {
          const newH = Math.max(80, startH - dy);
          node.y = startNodeY + startH - newH;
          node.h = newH;
        } else if (edge === "bottom-right") {
          node.w = Math.max(180, startW + dx);
          node.h = Math.max(80, startH + dy);
        }
        
        el.style.width = node.w + "px";
        el.style.height = node.h + "px";
        el.style.left = node.x + "px";
        el.style.top = node.y + "px";
        
        renderAllArrows(canvasId);
      };
      
      const onUp = () => {
        isResizing = false;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        setDirty(true);
      };
      
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });
  });
}

// ────────────────────────────────────────────────────────────────────
//  CONNECTORS / ARROWS
// ────────────────────────────────────────────────────────────────────
function bindConnectors(el, node, canvasId) {
  const dots = {};
  el.querySelectorAll(".conn-dot").forEach(dot => {
    const side = dot.classList[1]; // right/left/bottom/top
    dots[side] = dot;
    dot.addEventListener("mousedown", e => {
      e.stopPropagation();
      e.preventDefault();
      isDrawingArrow = true;
      arrowStartNodeId = node.id;
      arrowStartSide = side;
      arrowCanvasId = canvasId;
      // Draw temporary arrow line
      const svg = document.getElementById("svg-" + canvasId);
      if (svg) {
        const tmpLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
        tmpLine.id = "tmp-arrow-line";
        tmpLine.setAttribute("stroke", "color-mix(in srgb, var(--accent) 50%, transparent)");
        tmpLine.setAttribute("stroke-width", "2");
        tmpLine.setAttribute("stroke-dasharray", "6 3");
        tmpLine.setAttribute("pointer-events", "none");
        svg.appendChild(tmpLine);
      }
    });
  });

  // Only the single connector dot nearest the cursor should be visible, and
  // only once the cursor gets close to one of the four edge midpoints —
  // not just anywhere over the node body. Distances are measured in real
  // screen pixels so the reach feels consistent at any zoom level.
  const PROXIMITY = 56; // px

  function clearActive() {
    Object.values(dots).forEach(d => d.classList.remove("active"));
  }

  el.addEventListener("mousemove", e => {
    if (isDragging || isResizing || isDrawingArrow) return;
    const rect = el.getBoundingClientRect();
    const mx = e.clientX, my = e.clientY;

    const points = {
      right:  { x: rect.right,            y: rect.top + rect.height / 2 },
      left:   { x: rect.left,             y: rect.top + rect.height / 2 },
      bottom: { x: rect.left + rect.width / 2, y: rect.bottom },
      top:    { x: rect.left + rect.width / 2, y: rect.top    },
    };

    let nearestSide = null, nearestDist = Infinity;
    for (const side in points) {
      const p = points[side];
      const d = Math.hypot(mx - p.x, my - p.y);
      if (d < nearestDist) { nearestDist = d; nearestSide = side; }
    }

    if (nearestSide && nearestDist <= PROXIMITY) {
      Object.entries(dots).forEach(([side, d]) => {
        d.classList.toggle("active", side === nearestSide);
      });
    } else {
      clearActive();
    }
  });

  el.addEventListener("mouseleave", clearActive);
}

function getNodeCenter(node) {
  return { x: node.x + node.w / 2, y: node.y + node.h / 2 };
}

function getConnectorPos(node, side) {
  switch(side) {
    case "right":  return { x: node.x + node.w, y: node.y + node.h / 2 };
    case "left":   return { x: node.x,           y: node.y + node.h / 2 };
    case "bottom": return { x: node.x + node.w / 2, y: node.y + node.h };
    case "top":    return { x: node.x + node.w / 2, y: node.y };
    default:       return getNodeCenter(node);
  }
}

function getBezierCenter(p0, p1, p2, p3) {
  const x = 0.125 * p0.x + 0.375 * p1.x + 0.375 * p2.x + 0.125 * p3.x;
  const y = 0.125 * p0.y + 0.375 * p1.y + 0.375 * p2.y + 0.125 * p3.y;
  return { x, y };
}

function renderAllArrows(canvasId) {
  const svg = document.getElementById("svg-" + canvasId);
  if (!svg) return;
  const cv = canvasData[canvasId];
  if (!cv) return;
  const t = getTransform(canvasId);
  svg.innerHTML = "";

  // Everything below is drawn in CANVAS-SPACE (real node x/y/w/h, unscaled).
  // A single <g transform="translate(...) scale(...)"> mirrors the same
  // transform already applied to .canvas-nodes via CSS, so arrowheads,
  // stroke widths, and the note box all scale together with the boxes —
  // same relative size at any zoom level, just like Figma/Obsidian.
  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  g.setAttribute("transform", `translate(${t.x},${t.y}) scale(${t.scale})`);
  svg.appendChild(g);

  // Defs with canvas-space arrowheads — sized in the SAME units as node
  // x/y/w/h, so they scale 1:1 with the boxes via the <g> transform above.
  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  const ARROW_W = 10;
  const ARROW_H = 7;
  const refX = ARROW_W - 1; // pull tip in slightly so the polygon's point sits at the path end
  const refY = ARROW_H / 2;
  const polyPoints = `0 0, ${ARROW_W} ${refY}, 0 ${ARROW_H}`;

  defs.innerHTML = `
    <marker id="ah-${canvasId}" markerUnits="userSpaceOnUse" markerWidth="${ARROW_W}" markerHeight="${ARROW_H}" refX="${refX}" refY="${refY}" orient="auto">
      <polygon points="${polyPoints}" fill="var(--accent)"/>
    </marker>
    <marker id="ah-sel-${canvasId}" markerUnits="userSpaceOnUse" markerWidth="${ARROW_W}" markerHeight="${ARROW_H}" refX="${refX}" refY="${refY}" orient="auto">
      <polygon points="${polyPoints}" fill="var(--accent)"/>
    </marker>`;
  g.appendChild(defs);

  // Canvas-space stroke width (will visually scale with zoom via the <g>).
  const STROKE_WIDTH = 2;
  const ARROW_GAP = ARROW_W - refX + 1;

  cv.arrows.forEach(arrow => {
    const fromNode = cv.nodes.find(n => n.id === arrow.from);
    const toNode = cv.nodes.find(n => n.id === arrow.to);
    if (!fromNode || !toNode) return;
    const fp = getConnectorPos(fromNode, arrow.fromSide);
    const tp = getConnectorPos(toNode, arrow.toSide || "left");
    // Canvas-space coordinates — no scale/pan baked in, the <g> handles that.
    const fx = fp.x, fy = fp.y;
    const tx = tp.x, ty = tp.y;
    // Obsidian-style routing: each endpoint's control point sits a roughly
    // fixed distance straight out from the node, along the connector side's
    // direction — independent of how far apart the nodes are. This keeps the
    // line straight near each box and bending only in the middle, instead of
    // a single symmetric bulge that gets fatter the further apart nodes are
    // (which is how a plain proportional-tension bezier looks).
    const dist = Math.hypot(tx - fx, ty - fy);
    // Stub length grows a little for very short hops (so it doesn't look like
    // a sharp kink at point-blank range) but saturates quickly — it does NOT
    // keep scaling up for long connections the way the old TENSION did.
    const STUB = Math.max(30, Math.min(dist * 0.5, 80));
    function cpDir(side) {
      switch(side) {
        case "right":  return [ STUB, 0];
        case "left":   return [-STUB, 0];
        case "bottom": return [0,  STUB];
        case "top":    return [0, -STUB];
        default:       return [0, 0];
      }
    }
    const [fcx, fcy] = cpDir(arrow.fromSide || "right");
    const [tcx, tcy] = cpDir(arrow.toSide   || "left");
    const d = `M${fx},${fy} C${fx+fcx},${fy+fcy} ${tx+tcx},${ty+tcy} ${tx},${ty}`;
    const isSel = selectedArrowId === arrow.id;
    // Hit area
    const hit = document.createElementNS("http://www.w3.org/2000/svg", "path");
    hit.setAttribute("d", d);
    hit.setAttribute("class", "arrow-hit");
    hit.addEventListener("click", e => {
      e.stopPropagation();
      if (document.activeElement) document.activeElement.blur();
      selectedArrowId = arrow.id;
      selectedNodeId = null;
      document.querySelectorAll(".c-node.selected").forEach(n => n.classList.remove("selected"));
      renderAllArrows(canvasId);
    });
    hit.addEventListener("dblclick", e => {
      e.stopPropagation();
      selectedArrowId = arrow.id;
      selectedNodeId = null;
      editingArrowNoteId = arrow.id;
      document.querySelectorAll(".c-node.selected").forEach(n => n.classList.remove("selected"));
      renderAllArrows(canvasId);
      setTimeout(() => {
        const pageEl = document.getElementById("cv-" + canvasId);
        const editor = pageEl?.querySelector(`.arrow-label-fo[data-arrow-id="${arrow.id}"] .arrow-label-editor`);
        if (editor) {
          editor.focus();
          const range = document.createRange();
          range.selectNodeContents(editor);
          range.collapse(false);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }, 50);
    });
    hit.addEventListener("contextmenu", e => {
      e.preventDefault(); e.stopPropagation();
      if (document.activeElement) document.activeElement.blur();
      selectedArrowId = arrow.id;
      selectedNodeId = null;
      document.querySelectorAll(".c-node.selected").forEach(n => n.classList.remove("selected"));
      renderAllArrows(canvasId);
      showCtxMenu(e, { type: "arrow", arrowId: arrow.id });
    });
    g.appendChild(hit);

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("class", "arrow-path" + (isSel ? " selected" : ""));
    path.setAttribute("stroke-width", STROKE_WIDTH);
    path.setAttribute("marker-end", `url(#${isSel ? "ah-sel-" : "ah-"}${canvasId})`);
    path.setAttribute("d", d);

    // Trim the visible line so it stops right where the arrowhead begins,
    // instead of drawing the full-length line underneath the marker (which
    // is what made the curve look like it started inside/under the
    // rectangle). All distances here are canvas-space units, scaled
    // automatically by the <g> like everything else.
    try {
      const total = hit.getTotalLength();
      if (total > ARROW_GAP) {
        path.setAttribute("pathLength", total);
        path.setAttribute("stroke-dasharray", `${total - ARROW_GAP} ${ARROW_GAP + 1}`);
        path.setAttribute("stroke-dashoffset", "0");
      }
    } catch (e) { /* fall back to full-length path, no trimming */ }
    g.appendChild(path);

    // Midpoint note editor (Obsidian style) — also canvas-space, so the
    // note box scales together with the boxes instead of staying a fixed
    // screen size.
    let mid;
    try {
      const pathLength = path.getTotalLength();
      if (pathLength > 0) {
        mid = path.getPointAtLength(pathLength / 2);
      } else {
        mid = getBezierCenter(
          { x: fx, y: fy },
          { x: fx + fcx, y: fy + fcy },
          { x: tx + tcx, y: ty + tcy },
          { x: tx, y: ty }
        );
      }
    } catch (e) {
      mid = getBezierCenter(
        { x: fx, y: fy },
        { x: fx + fcx, y: fy + fcy },
        { x: tx + tcx, y: ty + tcy },
        { x: tx, y: ty }
      );
    }

    const isEditing = editingArrowNoteId === arrow.id;
    if (arrow.label || isEditing) {
      const fo = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
      const foWidth = 240;
      const foHeight = 100;
      fo.setAttribute("x", mid.x - foWidth / 2);
      fo.setAttribute("y", mid.y - foHeight / 2);
      fo.setAttribute("width", foWidth);
      fo.setAttribute("height", foHeight);
      fo.setAttribute("class", "arrow-label-fo");
      fo.setAttribute("data-arrow-id", arrow.id);

      const wrap = document.createElement("div");
      wrap.className = "arrow-label-wrap";

      const editor = document.createElement("div");
      editor.className = "arrow-label-editor";
      editor.contentEditable = true;
      editor.setAttribute("placeholder", "...");
      editor.innerText = arrow.label || "";

      editor.addEventListener("input", () => {
        arrow.label = editor.innerText.trim();
        setDirty(true);
      });
      editor.addEventListener("blur", () => {
        const text = editor.innerText.trim();
        arrow.label = text;
        editingArrowNoteId = null;
        setDirty(true);
        saveToLS();
        renderAllArrows(canvasId);
      });
      editor.addEventListener("mousedown", e => e.stopPropagation());
      editor.addEventListener("dblclick", e => e.stopPropagation());
      editor.addEventListener("keydown", e => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          editor.blur();
        }
        e.stopPropagation();
      });

      wrap.appendChild(editor);
      fo.appendChild(wrap);
      g.appendChild(fo);
    }
  });
}

// ────────────────────────────────────────────────────────────────────
//  CANVAS EVENTS (pan, zoom, double-click, arrow drawing, context menu)
// ────────────────────────────────────────────────────────────────────
function bindCanvasEvents(page, id, nodes, svg) {
  let isMarquee = false;
  let marqueeStartX = 0, marqueeStartY = 0;
  let marqueeDiv = null;

  page.addEventListener("mousedown", e => {
    const isCanvasBg = (e.target === page || e.target.classList.contains("canvas-nodes") || e.target.classList.contains("canvas-page"));
    const startPanning = ((isSpaceDown && e.button === 0) || e.button === 1);

    if (isCanvasBg) {
      if (e.button === 0 && !e.shiftKey && !startPanning) {
        selectedNodeId = null;
        selectedNodeIds.clear();
        selectedArrowId = null;
        document.querySelectorAll(".c-node.selected").forEach(n => n.classList.remove("selected"));
        renderAllArrows(id);
      }

      // Marquee selection start
      if (e.button === 0 && !startPanning) {
        isMarquee = true;
        const rect = page.getBoundingClientRect();
        marqueeStartX = e.clientX - rect.left;
        marqueeStartY = e.clientY - rect.top;
        
        marqueeDiv = document.createElement("div");
        marqueeDiv.className = "marquee-select";
        marqueeDiv.style.left = marqueeStartX + "px";
        marqueeDiv.style.top = marqueeStartY + "px";
        marqueeDiv.style.width = "0px";
        marqueeDiv.style.height = "0px";
        page.appendChild(marqueeDiv);
        e.preventDefault();
      }
    }

    if (startPanning) {
      isPanning = true;
      panStartX = e.clientX;
      panStartY = e.clientY;
      page.classList.add("panning");
      e.preventDefault();
    }
  });

  // Arrow drawing — finalize on mouseup on node
  document.addEventListener("mouseup", e => {
    if (isDrawingArrow) {
      // Clean up temp line
      const tmpLine = document.getElementById("tmp-arrow-line");
      if (tmpLine) tmpLine.remove();

      isDrawingArrow = false;
      const cid = arrowCanvasId || id;
      const target = document.elementFromPoint(e.clientX, e.clientY);
      const targetEl = target ? target.closest(".c-node") : null;
      if (targetEl && targetEl.dataset.nodeId && targetEl.dataset.nodeId !== arrowStartNodeId) {
        const toId = targetEl.dataset.nodeId;
        const cv = canvasData[cid];
        if (!cv) return;
        const fromNode = cv.nodes.find(n => n.id === arrowStartNodeId);
        const toNode = cv.nodes.find(n => n.id === toId);
        if (fromNode && toNode) {
          // Check not duplicate
          const exists = cv.arrows.some(a => a.from === arrowStartNodeId && a.to === toId);
          if (!exists) {
            // If mouse released directly on a conn-dot, honour that side exactly
            const dotEl = target && target.classList.contains("conn-dot") ? target : null;
            let toSide;
            if (dotEl) {
              // conn-dot has classes ["conn-dot", side]
              toSide = ["right","left","top","bottom"].find(s => dotEl.classList.contains(s)) || "left";
            } else {
              // Geometric fallback: pick face of toNode closest to the from-connector
              const fcp = getConnectorPos(fromNode, arrowStartSide);
              toSide = ["left","right","top","bottom"].reduce((best, s) => {
                const p = getConnectorPos(toNode, s);
                const d = Math.hypot(fcp.x - p.x, fcp.y - p.y);
                return d < best.d ? { s, d } : best;
              }, { s: "left", d: Infinity }).s;
            }
            snapshotUndo(cid);
            cv.arrows.push({ id: generateId(), from: arrowStartNodeId, fromSide: arrowStartSide, to: toId, toSide });
            renderAllArrows(cid);
            setDirty(true);
          }
        }
      }
      arrowCanvasId = null;
    }
    if (isMarquee) {
      isMarquee = false;
      if (marqueeDiv) {
        marqueeDiv.remove();
        marqueeDiv = null;
      }
      selectedNodeId = selectedNodeIds.size > 0 ? [...selectedNodeIds][0] : null;
      renderAllArrows(id);
    }
    if (isPanning) {
      isPanning = false;
      page.classList.remove("panning");
    }
  });

  document.addEventListener("mousemove", e => {
    if (isPanning) {
      const t = getTransform(id);
      t.x += e.clientX - panStartX;
      t.y += e.clientY - panStartY;
      panStartX = e.clientX; panStartY = e.clientY;
      applyTransform(nodes, id);
      renderAllArrows(id);
    }
    if (isMarquee && marqueeDiv) {
      const rect = page.getBoundingClientRect();
      const curX = e.clientX - rect.left;
      const curY = e.clientY - rect.top;
      
      const x = Math.min(marqueeStartX, curX);
      const y = Math.min(marqueeStartY, curY);
      const w = Math.abs(marqueeStartX - curX);
      const h = Math.abs(marqueeStartY - curY);
      
      marqueeDiv.style.left = x + "px";
      marqueeDiv.style.top = y + "px";
      marqueeDiv.style.width = w + "px";
      marqueeDiv.style.height = h + "px";
      
      // Calculate marquee box in canvas coordinates
      const t = getTransform(id);
      const cx = (x - t.x) / t.scale;
      const cy = (y - t.y) / t.scale;
      const cw = w / t.scale;
      const ch = h / t.scale;
      
      const cv = canvasData[id];
      if (cv) {
        cv.nodes.forEach(n => {
          const nodeEl = document.getElementById("node-" + n.id);
          const intersect = (n.x < cx + cw) && (n.x + n.w > cx) && (n.y < cy + ch) && (n.y + n.h > cy);
          
          if (intersect) {
            selectedNodeIds.add(n.id);
            if (nodeEl) nodeEl.classList.add("selected");
          } else if (!e.shiftKey) {
            selectedNodeIds.delete(n.id);
            if (nodeEl) nodeEl.classList.remove("selected");
          }
        });
      }
    }
    if (isDrawingArrow && arrowCanvasId === id) {
      const tmpLine = document.getElementById("tmp-arrow-line");
      if (tmpLine && arrowStartNodeId) {
        const cv = canvasData[id];
        const fromNode = cv && cv.nodes.find(n => n.id === arrowStartNodeId);
        if (fromNode) {
          const t = getTransform(id);
          const fp = getConnectorPos(fromNode, arrowStartSide);
          const fx = fp.x * t.scale + t.x, fy = fp.y * t.scale + t.y;
          const pageRect = page.getBoundingClientRect();
          const mx = e.clientX - pageRect.left, my = e.clientY - pageRect.top;
          tmpLine.setAttribute("x1", fx); tmpLine.setAttribute("y1", fy);
          tmpLine.setAttribute("x2", mx); tmpLine.setAttribute("y2", my);
        }
      }
    }
  });

  // Zoom
  page.addEventListener("wheel", e => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const t = getTransform(id);
    const rect = page.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const delta = e.deltaY < 0 ? 1.1 : 0.9;
    const newScale = Math.max(0.1, Math.min(3, t.scale * delta));
    t.x = mx - (mx - t.x) * (newScale / t.scale);
    t.y = my - (my - t.y) * (newScale / t.scale);
    t.scale = newScale;
    applyTransform(nodes, id);
    renderAllArrows(id);
  }, { passive: false });

  // Double click → new rect
  page.addEventListener("dblclick", e => {
    if (e.target.closest(".c-node") || e.target.closest("#ctxMenu") || e.target.closest("#slashMenu")) return;
    const t = getTransform(id);
    const rect = page.getBoundingClientRect();
    const cx = (e.clientX - rect.left - t.x) / t.scale;
    const cy = (e.clientY - rect.top - t.y) / t.scale;
    snapshotUndo(id);
    const node = { id: generateId(), type: "rect", x: cx - 140, y: cy - 50, w: 280, h: 130, title: "", content: "" };
    canvasData[id].nodes.push(node);
    renderNode(node, id);
    updateEmptyHint(id);
    setDirty(true);
    // Focus description
    setTimeout(() => {
      const el = document.getElementById("node-" + node.id);
      if (el) { const desc = el.querySelector(".c-node-desc"); if (desc) desc.focus(); }
    }, 50);
  });

  // Context menu
  page.addEventListener("contextmenu", e => {
    if (e.target.closest(".c-node")) return;
    e.preventDefault();
    showCtxMenu(e, { type: "canvas", canvasId: id });
  });

  // Drop from sidebar (songs, folders, or canvases)
  page.addEventListener("dragover", e => e.preventDefault());
  page.addEventListener("drop", e => {
    e.preventDefault();
    const t    = getTransform(id);
    const rect = page.getBoundingClientRect();
    const cx   = (e.clientX - rect.left - t.x) / t.scale;
    const cy   = (e.clientY - rect.top  - t.y) / t.scale;

    // Canvas drag-drop
    const refCanvasId = e.dataTransfer.getData("canvas-id");
    if (refCanvasId && refCanvasId !== id) {
      snapshotUndo(id);
      const node = { id: generateId(), type: "canvas", x: cx - 120, y: cy - 50, w: 240, h: 90, refCanvasId };
      canvasData[id].nodes.push(node); renderNode(node, id); updateEmptyHint(id); setDirty(true);
      return;
    }

    // Song drag-drop → Audio node
    const path = e.dataTransfer.getData("song-path");
    if (path) {
      snapshotUndo(id);
      const node = { id: generateId(), type: "audio", x: cx - 150, y: cy - 60, w: 300, h: 130, filePath: path, content: "" };
      canvasData[id].nodes.push(node); renderNode(node, id); updateEmptyHint(id); setDirty(true);
      return;
    }

    // Folder drag-drop → Project node
    const folderSourceId = e.dataTransfer.getData("folder-sourceId");
    if (folderSourceId) {
      const folderPath = e.dataTransfer.getData("folder-path") || "";
      const folderName = e.dataTransfer.getData("folder-name") || "Project";
      snapshotUndo(id);
      const node = {
        id: generateId(), type: "project",
        x: cx - 160, y: cy - 150, w: 320, h: 300,
        projectSourceId: folderSourceId, projectFolderPath: folderPath,
        content: ""
      };
      canvasData[id].nodes.push(node); renderNode(node, id); updateEmptyHint(id); setDirty(true);
      return;
    }
  });
}

// Make sidebar songs draggable
function makeDraggable(el, filePath) {
  el.draggable = true;
  el.addEventListener("dragstart", e => {
    e.dataTransfer.setData("song-path", filePath);
  });
}

// ────────────────────────────────────────────────────────────────────
//  SELECT / DELETE
// ────────────────────────────────────────────────────────────────────
function selectNode(nodeId, canvasId, isMulti = false) {
  if (!isMulti) {
    selectedNodeIds.clear();
    selectedNodeIds.add(nodeId);
    selectedNodeId = nodeId;
    selectedArrowId = null;
    document.querySelectorAll(".c-node.selected").forEach(n => n.classList.remove("selected"));
    const el = document.getElementById("node-" + nodeId);
    if (el) el.classList.add("selected");
  } else {
    selectedArrowId = null;
    if (selectedNodeIds.has(nodeId)) {
      selectedNodeIds.delete(nodeId);
      const el = document.getElementById("node-" + nodeId);
      if (el) el.classList.remove("selected");
    } else {
      selectedNodeIds.add(nodeId);
      const el = document.getElementById("node-" + nodeId);
      if (el) el.classList.add("selected");
    }
    selectedNodeId = selectedNodeIds.size > 0 ? [...selectedNodeIds][selectedNodeIds.size - 1] : null;
  }
  renderAllArrows(canvasId);
}

function deleteSelected(canvasId) {
  if (!canvasId) return;
  const cv = canvasData[canvasId];
  if (!cv) return;
  if (selectedNodeIds.size > 0) {
    snapshotUndo(canvasId);
    selectedNodeIds.forEach(nodeId => {
      cv.nodes = cv.nodes.filter(n => n.id !== nodeId);
      cv.arrows = cv.arrows.filter(a => a.from !== nodeId && a.to !== nodeId);
      const el = document.getElementById("node-" + nodeId);
      if (el) el.remove();
    });
    selectedNodeIds.clear();
    selectedNodeId = null;
    renderAllArrows(canvasId);
    updateEmptyHint(canvasId);
    setDirty(true);
  } else if (selectedNodeId) {
    snapshotUndo(canvasId);
    cv.nodes = cv.nodes.filter(n => n.id !== selectedNodeId);
    cv.arrows = cv.arrows.filter(a => a.from !== selectedNodeId && a.to !== selectedNodeId);
    const el = document.getElementById("node-" + selectedNodeId);
    if (el) el.remove();
    selectedNodeId = null;
    selectedNodeIds.clear();
    renderAllArrows(canvasId);
    updateEmptyHint(canvasId);
    setDirty(true);
  } else if (selectedArrowId) {
    snapshotUndo(canvasId);
    cv.arrows = cv.arrows.filter(a => a.id !== selectedArrowId);
    selectedArrowId = null;
    renderAllArrows(canvasId);
    setDirty(true);
  }
}

// ────────────────────────────────────────────────────────────────────
//  UNDO
// ────────────────────────────────────────────────────────────────────
function snapshotUndo(canvasId) {
  if (!undoStacks[canvasId]) undoStacks[canvasId] = [];
  const cv = canvasData[canvasId];
  undoStacks[canvasId].push(JSON.stringify({ nodes: cv.nodes, arrows: cv.arrows }));
  if (undoStacks[canvasId].length > 50) undoStacks[canvasId].shift();
}

function undo(canvasId) {
  if (!undoStacks[canvasId] || !undoStacks[canvasId].length) return;
  const snapshot = JSON.parse(undoStacks[canvasId].pop());
  const cv = canvasData[canvasId];
  // Clear rendered nodes
  const nodesEl = document.getElementById("nodes-" + canvasId);
  if (nodesEl) nodesEl.innerHTML = "";
  cv.nodes = snapshot.nodes;
  cv.arrows = snapshot.arrows;
  cv.nodes.forEach(n => renderNode(n, canvasId));
  renderAllArrows(canvasId);
  updateEmptyHint(canvasId);
  setDirty(true);
}

// ────────────────────────────────────────────────────────────────────
//  ZOOM TO FIT
// ────────────────────────────────────────────────────────────────────
function zoomToFit(canvasId) {
  const cv = canvasData[canvasId];
  if (!cv || cv.nodes.length === 0) return;
  const canvasEl = document.getElementById("canvasArea");
  const cw = canvasEl.offsetWidth, ch = canvasEl.offsetHeight;
  const minX = Math.min(...cv.nodes.map(n => n.x));
  const minY = Math.min(...cv.nodes.map(n => n.y));
  const maxX = Math.max(...cv.nodes.map(n => n.x + n.w));
  const maxY = Math.max(...cv.nodes.map(n => n.y + n.h));
  const contentW = maxX - minX + 80, contentH = maxY - minY + 80;
  const scale = Math.min(1, Math.min(cw / contentW, ch / contentH));
  const t = getTransform(canvasId);
  t.scale = scale;
  t.x = (cw - contentW * scale) / 2 - minX * scale + 40 * scale;
  t.y = (ch - contentH * scale) / 2 - minY * scale + 40 * scale;
  const nodesEl = document.getElementById("nodes-" + canvasId);
  if (nodesEl) applyTransform(nodesEl, canvasId);
  renderAllArrows(canvasId);
}

// ────────────────────────────────────────────────────────────────────
//  CONTEXT MENU
// ────────────────────────────────────────────────────────────────────
function showCtxMenu(e, meta) {
  ctxMenuTarget = meta;
  const menu = document.getElementById("ctxMenu");
  menu.style.display = "block";
  menu.style.left = Math.min(e.clientX, window.innerWidth - 220) + "px";
  menu.style.top = Math.min(e.clientY, window.innerHeight - 320) + "px";
  // Show/hide relevant items
  const isNode = meta.type === "node";
  menu.querySelector("[data-action=duplicate]").style.display = isNode ? "" : "none";
  menu.querySelector("[data-action=delete]").style.display = (isNode || selectedArrowId) ? "" : "none";
}

// ────────────────────────────────────────────────────────────────────
//  CANVAS NODE NAVIGATION
// ────────────────────────────────────────────────────────────────────
function openCanvasNodeWithAnimation(refCanvasId, fromCanvasId, fromNodeId) {
  if (!canvasData[refCanvasId]) return;
   
  // Push current state to history
  canvasNavHistory.push({ canvasId: fromCanvasId, nodeId: fromNodeId });
   
  // Animate zoom from the node to the full canvas
  const fromNode = canvasData[fromCanvasId].nodes.find(n => n.id === fromNodeId);
  if (!fromNode) {
    if (!openTabs.includes(refCanvasId)) openTabs.push(refCanvasId);
    renderTabs();
    switchTab(refCanvasId);
    return;
  }
   
  // Get current transform
  const t = getTransform(fromCanvasId);
  const nodeScreenX = fromNode.x * t.scale + t.x;
  const nodeScreenY = fromNode.y * t.scale + t.y;
  const nodeScreenW = fromNode.w * t.scale;
  const nodeScreenH = fromNode.h * t.scale;
   
  // Switch to the referenced canvas
  if (!openTabs.includes(refCanvasId)) openTabs.push(refCanvasId);
  renderTabs();
  switchTab(refCanvasId);
   
  // After switch, animate zoom to fit
  setTimeout(() => {
    const refT = getTransform(refCanvasId);
    const startScale = refT.scale;
    const startX = refT.x;
    const startY = refT.y;
     
    zoomToFit(refCanvasId);
     
    const endT = getTransform(refCanvasId);
    const endScale = endT.scale;
    const endX = endT.x;
    const endY = endT.y;
     
    // Animate from node position to fit
    const duration = 400;
    const startTime = Date.now();
    const nodesEl = document.getElementById("nodes-" + refCanvasId);
     
    function animateZoom() {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = progress < 0.5 
        ? 2 * progress * progress 
        : -1 + 4 * progress - 2 * progress * progress;
       
      refT.scale = startScale + (endScale - startScale) * easeProgress;
      refT.x = startX + (endX - startX) * easeProgress;
      refT.y = startY + (endY - startY) * easeProgress;
       
      if (nodesEl) applyTransform(nodesEl, refCanvasId);
      renderAllArrows(refCanvasId);
       
      if (progress < 1) {
        requestAnimationFrame(animateZoom);
      }
    }
     
    animateZoom();
  }, 50);
}
 
function goBackFromCanvasNode() {
  if (canvasNavHistory.length === 0) return;
   
  const prev = canvasNavHistory.pop();
  switchTab(prev.canvasId);
   
  // Select the node we came from
  selectNode(prev.nodeId, prev.canvasId, false);
  
  // Update back button visibility
  updateBackButtonVisibility();
}

document.getElementById("ctxMenu").addEventListener("click", e => {
  const item = e.target.closest(".ctx-item");
  if (!item) return;
  const action = item.dataset.action;
  const meta = ctxMenuTarget;
  document.getElementById("ctxMenu").style.display = "none";
  const cid = activeTabId;
  const cv = cid ? canvasData[cid] : null;

  switch(action) {
    case "newRect":
      if (cid) createNode("rect", {}, cid); break;
    case "undo": if (cid) undo(cid); break;
    case "save": saveToLS(); break;
    case "zoomFit": if (cid) zoomToFit(cid); break;
    case "newCanvas": openAddCanvasModal(); break;
    case "addExistingCanvas":
      if (cid) {
        // Create a canvas-ref node then immediately open picker
        const refNode = createNode("canvas", { refCanvasId: null }, cid);
        if (refNode) {
          const el = document.getElementById("node-" + refNode.id);
          if (el) {
            const pickBtn = el.querySelector(".c-canvas-ref-pick");
            if (pickBtn) setTimeout(() => pickBtn.click(), 50);
          }
        }
      }
      break;
    case "addNewCanvas": {
      // Create new canvas + immediately add a canvas-ref node pointing to it
      const newId = generateId();
      const newName = "Canvas " + (Object.keys(canvasData).length + 1);
      canvasData[newId] = { name: newName, nodes: [], arrows: [] };
      openTabs.push(newId);
      renderTabs();
      setDirty(true);
      if (cid) {
        createNode("canvas", { refCanvasId: newId }, cid);
      }
      break;
    }
    case "paste":
      if (clipboard && cid) {
        snapshotUndo(cid);
        const node = { ...JSON.parse(JSON.stringify(clipboard)), id: generateId(), x: clipboard.x + 20, y: clipboard.y + 20 };
        canvasData[cid].nodes.push(node); renderNode(node, cid); setDirty(true);
      }
      break;
    case "duplicate":
      if (meta.nodeId && cid) {
        const orig = cv && cv.nodes.find(n => n.id === meta.nodeId);
        if (orig) {
          snapshotUndo(cid);
          const node = { ...JSON.parse(JSON.stringify(orig)), id: generateId(), x: orig.x + 24, y: orig.y + 24 };
          cv.nodes.push(node); renderNode(node, cid); setDirty(true);
        }
      }
      break;
    case "delete":
      if (selectedArrowId) {
        deleteSelected(cid);
      } else {
        pendingDeleteCallback = () => {
          if (meta && meta.nodeId) { selectNode(meta.nodeId, cid); }
          deleteSelected(cid);
        };
        document.getElementById("deleteConfirm").classList.add("open");
      }
      break;
    case "zoomSel":
    case "panSel":
      if (selectedNodeIds.size > 0 && cid) {
        const nodesToFit = cv.nodes.filter(n => selectedNodeIds.has(n.id));
        if (nodesToFit.length === 0) break;
        
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
        
        const t = getTransform(cid);
        const canvasEl = document.getElementById("canvasArea");
        
        if (action === "zoomSel") {
          const pad = 40;
          const scaleX = (canvasEl.offsetWidth - pad * 2) / boxW;
          const scaleY = (canvasEl.offsetHeight - pad * 2) / boxH;
          t.scale = Math.max(0.2, Math.min(2.5, Math.min(scaleX, scaleY)));
        }
        
        t.x = canvasEl.offsetWidth / 2 - centerX * t.scale;
        t.y = canvasEl.offsetHeight / 2 - centerY * t.scale;
        
        const nodesEl = document.getElementById("nodes-" + cid);
        if (nodesEl) applyTransform(nodesEl, cid);
        renderAllArrows(cid);
      } else if (selectedNodeId && cid) {
        const node = cv && cv.nodes.find(n => n.id === selectedNodeId);
        if (!node) break;
        const t = getTransform(cid);
        const canvasEl = document.getElementById("canvasArea");
        t.x = canvasEl.offsetWidth / 2 - (node.x + node.w / 2) * t.scale;
        t.y = canvasEl.offsetHeight / 2 - (node.y + node.h / 2) * t.scale;
        const nodesEl = document.getElementById("nodes-" + cid);
        if (nodesEl) applyTransform(nodesEl, cid);
        renderAllArrows(cid);
      }
      break;
  }
});

document.addEventListener("click", e => {
  if (!e.target.closest("#ctxMenu")) document.getElementById("ctxMenu").style.display = "none";
  if (!e.target.closest("#slashMenu")) document.getElementById("slashMenu").style.display = "none";
  if (!e.target.closest("#explorerCtxMenu")) document.getElementById("explorerCtxMenu").style.display = "none";
});

// Delete modal
document.getElementById("deleteCancelBtn").addEventListener("click", () => {
  document.getElementById("deleteConfirm").classList.remove("open");
  pendingDeleteCallback = null;
});
document.getElementById("deleteConfirmBtn").addEventListener("click", () => {
  document.getElementById("deleteConfirm").classList.remove("open");
  if (pendingDeleteCallback) { pendingDeleteCallback(); pendingDeleteCallback = null; }
});

// ────────────────────────────────────────────────────────────────────
//  SLASH MENU
// ────────────────────────────────────────────────────────────────────
function openSlashMenu(e, canvasId, nodeId) {
  slashTarget = canvasId;
  slashNodeId = nodeId;
  const menu = document.getElementById("slashMenu");
  menu.style.display = "block";

  // Position near the cursor caret for keyboard events, or mouse position for mouse events
  let x = e.clientX, y = e.clientY;
  if (!x && !y) {
    // Keyboard event: use caret position
    const sel = window.getSelection();
    if (sel && sel.rangeCount) {
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      x = rect.left;
      y = rect.bottom + 4;
    } else {
      // Fallback to center of active node
      const nodeEl = document.getElementById("node-" + nodeId);
      if (nodeEl) {
        const r = nodeEl.getBoundingClientRect();
        x = r.left + 20;
        y = r.top + r.height / 2;
      }
    }
  } else {
    y = y + 10;
  }
  menu.style.left = Math.min(x, window.innerWidth - 240) + "px";
  menu.style.top = Math.min(y, window.innerHeight - 200) + "px";
}

document.getElementById("slashMenu").addEventListener("click", e => {
  const item = e.target.closest(".slash-item");
  if (!item) return;
  document.getElementById("slashMenu").style.display = "none";
  const action = item.dataset.action;
  const cid = slashTarget || activeTabId;
  switch(action) {
    case "rect":    createNode("rect", {}, cid); break;
    case "youtube": openYtModal(cid); break;
    case "spotify": openSpModal(cid); break;
    case "song":    openSongPicker(cid); break;
    case "project": openProjectPicker(cid); break;
    case "canvas":  createNode("canvas", { refCanvasId: null }, cid); break;
  }
});

function openProjectPicker(cid) {
  if (sources.length === 0) {
    showToast("Add a music source first (Sources button in toolbar)", 4000, "error");
    return;
  }
  // Create an empty project node, then immediately open folder picker
  const node = createNode("project", { projectSourceId: null, projectFolderPath: undefined }, cid);
  if (!node) return;
  setTimeout(() => {
    const el = document.getElementById("node-" + node.id);
    const pickBtn = el && el.querySelector(".proj-pick-btn");
    if (pickBtn) pickBtn.click();
  }, 50);
}

// ────────────────────────────────────────────────────────────────────
//  YOUTUBE MODAL
// ────────────────────────────────────────────────────────────────────
function openYtModal(cid) {
  document.getElementById("ytUrlInput").value = "";
  document.getElementById("ytModal").classList.add("open");
  document.getElementById("ytUrlInput").focus();
  document.getElementById("ytConfirmBtn").onclick = () => {
    const url = document.getElementById("ytUrlInput").value.trim();
    if (!url) return;
    document.getElementById("ytModal").classList.remove("open");
    createNode("youtube", { ytUrl: url }, cid || activeTabId);
  };
  document.getElementById("ytCancelBtn").onclick = () => document.getElementById("ytModal").classList.remove("open");
}
document.getElementById("ytUrlInput").addEventListener("keydown", e => {
  if (e.key === "Enter") document.getElementById("ytConfirmBtn").click();
});

// ────────────────────────────────────────────────────────────────────
//  SPOTIFY MODAL
// ────────────────────────────────────────────────────────────────────
function openSpModal(cid) {
  document.getElementById("spUrlInput").value = "";
  document.getElementById("spModal").classList.add("open");
  document.getElementById("spUrlInput").focus();
  document.getElementById("spConfirmBtn").onclick = () => {
    const url = document.getElementById("spUrlInput").value.trim();
    if (!url) return;
    document.getElementById("spModal").classList.remove("open");
    createNode("spotify", { spUrl: url }, cid || activeTabId);
  };
  document.getElementById("spCancelBtn").onclick = () => document.getElementById("spModal").classList.remove("open");
}
document.getElementById("spUrlInput").addEventListener("keydown", e => {
  if (e.key === "Enter") document.getElementById("spConfirmBtn").click();
});

// ────────────────────────────────────────────────────────────────────
//  SONG PICKER (slash menu → song)
// ────────────────────────────────────────────────────────────────────
function openSongPicker(cid) {
  // Reuse relocate modal UI
  pendingRelocateNodeId = null;
  relocateSelectedPath = null;
  document.getElementById("relocateModal").classList.add("open");
  document.querySelector("#relocateModal h3").innerHTML = '<span class="material-symbols-outlined">audio_file</span> Add Song';
  document.getElementById("relocateSearch").value = "";
  renderRelocateList("");
  document.getElementById("relocateConfirmBtn").onclick = () => {
    if (!relocateSelectedPath) return;
    document.getElementById("relocateModal").classList.remove("open");
    createNode("audio", { filePath: relocateSelectedPath }, cid || activeTabId);
  };
}

// ────────────────────────────────────────────────────────────────────
//  RELOCATE MODAL
// ────────────────────────────────────────────────────────────────────
function openRelocateModal(nodeId, canvasId) {
  pendingRelocateNodeId = nodeId;
  relocateSelectedPath = null;
  document.querySelector("#relocateModal h3").innerHTML = '<span class="material-symbols-outlined">folder</span> Relocate File';
  document.getElementById("relocateSearch").value = "";
  document.getElementById("relocateModal").classList.add("open");
  renderRelocateList("");
  document.getElementById("relocateConfirmBtn").onclick = () => {
    if (!relocateSelectedPath || !pendingRelocateNodeId) return;
    const cid = canvasId || activeTabId;
    const cv = canvasData[cid];
    if (cv) {
      const node = cv.nodes.find(n => n.id === pendingRelocateNodeId);
      if (node) {
        node.filePath = relocateSelectedPath;
        const el = document.getElementById("node-" + node.id);
        if (el) { el.remove(); renderNode(node, cid); }
      }
    }
    document.getElementById("relocateModal").classList.remove("open");
    setDirty(true);
  };
}

document.getElementById("relocateCancelBtn").addEventListener("click", () => {
  document.getElementById("relocateModal").classList.remove("open");
  document.getElementById("relocateSearch").disabled = false;
  document.getElementById("relocateSearch").placeholder = "Search songs...";
});

document.getElementById("relocateSearch").addEventListener("input", function() {
  renderRelocateList(this.value.toLowerCase().trim());
});

function renderRelocateList(term) {
  const list = document.getElementById("relocateList");
  list.innerHTML = "";
  const filtered = allSongs.filter(s => !term || s.name.toLowerCase().includes(term) || s.path.toLowerCase().includes(term));
  filtered.slice(0, 50).forEach(s => {
    const item = document.createElement("div");
    item.className = "relocate-item" + (relocateSelectedPath === s.path ? " selected" : "");
    item.innerHTML = `<span class="material-symbols-outlined" style="font-size:18px;color:var(--accent);">audio_file</span><span style="flex:1">${escHtml(baseName(s.name))}</span><span style="font-size:10px;color:var(--muted)">${escHtml(s.path)}</span>`;
    item.addEventListener("click", () => {
      relocateSelectedPath = s.path;
      list.querySelectorAll(".relocate-item").forEach(i => i.classList.remove("selected"));
      item.classList.add("selected");
    });
    list.appendChild(item);
  });
}

window.refreshCanvasNodes = function() {
  const cid = activeTabId;
  if (!cid) return;
  const cv = canvasData[cid];
  if (!cv) return;
  cv.nodes.forEach(node => {
    const el = document.getElementById("node-" + node.id);
    if (!el) return;
    if (node.type === "audio" && el.updateTags) {
      el.updateTags();
    } else if (node.type === "project" && el.updateProjectNode) {
      el.updateProjectNode();
    }
  });
};