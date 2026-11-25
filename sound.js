// Zero-dependency Web Audio UI micro-sounds + 76 BPM Lo-Fi Hip-Hop background loop
(function () {
  const STORAGE_KEY = "twj_sound_enabled";
  const LOFI_KEY = "twj_lofi_enabled";
  let ctx = null;
  let masterGain = null;
  let compressor = null;
  let enabled = true;
  let lofiPlaying = false;
  let lofiTimer = null;
  let lofiBus = null;
  let stepIndex = 0;

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) {
      enabled = saved === "true";
    } else if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      enabled = false;
    }
  } catch (e) {}

  function ensureContext(force = false) {
    if (!enabled && !force) return null;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!ctx) {
      ctx = new AudioCtx();
      compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -16;
      compressor.ratio.value = 6;
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.24;
      compressor.connect(masterGain);
      masterGain.connect(ctx.destination);
    }
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }

  // Unlock AudioContext on first user gesture (iOS Safari / WebKit)
  ["pointerdown", "touchend", "keydown"].forEach((evt) => {
    window.addEventListener(evt, () => {
      if (ctx && ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
    }, { once: true, passive: true });
  });

  function playTone(freqStart, freqEnd, duration, type, gainPeak, delay = 0, targetNode = null) {
    const c = ensureContext();
    if (!c) return;
    const now = c.currentTime + delay;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, now);
    if (freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), now + duration);
    }
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(gainPeak, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(g);
    g.connect(targetNode || compressor);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  // ==========================================
  // 76 BPM LO-FI HIP-HOP SYNTH ENGINE
  // ==========================================
  function ensureLofiBus() {
    const c = ensureContext(true);
    if (!c) return null;
    if (!lofiBus) {
      lofiBus = c.createGain();
      lofiBus.gain.value = 0.0001;
      const lpf = c.createBiquadFilter();
      lpf.type = "lowpass";
      lpf.frequency.value = 1850; // Warm dusty tape roll-off
      lpf.Q.value = 0.7;
      lofiBus.connect(lpf);
      lpf.connect(compressor);
    }
    return lofiBus;
  }

  function playNoiseHit(duration, filterFreq, filterType, peakGain, bus) {
    const c = ctx;
    if (!c || !bus) return;
    const len = Math.floor(c.sampleRate * duration);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    const filt = c.createBiquadFilter();
    filt.type = filterType;
    filt.frequency.value = filterFreq;
    const g = c.createGain();
    const now = c.currentTime;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(peakGain, now + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    src.connect(filt);
    filt.connect(g);
    g.connect(bus);
    src.start(now);
  }

  // Classic chillhop progression: Fmaj7 -> Em7 -> Dm7 -> Cmaj7
  const CHORDS = [
    { bass: 87.31, notes: [174.61, 220.0, 261.63, 329.63] },  // Fmaj7
    { bass: 82.41, notes: [164.81, 196.0, 246.94, 293.66] },  // Em7
    { bass: 73.42, notes: [146.83, 174.61, 220.0, 261.63] },  // Dm7
    { bass: 65.41, notes: [130.81, 164.81, 196.0, 246.94] }   // Cmaj7
  ];
  const TOP_MELODY = [523.25, null, 659.25, 587.33, null, 440.0, 523.25, null];

  function scheduleLofiStep() {
    if (!lofiPlaying || !ctx) return;
    const bus = ensureLofiBus();
    if (!bus) return;

    const bar = Math.floor(stepIndex / 8) % CHORDS.length;
    const beatStep = stepIndex % 8; // 8 eighth-notes per bar at 76 BPM (~394ms/step)
    const chord = CHORDS[bar];

    // 1. Dusty Rhodes Chord on beat 1 (plus gentle syncopation on step 5)
    if (beatStep === 0 || beatStep === 5) {
      const dur = beatStep === 0 ? 1.85 : 0.9;
      const vol = beatStep === 0 ? 0.11 : 0.065;
      chord.notes.forEach((n, idx) => {
        playTone(n, n * 0.997, dur, "triangle", vol, idx * 0.014, bus);
      });
    }

    // 2. Warm Sub Bass on beat 1 & beat 3.5
    if (beatStep === 0 || beatStep === 5) {
      playTone(chord.bass, chord.bass, 0.75, "sine", 0.34, 0, bus);
    }

    // 3. Laid-back Boom-Bap Kick (steps 0, 3, 4)
    if (beatStep === 0 || beatStep === 3 || beatStep === 4) {
      playTone(112, 42, 0.16, "sine", 0.42, 0, bus);
    }

    // 4. Soft Lo-Fi Snare on 2 & 4 (steps 2 & 6)
    if (beatStep === 2 || beatStep === 6) {
      playNoiseHit(0.11, 1450, "bandpass", 0.14, bus);
      playTone(175, 95, 0.07, "triangle", 0.12, 0, bus);
    }

    // 5. Swung Dusty Hi-Hat + Subtle Vinyl Texture
    playNoiseHit(0.035, 6200, "highpass", beatStep % 2 === 0 ? 0.04 : 0.025, bus);
    if (beatStep === 0) {
      playNoiseHit(1.2, 3200, "bandpass", 0.012, bus); // gentle vinyl warmth
    }

    // 6. Sparse Top-Line Rhodes Pluck
    const mel = TOP_MELODY[beatStep];
    if (mel && Math.random() > 0.32) {
      playTone(mel, mel * 0.998, 0.42, "sine", 0.06, 0.02, bus);
    }

    stepIndex++;
    // Slight lo-fi swing on odd eighth-notes
    const swingMs = beatStep % 2 === 0 ? 410 : 378;
    lofiTimer = setTimeout(scheduleLofiStep, swingMs);
  }

  function startLofi() {
    const c = ensureContext(true);
    const bus = ensureLofiBus();
    if (!c || !bus) return;
    if (lofiPlaying) return;
    lofiPlaying = true;
    bus.gain.setTargetAtTime(0.55, c.currentTime, 0.25);
    scheduleLofiStep();
    try { localStorage.setItem(LOFI_KEY, "true"); } catch (e) {}
    TravelSound.syncButtons();
  }

  function stopLofi() {
    lofiPlaying = false;
    if (lofiTimer) {
      clearTimeout(lofiTimer);
      lofiTimer = null;
    }
    if (ctx && lofiBus) {
      lofiBus.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.12);
    }
    try { localStorage.setItem(LOFI_KEY, "false"); } catch (e) {}
    TravelSound.syncButtons();
  }

  document.addEventListener("visibilitychange", () => {
    if (!lofiPlaying) return;
    if (document.hidden) {
      if (lofiTimer) { clearTimeout(lofiTimer); lofiTimer = null; }
      if (ctx && lofiBus) lofiBus.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.08);
    } else if (ctx && lofiBus) {
      lofiBus.gain.setTargetAtTime(0.55, ctx.currentTime, 0.2);
      scheduleLofiStep();
    }
  });

  const PENTATONIC = [523.25, 587.33, 659.25, 783.99, 880.0];

  const TravelSound = {
    isEnabled: () => enabled,
    isLofiPlaying: () => lofiPlaying,
    toggleLofi() {
      if (lofiPlaying) {
        stopLofi();
      } else {
        startLofi();
      }
      return lofiPlaying;
    },
    setEnabled(val) {
      enabled = !!val;
      try { localStorage.setItem(STORAGE_KEY, String(enabled)); } catch (e) {}
      this.syncButtons();
      if (enabled) this.play("toastOn");
    },
    toggle() {
      this.setEnabled(!enabled);
      return enabled;
    },
    syncButtons() {
      document.querySelectorAll("#soundToggleBtn").forEach((btn) => {
        btn.classList.toggle("is-muted", !enabled);
        btn.setAttribute("aria-pressed", String(enabled));
        const icon = btn.querySelector(".snd-icon");
        if (icon) icon.textContent = enabled ? "🔊" : "🔇";
      });
      document.querySelectorAll("#lofiToggleBtn").forEach((btn) => {
        btn.classList.toggle("active", lofiPlaying);
        btn.setAttribute("aria-pressed", String(lofiPlaying));
        const lbl = btn.querySelector(".lofi-lbl");
        if (lbl) lbl.textContent = lofiPlaying ? "Lo-Fi On" : "Lo-Fi";
      });
    },
    play(id, opts = {}) {
      if (!enabled) return;
      try {
        switch (id) {
          case "tap":
            playTone(620, 260, 0.042, "triangle", 0.32);
            break;
          case "pinDrop": {
            const f = PENTATONIC[(opts.index || 0) % PENTATONIC.length];
            playTone(f, f * 1.02, 0.09, "sine", 0.28);
            playTone(f * 2, f * 2, 0.06, "triangle", 0.08, 0.01);
            break;
          }
          case "map3d":
            playTone(opts.is3D ? 280 : 440, opts.is3D ? 520 : 260, 0.14, "sine", 0.22);
            break;
          case "mapPing":
            playTone(880, 880, 0.11, "sine", 0.28);
            playTone(1320, 1320, 0.12, "sine", 0.12, 0.06);
            break;
          case "drawerOpen":
            playTone(320, 480, 0.085, "sine", 0.18);
            break;
          case "drawerClose":
            playTone(440, 290, 0.075, "sine", 0.15);
            break;
          case "modalOpen":
            playTone(392, 523.25, 0.12, "sine", 0.2);
            break;
          case "modalClose":
            playTone(493.88, 349.23, 0.09, "sine", 0.16);
            break;
          case "toastOn":
            playTone(523.25, 523.25, 0.08, "triangle", 0.22);
            playTone(659.25, 659.25, 0.11, "triangle", 0.22, 0.06);
            break;
          case "waSend":
            playTone(523.25, 523.25, 0.08, "sine", 0.22, 0);
            playTone(659.25, 659.25, 0.08, "sine", 0.22, 0.055);
            playTone(783.99, 783.99, 0.14, "sine", 0.24, 0.11);
            break;
        }
      } catch (e) {}
    }
  };

  window.TravelSound = TravelSound;
  document.addEventListener("DOMContentLoaded", () => TravelSound.syncButtons());
})();
