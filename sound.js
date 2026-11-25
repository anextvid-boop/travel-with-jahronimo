// Travel With Jahronimo — Web Audio SFX + 10-Track Rotating Chill Lo-Fi Autoplay
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
  let synthTimer = null;
  let activeTrackIdx = 0;

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "false") enabled = false;
    const savedLofi = localStorage.getItem(LOFI_KEY);
    if (savedLofi === "false") lofiWanted = false;
  } catch (e) {}

  // 10 Chill Lo-Fi Tracks (Track 0 = lofi.mp3, Tracks 1-9 = distinct warm Web Audio Lo-Fi grooves)
  const TRACKS = [
    { name: "Chill Days (MP3)", type: "mp3", src: "assets/lofi.mp3" },
    { name: "Brighton Mist", type: "synth", bpm: 74, wave: "sine", bassWave: "triangle", chords: [[261.63, 329.63, 392.0, 493.88], [220.0, 261.63, 329.63, 392.0], [174.61, 220.0, 261.63, 329.63], [196.0, 246.94, 293.66, 349.23]] },
    { name: "Málaga Sunset", type: "synth", bpm: 78, wave: "triangle", bassWave: "sine", chords: [[293.66, 349.23, 440.0, 523.25], [246.94, 293.66, 349.23, 440.0], [261.63, 329.63, 392.0, 493.88], [220.0, 261.63, 329.63, 392.0]] },
    { name: "Valencia Breeze", type: "synth", bpm: 80, wave: "sine", bassWave: "sine", chords: [[329.63, 392.0, 493.88, 587.33], [261.63, 329.63, 392.0, 493.88], [293.66, 349.23, 440.0, 523.25], [246.94, 293.66, 392.0, 440.0]] },
    { name: "Lisbon Tram", type: "synth", bpm: 72, wave: "triangle", bassWave: "triangle", chords: [[220.0, 261.63, 329.63, 392.0], [174.61, 220.0, 261.63, 349.23], [196.0, 246.94, 293.66, 392.0], [164.81, 196.0, 246.94, 329.63]] },
    { name: "Atlas Dusk", type: "synth", bpm: 76, wave: "sine", bassWave: "triangle", chords: [[246.94, 293.66, 369.99, 440.0], [220.0, 261.63, 329.63, 415.3], [196.0, 246.94, 293.66, 369.99], [164.81, 196.0, 246.94, 329.63]] },
    { name: "Chiang Mai Rain", type: "synth", bpm: 70, wave: "sine", bassWave: "sine", chords: [[261.63, 311.13, 392.0, 466.16], [233.08, 293.66, 349.23, 440.0], [207.65, 261.63, 311.13, 392.0], [196.0, 233.08, 293.66, 392.0]] },
    { name: "Ubud Morning", type: "synth", bpm: 82, wave: "triangle", bassWave: "sine", chords: [[349.23, 440.0, 523.25, 659.25], [293.66, 349.23, 440.0, 523.25], [261.63, 329.63, 392.0, 493.88], [220.0, 293.66, 349.23, 440.0]] },
    { name: "Hanoi Lanterns", type: "synth", bpm: 75, wave: "sine", bassWave: "triangle", chords: [[233.08, 293.66, 349.23, 440.0], [196.0, 233.08, 293.66, 349.23], [174.61, 220.0, 261.63, 329.63], [196.0, 246.94, 293.66, 349.23]] },
    { name: "Tokyo Midnight", type: "synth", bpm: 84, wave: "triangle", bassWave: "sine", chords: [[261.63, 329.63, 392.0, 493.88], [246.94, 293.66, 369.99, 440.0], [220.0, 261.63, 329.63, 392.0], [196.0, 246.94, 293.66, 392.0]] }
  ];

  // Pick a different track on every launch
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

  function playSoftChord(track, stepIdx) {
    const c = getCtx();
    if (!c || !lofiPlaying) return;
    const chord = track.chords[stepIdx % track.chords.length];
    const barSec = (60 / track.bpm) * 2;
    const now = c.currentTime;

    chord.forEach((freq, i) => {
      const osc = c.createOscillator();
      const gain = c.createGain();
      const filter = c.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(950, now);

      osc.type = i === 0 ? track.bassWave : track.wave;
      osc.frequency.setValueAtTime(i === 0 ? freq / 2 : freq, now);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(i === 0 ? 0.055 : 0.026, now + 0.14);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + barSec * 0.95);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(c.destination);
      osc.start(now);
      osc.stop(now + barSec);
    });
  }

  function startSynthLoop(track) {
    stopSynthLoop();
    let step = 0;
    const intervalMs = Math.round(((60 / track.bpm) * 2) * 1000);
    playSoftChord(track, step++);
    synthTimer = setInterval(() => {
      if (!lofiPlaying) return;
      playSoftChord(track, step++);
    }, intervalMs);
  }

  function stopSynthLoop() {
    if (synthTimer) {
      clearInterval(synthTimer);
      synthTimer = null;
    }
  }

  function ensureLofiAudio(src) {
    if (!lofiAudio) {
      lofiAudio = new Audio(src);
      lofiAudio.loop = true;
      lofiAudio.preload = "auto";
      lofiAudio.volume = 0.34;
    }
    return lofiAudio;
  }

  function startLofi() {
    const track = TRACKS[activeTrackIdx] || TRACKS[0];
    lofiWanted = true;
    lofiPlaying = true;

    if (track.type === "mp3") {
      stopSynthLoop();
      const audio = ensureLofiAudio(track.src);
      audio.play().catch(() => {
        lofiPlaying = false;
        TravelSound.syncButtons();
      });
    } else {
      if (lofiAudio) lofiAudio.pause();
      getCtx();
      startSynthLoop(track);
    }

    try { localStorage.setItem(LOFI_KEY, "true"); } catch (e) {}
    TravelSound.syncButtons();
  }

  function stopLofi() {
    lofiWanted = false;
    lofiPlaying = false;
    stopSynthLoop();
    if (lofiAudio) lofiAudio.pause();
    try { localStorage.setItem(LOFI_KEY, "false"); } catch (e) {}
    TravelSound.syncButtons();
  }

  // Unlock autoplay on first user gesture if browser blocked initial play
  function unlockOnFirstGesture() {
    if (!enabled || !lofiWanted) return;
    if (!lofiPlaying || (ctx && ctx.state === "suspended")) {
      startLofi();
    }
  }
  ["pointerdown", "touchstart", "keydown"].forEach((evt) => {
    document.addEventListener(evt, unlockOnFirstGesture, { once: true, passive: true });
  });

  document.addEventListener("visibilitychange", () => {
    const track = TRACKS[activeTrackIdx] || TRACKS[0];
    if (document.hidden) {
      stopSynthLoop();
      if (lofiAudio) lofiAudio.pause();
    } else if (lofiWanted && enabled) {
      if (track.type === "mp3" && lofiAudio) lofiAudio.play().catch(() => {});
      else if (track.type === "synth") startSynthLoop(track);
    }
  });

  const PENTATONIC = [523.25, 587.33, 659.25, 783.99, 880.0];

  const TravelSound = {
    isEnabled: () => enabled,
    isLofiPlaying: () => lofiPlaying,
    getTrackName: () => (TRACKS[activeTrackIdx] || TRACKS[0]).name,
    toggleLofi() {
      if (lofiPlaying) stopLofi();
      else startLofi();
      return lofiPlaying;
    },
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
    if (enabled && lofiWanted) startLofi();
  });
})();
