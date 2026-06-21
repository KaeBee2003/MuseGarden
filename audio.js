// ════════════════════════════════════════════════════════════════════
//  AUDIO ENGINE — supports local (FileHandle) + GitHub files
// ════════════════════════════════════════════════════════════════════

let audioCtx = null, gainNode = null;
let currentSource = null, currentBuffer = null;
let startTime = 0, pauseOffset = 0, isPlaying = false;
let animFrame = null, currentDuration = 0;
let volLevel = 0.8, muted = false, playGeneration = 0;
let nowPlayingPath = null, nowPlayingFile = null;
let fallbackAudio = null, fallbackPath = null, fbAnimFrame = null;
const isIOSSafari = /iP(hone|ad|od)/.test(navigator.userAgent)
  && /WebKit/.test(navigator.userAgent) && !/CriOS|FxiOS/.test(navigator.userAgent);

function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    gainNode = audioCtx.createGain();
    gainNode.gain.value = volLevel;
    gainNode.connect(audioCtx.destination);
  }
  return audioCtx;
}

function formatTime(s) {
  if (!isFinite(s)) return "--:--";
  return Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");
}

function updateBarProgress(el, dur) {
  const pct = dur > 0 ? Math.min(el / dur, 1) * 100 : 0;
  document.getElementById("barProgressFill").style.width = pct + "%";
  document.getElementById("barCur").textContent  = formatTime(el);
  document.getElementById("barTot").textContent  = formatTime(dur);
  if (nowPlayingPath) {
    document.querySelectorAll(`.c-mini-prog-fill[data-path="${CSS.escape(nowPlayingPath)}"]`).forEach(f => {
      f.style.width = pct + "%";
    });
    document.querySelectorAll(`.c-audio-time[data-path="${CSS.escape(nowPlayingPath)}"]`).forEach(t => {
      t.textContent = formatTime(el) + " / " + formatTime(dur);
    });
  }
}

function tickProgress() {
  if (!isPlaying || !audioCtx) return;
  const el = audioCtx.currentTime - startTime;
  updateBarProgress(el, currentDuration);
  animFrame = requestAnimationFrame(tickProgress);
}

function fallbackTick() {
  if (!fallbackAudio || fallbackAudio.paused) return;
  updateBarProgress(fallbackAudio.currentTime, fallbackAudio.duration || 0);
  fbAnimFrame = requestAnimationFrame(fallbackTick);
}

function stopAll() {
  if (currentSource) { try { currentSource.stop(); } catch(e) {} currentSource = null; }
  if (fallbackAudio) { fallbackAudio.pause(); fallbackAudio.src = ""; fallbackAudio = null; }
  cancelAnimationFrame(animFrame); cancelAnimationFrame(fbAnimFrame);
  isPlaying = false; playGeneration++;
  document.querySelectorAll(".c-play-btn.playing").forEach(b => b.classList.remove("playing"));
  document.querySelectorAll(".proj-play-btn.playing").forEach(b => b.classList.remove("playing"));
  updateBarBtns(false);
}

function updateBarBtns(playing) {
  const btn = document.getElementById("barPlayBtn");
  btn.classList.remove("loading");
  if (playing) {
    btn.innerHTML = `<span class="material-symbols-outlined">pause</span>`;
    btn.classList.add("active");
  } else {
    btn.innerHTML = `<span class="material-symbols-outlined">play_arrow</span>`;
    btn.classList.remove("active");
  }
}

