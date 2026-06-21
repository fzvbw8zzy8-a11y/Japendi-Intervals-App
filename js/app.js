/* ============================================================
   Aki · Intervals — app logic
   A drift-free interval engine with soft audio + haptic cues,
   screen wake-lock, and persisted settings.
   ============================================================ */

(() => {
  'use strict';

  // ---------- configuration model ----------
  const DEFAULTS = { prepare: 10, sprint: 30, recover: 60, reps: 8, sets: 1, rest: 120 };

  // step size + bounds per field; steps are fine (1s) at breathing-scale
  // durations and grow coarser for longer sprint/recovery intervals
  const FIELD = {
    prepare: { min: 0,  max: 60,   step: v => (v < 10 ? 1 : 5) },
    sprint:  { min: 1,  max: 600,  step: v => (v < 30 ? 1 : v < 60 ? 5 : 10) },
    recover: { min: 0,  max: 900,  step: v => (v < 30 ? 1 : v < 60 ? 5 : v < 180 ? 15 : 30) },
    reps:    { min: 1,  max: 50,   step: v => 1 },
    sets:    { min: 1,  max: 20,   step: v => 1 },
    rest:    { min: 0,  max: 900,  step: v => (v < 60 ? 5 : 30) },
  };

  // built-in starting points (read-only)
  const PRESETS = {
    'sprint repeats': { prepare: 10, sprint: 30, recover: 90, reps: 8,  sets: 1, rest: 0 },
    'tabata':         { prepare: 10, sprint: 20, recover: 10, reps: 8,  sets: 1, rest: 0 },
    'hill 400s':      { prepare: 15, sprint: 75, recover: 120, reps: 6, sets: 1, rest: 0 },
    'pyramid':        { prepare: 10, sprint: 45, recover: 75, reps: 10, sets: 2, rest: 180 },
  };

  let cfg = load();
  let customPresets = loadPresets();   // [{ name, cfg }]

  // ---------- elements ----------
  const $ = sel => document.querySelector(sel);
  const views = { setup: $('#setup'), timer: $('#timer'), done: $('#done') };
  const timerView = views.timer;

  const ringFill = $('#ringFill');
  const RING_LEN = 2 * Math.PI * 108;
  ringFill.style.strokeDasharray = RING_LEN;

  const el = {
    phase: $('#phaseLabel'), clock: $('#clock'), next: $('#nextUp'),
    counter: $('#counter'), pause: $('#pause'), skip: $('#skip'),
    quit: $('#quit'), begin: $('#begin'), again: $('#again'),
    summary: $('#summary'), doneStats: $('#doneStats'),
    presets: $('#presets'), dials: $('#dials'),
    sheet: $('#sheet'), presetName: $('#presetName'),
  };

  // ============================================================
  //  SETUP VIEW
  // ============================================================
  function fmt(s) {
    s = Math.max(0, Math.round(s));
    if (s < 60) return s + 's';
    const m = Math.floor(s / 60), sec = s % 60;
    return sec ? `${m}:${String(sec).padStart(2, '0')}` : `${m}:00`;
  }
  function clock(s) {
    s = Math.max(0, Math.ceil(s));
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, '0')}`;
  }

  function renderSetup() {
    for (const key in DEFAULTS) {
      const node = document.querySelector(`[data-display="${key}"]`);
      if (!node) continue;
      node.textContent = (key === 'reps' || key === 'sets') ? cfg[key] : fmt(cfg[key]);
    }
    // total
    const totalEfforts = cfg.reps * cfg.sets;
    document.querySelector('[data-display="totalReps"]').textContent =
      `${totalEfforts} effort${totalEfforts === 1 ? '' : 's'}`;
    document.querySelector('[data-display="totalTime"]').textContent =
      `${clock(totalDuration())} total`;
    markActivePreset();
  }

  // derive total straight from the queue so the displayed time always
  // matches the workout you'll actually run (dropped recoveries included)
  function totalDuration() {
    return buildQueue().reduce((sum, ph) => sum + ph.dur, 0);
  }

  function buildPresets() {
    el.presets.innerHTML = '';
    // built-ins, then your saved workouts, then the "+ save" chip
    Object.keys(PRESETS).forEach(name => el.presets.appendChild(makeChip(name, PRESETS[name])));
    customPresets.forEach((p, i) => el.presets.appendChild(makeChip(p.name, p.cfg, i)));

    const add = document.createElement('button');
    add.className = 'preset preset--add';
    add.textContent = '+ save';
    add.setAttribute('aria-label', 'Save current workout as a preset');
    add.addEventListener('click', openSheet);
    el.presets.appendChild(add);

    markActivePreset();
  }

  // a single preset chip; pass customIdx (number) to make it deletable
  function makeChip(name, conf, customIdx) {
    const b = document.createElement('button');
    b.className = 'preset';
    b._cfg = conf;

    const label = document.createElement('span');
    label.className = 'preset__name';
    label.textContent = name;
    b.appendChild(label);

    b.addEventListener('click', () => {
      cfg = { ...conf };
      save();
      renderSetup();
      tick(440, 0.05);
    });

    if (typeof customIdx === 'number') {
      const del = document.createElement('span');
      del.className = 'preset__del';
      del.textContent = '×';
      del.setAttribute('role', 'button');
      del.setAttribute('aria-label', 'delete ' + name);
      del.addEventListener('click', e => {
        e.stopPropagation();
        deletePreset(customIdx);
      });
      b.appendChild(del);
    }
    return b;
  }

  function markActivePreset() {
    document.querySelectorAll('.preset').forEach(b => {
      if (!b._cfg) return;
      const match = Object.keys(DEFAULTS).every(k => b._cfg[k] === cfg[k]);
      b.classList.toggle('preset--on', match);
    });
  }

  // ---------- save / delete custom presets ----------
  function openSheet() {
    tick(520, 0.04);
    el.presetName.value = '';
    el.sheet.classList.add('sheet--open');
    el.sheet.setAttribute('aria-hidden', 'false');
    setTimeout(() => el.presetName.focus(), 60);
  }
  function closeSheet() {
    el.sheet.classList.remove('sheet--open');
    el.sheet.setAttribute('aria-hidden', 'true');
    el.presetName.blur();
  }
  function commitSheet() {
    const name = el.presetName.value.trim().toLowerCase();
    if (!name) { el.presetName.focus(); return; }
    const snap = {};
    Object.keys(DEFAULTS).forEach(k => snap[k] = cfg[k]);
    const existing = customPresets.findIndex(p => p.name === name);
    if (existing >= 0) customPresets[existing].cfg = snap;   // overwrite same name
    else customPresets.push({ name, cfg: snap });
    savePresets();
    closeSheet();
    buildPresets();
    tick(660, 0.06);
  }
  function deletePreset(index) {
    customPresets.splice(index, 1);
    savePresets();
    buildPresets();
    tick(380, 0.05);
  }

  el.dials.addEventListener('click', e => {
    const btn = e.target.closest('.step');
    if (!btn) return;
    const key = btn.closest('.dial').dataset.key;
    const f = FIELD[key];
    const dir = btn.dataset.act === 'inc' ? 1 : -1;
    // when stepping down, size the step from just below the current value so
    // crossing a tier boundary (e.g. 30→29) lands on the finer increment
    const basis = dir > 0 ? cfg[key] : cfg[key] - 1;
    const delta = f.step(basis) * dir;
    cfg[key] = Math.min(f.max, Math.max(f.min, cfg[key] + delta));
    save();
    renderSetup();
    tick(dir > 0 ? 520 : 400, 0.04);
  });

  // ============================================================
  //  PHASE QUEUE
  // ============================================================
  function buildQueue() {
    const q = [];
    if (cfg.prepare > 0) q.push({ type: 'prepare', label: 'prepare', dur: cfg.prepare });
    for (let s = 0; s < cfg.sets; s++) {
      for (let r = 0; r < cfg.reps; r++) {
        q.push({ type: 'sprint', label: 'sprint', dur: cfg.sprint, rep: r + 1, set: s + 1 });
        const lastRep = r === cfg.reps - 1;
        const lastSet = s === cfg.sets - 1;
        if (cfg.recover > 0 && !(lastRep && lastSet)) {
          // skip recover on the final effort; between sets the rest covers it
          if (!lastRep || cfg.rest === 0) {
            q.push({ type: 'recover', label: 'recover', dur: cfg.recover, rep: r + 1, set: s + 1 });
          }
        }
      }
      if (s < cfg.sets - 1 && cfg.rest > 0) {
        q.push({ type: 'rest', label: 'set rest', dur: cfg.rest, set: s + 1 });
      }
    }
    return q;
  }

  // ============================================================
  //  TIMER ENGINE  (timestamp-based, drift free)
  // ============================================================
  let queue = [], idx = 0, totalEfforts = 0;
  let phaseEnd = 0, remaining = 0, paused = true, rafId = null;
  let lastWholeSecond = -1, cuedCountdown = -1;

  function startWorkout() {
    queue = buildQueue();
    idx = 0;
    totalEfforts = cfg.reps * cfg.sets;
    show('timer');
    requestWakeLock();
    enterPhase(0);
  }

  function enterPhase(i) {
    idx = i;
    if (idx >= queue.length) return finish();
    const ph = queue[idx];
    remaining = ph.dur;
    phaseEnd = performance.now() + ph.dur * 1000;
    paused = false;
    lastWholeSecond = -1;
    cuedCountdown = -1;

    // theme
    timerView.classList.remove('timer--sprint', 'timer--recover', 'timer--rest', 'timer--prepare', 'is-paused');
    timerView.classList.add('timer--' + ph.type);

    el.phase.textContent = ph.label;
    el.pause.textContent = 'pause';

    // counter + next-up
    const effortNum = ph.rep && ph.set ? (ph.set - 1) * cfg.reps + ph.rep : null;
    el.counter.textContent = ph.type === 'rest'
      ? `set ${ph.set} done`
      : (effortNum ? `rep ${effortNum} / ${totalEfforts}` : 'get ready');
    const nxt = queue[idx + 1];
    el.next.textContent = nxt ? `next · ${nxt.label}` : 'next · finish';

    cueStart(ph.type);
    render();
    loop();
  }

  function loop() {
    cancelAnimationFrame(rafId);
    const frame = () => {
      if (paused) return;
      const now = performance.now();
      remaining = (phaseEnd - now) / 1000;

      if (remaining <= 0) {
        render(0);
        return enterPhase(idx + 1);
      }

      // countdown cues at 3,2,1
      const whole = Math.ceil(remaining);
      if (whole <= 3 && whole !== cuedCountdown) {
        cuedCountdown = whole;
        tick(660, 0.06);
        haptic(20);
      }
      if (whole !== lastWholeSecond) {
        lastWholeSecond = whole;
        render();
      }
      rafId = requestAnimationFrame(frame);
    };
    rafId = requestAnimationFrame(frame);
  }

  function render(forceRemain) {
    const ph = queue[idx];
    if (!ph) return;
    const rem = forceRemain != null ? forceRemain : remaining;
    el.clock.textContent = clock(rem);
    const frac = Math.min(1, Math.max(0, rem / ph.dur));
    ringFill.style.strokeDashoffset = RING_LEN * (1 - frac);
  }

  function togglePause() {
    paused = !paused;
    timerView.classList.toggle('is-paused', paused);
    el.pause.textContent = paused ? 'resume' : 'pause';
    if (paused) {
      cancelAnimationFrame(rafId);
      releaseWakeLock();
    } else {
      // re-anchor end time so we resume exactly where we left off
      phaseEnd = performance.now() + remaining * 1000;
      requestWakeLock();
      loop();
    }
  }

  function skipPhase() {
    tick(380, 0.05);
    enterPhase(idx + 1);
  }

  function finish() {
    cancelAnimationFrame(rafId);
    releaseWakeLock();
    cueFinish();
    el.doneStats.textContent = `${totalEfforts} effort${totalEfforts === 1 ? '' : 's'} · ${clock(totalDuration())}`;
    show('done');
  }

  function quit() {
    cancelAnimationFrame(rafId);
    paused = true;
    releaseWakeLock();
    show('setup');
  }

  // ============================================================
  //  CUES — Web Audio (no asset files) + vibration
  // ============================================================
  let actx = null;
  function audio() {
    if (!actx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) actx = new AC();
    }
    if (actx && actx.state === 'suspended') actx.resume();
    return actx;
  }
  // soft sine "tick" with a gentle envelope — never harsh
  function tick(freq = 600, dur = 0.06, gain = 0.18) {
    const a = audio();
    if (!a) return;
    const osc = a.createOscillator();
    const g = a.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const t = a.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(a.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }
  function chord(freqs, dur = 0.5, gain = 0.16) {
    freqs.forEach((f, i) => setTimeout(() => tick(f, dur, gain), i * 70));
  }
  function haptic(ms) {
    if (navigator.vibrate) navigator.vibrate(ms);
  }
  function cueStart(type) {
    if (type === 'sprint')      { chord([523, 784], 0.45); haptic([0, 40, 60, 80]); }
    else if (type === 'recover'){ tick(392, 0.5, 0.16); haptic(40); }
    else if (type === 'rest')   { tick(330, 0.7, 0.15); haptic([0, 50, 80, 50]); }
    else                        { tick(440, 0.3, 0.13); haptic(30); }
  }
  function cueFinish() {
    chord([523, 659, 784, 1047], 0.6, 0.17);
    haptic([0, 80, 60, 80, 60, 160]);
  }

  // ============================================================
  //  WAKE LOCK — keep the screen on mid-workout
  // ============================================================
  let wakeLock = null;
  async function requestWakeLock() {
    try {
      if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen');
    } catch (_) { /* user can still train; ignore */ }
  }
  function releaseWakeLock() {
    if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !paused && views.timer.classList.contains('view--active')) {
      requestWakeLock();
    }
  });

  // ============================================================
  //  VIEW SWITCHER
  // ============================================================
  function show(name) {
    Object.values(views).forEach(v => v.classList.remove('view--active'));
    views[name].classList.add('view--active');
  }

  // ============================================================
  //  PERSISTENCE
  // ============================================================
  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem('aki.cfg'));
      if (raw) return { ...DEFAULTS, ...raw };
    } catch (_) {}
    return { ...DEFAULTS };
  }
  function save() { try { localStorage.setItem('aki.cfg', JSON.stringify(cfg)); } catch (_) {} }

  function loadPresets() {
    try {
      const raw = JSON.parse(localStorage.getItem('aki.presets'));
      if (Array.isArray(raw)) return raw.filter(p => p && p.name && p.cfg);
    } catch (_) {}
    return [];
  }
  function savePresets() {
    try { localStorage.setItem('aki.presets', JSON.stringify(customPresets)); } catch (_) {}
  }

  // ============================================================
  //  WIRING
  // ============================================================
  el.begin.addEventListener('click', () => { audio(); startWorkout(); });
  el.again.addEventListener('click', () => show('setup'));
  el.pause.addEventListener('click', togglePause);
  el.skip.addEventListener('click', skipPhase);
  el.quit.addEventListener('click', quit);

  // save-preset sheet
  $('#sheetSave').addEventListener('click', commitSheet);
  $('#sheetCancel').addEventListener('click', closeSheet);
  el.sheet.addEventListener('click', e => { if (e.target === el.sheet) closeSheet(); });
  el.presetName.addEventListener('keydown', e => { if (e.key === 'Enter') commitSheet(); });

  buildPresets();
  renderSetup();

  // service worker for offline use
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
