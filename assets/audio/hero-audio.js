// ---------- Extra sound + lock add-on (self-contained, loaded after the main page script) ----------
//  1. Character profile clips   - short clip when a profile / theme is picked
//  2. Ambience only when idle   - the background bed starts after ~12s of no activity, stops the moment the cursor moves
//  3. Countdown clock           - tick+echo+fade cycle looping in step with the countdown, stops when it ends (Dec 18)
//  4. Avengers: Doomsday lock   - cannot be ticked as watched until the countdown is over
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

  let el = null, timer = null;
  const soundOn = () => { try{ return localStorage.getItem("doomsday-sound") !== "off"; }catch(e){ return true; } };
  const trailerOpen = () => { const m = document.getElementById("trailer-modal"); return !!(m && !m.hidden); };

  function stop(){
    clearInterval(timer); timer = null;
    if(el){ try{ el.pause(); }catch(e){} el = null; }
  }
  function play(av){
    stop();
    const c = CLIPS[av];
    if(!c || !soundOn() || trailerOpen()) return;
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
    if(!soundOn() || trailerOpen() || el || (gate && gate.firstChild)) return;
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
  const tickAllowed = () => countdownOn() && soundOn() && !trailerOpen() && !document.hidden && !el;
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
      pend = {id, was: typeof watched !== "undefined" && watched.has(id)};
    }, true);
    tl.addEventListener("click", () => {              // bubble: after the page's handler. Doomsday itself can't be ticked,
      if(!pend) return;                               // so "ready for Doomsday" = every other MCU title watched
      const p = pend; pend = null;
      try{
        if(!p.was && watched.has(p.id) && locked() && typeof showMilestone === "function"
           && MOVIES.filter(m => m.p !== 7 && m.i !== DOOM_ID).every(m => watched.has(m.i))) showMilestone();
      }catch(e){}
    });
  }
  let wasLocked = locked();
  setInterval(() => {                                  // countdown just ended while the page is open: unlock live
    if(wasLocked && !locked()){ wasLocked = false; if(typeof render === "function") render(); }
  }, 1000);
  if(!enforce()) decorate();
})();
