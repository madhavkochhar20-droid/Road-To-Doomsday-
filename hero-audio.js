// ---------- Extra sound + lock add-on (self-contained, loaded after the main page script) ----------
//  1. Character profile clips   - short clip when a profile / theme is picked
//  2. Ambience only when idle   - the background bed starts after ~12s of no activity, stops the moment the cursor moves
//  3. Countdown clock           - tick+echo+fade cycle looping in step with the countdown, stops when it ends (Dec 18)
//  4. Avengers: Doomsday lock   - cannot be ticked as watched until the countdown is over
//  5. VisionQuest              - added to the list (Disney+, Oct 14 2026)
//  7. "Select all" button      - marks every available title as watched in one click (Doomsday stays locked)
//  7. Select all / Shift+click  - mark everything listed (or a range) as watched in one go
//  6. Reveal video             - when only Doomsday is left: black screen, logo + "12.18.26 IS DOOMSDAY" (once per session)
// Everything respects the 🔊 on/off button and stays quiet while the trailer is open.
// Timings are in seconds; edit start/end below to change a clip.
(function(){
  const BASE = "assets/audio/", V = "?v=1";
  const CLIPS = {
    spiderman:      {file:"spiderman.m4a",      start:1,  end:4},    // 0:01 - 0:04
    thor:           {file:"thor.m4a",           start:72, end:74},   // 1:12 - 1:14
    captainamerica: {file:"captainamerica.m4a", start:37, end:39},   // 0:37 - 0:39
    ironman:        {file:"ironman.m4a",        start:40, end:49},   // 0:40 - 0:49
    blackpanther:   {file:"blackpanther.m4a",   start:2,  end:4},    // 0:02 - 0:04
    hulk:           {file:"hulk.mp3",           start:2,  end:5}     // 0:02 - 0:05
  };                                                                  // doomsday: no clip here (its own sound system)
  const VOL = 0.85, FADE = 0.25;   // volume, and fade-out length at the end of the clip (seconds)

  let el = null, timer = null, cine = false, lastClickId = null;
  const soundOn = () => { try{ return localStorage.getItem("doomsday-sound") !== "off"; }catch(e){ return true; } };
  const trailerOpen = () => { const m = document.getElementById("trailer-modal"); return !!(m && !m.hidden); };

  function stop(){
    clearInterval(timer); timer = null;
    if(el){ try{ el.pause(); }catch(e){} el = null; }
  }
  function play(av){
    stop();
    const c = CLIPS[av];
    if(!c || !soundOn() || trailerOpen() || cine) return;
    if(window.__bedHold) window.__bedHold();                       // ambience steps aside while a profile clip plays
    const a = new Audio(BASE + c.file + V);
    a.preload = "auto"; a.volume = VOL;
    try{ a.currentTime = c.start; }catch(e){}
    a.addEventListener("loadedmetadata", () => { if(a.currentTime < c.start) a.currentTime = c.start; });
    a.addEventListener("error", () => { if(el === a) stop(); });
    a.addEventListener("ended", () => { if(el === a) stop(); });
    el = a;
    const pr = a.play();
    if(pr && pr.catch) pr.catch(() => { if(el === a) stop(); });
    timer = setInterval(() => {
      if(el !== a){ clearInterval(timer); return; }
      const left = c.end - a.currentTime;
      if(left <= 0){ stop(); return; }
      if(left < FADE) a.volume = Math.max(0, VOL * left / FADE);
    }, 40);
  }

  const avOfProfile = id => {
    try{
      const s = JSON.parse(localStorage.getItem("doomsday-profiles"));
      const p = s.profiles.find(x => x.id === id);
      return p ? p.av : null;
    }catch(e){ return null; }
  };

  // 1) "Who's Here?" screen: tile click = profile chosen (not "add profile", not "manage" mode)
  //    + avatar pick inside the profile editor
  const gate = document.getElementById("gate-slot");
  if(gate){
    let pend = null;
    gate.addEventListener("click", e => {            // capture: read the state before the page's own handler changes it
      pend = null;
      const pk = e.target.closest(".pick"), t = e.target.closest(".tile");
      if(pk) pend = {av:pk.dataset.k};
      else if(t && t.dataset.id && !t.dataset.add && !gate.querySelector(".pen")) pend = {id:t.dataset.id};
    }, true);
    gate.addEventListener("click", () => {           // bubble: runs after the page's handler has switched the profile
      if(!pend) return;
      play(pend.av || avOfProfile(pend.id));
      pend = null;
    });
  }

  // 2) Account dropdown: website theme pick
  const menu = document.getElementById("auth-menu");
  if(menu){
    let key = null;
    menu.addEventListener("click", e => { const pk = e.target.closest(".pick"); key = pk ? pk.dataset.k : null; }, true);
    menu.addEventListener("click", () => { if(key) play(key); key = null; });
  }

  // 3) Sound turned off, or trailer opened: cut any clip that is playing
  document.addEventListener("click", e => {
    if(!e.target.closest("#sound-btn") && !e.target.closest("#trailer-btn")) return;
    setTimeout(() => { if(!soundOn() || trailerOpen()) stop(); }, 0);
  });

  // ---------- 2) Ambience bed: only when the site has been idle ----------
  // The page asks to play "ambience" ~10s after the opening line. We hold that request and only start it after
  // IDLE_MS without any activity, and never while a profile clip is playing or the "Who's Here?" screen is open.
  const IDLE_MS = 12000;
  const nativePlay = HTMLMediaElement.prototype.play, nativePause = HTMLMediaElement.prototype.pause;
  let bed = null, bedWanted = false, lastAct = Date.now();
  const isBed = a => a instanceof HTMLAudioElement && /ambience/i.test(a.getAttribute("src") || "");
  HTMLMediaElement.prototype.play = function(){
    if(isBed(this)){ bed = this; bedWanted = true; return Promise.resolve(); }
    return nativePlay.apply(this, arguments);
  };
  HTMLMediaElement.prototype.pause = function(){
    if(this === bed) bedWanted = false;               // the page itself stopped it (sound off / trailer): forget the request
    return nativePause.apply(this, arguments);
  };
  window.__bedHold = () => {
    if(bed && !bed.paused){ nativePause.call(bed); bedWanted = !bed.ended; }   // resume later from the same spot
  };
  // Any real activity (cursor move, click, key, scroll, touch) cuts the ambience on the spot; it comes back
  // (from the same spot) once the site has been idle for IDLE_MS again.
  let mx = null, my = null;
  function userActive(e){
    if(e && e.type === "pointermove"){                // ignore tiny jitter / synthetic moves (< 3px)
      if(mx === null){ mx = e.clientX; my = e.clientY; return; }
      if(Math.abs(e.clientX - mx) < 3 && Math.abs(e.clientY - my) < 3) return;
      mx = e.clientX; my = e.clientY;
    }
    lastAct = Date.now();
    if(bed && !bed.paused){ nativePause.call(bed); bedWanted = !bed.ended; }
  }
  ["pointermove", "pointerdown", "keydown", "wheel", "scroll", "touchstart"].forEach(ev =>
    window.addEventListener(ev, userActive, {passive:true, capture:true}));
  setInterval(() => {
    if(!bed || !bedWanted) return;
    if(Date.now() - lastAct < IDLE_MS) return;
    if(!soundOn() || trailerOpen() || cine || el || (gate && gate.firstChild)) return;
    bedWanted = false;
    const pr = nativePlay.call(bed);
    if(pr && pr.catch) pr.catch(() => { bedWanted = true; lastAct = Date.now(); });
  }, 500);

  // ---------- 3) Countdown clock: the tick/echo/fade cycle loops continuously, locked to the countdown ----------
  // clock-tick.wav is ONE full cycle of your clock sound (tick -> echo -> fade), exactly 1.000s long, so it plays
  // as a seamless loop at the same pace as the countdown seconds. It starts on a countdown second change, is
  // re-aligned if it ever drifts, is muted (not stopped) while a profile clip / trailer plays or sound is off,
  // and stops for good when the countdown ends.
  const getTarget = () => (typeof target !== "undefined" && target) ? target : new Date("2026-12-18T00:00:00");
  const countdownOn = () => Date.now() < getTarget().getTime();
  const TICK_URL = BASE + "clock-tick.wav?v=3", TICK_VOL = 0.5;
  let actx = null, tickBuf = null, tickEl = null, tickInit = false;
  let loopSrc = null, loopGain = null, loopT0 = 0;
  function initTick(){
    if(tickInit) return; tickInit = true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if(AC){
      try{
        actx = new AC();
        fetch(TICK_URL).then(r => r.arrayBuffer())
          .then(b => new Promise((res, rej) => actx.decodeAudioData(b, res, rej)))
          .then(buf => { tickBuf = buf; })
          .catch(() => { actx = null; tickEl = new Audio(TICK_URL); tickEl.loop = true; tickEl.volume = TICK_VOL; });
        return;
      }catch(e){ actx = null; }
    }
    tickEl = new Audio(TICK_URL); tickEl.loop = true; tickEl.volume = TICK_VOL;
  }
  // browsers allow sound only after a first tap/click/key, so the clock starts from there
  ["pointerdown", "keydown", "touchend"].forEach(g => window.addEventListener(g, () => {
    initTick();
    if(actx && actx.state === "suspended") actx.resume().catch(() => {});
  }, {capture:true, passive:true}));
  function stopLoop(){
    if(loopSrc){ try{ loopSrc.stop(); }catch(e){} loopSrc = null; }
    if(tickEl){ try{ tickEl.pause(); }catch(e){} }
  }
  function startLoop(){
    if(!actx || !tickBuf || actx.state !== "running") return false;
    if(loopSrc){ try{ loopSrc.stop(); }catch(e){} loopSrc = null; }
    if(!loopGain){ loopGain = actx.createGain(); loopGain.gain.value = 0; loopGain.connect(actx.destination); }
    const s = actx.createBufferSource();
    s.buffer = tickBuf; s.loop = true; s.loopStart = 0; s.loopEnd = tickBuf.duration;
    s.connect(loopGain);
    loopT0 = actx.currentTime + 0.01;
    s.start(loopT0);
    loopSrc = s;
    return true;
  }
  const tickAllowed = () => countdownOn() && soundOn() && !trailerOpen() && !document.hidden && !el && !cine;
  setInterval(() => {                                  // mute / unmute without losing the beat; stop when the countdown ends
    if(!countdownOn()){ stopLoop(); return; }
    const on = tickAllowed();
    if(loopGain) loopGain.gain.setTargetAtTime(on ? TICK_VOL : 0, actx.currentTime, 0.03);
    if(tickEl && actx === null){
      if(on && tickEl.paused){ const pr = tickEl.play(); if(pr && pr.catch) pr.catch(() => {}); }
      else if(!on && !tickEl.paused) tickEl.pause();
    }
  }, 150);
  function onSecondChange(){
    if(!countdownOn()){ stopLoop(); return; }
    if(!(actx && tickBuf && actx.state === "running")) return;
    if(!loopSrc){ startLoop(); return; }
    const d = tickBuf.duration;                        // keep the loop locked to the displayed second
    let ph = (actx.currentTime - loopT0) % d; if(ph < 0) ph += d;
    if(Math.min(ph, d - ph) > 0.12) startLoop();
  }
  const secsEl = document.getElementById("c-secs");
  if(secsEl){
    let lastSec = null;
    new MutationObserver(() => {
      const v = secsEl.textContent;
      if(v === lastSec) return;
      const first = lastSec === null; lastSec = v;
      if(!first) onSecondChange();                     // same moment the displayed seconds change
    }).observe(secsEl, {childList:true, characterData:true, subtree:true});
  }

  // ---------- 4) Avengers: Doomsday is locked until the countdown ends ----------
  const DOOM_ID = 51;
  const st = document.createElement("style");
  st.textContent = ".entry.locked .title{cursor:not-allowed}"
    + ".entry.locked .check{border-color:transparent;background:none;color:inherit;font-size:13px}"
    + ".lock-tag{display:inline-block;margin-left:8px;font-size:11px;font-weight:600;color:var(--ember);border:1px solid var(--ember);padding:1px 8px;border-radius:999px;vertical-align:middle}";
  document.head.appendChild(st);

  const locked = () => countdownOn();
  const unlockLabel = () => getTarget().toLocaleDateString("en-US", {month:"short", day:"numeric", year:"numeric"});
  // if it was ticked earlier (older save / another device) take it back, so it can't be done early
  function enforce(){
    try{
      if(locked() && typeof watched !== "undefined" && watched.has(DOOM_ID)){
        watched.delete(DOOM_ID);
        if(typeof saveWatched === "function") saveWatched();
        if(typeof render === "function") render();
        return true;
      }
    }catch(e){}
    return false;
  }
  function decorate(){
    if(!locked()) return;
    const row = document.querySelector('#timeline .entry[data-id="' + DOOM_ID + '"]');
    if(!row || row.dataset.locked) return;
    row.dataset.locked = "1";
    row.classList.add("locked");
    row.classList.remove("up-next", "watched");
    const nb = row.querySelector(".up-next-badge"); if(nb) nb.remove();
    const chk = row.querySelector(".check"); if(chk) chk.textContent = "\uD83D\uDD12";
    const title = row.querySelector(".title");
    if(title) title.insertAdjacentHTML("beforeend", '<span class="lock-tag">Unlocks ' + unlockLabel() + '</span>');
  }
  const tl = document.getElementById("timeline");
  if(tl){
    new MutationObserver(() => { if(!enforce()) decorate(); }).observe(tl, {childList:true});
    let pend = null;
    tl.addEventListener("click", e => {               // capture: runs before the page's own handler
      pend = null;
      const t = e.target.closest(".title"), row = t && t.closest(".entry");
      if(!row) return;
      const id = Number(row.dataset.id);
      if(id === DOOM_ID && locked()){
        e.stopImmediatePropagation(); e.preventDefault();
        if(typeof toast === "function") toast("Avengers: Doomsday unlocks on " + unlockLabel() + ", when the countdown hits zero.");
        return;
      }
      if(e.shiftKey && lastClickId !== null && lastClickId !== id && visibleIds().includes(lastClickId)){
        e.stopImmediatePropagation(); e.preventDefault();   // Shift+click: mark everything between the two titles
        rangeToggle(lastClickId, id); lastClickId = id; pend = null;
        return;
      }
      lastClickId = id;
      pend = {id, was: typeof watched !== "undefined" && watched.has(id)};
    }, true);
    tl.addEventListener("click", () => {              // bubble: after the page's handler. Doomsday itself can't be ticked,
      if(!pend) return;                               // so "ready for Doomsday" = every other MCU title watched
      const p = pend; pend = null;
      try{
        if(!p.was && watched.has(p.id) && locked() && onlyDoomLeft()) playReveal();   // last other title ticked: reveal
      }catch(e){}
    });
  }
  let wasLocked = locked();
  setInterval(() => {                                  // countdown just ended while the page is open: unlock live
    if(wasLocked && !locked()){ wasLocked = false; if(typeof render === "function") render(); }
  }, 1000);
  // ---------- 5) VisionQuest (Disney+, premiered Oct 14 2026) ----------
  // Added here so index.html needs no change. If you later add it to MOVIES in index.html, this is skipped.
  // i:50.5 = in-universe slot right before Avengers: Doomsday. imdb:null shows "TBA" until you put a rating in.
  try{
    if(typeof MOVIES !== "undefined" && !MOVIES.some(m => /^visionquest$/i.test(m.t))){
      MOVIES.push({p:6, i:50.5, y:"2026", ry:2026, t:"VisionQuest",
        d:"A rebuilt Vision searches for his memory and his humanity while Ultron, Jocasta and a bounty hunter close in on him.",
        type:"series", ic:"👁️", rt:360, sk:false, imdb:null});
      const nc = document.getElementById("mode-n-core"), na = document.getElementById("mode-n-all");
      if(nc) nc.textContent = MOVIES.filter(m => m.p !== 7).length;
      if(na) na.textContent = MOVIES.length;
      if(typeof render === "function") render();
    }
  }catch(e){}

  // ---------- 6) Reveal video: only Doomsday left -> black screen, logo, "12.18.26 IS DOOMSDAY" ----------
  const REVEAL_URL = "assets/video/doomsday-reveal.mp4?v=1", REVEAL_KEY = "doomsday-reveal-seen";
  // Test without ticking everything: open the site as  yoursite.com/?reveal=1  and click anywhere on the page.
  if(/[?&]reveal=1(&|$)/.test(location.search)){
    const go = () => { ["pointerdown", "keydown"].forEach(g => window.removeEventListener(g, go, true)); playReveal(true); };
    ["pointerdown", "keydown"].forEach(g => window.addEventListener(g, go, true));
  }
  const onlyDoomLeft = () => {
    try{ return MOVIES.filter(m => m.p !== 7 && m.i !== DOOM_ID).every(m => watched.has(m.i)); }catch(e){ return false; }
  };
  function playReveal(force){
    if(cine) return;
    if(!force){ try{ if(sessionStorage.getItem(REVEAL_KEY) === "1") return; }catch(e){} }   // once per session
    cine = true;
    stop(); if(window.__bedHold) window.__bedHold();                 // silence profile clip + ambience; clock mutes via tickAllowed()
    const ov = document.createElement("div");
    ov.style.cssText = "position:fixed;inset:0;z-index:3000;background:#000;opacity:0;transition:opacity .5s ease;display:flex;align-items:center;justify-content:center";
    const v = document.createElement("video");
    v.playsInline = true; v.preload = "auto"; v.src = REVEAL_URL; v.muted = !soundOn(); v.volume = 0.9;
    v.style.cssText = "width:100%;height:100%;object-fit:contain;background:#000";
    const sk = document.createElement("button");
    sk.type = "button"; sk.textContent = "Skip ✕";
    sk.style.cssText = "position:absolute;top:16px;right:18px;background:none;border:1px solid rgba(255,255,255,.35);color:#fff;font:600 12px 'IBM Plex Sans',sans-serif;padding:6px 14px;border-radius:999px;cursor:pointer;opacity:.75";
    ov.appendChild(v); ov.appendChild(sk); document.body.appendChild(ov);
    const prevOv = document.documentElement.style.overflow; document.documentElement.style.overflow = "hidden";
    let closed = false;
    const onKey = e => { if(e.key === "Escape"){ e.stopPropagation(); close(); } };
    function close(){
      if(closed) return; closed = true;
      document.removeEventListener("keydown", onKey, true);
      ov.style.opacity = "0";
      try{ v.pause(); }catch(e){}
      setTimeout(() => { ov.remove(); document.documentElement.style.overflow = prevOv; cine = false; }, 550);
    }
    document.addEventListener("keydown", onKey, true);
    sk.addEventListener("click", close);
    v.addEventListener("playing", () => { try{ sessionStorage.setItem(REVEAL_KEY, "1"); }catch(e){} });   // counts as "seen" only once it really plays
    v.addEventListener("ended", () => setTimeout(close, 1600));      // hold the last frame ("12.18.26 IS DOOMSDAY") a moment
    v.addEventListener("error", () => {
      console.error("Reveal video failed to load: " + REVEAL_URL + " (check that assets/video/doomsday-reveal.mp4 exists)");
      if(typeof toast === "function") toast("Reveal video not found. Check assets/video/doomsday-reveal.mp4");
      close();
    });
    requestAnimationFrame(() => { ov.style.opacity = "1"; });
    const pr = v.play();
    if(pr && pr.catch) pr.catch(() => { v.muted = true; const p2 = v.play(); if(p2 && p2.catch) p2.catch(close); });
  }

  // ---------- 7) Select all + Shift+click range ----------
  // "Select all" marks every title that is currently listed (respects the phase / search / Essential / MCU-only filters).
  // Avengers: Doomsday is never included while it is locked. Click one title, then Shift+click another to mark everything between them.
  const visibleIds = () => [...document.querySelectorAll("#timeline .entry")]
    .map(r => Number(r.dataset.id)).filter(id => !(id === DOOM_ID && locked()));
  function applyBulk(ids, on){
    const wasOnly = onlyDoomLeft();
    ids.forEach(id => { if(on) watched.add(id); else watched.delete(id); });
    saveWatched(); render();
    if(on && !wasOnly && locked() && onlyDoomLeft()) playReveal();   // that completed everything except Doomsday
  }
  function rangeToggle(a, b){
    const ids = visibleIds(), i = ids.indexOf(a), j = ids.indexOf(b);
    if(i < 0 || j < 0) return;
    applyBulk(ids.slice(Math.min(i, j), Math.max(i, j) + 1), !watched.has(b));
  }
  (function(){
    const bar = document.querySelector(".progress-summary"), rst = document.getElementById("progress-reset");
    if(!bar || !tl) return;
    const css = document.createElement("style");
    css.textContent = ".share-btn:disabled{opacity:.45;cursor:default}#timeline .entry .title{user-select:none;-webkit-user-select:none}";
    document.head.appendChild(css);
    const b = document.createElement("button");
    b.type = "button"; b.className = "share-btn"; b.id = "selall-btn";
    b.title = "Mark everything listed as watched. Tip: click one title, then Shift+click another to mark everything between them.";
    bar.insertBefore(b, rst && rst.parentNode === bar ? rst : null);
    function sync(){
      const ids = visibleIds(), all = ids.length > 0 && ids.every(id => watched.has(id));
      b.textContent = (all ? "Unselect all (" : "Select all (") + ids.length + ")";
      b.disabled = ids.length === 0;
    }
    b.addEventListener("click", () => {
      const ids = visibleIds(); if(!ids.length) return;
      const all = ids.every(id => watched.has(id));
      if(!confirm((all ? "Mark these " + ids.length + " titles as NOT watched?" : "Mark these " + ids.length + " titles as watched?"))) return;
      applyBulk(ids, !all);
    });
    new MutationObserver(sync).observe(tl, {childList:true});
    sync();
  })();

  if(!enforce()) decorate();
})();
