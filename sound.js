// Web Audio UI micro-sounds + Real Lo-Fi MP3 background loop (assets/lofi.mp3)
(function () {
  const STORAGE_KEY = "twj_sound_enabled";
  const LOFI_KEY = "twj_lofi_enabled";
  let ctx = null;
  let masterGain = null;
  let compressor = null;
  let enabled = true;
  let lofiPlaying = false;
  let lofiAudio = null;

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) {
      enabled = saved === "true";
    } else if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      enabled = false;
    }
  } catch (e) {}

  function ensureContext() {
    if (!enabled) return null;
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

  function playTone(freqStart, freqEnd, duration, type, gainPeak, delay = 0) {
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
    g.connect(compressor);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  function ensureLofiAudio() {
    if (!lofiAudio) {
      lofiAudio = new Audio("assets/lofi.mp3");
      lofiAudio.loop = true;
      lofiAudio.preload = "auto";
      lofiAudio.volume = 0.36;
    }
    return lofiAudio;
  }

  function startLofi() {
    const audio = ensureLofiAudio();
    lofiPlaying = true;
    audio.play().catch(() => {
      lofiPlaying = false;
      TravelSound.syncButtons();
    });
    try { localStorage.setItem(LOFI_KEY, "true"); } catch (e) {}
    TravelSound.syncButtons();
  }

  function stopLofi() {
    lofiPlaying = false;
    if (lofiAudio) {
      lofiAudio.pause();
    }
    try { localStorage.setItem(LOFI_KEY, "false"); } catch (e) {}
    TravelSound.syncButtons();
  }

  document.addEventListener("visibilitychange", () => {
    if (!lofiAudio || !lofiPlaying) return;
    if (document.hidden) {
      lofiAudio.pause();
    } else {
      lofiAudio.play().catch(() => {});
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
