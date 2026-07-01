/* Hexcited — Hexie's Rescue
   audio.js — Web Audio synthesis: sound effects + sequenced music.
   Everything is generated live; there are no audio files. */
(function () {
  'use strict';
  const HX = window.Hexcited;

  const A = (HX.Audio = {
    ctx: null,
    master: null,
    musicG: null,
    sfxG: null,
    noiseBuf: null,
    muted: false,
    unlocked: false,
    song: null,
    pendingSong: null,
    step: 0,
    nextT: 0,
  });

  const freq = (m) => 440 * Math.pow(2, (m - 69) / 12);

  /* Audio contexts must be created from a user gesture (keydown). */
  A.unlock = function () {
    if (A.unlocked) return;
    let ctx;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      return;
    }
    A.ctx = ctx;
    A.unlocked = true;
    A.master = ctx.createGain();
    A.master.gain.value = A.muted ? 0 : 0.55;
    A.master.connect(ctx.destination);
    A.musicG = ctx.createGain();
    A.musicG.gain.value = 0.8;
    A.musicG.connect(A.master);
    A.sfxG = ctx.createGain();
    A.sfxG.gain.value = 1;
    A.sfxG.connect(A.master);

    const len = Math.floor(ctx.sampleRate * 1.2);
    A.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = A.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    if (A.pendingSong) {
      A.playMusic(A.pendingSong);
      A.pendingSong = null;
    }
  };

  A.toggleMute = function () {
    A.muted = !A.muted;
    if (A.master) A.master.gain.value = A.muted ? 0 : 0.55;
  };

  A.suspend = function () {
    if (A.ctx && A.ctx.state === 'running') A.ctx.suspend();
  };
  A.resume = function () {
    if (A.ctx && A.ctx.state === 'suspended') A.ctx.resume();
  };

  /* ---------------------------------------------- voice helpers */
  function tone(o) {
    // o: {t, f, f2, dur, type, vol, dest, lp}
    const ctx = A.ctx;
    const osc = ctx.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f, o.t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), o.t + o.dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, o.t);
    g.gain.linearRampToValueAtTime(o.vol, o.t + (o.attack || 0.008));
    g.gain.exponentialRampToValueAtTime(0.0001, o.t + o.dur);
    let node = osc;
    if (o.lp) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = o.lp;
      osc.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(o.dest || A.sfxG);
    osc.start(o.t);
    osc.stop(o.t + o.dur + 0.05);
  }

  function noise(o) {
    // o: {t, dur, vol, type, f, q, dest, f2}
    const ctx = A.ctx;
    const src = ctx.createBufferSource();
    src.buffer = A.noiseBuf;
    src.loop = true;
    const flt = ctx.createBiquadFilter();
    flt.type = o.type || 'bandpass';
    flt.frequency.setValueAtTime(o.f || 1000, o.t);
    if (o.f2) flt.frequency.exponentialRampToValueAtTime(Math.max(30, o.f2), o.t + o.dur);
    flt.Q.value = o.q || 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, o.t);
    g.gain.linearRampToValueAtTime(o.vol, o.t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, o.t + o.dur);
    src.connect(flt);
    flt.connect(g);
    g.connect(o.dest || A.sfxG);
    src.start(o.t);
    src.stop(o.t + o.dur + 0.05);
  }

  /* ---------------------------------------------- sound effects */
  A.sfx = function (name) {
    if (!A.ctx) return;
    const t = A.ctx.currentTime;
    switch (name) {
      case 'jump':
        tone({ t, f: 260, f2: 560, dur: 0.16, type: 'square', vol: 0.14 });
        noise({ t, dur: 0.06, vol: 0.05, type: 'highpass', f: 2500 });
        break;
      case 'land':
        noise({ t, dur: 0.09, vol: 0.12, type: 'lowpass', f: 400 });
        break;
      case 'collect':
        tone({ t, f: freq(83), dur: 0.09, type: 'sine', vol: 0.16 });
        tone({ t: t + 0.07, f: freq(88), dur: 0.14, type: 'sine', vol: 0.16 });
        tone({ t: t + 0.07, f: freq(100), dur: 0.12, type: 'triangle', vol: 0.05 });
        break;
      case 'stomp':
        noise({ t, dur: 0.11, vol: 0.24, type: 'lowpass', f: 700 });
        tone({ t, f: 190, f2: 45, dur: 0.14, type: 'sine', vol: 0.3 });
        break;
      case 'hurt':
        tone({ t, f: 420, f2: 110, dur: 0.3, type: 'sawtooth', vol: 0.16, lp: 1600 });
        noise({ t, dur: 0.12, vol: 0.1, f: 800 });
        break;
      case 'die':
        tone({ t, f: 380, f2: 55, dur: 0.8, type: 'sawtooth', vol: 0.16, lp: 1200 });
        tone({ t: t + 0.1, f: 240, f2: 40, dur: 0.8, type: 'triangle', vol: 0.15 });
        break;
      case 'win': {
        const m = [72, 76, 79, 84];
        m.forEach((n, i) =>
          tone({ t: t + i * 0.13, f: freq(n), dur: 0.22, type: 'square', vol: 0.1, lp: 2500 })
        );
        tone({ t: t + 0.52, f: freq(88), dur: 0.7, type: 'square', vol: 0.1, lp: 2500 });
        tone({ t: t + 0.52, f: freq(76), dur: 0.7, type: 'triangle', vol: 0.12 });
        break;
      }
      case 'rescue': {
        const m = [76, 81, 85, 88, 93];
        m.forEach((n, i) =>
          tone({ t: t + i * 0.09, f: freq(n), dur: 0.5, type: 'sine', vol: 0.11 })
        );
        break;
      }
      case 'select':
        tone({ t, f: 660, dur: 0.07, type: 'square', vol: 0.09, lp: 2400 });
        break;
      case 'quack':
        tone({ t, f: 320, f2: 240, dur: 0.09, type: 'sawtooth', vol: 0.13, lp: 1400 });
        tone({ t: t + 0.11, f: 300, f2: 220, dur: 0.09, type: 'sawtooth', vol: 0.11, lp: 1400 });
        break;
      case 'flap':
        noise({ t, dur: 0.13, vol: 0.07, f: 420, q: 0.5 });
        break;
      case 'screech':
        tone({ t, f: 800, f2: 1500, dur: 0.22, type: 'sawtooth', vol: 0.11, lp: 3200 });
        tone({ t: t + 0.2, f: 1500, f2: 480, dur: 0.3, type: 'sawtooth', vol: 0.11, lp: 3200 });
        noise({ t, dur: 0.4, vol: 0.05, type: 'highpass', f: 3000 });
        break;
      case 'bossHit':
        tone({ t, f: 1000, f2: 1700, dur: 0.18, type: 'sawtooth', vol: 0.13, lp: 3600 });
        tone({ t, f: 160, f2: 40, dur: 0.2, type: 'sine', vol: 0.32 });
        noise({ t, dur: 0.16, vol: 0.2, type: 'lowpass', f: 900 });
        break;
      case 'break':
        noise({ t, dur: 0.25, vol: 0.22, f: 2400, q: 1.5 });
        tone({ t, f: 1200, f2: 300, dur: 0.2, type: 'square', vol: 0.08, lp: 3000 });
        noise({ t: t + 0.08, dur: 0.2, vol: 0.14, f: 1400, q: 1.5 });
        break;
    }
  };

  /* ---------------------------------------------- music sequencer
     Songs are 32 steps of 8th notes. 0 = rest, otherwise MIDI note. */
  function drums(kickEvery, snareAt, hatEvery) {
    const k = [], s = [], h = [];
    for (let i = 0; i < 32; i++) {
      k.push(i % kickEvery === 0 ? 1 : 0);
      s.push(snareAt.includes(i % 16) ? 1 : 0);
      h.push(i % hatEvery === 0 ? 1 : 0);
    }
    return { k, s, h };
  }

  const SONGS = {
    title: {
      bpm: 84, lead: [
        69, 0, 0, 72, 0, 0, 76, 0, 74, 0, 72, 0, 71, 0, 0, 0,
        69, 0, 0, 72, 0, 0, 76, 0, 79, 0, 76, 0, 74, 0, 0, 0],
      bass: [
        33, 0, 0, 0, 40, 0, 0, 0, 36, 0, 0, 0, 43, 0, 0, 0,
        38, 0, 0, 0, 41, 0, 0, 0, 40, 0, 0, 0, 40, 0, 0, 0],
      d: drums(8, [], 4), vol: 0.5,
    },
    grave: {
      bpm: 102, lead: [
        69, 0, 0, 72, 0, 0, 76, 0, 74, 0, 72, 0, 71, 0, 69, 0,
        69, 0, 0, 72, 0, 0, 77, 0, 76, 0, 74, 0, 72, 0, 0, 0],
      bass: [
        33, 0, 33, 0, 40, 0, 33, 0, 36, 0, 36, 0, 43, 0, 36, 0,
        38, 0, 38, 0, 41, 0, 38, 0, 40, 0, 40, 0, 40, 0, 28, 0],
      d: drums(8, [4, 12], 2), vol: 0.75,
    },
    flight: {
      bpm: 134, lead: [
        72, 0, 76, 0, 79, 0, 76, 0, 74, 0, 72, 0, 69, 0, 0, 0,
        72, 0, 76, 0, 81, 0, 79, 0, 76, 0, 74, 0, 72, 0, 0, 0],
      bass: [
        36, 0, 36, 43, 0, 36, 0, 43, 33, 0, 33, 40, 0, 33, 0, 40,
        29, 0, 29, 36, 0, 29, 0, 36, 31, 0, 31, 38, 0, 38, 31, 0],
      d: drums(4, [4, 12], 1), vol: 0.75,
    },
    climb: {
      bpm: 120, lead: [
        74, 0, 0, 0, 77, 0, 74, 0, 81, 0, 0, 0, 79, 0, 77, 0,
        74, 0, 0, 0, 77, 0, 81, 0, 86, 0, 84, 0, 81, 0, 79, 0],
      bass: [
        38, 0, 45, 0, 41, 0, 45, 0, 38, 0, 45, 0, 41, 0, 45, 0,
        36, 0, 43, 0, 40, 0, 43, 0, 33, 0, 40, 0, 36, 0, 40, 0],
      d: drums(8, [4, 12], 2), vol: 0.7,
    },
    boss: {
      bpm: 150, lead: [
        74, 0, 74, 0, 0, 0, 77, 74, 0, 0, 74, 0, 80, 0, 79, 77,
        74, 0, 74, 0, 0, 0, 77, 74, 0, 0, 82, 0, 81, 0, 79, 77],
      bass: [
        31, 31, 0, 31, 31, 0, 31, 0, 34, 34, 0, 34, 34, 0, 34, 0,
        30, 30, 0, 30, 30, 0, 30, 0, 36, 36, 0, 36, 34, 0, 33, 0],
      d: drums(4, [4, 12], 1), vol: 0.8,
    },
  };

  A.playMusic = function (name) {
    if (!A.ctx) {
      A.pendingSong = name;
      return;
    }
    A.song = SONGS[name] || null;
    A.step = 0;
    A.nextT = A.ctx.currentTime + 0.08;
  };

  A.stopMusic = function () {
    A.song = null;
    A.pendingSong = null;
  };

  function scheduleStep(song, i, t, stepDur) {
    const g = A.musicG;
    const v = song.vol;
    if (song.bass[i]) {
      tone({ t, f: freq(song.bass[i]), dur: stepDur * 1.7, type: 'triangle', vol: 0.26 * v, lp: 420, dest: g });
    }
    if (song.lead[i]) {
      const f = freq(song.lead[i]);
      tone({ t, f, dur: stepDur * 1.5, type: 'square', vol: 0.075 * v, lp: 1700, dest: g });
      tone({ t, f: f * 1.004, dur: stepDur * 1.5, type: 'square', vol: 0.045 * v, lp: 1700, dest: g });
    }
    if (song.d.k[i]) tone({ t, f: 130, f2: 42, dur: 0.13, type: 'sine', vol: 0.5 * v, dest: g });
    if (song.d.s[i]) noise({ t, dur: 0.09, vol: 0.1 * v, f: 1900, q: 1.2, dest: g });
    if (song.d.h[i]) noise({ t, dur: 0.035, vol: 0.045 * v, type: 'highpass', f: 7000, dest: g });
  }

  /* called once per frame from the game loop */
  A.tick = function () {
    const ctx = A.ctx;
    if (!ctx || !A.song || ctx.state !== 'running') return;
    const stepDur = 60 / A.song.bpm / 2;
    if (A.nextT < ctx.currentTime - 0.5) A.nextT = ctx.currentTime + 0.05;
    while (A.nextT < ctx.currentTime + 0.3) {
      scheduleStep(A.song, A.step, A.nextT, stepDur);
      A.nextT += stepDur;
      A.step = (A.step + 1) % 32;
    }
  };
})();
