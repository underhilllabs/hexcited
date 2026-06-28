/* =========================================================================
   Hexcited — audio.js
   All sound synthesized with the Web Audio API: looping background music
   (a small scheduler) plus juicy SFX. Attaches to Hex.Audio.
   ========================================================================= */
(function (global) {
  "use strict";
  const Hex = (global.Hex = global.Hex || {});

  const Audio = {
    ctx: null,
    master: null,
    musicGain: null,
    sfxGain: null,
    muted: false,
    started: false,

    // --- music scheduler state ---
    _tempo: 132,             // bpm
    _nextNoteTime: 0,
    _step: 0,
    _timer: null,
    _track: null,
    _playing: false,

    init() {
      if (this.ctx) return;
      const AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.32;
      this.musicGain.connect(this.master);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.7;
      this.sfxGain.connect(this.master);
    },

    // Must be called from a user gesture (browsers block autoplay)
    resume() {
      this.init();
      if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
      this.started = true;
    },

    toggleMute() {
      this.muted = !this.muted;
      if (this.master)
        this.master.gain.setTargetAtTime(this.muted ? 0 : 0.9, this.ctx.currentTime, 0.02);
      return this.muted;
    },

    /* --------------------------- low-level synth ----------------------- */
    _now() { return this.ctx ? this.ctx.currentTime : 0; },

    tone(opts) {
      if (!this.ctx || this.muted) return;
      const t0 = opts.time || this._now();
      const dest = opts.dest || this.sfxGain;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = opts.type || "square";
      osc.frequency.setValueAtTime(opts.freq, t0);
      if (opts.freqTo)
        osc.frequency[opts.glide === "exp" ? "exponentialRampToValueAtTime" : "linearRampToValueAtTime"](
          Math.max(1, opts.freqTo), t0 + (opts.dur || 0.2));
      const peak = opts.gain != null ? opts.gain : 0.3;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(peak, t0 + (opts.attack || 0.005));
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + (opts.dur || 0.2));
      osc.connect(gain).connect(dest);
      osc.start(t0);
      osc.stop(t0 + (opts.dur || 0.2) + 0.02);
    },

    noise(opts) {
      if (!this.ctx || this.muted) return;
      const t0 = opts.time || this._now();
      const dur = opts.dur || 0.2;
      const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = opts.filter || "lowpass";
      filter.frequency.setValueAtTime(opts.freq || 1000, t0);
      if (opts.freqTo)
        filter.frequency.exponentialRampToValueAtTime(Math.max(1, opts.freqTo), t0 + dur);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(opts.gain || 0.3, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(filter).connect(gain).connect(opts.dest || this.sfxGain);
      src.start(t0);
      src.stop(t0 + dur);
    },

    /* ------------------------------- SFX ------------------------------- */
    jump() {
      this.tone({ type: "square", freq: 300, freqTo: 720, dur: 0.18, gain: 0.25, glide: "exp" });
      this.tone({ type: "triangle", freq: 600, freqTo: 1200, dur: 0.14, gain: 0.12, glide: "exp" });
    },
    land() {
      this.noise({ filter: "lowpass", freq: 500, freqTo: 120, dur: 0.1, gain: 0.18 });
    },
    collect() {
      const base = 660;
      [0, 0.06, 0.12].forEach((d, i) => {
        this.tone({ type: "triangle", freq: base * Math.pow(1.26, i), dur: 0.16,
          gain: 0.22, time: this._now() + d });
      });
    },
    stomp() {
      this.tone({ type: "square", freq: 200, freqTo: 60, dur: 0.18, gain: 0.3, glide: "exp" });
      this.noise({ filter: "lowpass", freq: 800, freqTo: 100, dur: 0.16, gain: 0.3 });
      this.tone({ type: "triangle", freq: 400, freqTo: 900, dur: 0.1, gain: 0.12, glide: "exp" });
    },
    hurt() {
      this.tone({ type: "sawtooth", freq: 440, freqTo: 90, dur: 0.4, gain: 0.28, glide: "exp" });
      this.noise({ filter: "bandpass", freq: 300, dur: 0.25, gain: 0.12 });
    },
    win() {
      const seq = [523.25, 659.25, 783.99, 1046.5, 1318.5];
      seq.forEach((f, i) => {
        this.tone({ type: "triangle", freq: f, dur: 0.5, gain: 0.28, time: this._now() + i * 0.12 });
        this.tone({ type: "square", freq: f / 2, dur: 0.5, gain: 0.1, time: this._now() + i * 0.12 });
      });
    },
    lose() {
      const seq = [392, 349.23, 311.13, 261.63];
      seq.forEach((f, i) =>
        this.tone({ type: "sawtooth", freq: f, dur: 0.45, gain: 0.22, time: this._now() + i * 0.18 }));
    },
    select() {
      this.tone({ type: "square", freq: 520, freqTo: 880, dur: 0.12, gain: 0.2, glide: "exp" });
    },
    swoop() {
      this.noise({ filter: "bandpass", freq: 400, freqTo: 1600, dur: 0.3, gain: 0.1 });
    },

    /* ------------------------------ Music ------------------------------ */
    // Tracks are 16-step patterns. Pitches are MIDI-ish note arrays.
    tracks: {
      level1: {
        tempo: 126,
        // A minor-ish spooky bassline + melody
        bass: ["A1", "A1", "E2", "A1", "F1", "F1", "C2", "F1",
               "G1", "G1", "D2", "G1", "E1", "E1", "B1", "E2"],
        lead: ["A4", null, "C5", "E5", null, "C5", "B4", null,
               "A4", null, "E4", "F4", null, "A4", "G4", null],
        arp: true,
      },
      level2: {
        tempo: 150,
        bass: ["D2", "D2", "A2", "D2", "B1", "B1", "F2", "B1",
               "C2", "C2", "G2", "C2", "A1", "A1", "E2", "A1"],
        lead: ["D5", "F5", "A5", "F5", "B4", "D5", "F5", "D5",
               "C5", "E5", "G5", "E5", "A4", "C5", "E5", "G5"],
        arp: true,
      },
      // "Night on Bald Mountain" — Mussorgsky's agitated D-minor theme,
      // transcribed into the chiptune step format (sharps only; A# = B-flat).
      level3: {
        tempo: 138,
        bass: ["D2", "D2", "A2", "D2", "D2", "D2", "A2", "D2",
               "A#1", "A#1", "F2", "A#1", "A1", "A1", "E2", "A1"],
        lead: ["A4", "A4", "G4", "A4", "A4", "G4", "A4", "F4",
               "D4", "F4", "A4", "D5", "A4", "F4", "E4", null],
        arp: true,
      },
    },

    noteFreq(n) {
      if (!n) return 0;
      const names = { C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5, "F#": 6,
        G: 7, "G#": 8, A: 9, "A#": 10, B: 11 };
      const m = n.match(/^([A-G]#?)(\d)$/);
      if (!m) return 0;
      const semis = names[m[1]] + (parseInt(m[2], 10) + 1) * 12;
      return 440 * Math.pow(2, (semis - 69) / 12);
    },

    playMusic(name) {
      this.init();
      if (this._track === name && this._playing) return;
      this.stopMusic();
      this._track = name;
      this._playing = true;
      this._step = 0;
      this._tempo = this.tracks[name].tempo;
      this._nextNoteTime = this._now() + 0.1;
      this._scheduler();
    },

    stopMusic() {
      this._playing = false;
      if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    },

    _scheduler() {
      if (!this._playing || !this.ctx) return;
      const spb = 60 / this._tempo;        // seconds per beat
      const stepDur = spb / 2;             // 8th notes
      while (this._nextNoteTime < this._now() + 0.15) {
        this._scheduleStep(this._step, this._nextNoteTime, stepDur);
        this._nextNoteTime += stepDur;
        this._step = (this._step + 1) % 16;
      }
      this._timer = setTimeout(() => this._scheduler(), 40);
    },

    _scheduleStep(step, t, dur) {
      if (this.muted) return;
      const tr = this.tracks[this._track];
      // Bass
      const b = tr.bass[step];
      if (b) {
        const f = this.noteFreq(b);
        this.tone({ type: "triangle", freq: f, dur: dur * 1.6, gain: 0.22,
          time: t, dest: this.musicGain });
        this.tone({ type: "sine", freq: f / 2, dur: dur * 1.6, gain: 0.14,
          time: t, dest: this.musicGain });
      }
      // Lead
      const l = tr.lead[step];
      if (l) {
        const f = this.noteFreq(l);
        this.tone({ type: "square", freq: f, dur: dur * 1.1, gain: 0.1,
          time: t, attack: 0.01, dest: this.musicGain });
      }
      // soft hat on off-beats
      if (step % 2 === 1) {
        this.noise({ filter: "highpass", freq: 6000, dur: 0.04, gain: 0.05,
          time: t, dest: this.musicGain });
      }
    },
  };

  Hex.Audio = Audio;
})(window);
