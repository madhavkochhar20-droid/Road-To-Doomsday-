// ---------- Character profile clips ----------
// Plays a short clip when a character profile / theme is picked. Self-contained: it does not change the existing
// sound code (victor / ambience / I AM DOOM), it only listens for the same clicks. Respects the 🔊 on/off button
// and stays silent while the trailer is open. Timings are in seconds; edit start/end below to change a clip.
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
})();
