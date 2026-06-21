// ════════════════════════════════════════════════════════════════════
//  GITHUB — API calls for optional GitHub sync
//  (fetchWithTimeout, setLoaderMsg, isAudio now live in sources.js)
// ════════════════════════════════════════════════════════════════════

const CANVAS_PATH  = "Canvases/data.json";
let canvasFileSha  = null;
let ghSaveInProgress = false;
let ghPendingSave    = false;

// ── Worker API helpers ────────────────────────────────────────────
function workerGhGet(src, repoPath, qs = "") {
  return fetchWithTimeout(
    `${src.worker}/api/repos/${src.owner}/${src.repo}/contents/${repoPath}?ref=${src.branch || "main"}${qs}`
  );
}
function workerGhPut(src, repoPath, bodyObj) {
  return fetch(`${src.worker}/api/repos/${src.owner}/${src.repo}/contents/${repoPath}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bodyObj)
  });
}

// ── UTF-8 safe base64 ─────────────────────────────────────────────
function toB64(str)   { return btoa(unescape(encodeURIComponent(str))); }
function fromB64(b64) { return decodeURIComponent(escape(atob(b64.replace(/\n/g, "")))); }

// ── Get active GitHub source ──────────────────────────────────────
function getGithubSource() {
  return sources.find(s => s.type === "github") || null;
}

// ── Load from GitHub (used for migration / first run) ────────────
async function loadFromGitHub() {
  const src = getGithubSource();
  if (!src) return;
  const res = await workerGhGet(src, CANVAS_PATH);
  if (res.status === 500) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Worker error");
  }
  if (res.status === 404) { canvasFileSha = null; return; }
  if (res.status === 401 || res.status === 403) throw new Error("GitHub auth failed");
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  if (json.message) throw new Error("GitHub API: " + json.message);
  if (!json.content) return;

  canvasFileSha = json.sha;
  const data = JSON.parse(fromB64(json.content));
  canvasData  = data.canvases  || {};
  songTags    = data.tags      || {};
  settings    = data.settings  || {};
  openTabs    = data.openTabs  || [];
  activeTabId = data.activeTab || null;
  // Mirror to localStorage
  saveToLocal();
  console.log("✓ Loaded from GitHub:", Object.keys(canvasData).length, "canvases");
}

// ── Save to GitHub ────────────────────────────────────────────────
async function saveToGitHub() {
  const src = getGithubSource();
  if (!src) return;
  if (ghSaveInProgress) { ghPendingSave = true; return; }
  ghSaveInProgress = true;
  setSaveStatus("saving");

  const payload = JSON.stringify({
    canvases:  canvasData,
    tags:      songTags,
    settings,
    openTabs,
    activeTab: activeTabId
  }, null, 2);

  try {
    // Fetch latest SHA if we don't have it
    if (!canvasFileSha) {
      const check = await workerGhGet(src, CANVAS_PATH);
      if (check.ok) {
        const j = await check.json();
        if (j.sha) canvasFileSha = j.sha;
      }
    }

    const body = {
      message: "chore: update canvas data [skip ci]",
      content: toB64(payload),
      branch:  src.branch || "main"
    };
    if (canvasFileSha) body.sha = canvasFileSha;

    const res = await workerGhPut(src, CANVAS_PATH, body);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      if (res.status === 409) {
        // SHA conflict — refetch and retry
        const r2 = await workerGhGet(src, CANVAS_PATH);
        if (r2.ok) { const j2 = await r2.json(); canvasFileSha = j2.sha; }
        ghSaveInProgress = false;
        return saveToGitHub();
      }
      throw new Error(err.message || "HTTP " + res.status);
    }
    const saved = await res.json();
    canvasFileSha = saved.content.sha;
    setDirty(false);
  } catch(e) {
    setSaveStatus("error", e.message);
    console.error("GitHub save error:", e);
  } finally {
    ghSaveInProgress = false;
    if (ghPendingSave) { ghPendingSave = false; saveToGitHub(); }
  }
}

// ── Loader error screen ───────────────────────────────────────────
function showLoaderError(msg) {
  const loader = document.getElementById("loader");
  if (!loader) return;
  loader.querySelector(".loader-ring").style.display = "none";
  const p = loader.querySelector("p");
  p.style.cssText = "color:#ff6b6b;letter-spacing:0;text-transform:none;font-size:13px;max-width:340px;line-height:1.8;white-space:pre-wrap;text-align:center";
  p.textContent = msg;
  const btn = document.createElement("button");
  btn.textContent = "↺ Retry";
  btn.style.cssText = "margin-top:20px;padding:10px 24px;border-radius:8px;border:1px solid var(--accent);background:transparent;color:var(--accent);font-size:12px;cursor:pointer;letter-spacing:normal;";
  btn.onclick = () => location.reload();
  loader.appendChild(btn);
}
