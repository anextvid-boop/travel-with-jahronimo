// Travel With Jahronimo — Web Audio UI SFX + 10 Real Chill Lo-Fi MP3 Autoplay
(function () {
  "use strict";

  const STORAGE_KEY = "twj_sound_enabled";
  const LOFI_KEY = "twj_lofi_enabled";
  const LAST_TRACK_KEY = "twj_last_track";

  let ctx = null;
  let enabled = true;
  let lofiWanted = true;
  let lofiPlaying = false;
  let lofiAudio = null;
  let activeTrackIdx = 0;

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "false") enabled = false;
    const savedLofi = localStorage.getItem(LOFI_KEY);
    if (savedLofi === "false") lofiWanted = false;
  } catch (e) {}

  // 10 Real Recorded Chill Lo-Fi MP3 Tracks (No synthesized music)
  const TRACKS = [
    { name: "Snoozy Beats — Chill Days", src: "assets/lofi.mp3" },
    { name: "Slxt Sync — Shuttle", src: "assets/lofi-2.mp3" },
    { name: "Slxt Sync — Green Background", src: "assets/lofi-3.mp3" },
    { name: "Slxt Sync — Full Moon", src: "assets/lofi-4.mp3" },
    { name: "Slxt Sync — Elevation", src: "assets/lofi-5.mp3" },
    { name: "Slxt Sync — Chill Carpet", src: "assets/lofi-6.mp3" },
    { name: "Janevo — LoFi Chill Hip Hop", src: "assets/lofi-7.mp3" },
    { name: "Centz — Bonjour", src: "assets/lofi-8.mp3" },
    { name: "Centz — The London Underground", src: "assets/lofi-9.mp3" },
    { name: "Centz — Go Home With You", src: "assets/lofi-10.mp3" }
  ];

  // Pick a different real MP3 track on every launch
  (function pickLaunchTrack() {
    let last = -1;
    try {
      last = parseInt(localStorage.getItem(LAST_TRACK_KEY) || "-1", 10);
    } catch (e) {}
    const candidates = TRACKS.map((_, i) => i).filter((i) => i !== last);
    activeTrackIdx = candidates[Math.floor(Math.random() * candidates.length)] || 0;
    try {
      localStorage.setItem(LAST_TRACK_KEY, String(activeTrackIdx));
    } catch (e) {}
  })();

  function getCtx() {
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) ctx = new AudioCtx();
    }
    if (ctx && ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }

  function playTone(freqStart, freqEnd, duration, type, gainPeak, delay = 0) {
    if (!enabled) return;
    const c = getCtx();
    if (!c) return;

    const now = c.currentTime + delay;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type || "sine";
    osc.frequency.setValueAtTime(freqStart, now);
    if (freqEnd && freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), now + duration);
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gainPeak * 0.22, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  function ensureLofiAudio() {
    const track = TRACKS[activeTrackIdx] || TRACKS[0];
    if (!lofiAudio) {
      lofiAudio = new Audio(track.src);
      lofiAudio.preload = "metadata";
      lofiAudio.volume = 0.36;
      lofiAudio.addEventListener("ended", () => {
        activeTrackIdx = (activeTrackIdx + 1) % TRACKS.length;
        try { localStorage.setItem(LAST_TRACK_KEY, String(activeTrackIdx)); } catch (e) {}
        lofiAudio.src = TRACKS[activeTrackIdx].src;
        if (lofiWanted && enabled) {
          lofiAudio.play().catch(() => {});
          TravelSound.syncButtons();
        }
      });
    }
    return lofiAudio;
  }

  function startLofi() {
    const audio = ensureLofiAudio();
    lofiWanted = true;
    lofiPlaying = true;
    audio.play().catch(() => {
      lofiPlaying = false;
      TravelSound.syncButtons();
    });
    try { localStorage.setItem(LOFI_KEY, "true"); } catch (e) {}
    TravelSound.syncButtons();
  }

  function stopLofi() {
    lofiWanted = false;
    lofiPlaying = false;
    if (lofiAudio) lofiAudio.pause();
    try { localStorage.setItem(LOFI_KEY, "false"); } catch (e) {}
    TravelSound.syncButtons();
  }

  function unlockOnFirstGesture() {
    if (!enabled || !lofiWanted) return;
    if (!lofiPlaying || (lofiAudio && lofiAudio.paused)) {
      startLofi();
    }
  }
  ["pointerdown", "touchstart", "keydown"].forEach((evt) => {
    document.addEventListener(evt, unlockOnFirstGesture, { once: true, passive: true });
  });

  document.addEventListener("visibilitychange", () => {
    if (!lofiAudio) return;
    if (document.hidden) {
      lofiAudio.pause();
    } else if (lofiWanted && enabled) {
      lofiAudio.play().catch(() => {});
    }
  });

  const PENTATONIC = [523.25, 587.33, 659.25, 783.99, 880.0];

  const TravelSound = {
    isEnabled: () => enabled,
    isLofiPlaying: () => lofiPlaying,
    getTrackName: () => (TRACKS[activeTrackIdx] || TRACKS[0]).name,
    setEnabled(val) {
      enabled = !!val;
      try { localStorage.setItem(STORAGE_KEY, String(enabled)); } catch (e) {}
      if (!enabled) {
        stopLofi();
      } else {
        startLofi();
        this.play("toastOn");
      }
      this.syncButtons();
    },
    toggle() {
      this.setEnabled(!enabled);
      return enabled;
    },
    syncButtons() {
      const track = TRACKS[activeTrackIdx] || TRACKS[0];
      document.querySelectorAll("#soundToggleBtn").forEach((btn) => {
        btn.classList.toggle("is-muted", !enabled);
        btn.setAttribute("aria-pressed", String(enabled));
        btn.title = enabled ? `Playing (${activeTrackIdx + 1}/10): ${track.name}` : "Sound Off";
        btn.textContent = enabled ? "🔊 Sound" : "🔇 Sound Off";
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
            break;
          }
          case "mapPing":
            playTone(880, 880, 0.11, "sine", 0.28);
            playTone(1320, 1320, 0.12, "sine", 0.12, 0.06);
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
        }
      } catch (e) {}
    }
  };

  window.TravelSound = TravelSound;
  window.SFX = {
    tap: () => TravelSound.play("tap"),
    open: () => TravelSound.play("modalOpen"),
    close: () => TravelSound.play("modalClose"),
    mapPing: () => TravelSound.play("mapPing"),
    success: () => TravelSound.play("toastOn")
  };

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("#soundToggleBtn").forEach((btn) => {
      btn.addEventListener("click", () => TravelSound.toggle());
    });
    TravelSound.syncButtons();
    if (enabled && lofiWanted) {
      setTimeout(() => {
        if (enabled && lofiWanted && !lofiPlaying) startLofi();
      }, 2200);
    }
  });
})();
