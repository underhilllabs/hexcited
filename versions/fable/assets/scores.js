/* Hexcited — Hexie's Rescue
   scores.js — persistent top-10 high score table (localStorage). */
(function () {
  'use strict';
  const HX = window.Hexcited;
  const KEY = 'hexcited.hiscores.v1';
  const MAX = 10;

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      return arr
        .filter((e) => e && typeof e.score === 'number')
        .map((e) => ({
          initials: String(e.initials || '···').slice(0, 3),
          score: e.score,
          pumps: e.pumps | 0,
        }))
        .slice(0, MAX);
    } catch (_) {
      return []; // storage blocked (private mode etc.) — play on without it
    }
  }

  const S = (HX.Scores = {
    list: load(),

    qualifies(score) {
      if (score <= 0) return false;
      if (S.list.length < MAX) return true;
      return score > S.list[S.list.length - 1].score;
    },

    /* insert sorted (earlier entry wins ties), trim, save; returns 0-based rank */
    insert(initials, score, pumps) {
      const entry = { initials, score, pumps: pumps | 0 };
      let rank = S.list.length;
      for (let i = 0; i < S.list.length; i++) {
        if (score > S.list[i].score) { rank = i; break; }
      }
      S.list.splice(rank, 0, entry);
      S.list.length = Math.min(S.list.length, MAX);
      try {
        localStorage.setItem(KEY, JSON.stringify(S.list));
      } catch (_) { /* table lives for this session only */ }
      return rank < MAX ? rank : -1;
    },
  });
})();
