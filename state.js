// ════════════════════════════════════════════════════════════════════
//  GLOBAL STATE + SHARED UTILITIES
// ════════════════════════════════════════════════════════════════════

// ── Default GitHub config (legacy / optional) ─────────────────────
const OWNER  = "kaebee2003";
const REPO   = "Song-Backup";
const WORKER = "https://meowsick-worker.nvkarthik2003.workers.dev";

// ── Data state ────────────────────────────────────────────────────
let repoTree  = {};      // { path: songObj } — unified across all sources
let allSongs  = [];      // [ songObj, ... ]  — unified across all sources
let repoReady = false;
let branch    = "main";
let songTags  = {};      // { filePath: [tag, ...] }
let canvasData = {};     // { canvasId: { name, nodes, arrows } }
let openTabs  = [];
let activeTabId  = null;
let activeSidebarTab = "files";
let activeViewType   = "root";
let filterTags = new Set();
let settings   = {
  autoSave: true,
  autoSaveInterval: 30,
  showWelcome: true,
  defaultCanvasFolder: null,
  viewType: 'root',
  saveToElectron: true
};
let sources    = [];     // [{ id, type:'local'|'github', name, ... }]

// ── Per-canvas state ───────────────────────────────────────────────
let transforms  = {};    // { canvasId: { x, y, scale } }
let undoStacks  = {};    // { canvasId: [snapshot, ...] }
let canvasNavHistory = [];  // [{ canvasId, nodeId }, ...] — navigation stack for embedded canvas nodes

// ── Interaction state ─────────────────────────────────────────────
let selectedNodeId  = null;
let selectedNodeIds = new Set();
let selectedArrowId = null;
let isDragging = false, isResizing = false;
let dragOffX = 0, dragOffY = 0;
let isPanning = false, panStartX = 0, panStartY = 0;
let isSpaceDown = false;
let isDrawingArrow = false, arrowStartNodeId = null, arrowStartSide = null, arrowCanvasId = null;
let pendingDeleteCallback  = null;
let pendingRelocateNodeId  = null;
let relocateSelectedPath   = null;
let tagModalFilePath = null;
let slashTarget = null;
let slashNodeId = null;
let clipboard   = null;
let ctxMenuTarget = null;
let isDirty = false;
let sidebarSearchTerm = "";

// ── Shared utilities (available to all scripts) ───────────────────
function escHtml(str) {
  return (str || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

let projectTags = {};    // { "sourceId:folderPath": [tag, ...] }
let tagModalIsFolder = false;

function getSongTags(file) {
  if (!file) return [];
  const tags = new Set(songTags[file.path] || []);
  if (file.sourceId) {
    let parent = file.parentPath;
    while (parent !== undefined) {
      const key = file.sourceId + ":" + parent;
      const pTags = projectTags[key] || [];
      pTags.forEach(t => tags.add(t));
      if (!parent) break;
      const lastSlash = parent.lastIndexOf("/");
      parent = lastSlash !== -1 ? parent.slice(0, lastSlash) : "";
    }
    const rootKey = file.sourceId + ":";
    const rTags = projectTags[rootKey] || [];
    rTags.forEach(t => tags.add(t));
  }
  return [...tags];
}