function playBuffer(buffer, offset, file) {
  getAudioCtx();
  if (audioCtx.state === "suspended") audioCtx.resume();
  const gen  = ++playGeneration;
  const src  = audioCtx.createBufferSource();
  src.buffer = buffer;
  src.connect(gainNode);
  const safeOffset = Math.min(offset, buffer.duration);
  src.start(0, safeOffset);
  currentSource = src; currentBuffer = buffer;
  startTime = audioCtx.currentTime - safeOffset;
  currentDuration = buffer.duration;
  isPlaying = true;
  updateBarBtns(true);
  // Mark playing buttons
  document.querySelectorAll(`.c-play-btn[data-path="${CSS.escape(file.path)}"]`).forEach(b => b.classList.add("playing"));
  document.querySelectorAll(`.proj-play-btn[data-path="${CSS.escape(file.path)}"]`).forEach(b => b.classList.add("playing"));
  src.onended = () => {
    if (playGeneration !== gen) return;
    isPlaying = false;
    pauseOffset = 0;
    updateBarProgress(currentDuration, currentDuration);
    updateBarBtns(false);
    document.querySelectorAll(".c-play-btn.playing, .proj-play-btn.playing")
      .forEach(b => b.classList.remove("playing"));
    cancelAnimationFrame(animFrame);
  };
  cancelAnimationFrame(animFrame);
  animFrame = requestAnimationFrame(tickProgress);
}

async function playFile(file) {
  if (nowPlayingPath === file.path && (isPlaying || (fallbackAudio && !fallbackAudio.paused))) {
    pauseFile(); return;
  }
  stopAll();
  nowPlayingPath = file.path;
  nowPlayingFile = file;

  document.getElementById("bottomBar").classList.add("visible");
  document.body.classList.add("player-visible");
  document.getElementById("barTitle").textContent = baseName(file.name);
  updateBottomBarTags();
  updateBarProgress(0, 0);

  const barBtn = document.getElementById("barPlayBtn");
  barBtn.classList.add("loading");
  document.querySelectorAll(`.c-play-btn[data-path="${CSS.escape(file.path)}"],.proj-play-btn[data-path="${CSS.escape(file.path)}"]`)
    .forEach(b => b.classList.add("loading"));

  if (isIOSSafari) {
    barBtn.classList.remove("loading");
    document.querySelectorAll(`[data-path="${CSS.escape(file.path)}"]`).forEach(b => b.classList.remove("loading"));
    await playFallback(file); return;
  }

  try {
    // Resolve the actual URL / blob
    let buf;
    if (file.source === "local") {
      if (window.electronAPI && file.absolutePath) {
        const buffer = await window.electronAPI.readLocalFile(file.absolutePath);
        buf = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
      } else if (file.fileHandle) {
        const f = await file.fileHandle.getFile();
        buf     = await f.arrayBuffer();
      }
    } else {
      const res = await fetch(file.download_url);
      buf       = await res.arrayBuffer();
    }
    const buffer = await getAudioCtx().decodeAudioData(buf);
    barBtn.classList.remove("loading");
    document.querySelectorAll(`[data-path="${CSS.escape(file.path)}"]`).forEach(b => b.classList.remove("loading"));
    playBuffer(buffer, 0, file);
  } catch(e) {
    barBtn.classList.remove("loading");
    document.querySelectorAll(`[data-path="${CSS.escape(file.path)}"]`).forEach(b => b.classList.remove("loading"));
    await playFallback(file);
  }
}

async function playFallback(file) {
  let url;
  if (file.source === "local") {
    if (window.electronAPI && file.absolutePath) {
      url = await resolveFileUrl(file);
    } else if (file.fileHandle) {
      const f = await file.fileHandle.getFile();
      url     = URL.createObjectURL(f);
    }
  } else {
    url = file.download_url;
  }
  fallbackAudio = new Audio(url);
  fallbackAudio.volume = muted ? 0 : volLevel;
  fallbackPath  = file.path;
  fallbackAudio.play().catch(() => {});
  fallbackAudio.addEventListener("timeupdate", () => {
    updateBarProgress(fallbackAudio.currentTime, fallbackAudio.duration || 0);
  });
  fallbackAudio.addEventListener("ended", () => {
    updateBarBtns(false);
    document.querySelectorAll(".c-play-btn.playing, .proj-play-btn.playing").forEach(b => b.classList.remove("playing"));
  });
  updateBarBtns(true);
}

