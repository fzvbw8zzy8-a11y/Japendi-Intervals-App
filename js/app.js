/* ============================================================
   Aki · Intervals — app logic
   A drift-free interval engine with soft audio + haptic cues,
   screen wake-lock, and persisted settings.
   ============================================================ */

(() => {
  'use strict';

  // ---------- configuration model ----------
  // kind 'intervals' uses sprint/recover/reps/sets/rest;
  // kind 'breathing' uses inhale/hold/exhale/holdout/rounds
  const DEFAULTS = {
    kind: 'intervals',
    prepare: 10, sprint: 30, recover: 60, reps: 8, sets: 1, rest: 120,
    inhale: 4, hold: 4, exhale: 4, holdout: 4, rounds: 8,
  };

  // which fields belong to each workout kind (prepare is shared)
  const KEYS = {
    intervals: ['prepare', 'sprint', 'recover', 'reps', 'sets', 'rest'],
    breathing: ['prepare', 'inhale', 'hold', 'exhale', 'holdout', 'rounds'],
  };
  const COUNT_FIELDS = new Set(['reps', 'sets', 'rounds']);

  // step size + bounds per field; steps are fine (1s) at breathing-scale
  // durations and grow coarser for longer sprint/recovery intervals
  const FIELD = {
    prepare: { min: 0,  max: 60,   step: v => (v < 10 ? 1 : 5) },
    sprint:  { min: 1,  max: 600,  step: v => (v < 30 ? 1 : v < 60 ? 5 : 10) },
    recover: { min: 0,  max: 900,  step: v => (v < 30 ? 1 : v < 60 ? 5 : v < 180 ? 15 : 30) },
    reps:    { min: 1,  max: 50,   step: v => 1 },
    sets:    { min: 1,  max: 20,   step: v => 1 },
    rest:    { min: 0,  max: 900,  step: v => (v < 60 ? 5 : 30) },
    inhale:  { min: 1,  max: 30,   step: v => 1 },
    hold:    { min: 0,  max: 60,   step: v => 1 },
    exhale:  { min: 1,  max: 30,   step: v => 1 },
    holdout: { min: 0,  max: 60,   step: v => 1 },
    rounds:  { min: 1,  max: 99,   step: v => 1 },
  };

  // built-in starting points (read-only)
  const PRESETS = {
    'sprint repeats': { kind: 'intervals', prepare: 10, sprint: 30, recover: 90, reps: 8,  sets: 1, rest: 0 },
    'tabata':         { kind: 'intervals', prepare: 10, sprint: 20, recover: 10, reps: 8,  sets: 1, rest: 0 },
    'hill 400s':      { kind: 'intervals', prepare: 15, sprint: 75, recover: 120, reps: 6, sets: 1, rest: 0 },
    'pyramid':        { kind: 'intervals', prepare: 10, sprint: 45, recover: 75, reps: 10, sets: 2, rest: 180 },
    'forearms':       { kind: 'intervals', prepare: 0,  sprint: 20, recover: 20, reps: 6,  sets: 1, rest: 0 },
    'vo2 max':        { kind: 'intervals', prepare: 5,  sprint: 30, recover: 10, reps: 10, sets: 1, rest: 0 },
    'box 4·4·4·4':    { kind: 'breathing', prepare: 4, inhale: 4, hold: 4, exhale: 4, holdout: 4, rounds: 8 },
    '4·7·8':          { kind: 'breathing', prepare: 4, inhale: 4, hold: 7, exhale: 8, holdout: 0, rounds: 6 },
  };

  let cfg = load();
  let customPresets = loadPresets();   // [{ name, cfg }]

  // ---------- elements ----------
  const $ = sel => document.querySelector(sel);
  const views = { setup: $('#setup'), timer: $('#timer'), done: $('#done'), habits: $('#habits') };
  const timerView = views.timer;

  const ringFill = $('#ringFill');
  const RING_LEN = 2 * Math.PI * 108;
  ringFill.style.strokeDasharray = RING_LEN;

  const el = {
    phase: $('#phaseLabel'), clock: $('#clock'), next: $('#nextUp'),
    counter: $('#counter'), pause: $('#pause'), skip: $('#skip'),
    quit: $('#quit'), begin: $('#begin'), again: $('#again'),
    summary: $('#summary'), doneStats: $('#doneStats'),
    presets: $('#presets'), dials: $('#dials'), dialsBreath: $('#dialsBreath'),
    setup: $('#setup'),
    sheet: $('#sheet'), presetName: $('#presetName'),
    // habit tracker
    habitList: $('#habitList'), habitDay: $('#habitDay'), habitEdit: $('#habitEdit'),
    addHabit: $('#addHabit'), habitSheet: $('#habitSheet'),
    habitNameInput: $('#habitNameInput'), habitTargetVal: $('#habitTargetVal'),
    habitSwatches: $('#habitSwatches'),
    // tasks
    taskList: $('#taskList'), tasksHead: $('#tasksHead'), addTask: $('#addTask'),
    taskSheet: $('#taskSheet'), taskTextInput: $('#taskTextInput'),
    taskKind: $('#taskKind'), taskHint: $('#taskHint'),
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
    const breathing = cfg.kind === 'breathing';
    el.setup.classList.toggle('is-breathing', breathing);

    KEYS[cfg.kind].forEach(key => {
      const txt = COUNT_FIELDS.has(key) ? cfg[key] : fmt(cfg[key]);
      document.querySelectorAll(`[data-display="${key}"]`).forEach(n => n.textContent = txt);
    });

    // summary line
    if (breathing) {
      const r = cfg.rounds;
      document.querySelector('[data-display="totalReps"]').textContent =
        `${r} round${r === 1 ? '' : 's'}`;
    } else {
      const efforts = cfg.reps * cfg.sets;
      document.querySelector('[data-display="totalReps"]').textContent =
        `${efforts} effort${efforts === 1 ? '' : 's'}`;
    }
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
      cfg = { ...DEFAULTS, ...conf };   // merge so every field exists for either kind
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
      const pc = b._cfg;
      if (!pc) return;
      const kind = pc.kind || 'intervals';
      const match = kind === cfg.kind && KEYS[kind].every(k => pc[k] === cfg[k]);
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
    const snap = { kind: cfg.kind };
    KEYS[cfg.kind].forEach(k => snap[k] = cfg[k]);
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

  function onDialClick(e) {
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
  }
  el.dials.addEventListener('click', onDialClick);
  el.dialsBreath.addEventListener('click', onDialClick);

  // ============================================================
  //  PHASE QUEUE
  // ============================================================
  function buildQueue() {
    return cfg.kind === 'breathing' ? buildBreathQueue() : buildIntervalQueue();
  }

  // breathing: inhale → hold → exhale → hold-out, per round.
  // the ring fills on the inhale and empties on the exhale for a visual guide.
  function buildBreathQueue() {
    const q = [];
    if (cfg.prepare > 0) q.push({ type: 'prepare', label: 'prepare', dur: cfg.prepare, ring: 'drain' });
    const breath = [
      { type: 'inhale',  label: 'inhale',  key: 'inhale',  ring: 'fill' },
      { type: 'hold',    label: 'hold',    key: 'hold',    ring: 'hold-full' },
      { type: 'exhale',  label: 'exhale',  key: 'exhale',  ring: 'drain' },
      { type: 'holdout', label: 'hold',    key: 'holdout', ring: 'hold-empty' },
    ];
    for (let r = 0; r < cfg.rounds; r++) {
      breath.forEach(b => {
        if (cfg[b.key] > 0) {
          q.push({ type: b.type, label: b.label, dur: cfg[b.key], ring: b.ring, round: r + 1 });
        }
      });
    }
    return q;
  }

  function buildIntervalQueue() {
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
  let breathingMode = false;

  function startWorkout() {
    queue = buildQueue();
    idx = 0;
    breathingMode = cfg.kind === 'breathing';
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
    timerView.classList.remove(
      'timer--sprint', 'timer--recover', 'timer--rest', 'timer--prepare',
      'timer--inhale', 'timer--hold', 'timer--exhale', 'timer--holdout', 'is-paused');
    timerView.classList.add('timer--' + ph.type);

    el.phase.textContent = ph.label;
    el.pause.textContent = 'pause';

    // counter + next-up
    if (breathingMode) {
      el.counter.textContent = ph.round ? `round ${ph.round} / ${cfg.rounds}` : 'get ready';
    } else {
      const effortNum = ph.rep && ph.set ? (ph.set - 1) * cfg.reps + ph.rep : null;
      el.counter.textContent = ph.type === 'rest'
        ? `set ${ph.set} done`
        : (effortNum ? `rep ${effortNum} / ${totalEfforts}` : 'get ready');
    }
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

      // countdown cues at 3,2,1 — suppressed in breathing for a calm experience
      const whole = Math.ceil(remaining);
      if (!breathingMode && whole <= 3 && whole !== cuedCountdown) {
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
    let offset;
    switch (ph.ring) {
      case 'fill':       offset = RING_LEN * frac; break;       // empty → full (inhale)
      case 'hold-full':  offset = 0; break;                     // stays full (hold)
      case 'hold-empty': offset = RING_LEN; break;              // stays empty (hold out)
      default:           offset = RING_LEN * (1 - frac);        // full → empty (drain)
    }
    ringFill.style.strokeDashoffset = offset;
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
    el.doneStats.textContent = breathingMode
      ? `${cfg.rounds} round${cfg.rounds === 1 ? '' : 's'} · ${clock(totalDuration())}`
      : `${totalEfforts} effort${totalEfforts === 1 ? '' : 's'} · ${clock(totalDuration())}`;
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
  // a soft tone that glides between two pitches — used for calm breath swells
  function swell(f0, f1, dur = 0.9, gain = 0.12) {
    const a = audio();
    if (!a) return;
    const osc = a.createOscillator();
    const g = a.createGain();
    osc.type = 'sine';
    const t = a.currentTime;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.linearRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + dur * 0.35);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(a.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }
  function cueStart(type) {
    switch (type) {
      // sprint / interval cues — clear and energetic
      case 'sprint':  chord([523, 784], 0.45); haptic([0, 40, 60, 80]); break;
      case 'recover': tick(392, 0.5, 0.16);    haptic(40); break;
      case 'rest':    tick(330, 0.7, 0.15);    haptic([0, 50, 80, 50]); break;
      // breathing cues — soft, gliding, gentle haptics
      case 'inhale':  swell(330, 466, 0.9, 0.12); haptic(25); break;
      case 'exhale':  swell(466, 294, 1.0, 0.12); haptic(25); break;
      case 'hold':
      case 'holdout': tick(392, 0.22, 0.06);      haptic(12); break;
      default:        tick(440, 0.3, 0.13);       haptic(30); // prepare
    }
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
  //  DEEP LINKS — launch a specific workout from a URL.
  //  Used by iOS Shortcuts / Lock-Screen widgets and (later) the
  //  native widget, e.g.  …/?start=vo2-max  or  …/?open=box-4-4-4-4
  //    start=<slug> → load that preset and begin immediately
  //    open=<slug>  → load that preset, stay on setup (one tap to begin)
  // ============================================================
  function slugify(s) {
    return s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
  function findPresetBySlug(slug) {
    for (const name in PRESETS) if (slugify(name) === slug) return PRESETS[name];
    const c = customPresets.find(p => slugify(p.name) === slug);
    return c ? c.cfg : null;
  }
  // resume audio on the first touch, since a deep-link auto-begin has no
  // in-page gesture and iOS keeps the audio context suspended until one
  function primeAudioOnFirstTouch() {
    const resume = () => { audio(); };
    document.addEventListener('pointerdown', resume, { once: true });
  }
  function handleDeepLink() {
    const params = new URLSearchParams(location.search);
    const startSlug = params.get('start');
    const slug = startSlug || params.get('open');
    if (!slug) return;
    if (launchPreset(slug, !!startSlug)) {
      // drop the query so a later manual refresh doesn't re-trigger the launch
      try { history.replaceState({}, '', location.pathname); } catch (_) {}
    }
  }

  // load a preset by slug and optionally begin it. returns false if unknown.
  function launchPreset(slug, begin) {
    const pc = findPresetBySlug(slug);
    if (!pc) return false;
    cfg = { ...DEFAULTS, ...pc };
    save();
    show('setup');
    renderSetup();
    if (begin) {
      primeAudioOnFirstTouch();
      audio();
      startWorkout();
    }
    return true;
  }

  // exposed for the native widget bridge (Capacitor appUrlOpen → js/native.js)
  window.aki = {
    start: slug => launchPreset(slug, true),
    open:  slug => launchPreset(slug, false),
    // pull habit/task data written by the widget (App Group) back into the app
    ingestHabits(json) {
      try {
        const d = typeof json === 'string' ? JSON.parse(json) : json;
        if (!d) return;
        if (Array.isArray(d.habits)) habits = d.habits;
        if (d.log && typeof d.log === 'object') habitLog = d.log;
        if (Array.isArray(d.tasks)) tasks = d.tasks;
        if (d.tasklog && typeof d.tasklog === 'object') taskLog = d.tasklog;
        try {
          localStorage.setItem('aki.habits', JSON.stringify(habits));
          localStorage.setItem('aki.habitlog', JSON.stringify(habitLog));
          localStorage.setItem('aki.tasks', JSON.stringify(tasks));
          localStorage.setItem('aki.tasklog', JSON.stringify(taskLog));
        } catch (_) {}
        if (views.habits.classList.contains('view--active')) renderTracker();
      } catch (_) {}
    },
  };

  // ============================================================
  //  HABIT TRACKER
  //  Daily habits with a per-habit target count. Tap completes /
  //  increments; tapping past the target wraps to 0 (undo).
  //  Storage mirrors to the native App Group store (for the widget)
  //  when running inside the Capacitor app.
  // ============================================================
  const ACCENT_VAR = { clay: 'var(--clay)', sage: 'var(--sage)', dust: 'var(--dust)', mocha: 'var(--mocha-soft)' };

  let habits = loadHabits();
  let habitLog = loadHabitLog();
  let tasks = loadTasks();
  let taskLog = loadTaskLog();
  let habitEditing = false;
  let draftAccent = 'clay';
  let draftTarget = 1;
  let draftTaskKind = 'once';

  function dayKey(d = new Date()) {
    const z = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
  }
  function keyOffset(off) { const d = new Date(); d.setDate(d.getDate() + off); return dayKey(d); }

  function loadHabits() {
    try { const r = JSON.parse(localStorage.getItem('aki.habits')); if (Array.isArray(r)) return r; } catch (_) {}
    return [];
  }
  function loadHabitLog() {
    try { const r = JSON.parse(localStorage.getItem('aki.habitlog')); if (r && typeof r === 'object') return r; } catch (_) {}
    return {};
  }
  function loadTasks() {
    try { const r = JSON.parse(localStorage.getItem('aki.tasks')); if (Array.isArray(r)) return r; } catch (_) {}
    return [];
  }
  function loadTaskLog() {
    try { const r = JSON.parse(localStorage.getItem('aki.tasklog')); if (r && typeof r === 'object') return r; } catch (_) {}
    return {};
  }
  function persistAll() {
    try {
      localStorage.setItem('aki.habits', JSON.stringify(habits));
      localStorage.setItem('aki.habitlog', JSON.stringify(habitLog));
      localStorage.setItem('aki.tasks', JSON.stringify(tasks));
      localStorage.setItem('aki.tasklog', JSON.stringify(taskLog));
    } catch (_) {}
    // mirror to the native App Group store so the widget sees the same data
    try {
      const S = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.AkiStore;
      if (S && S.set) S.set({ value: JSON.stringify({ habits, log: habitLog, tasks, tasklog: taskLog }) });
    } catch (_) {}
  }

  function habitCount(id, key = dayKey()) { const day = habitLog[key]; return (day && day[id]) || 0; }
  function habitDone(h, key = dayKey()) { return habitCount(h.id, key) >= (h.target || 1); }

  function tapHabit(h) {
    const key = dayKey();
    if (!habitLog[key]) habitLog[key] = {};
    const target = h.target || 1;
    const cur = habitLog[key][h.id] || 0;
    const next = cur >= target ? 0 : cur + 1;     // wrap to 0 to undo once complete
    if (next === 0) delete habitLog[key][h.id]; else habitLog[key][h.id] = next;
    persistAll();
    renderHabits();
    if (next >= target && next !== 0) { tick(660, 0.06); haptic(20); }
    else { tick(next === 0 ? 380 : 520, 0.04); }
  }

  function computeStreak(h) {
    let streak = 0;
    let off = habitDone(h, keyOffset(0)) ? 0 : -1;   // today not done yet → count from yesterday
    while (off > -3650 && habitCount(h.id, keyOffset(off)) >= (h.target || 1)) { streak++; off--; }
    return streak;
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }
  function streakLabel(s) { return s > 0 ? `${s} day${s === 1 ? '' : 's'}` : 'start today'; }
  function trailDots(h) {
    let out = '';
    for (let off = -6; off <= 0; off++) {
      const on = habitCount(h.id, keyOffset(off)) >= (h.target || 1);
      out += `<span class="habit__dot${on ? ' on' : ''}"></span>`;
    }
    return out;
  }

  function renderHabits() {
    el.habitDay.textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
    const list = el.habitList;
    list.classList.toggle('is-editing', habitEditing);
    list.innerHTML = '';
    if (habits.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'habits__empty';
      empty.textContent = 'no habits yet — add one below';
      list.appendChild(empty);
      return;
    }
    const R = 18, LEN = 2 * Math.PI * R;
    habits.forEach(h => {
      const target = h.target || 1;
      const count = habitCount(h.id);
      const off = LEN * (1 - Math.min(1, count / target));
      const card = document.createElement('div');
      card.className = 'habit' + (habitDone(h) ? ' is-done' : '');
      card.style.setProperty('--habit-accent', ACCENT_VAR[h.accent] || ACCENT_VAR.clay);

      const tap = document.createElement('button');
      tap.className = 'habit__tap';
      tap.setAttribute('aria-label', 'complete ' + h.name);
      tap.innerHTML =
        `<span class="habit__ring">
          <svg viewBox="0 0 42 42">
            <circle class="habit__ringtrack" cx="21" cy="21" r="${R}"/>
            <circle class="habit__ringfill" cx="21" cy="21" r="${R}" style="stroke-dasharray:${LEN};stroke-dashoffset:${off}"/>
          </svg>
          <span class="habit__check">✓</span>
        </span>
        <span class="habit__body">
          <span class="habit__name">${escapeHtml(h.name)}</span>
          <span class="habit__meta">
            ${target > 1 ? `<span class="habit__count">${count}/${target}</span>` : ''}
            <span class="habit__streak">${streakLabel(computeStreak(h))}</span>
            <span class="habit__trail">${trailDots(h)}</span>
          </span>
        </span>`;
      tap.addEventListener('click', () => tapHabit(h));
      card.appendChild(tap);

      const del = document.createElement('button');
      del.className = 'habit__del';
      del.textContent = '×';
      del.setAttribute('aria-label', 'delete ' + h.name);
      del.addEventListener('click', e => { e.stopPropagation(); deleteHabit(h.id); });
      card.appendChild(del);

      list.appendChild(card);
    });
  }

  function deleteHabit(id) {
    habits = habits.filter(h => h.id !== id);
    persistAll();
    renderHabits();
    tick(380, 0.05);
  }

  // ---------- new-habit sheet ----------
  function updateSwatches() {
    el.habitSwatches.querySelectorAll('.swatch').forEach(s =>
      s.classList.toggle('swatch--on', s.dataset.accent === draftAccent));
  }
  function openHabitSheet() {
    tick(520, 0.04);
    el.habitNameInput.value = '';
    draftTarget = 1; draftAccent = 'clay';
    el.habitTargetVal.textContent = '1';
    updateSwatches();
    el.habitSheet.classList.add('sheet--open');
    el.habitSheet.setAttribute('aria-hidden', 'false');
    setTimeout(() => el.habitNameInput.focus(), 60);
  }
  function closeHabitSheet() {
    el.habitSheet.classList.remove('sheet--open');
    el.habitSheet.setAttribute('aria-hidden', 'true');
    el.habitNameInput.blur();
  }
  function commitHabit() {
    const name = el.habitNameInput.value.trim();
    if (!name) { el.habitNameInput.focus(); return; }
    habits.push({
      id: 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name, target: draftTarget, accent: draftAccent, created: dayKey(),
    });
    persistAll();
    closeHabitSheet();
    renderHabits();
    tick(660, 0.06);
  }

  // ============================================================
  //  TASKS  (one-off 'once' persist until done; 'daily' reset each day)
  // ============================================================
  function taskDone(t) {
    if (t.kind === 'daily') { const d = taskLog[dayKey()]; return !!(d && d[t.id]); }
    return !!t.done;
  }
  function toggleTask(t) {
    if (t.kind === 'daily') {
      const k = dayKey();
      if (!taskLog[k]) taskLog[k] = {};
      if (taskLog[k][t.id]) delete taskLog[k][t.id]; else taskLog[k][t.id] = 1;
    } else {
      t.done = !t.done;
    }
    persistAll();
    renderTasks();
    const done = taskDone(t);
    tick(done ? 660 : 380, done ? 0.06 : 0.04);
    haptic(15);
  }
  // completed one-off tasks clear on the next app open / day rollover
  function purgeDoneOnceTasks() {
    const before = tasks.length;
    tasks = tasks.filter(t => !(t.kind === 'once' && t.done));
    if (tasks.length !== before) persistAll();
  }

  function renderTasks() {
    const list = el.taskList;
    list.classList.toggle('is-editing', habitEditing);
    list.innerHTML = '';
    el.tasksHead.style.display = tasks.length ? '' : 'none';
    tasks.forEach(t => {
      const done = taskDone(t);
      const card = document.createElement('div');
      card.className = 'task' + (done ? ' is-done' : '');

      const tap = document.createElement('button');
      tap.className = 'task__tap';
      tap.setAttribute('aria-label', (done ? 'uncomplete ' : 'complete ') + t.text);
      tap.innerHTML =
        `<span class="task__box">${done ? '✓' : ''}</span>
         <span class="task__text">${escapeHtml(t.text)}</span>
         <span class="task__kind">${t.kind}</span>`;
      tap.addEventListener('click', () => toggleTask(t));
      card.appendChild(tap);

      const del = document.createElement('button');
      del.className = 'task__del';
      del.textContent = '×';
      del.setAttribute('aria-label', 'delete ' + t.text);
      del.addEventListener('click', e => { e.stopPropagation(); deleteTask(t.id); });
      card.appendChild(del);

      list.appendChild(card);
    });
  }

  function deleteTask(id) {
    tasks = tasks.filter(t => t.id !== id);
    persistAll();
    renderTasks();
    tick(380, 0.05);
  }

  // ---------- new-task sheet ----------
  function updateTaskKind() {
    el.taskKind.querySelectorAll('.seg__opt').forEach(o =>
      o.classList.toggle('seg__opt--on', o.dataset.kind === draftTaskKind));
    el.taskHint.textContent = draftTaskKind === 'daily'
      ? 'resets every morning' : 'stays until you complete it';
  }
  function openTaskSheet() {
    tick(520, 0.04);
    el.taskTextInput.value = '';
    draftTaskKind = 'once';
    updateTaskKind();
    el.taskSheet.classList.add('sheet--open');
    el.taskSheet.setAttribute('aria-hidden', 'false');
    setTimeout(() => el.taskTextInput.focus(), 60);
  }
  function closeTaskSheet() {
    el.taskSheet.classList.remove('sheet--open');
    el.taskSheet.setAttribute('aria-hidden', 'true');
    el.taskTextInput.blur();
  }
  function commitTask() {
    const text = el.taskTextInput.value.trim();
    if (!text) { el.taskTextInput.focus(); return; }
    tasks.push({
      id: 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      text, kind: draftTaskKind, done: false,
    });
    persistAll();
    closeTaskSheet();
    renderTasks();
    tick(660, 0.06);
  }

  // ---------- tab navigation ----------
  function renderTracker() { renderHabits(); renderTasks(); }
  function switchTab(name) {
    show(name);
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('tab--on', t.dataset.tab === name));
    if (name === 'habits') renderTracker();
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

  // tab navigation (train / habits)
  document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => switchTab(t.dataset.tab)));

  // habit tracker
  el.addHabit.addEventListener('click', openHabitSheet);
  el.habitEdit.addEventListener('click', () => {
    habitEditing = !habitEditing;
    el.habitEdit.textContent = habitEditing ? 'done' : 'edit';
    renderTracker();
  });
  $('#habitSave').addEventListener('click', commitHabit);
  $('#habitCancel').addEventListener('click', closeHabitSheet);
  el.habitSheet.addEventListener('click', e => { if (e.target === el.habitSheet) closeHabitSheet(); });
  el.habitNameInput.addEventListener('keydown', e => { if (e.key === 'Enter') commitHabit(); });
  el.habitSwatches.addEventListener('click', e => {
    const s = e.target.closest('.swatch');
    if (!s) return;
    draftAccent = s.dataset.accent;
    updateSwatches();
  });
  el.habitSheet.querySelector('.sheet__stepper').addEventListener('click', e => {
    const btn = e.target.closest('.step');
    if (!btn) return;
    draftTarget = Math.min(20, Math.max(1, draftTarget + (btn.dataset.habitTarget === 'inc' ? 1 : -1)));
    el.habitTargetVal.textContent = draftTarget;
    tick(480, 0.03);
  });

  // tasks
  el.addTask.addEventListener('click', openTaskSheet);
  $('#taskSave').addEventListener('click', commitTask);
  $('#taskCancel').addEventListener('click', closeTaskSheet);
  el.taskSheet.addEventListener('click', e => { if (e.target === el.taskSheet) closeTaskSheet(); });
  el.taskTextInput.addEventListener('keydown', e => { if (e.key === 'Enter') commitTask(); });
  el.taskKind.addEventListener('click', e => {
    const o = e.target.closest('.seg__opt');
    if (!o) return;
    draftTaskKind = o.dataset.kind;
    updateTaskKind();
    tick(480, 0.03);
  });

  purgeDoneOnceTasks();
  buildPresets();
  renderSetup();
  handleDeepLink();

  // service worker for offline use
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