function pauseFile() {
  if (fallbackAudio) {
    fallbackAudio.pause();
    updateBarBtns(false);
    document.querySelectorAll(".c-play-btn.playing, .proj-play-btn.playing").forEach(b => b.classList.remove("playing"));
    return;
  }
  if (isPlaying && audioCtx) {
    pauseOffset = audioCtx.currentTime - startTime;
    playGeneration++;
    try { currentSource.stop(); } catch(e) {}
    currentSource = null; isPlaying = false;
    updateBarBtns(false);
    cancelAnimationFrame(animFrame);
    document.querySelectorAll(".c-play-btn.playing, .proj-play-btn.playing").forEach(b => b.classList.remove("playing"));
  }
}

function resumeFile() {
  if (!nowPlayingFile) return;
  if (fallbackAudio && fallbackPath === nowPlayingPath) {
    fallbackAudio.play().catch(() => {});
    updateBarBtns(true); return;
  }
  if (currentBuffer) playBuffer(currentBuffer, pauseOffset, nowPlayingFile);
}

// ── Bar controls ──────────────────────────────────────────────────
document.getElementById("barPlayBtn").addEventListener("click", () => {
  if (!nowPlayingFile) return;
  if (isPlaying || (fallbackAudio && !fallbackAudio.paused)) pauseFile();
  else resumeFile();
});

document.getElementById("barProgressWrap").addEventListener("click", e => {
  const rect = document.getElementById("barProgressWrap").getBoundingClientRect();
  const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  if (fallbackAudio) {
    const dur = fallbackAudio.duration || 0;
    if (!dur) return;
    fallbackAudio.currentTime = pct * dur; return;
  }
  if (!currentBuffer) return;
  const offset = pct * currentDuration;
  const was    = isPlaying;
  playGeneration++;
  if (currentSource) { try { currentSource.stop(); } catch(e) {} currentSource = null; }
  cancelAnimationFrame(animFrame); isPlaying = false;
  if (was && nowPlayingFile) playBuffer(currentBuffer, offset, nowPlayingFile);
  else { pauseOffset = offset; updateBarProgress(offset, currentDuration); }
});

document.getElementById("barVolSlider").addEventListener("input", e => {
  volLevel = parseFloat(e.target.value);
  if (gainNode) gainNode.gain.value = volLevel;
  if (fallbackAudio) fallbackAudio.volume = volLevel;
  muted = volLevel === 0;
  document.getElementById("barVolIcon").textContent = muted ? "volume_off" : volLevel < 0.5 ? "volume_down" : "volume_up";
});

document.getElementById("barVolIcon").addEventListener("click", () => {
  muted = !muted;
  if (gainNode) gainNode.gain.value = muted ? 0 : volLevel;
  if (fallbackAudio) fallbackAudio.volume = muted ? 0 : volLevel;
  document.getElementById("barVolIcon").textContent = muted ? "volume_off" : volLevel < 0.5 ? "volume_down" : "volume_up";
});

document.getElementById("barVolWrap").addEventListener("wheel", e => {
  e.preventDefault();
  const step = 0.04;
  volLevel = Math.max(0, Math.min(1, volLevel - Math.sign(e.deltaY) * step));
  document.getElementById("barVolSlider").value = volLevel;
  if (gainNode) gainNode.gain.value = volLevel;
  if (fallbackAudio) fallbackAudio.volume = volLevel;
  document.getElementById("barVolIcon").textContent = volLevel === 0 ? "volume_off" : volLevel < 0.5 ? "volume_down" : "volume_up";
}, { passive: false });

function updateBottomBarTags() {
  if (nowPlayingFile) {
    const tags = getSongTags(nowPlayingFile);
    document.getElementById("barTags").innerHTML = tags.map(t => `<span class="sb-tag">${t}</span>`).join("");
    const addTagBtn = document.getElementById("barAddTagBtn");
    if (addTagBtn) {
      const hasOwn = songTags[nowPlayingFile.path] && songTags[nowPlayingFile.path].length > 0;
      if (hasOwn) addTagBtn.classList.add("active");
      else addTagBtn.classList.remove("active");
    }
  }
}
window.updateBottomBarTags = updateBottomBarTags;

document.getElementById("barAddTagBtn").addEventListener("click", () => {
  if (nowPlayingPath) {
    openTagModal(nowPlayingPath);
  }
});
