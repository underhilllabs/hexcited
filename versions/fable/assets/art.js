/* Hexcited — Hexie's Rescue
   art.js — every sprite, prop, and background is drawn with canvas paths. */
(function () {
  'use strict';
  const HX = window.Hexcited;
  const U = HX.util;
  const W = HX.W, H = HX.H;
  const rr = U.rr;
  const TAU = Math.PI * 2;

  const Art = (HX.Art = {});

  /* ================================================= HEXIE (the cat) */
  /* o: {x, y(feet), face, pose: idle|run|jump|fall|hurt|dead|broom, t, sy, blink} */
  Art.hexie = function (ctx, o) {
    const t = o.t || 0;
    const face = o.face || 1;
    const pose = o.pose || 'idle';
    const FUR = '#17111f', FUR2 = '#2b2140';

    ctx.save();
    ctx.translate(o.x, o.y);
    if (o.angle) ctx.rotate(o.angle);
    const sy = o.sy || 1;
    ctx.scale(face * (1 + (1 - sy) * 0.7), sy);

    const run = pose === 'run';
    const air = pose === 'jump' || pose === 'fall';
    const broom = pose === 'broom';
    const bob = run ? Math.sin(t * 16) * 1.8 : pose === 'idle' ? Math.sin(t * 2.4) * 0.9 : 0;

    /* tail */
    ctx.strokeStyle = FUR;
    ctx.lineCap = 'round';
    ctx.lineWidth = 6;
    ctx.beginPath();
    if (broom) {
      const s = Math.sin(t * 9) * 4;
      ctx.moveTo(-14, -12);
      ctx.quadraticCurveTo(-30, -14 + s, -42, -8 - s);
    } else if (air) {
      ctx.moveTo(-14, -14);
      ctx.quadraticCurveTo(-28, -10, -30, -24 + (pose === 'jump' ? -4 : 6));
    } else {
      const tw = Math.sin(t * (run ? 10 : 2.6)) * (run ? 5 : 7);
      ctx.moveTo(-14, -14 + bob * 0.5);
      ctx.quadraticCurveTo(-27, -22 + tw * 0.4, -24, -37 + tw);
      ctx.stroke();
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-24, -37 + tw);
      ctx.quadraticCurveTo(-23, -43 + tw, -17, -44 + tw * 1.3);
    }
    ctx.stroke();

    /* legs */
    ctx.fillStyle = FUR;
    const leg = (x, y, w, h, r) => { rr(ctx, x, y, w, h, r); ctx.fill(); };
    if (broom) {
      leg(2, -8, 7, 7, 3);
      leg(-11, -8, 7, 7, 3);
    } else if (air) {
      if (pose === 'jump') { // tucked, front paws forward
        leg(8, -14, 6, 10, 3);
        leg(13, -12, 6, 9, 3);
        leg(-13, -10, 6, 9, 3);
        leg(-8, -12, 6, 9, 3);
      } else { // fall: reaching down
        leg(7, -10, 6, 12, 3);
        leg(12, -11, 6, 12, 3);
        leg(-14, -12, 6, 10, 3);
        leg(-9, -11, 6, 11, 3);
      }
    } else {
      const ph = [0, Math.PI, Math.PI * 0.9, Math.PI * 1.9];
      const xs = [-12, -6, 6, 12];
      for (let i = 0; i < 4; i++) {
        const lift = run ? Math.max(0, Math.sin(t * 16 + ph[i])) * 5 : 0;
        const swing = run ? Math.sin(t * 16 + ph[i]) * 3 : 0;
        leg(xs[i] + swing - 3, -10 - lift, 6, 10 + lift * 0.4, 3);
      }
    }

    /* body */
    ctx.fillStyle = FUR;
    ctx.beginPath();
    ctx.ellipse(0, -15 + bob, 17, 10, broom ? -0.12 : 0, 0, TAU);
    ctx.fill();
    ctx.beginPath(); // haunch
    ctx.ellipse(-8, -14 + bob, 9.5, 9, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = FUR2; // back highlight
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, -16 + bob, 15, 8.5, 0, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();

    /* head */
    const hx = broom ? 13 : 11;
    const hy = (broom ? -22 : -28) + bob * 0.6;
    const earBack = air || broom || pose === 'hurt';
    // ears
    ctx.fillStyle = FUR;
    ctx.beginPath();
    if (earBack) {
      ctx.moveTo(hx - 6, hy - 6); ctx.lineTo(hx - 13, hy - 12); ctx.lineTo(hx - 1, hy - 9);
      ctx.moveTo(hx + 2, hy - 8); ctx.lineTo(hx - 3, hy - 16); ctx.lineTo(hx + 7, hy - 8);
    } else {
      ctx.moveTo(hx - 7, hy - 5); ctx.lineTo(hx - 9, hy - 17); ctx.lineTo(hx, hy - 8);
      ctx.moveTo(hx + 1, hy - 8); ctx.lineTo(hx + 5, hy - 18); ctx.lineTo(hx + 8, hy - 6);
    }
    ctx.closePath();
    ctx.fill();
    if (!earBack) { // inner ears
      ctx.fillStyle = '#a1567c';
      ctx.beginPath();
      ctx.moveTo(hx - 7, hy - 8); ctx.lineTo(hx - 8, hy - 14); ctx.lineTo(hx - 3, hy - 8.5);
      ctx.moveTo(hx + 2.5, hy - 9); ctx.lineTo(hx + 4.5, hy - 15); ctx.lineTo(hx + 6.5, hy - 7.5);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = FUR;
    ctx.beginPath();
    ctx.arc(hx, hy, 9.5, 0, TAU);
    ctx.fill();

    /* face */
    if (pose === 'dead') {
      ctx.strokeStyle = '#9dff57';
      ctx.lineWidth = 1.8;
      const xx = (cx, cy) => {
        ctx.beginPath();
        ctx.moveTo(cx - 2.4, cy - 2.4); ctx.lineTo(cx + 2.4, cy + 2.4);
        ctx.moveTo(cx + 2.4, cy - 2.4); ctx.lineTo(cx - 2.4, cy + 2.4);
        ctx.stroke();
      };
      xx(hx - 2.5, hy - 1);
      xx(hx + 4.5, hy - 1);
    } else if (o.blink || pose === 'hurt') {
      ctx.strokeStyle = '#9dff57';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(hx - 5, hy - 1); ctx.lineTo(hx - 0.5, hy - (pose === 'hurt' ? 2.5 : 1));
      ctx.moveTo(hx + 2.5, hy - (pose === 'hurt' ? 2.5 : 1)); ctx.lineTo(hx + 7, hy - 1);
      ctx.stroke();
    } else {
      const wide = air ? 3.9 : 3.3;
      ctx.fillStyle = '#9dff57';
      ctx.beginPath();
      ctx.ellipse(hx - 2.7, hy - 1, 2.6, wide, 0, 0, TAU);
      ctx.ellipse(hx + 4.7, hy - 1, 2.6, wide, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#0c1408';
      ctx.beginPath();
      ctx.ellipse(hx - 2.2, hy - 1, 1, 2.5, 0, 0, TAU);
      ctx.ellipse(hx + 5.2, hy - 1, 1, 2.5, 0, 0, TAU);
      ctx.fill();
    }
    // nose + mouth
    ctx.fillStyle = '#f08bab';
    ctx.beginPath();
    ctx.moveTo(hx + 8.5, hy + 2); ctx.lineTo(hx + 6, hy + 1); ctx.lineTo(hx + 6.5, hy + 3.6);
    ctx.closePath();
    ctx.fill();
    // whiskers
    ctx.strokeStyle = 'rgba(230,225,245,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(hx + 6, hy + 3); ctx.lineTo(hx + 14, hy + 1.5);
    ctx.moveTo(hx + 6, hy + 4); ctx.lineTo(hx + 14, hy + 5);
    ctx.moveTo(hx - 6, hy + 3); ctx.lineTo(hx - 12, hy + 2);
    ctx.stroke();

    /* collar with charm */
    ctx.strokeStyle = '#6d4bd6';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(hx - 1, hy + 6, 6.5, 0.3, Math.PI - 0.3);
    ctx.stroke();
    ctx.fillStyle = '#f5b731';
    ctx.beginPath();
    ctx.arc(hx - 1, hy + 12, 2.2, 0, TAU);
    ctx.fill();

    ctx.restore();
  };

  /* ================================================= WENDY (the witch) */
  /* o: {x, y(feet), face, pose: stand|cheer|cage|broom|wave|sad, t} */
  Art.wendy = function (ctx, o) {
    const t = o.t || 0;
    const pose = o.pose || 'stand';
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.scale(o.face || 1, 1);
    const bob = pose === 'cheer' ? Math.abs(Math.sin(t * 7)) * -5 : Math.sin(t * 2.2) * 0.8;
    ctx.translate(0, bob);

    const SKIN = '#f2c9a4', HAIR = '#d96a2b', DRESS = '#4b2d7f', HAT = '#5a3d8f';

    /* striped socks + boots */
    const legY = pose === 'broom' ? -8 : -15;
    for (const lx of [-6, 2]) {
      ctx.fillStyle = '#ece7ee';
      ctx.fillRect(lx, legY, 5, 13);
      ctx.fillStyle = '#d8383e';
      for (let s = 0; s < 13; s += 5) ctx.fillRect(lx, legY + s, 5, 2.6);
      ctx.fillStyle = '#1c1524';
      rr(ctx, lx - 2, legY + 11, 9, 4.5, 2);
      ctx.fill();
    }

    /* dress */
    ctx.fillStyle = DRESS;
    ctx.beginPath();
    ctx.moveTo(-6, -31);
    ctx.lineTo(6, -31);
    ctx.quadraticCurveTo(13, -22, 13, -14);
    ctx.quadraticCurveTo(6, -11.5, 0, -14);
    ctx.quadraticCurveTo(-6, -11.5, -13, -14);
    ctx.quadraticCurveTo(-13, -22, -6, -31);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.moveTo(2, -31); ctx.lineTo(6, -31);
    ctx.quadraticCurveTo(13, -22, 13, -14);
    ctx.quadraticCurveTo(10, -13, 7, -13.6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#f5b731'; // belt
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-6.5, -29.5); ctx.lineTo(6.5, -29.5);
    ctx.stroke();

    /* arms */
    ctx.strokeStyle = DRESS;
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (pose === 'cheer') {
      ctx.moveTo(-5, -28); ctx.lineTo(-12, -42 + Math.sin(t * 7) * 2);
      ctx.moveTo(5, -28); ctx.lineTo(12, -42 - Math.sin(t * 7) * 2);
    } else if (pose === 'wave') {
      ctx.moveTo(-5, -28); ctx.lineTo(-9, -19);
      ctx.moveTo(5, -28); ctx.lineTo(12, -40 + Math.sin(t * 6) * 3);
    } else if (pose === 'broom') {
      ctx.moveTo(5, -27); ctx.lineTo(14, -20);
      ctx.moveTo(-5, -27); ctx.lineTo(10, -21);
    } else if (pose === 'cage' || pose === 'sad') {
      ctx.moveTo(-5, -28); ctx.lineTo(-8, -18);
      ctx.moveTo(5, -28); ctx.lineTo(8, -18);
    } else {
      ctx.moveTo(-5, -28); ctx.lineTo(-9, -19);
      ctx.moveTo(5, -28); ctx.lineTo(9, -19);
    }
    ctx.stroke();
    // hands
    ctx.fillStyle = SKIN;
    const hand = (x, y) => { ctx.beginPath(); ctx.arc(x, y, 2.5, 0, TAU); ctx.fill(); };
    if (pose === 'cheer') { hand(-12, -43 + Math.sin(t * 7) * 2); hand(12, -43 - Math.sin(t * 7) * 2); }
    else if (pose === 'wave') { hand(-9, -18); hand(12, -41 + Math.sin(t * 6) * 3); }
    else if (pose === 'broom') { hand(14, -20); hand(10, -21); }
    else if (pose === 'cage' || pose === 'sad') { hand(-8, -17); hand(8, -17); }
    else { hand(-9, -18); hand(9, -18); }

    /* head */
    ctx.fillStyle = SKIN;
    ctx.beginPath();
    ctx.arc(0, -37, 7.2, 0, TAU);
    ctx.fill();
    // hair
    ctx.fillStyle = HAIR;
    ctx.beginPath();
    ctx.ellipse(-6.5, -35, 3, 7, 0.25, 0, TAU);
    ctx.ellipse(6.5, -35, 3, 7, -0.25, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, -40, 7.4, Math.PI * 1.05, Math.PI * 1.95);
    ctx.fill();
    // face
    const sad = pose === 'cage' || pose === 'sad';
    const blink = (t % 3.4) < 0.13;
    ctx.fillStyle = '#241a2e';
    if (blink) {
      ctx.fillRect(-4.4, -38, 3, 1.2);
      ctx.fillRect(1.4, -38, 3, 1.2);
    } else {
      ctx.beginPath();
      ctx.arc(-2.9, -38 + (sad ? 0.6 : 0), 1.25, 0, TAU);
      ctx.arc(2.9, -38 + (sad ? 0.6 : 0), 1.25, 0, TAU);
      ctx.fill();
    }
    ctx.strokeStyle = '#8c4a3a';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    if (sad) ctx.arc(0, -31.5, 2.4, Math.PI * 1.15, Math.PI * 1.85);
    else ctx.arc(0, -34.6, 2.6, 0.25, Math.PI - 0.25);
    ctx.stroke();
    if (sad) { // worried brows
      ctx.strokeStyle = '#a15a2a';
      ctx.beginPath();
      ctx.moveTo(-4.5, -41.5); ctx.lineTo(-1.5, -40.6);
      ctx.moveTo(4.5, -41.5); ctx.lineTo(1.5, -40.6);
      ctx.stroke();
    }
    // rosy cheeks
    ctx.fillStyle = 'rgba(232,120,120,0.35)';
    ctx.beginPath();
    ctx.arc(-5, -34.5, 1.6, 0, TAU);
    ctx.arc(5, -34.5, 1.6, 0, TAU);
    ctx.fill();

    /* THE oversized hat */
    const sway = Math.sin(t * 2.1) * 2 + (pose === 'broom' ? -4 : 0);
    ctx.fillStyle = '#42296b';
    ctx.beginPath();
    ctx.ellipse(0, -42.5, 20, 5.2, pose === 'broom' ? -0.12 : 0.03, 0, TAU);
    ctx.fill();
    ctx.fillStyle = HAT;
    ctx.beginPath();
    ctx.ellipse(0, -43.5, 19, 4.6, pose === 'broom' ? -0.12 : 0.03, 0, TAU);
    ctx.fill();
    ctx.beginPath(); // crown with floppy tip
    ctx.moveTo(-9.5, -44);
    ctx.quadraticCurveTo(-8, -58, -1, -63);
    ctx.quadraticCurveTo(6 + sway, -69, 13 + sway, -64 + Math.abs(sway) * 0.4);
    ctx.quadraticCurveTo(7, -63, 4, -57);
    ctx.quadraticCurveTo(8, -50, 9.5, -44);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.09)';
    ctx.beginPath();
    ctx.moveTo(-9.5, -44);
    ctx.quadraticCurveTo(-8, -58, -1, -63);
    ctx.quadraticCurveTo(-4, -55, -3, -44.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f5b731'; // band + buckle
    ctx.fillRect(-9, -47.5, 18, 3.4);
    ctx.strokeStyle = '#8f6a1a';
    ctx.lineWidth = 1.4;
    ctx.strokeRect(-2.4, -47.2, 4.8, 2.8);

    ctx.restore();
  };

  /* broom with Wendy and Hexie riding (level 2) */
  Art.broomTrio = function (ctx, o) {
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.rotate(o.angle || 0);
    // broom stick
    ctx.strokeStyle = '#8a5a2b';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-42, 8);
    ctx.lineTo(42, 4);
    ctx.stroke();
    // bristles
    ctx.strokeStyle = '#c9a04e';
    ctx.lineWidth = 2;
    for (let i = 0; i < 7; i++) {
      const s = Math.sin(o.t * 14 + i) * 2;
      ctx.beginPath();
      ctx.moveTo(-42, 8);
      ctx.quadraticCurveTo(-54, 6 + i * 2 - 6, -66, 4 + i * 3.4 - 8 + s);
      ctx.stroke();
    }
    ctx.strokeStyle = '#6a4426';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(-44, 3);
    ctx.lineTo(-44, 13);
    ctx.stroke();
    // riders
    Art.wendy(ctx, { x: 18, y: 10, face: 1, pose: 'broom', t: o.t });
    Art.hexie(ctx, { x: -20, y: 10, face: 1, pose: 'broom', t: o.t, sy: 1 });
    ctx.restore();
  };

  /* ================================================= ENEMIES */
  Art.churchman = function (ctx, e) {
    const t = e.t || 0;
    ctx.save();
    ctx.translate(e.x, e.y);
    if (e.squash > 0) {
      // stomped: flatten into the ground
      const s = Math.min(1, e.squash * 3);
      ctx.scale(1 + s * 0.7, Math.max(0.12, 1 - s));
    } else {
      ctx.rotate(Math.sin(t * 8) * 0.06);
    }
    ctx.scale(e.face || 1, 1);

    // feet
    ctx.fillStyle = '#14121c';
    const step = Math.sin(t * 8) * 3;
    rr(ctx, -8 + step, -4, 8, 4.5, 2); ctx.fill();
    rr(ctx, 1 - step, -4, 8, 4.5, 2); ctx.fill();
    // cassock
    ctx.fillStyle = '#3a3a47';
    rr(ctx, -11, -36, 22, 34, 8);
    ctx.fill();
    ctx.strokeStyle = '#2a2a35';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -33); ctx.lineTo(0, -6);
    ctx.stroke();
    ctx.fillStyle = '#55556a';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath(); ctx.arc(0, -29 + i * 7, 1.2, 0, TAU); ctx.fill();
    }
    // white collar
    ctx.fillStyle = '#e8e8ee';
    ctx.fillRect(-5, -37, 10, 4);
    // etiquette book under arm
    ctx.fillStyle = '#7a2430';
    rr(ctx, 6, -26, 9, 11, 1.5);
    ctx.fill();
    ctx.fillStyle = '#d8cfae';
    ctx.fillRect(13.4, -25, 1.6, 9);
    // head
    ctx.fillStyle = '#e9d4bd';
    ctx.beginPath();
    ctx.arc(0, -42, 7, 0, TAU);
    ctx.fill();
    // stern face
    ctx.fillStyle = '#241a2e';
    ctx.beginPath();
    ctx.arc(-2.4, -42.5, 1.1, 0, TAU);
    ctx.arc(3.4, -42.5, 1.1, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#5a4232';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-4.5, -45.6); ctx.lineTo(-1, -44.4);
    ctx.moveTo(5.5, -45.6); ctx.lineTo(2, -44.4);
    ctx.moveTo(-2, -38.4); ctx.lineTo(3, -38.8);
    ctx.stroke();
    // tall hat
    ctx.fillStyle = '#26262e';
    ctx.beginPath();
    ctx.ellipse(0, -47.5, 8.5, 2.4, 0, 0, TAU);
    ctx.fill();
    rr(ctx, -5.5, -60, 11, 13, 1.5);
    ctx.fill();
    ctx.fillStyle = '#3c3c4a';
    ctx.fillRect(-5.5, -52, 11, 2.4);
    ctx.restore();
  };

  Art.duck = function (ctx, e) {
    const t = e.t || 0;
    ctx.save();
    ctx.translate(e.x, e.y);
    if (e.hit) ctx.rotate(e.rot || 0);
    ctx.scale(e.face || -1, 1); // ducks fly left by default
    // body
    ctx.fillStyle = '#b09a78';
    ctx.beginPath();
    ctx.ellipse(0, 0, 13, 8, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#d8c9a8';
    ctx.beginPath();
    ctx.ellipse(-1, 3, 9, 4.5, 0, 0, TAU);
    ctx.fill();
    // tail
    ctx.fillStyle = '#8a7455';
    ctx.beginPath();
    ctx.moveTo(-11, -2); ctx.lineTo(-19, -7); ctx.lineTo(-12, 2);
    ctx.closePath();
    ctx.fill();
    // head (mallard green)
    ctx.fillStyle = '#2e7d4f';
    ctx.beginPath();
    ctx.arc(11, -6, 6, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#f2a13a'; // beak
    ctx.beginPath();
    ctx.moveTo(16, -7); ctx.lineTo(24, -5.5); ctx.lineTo(16, -3.6);
    ctx.closePath();
    ctx.fill();
    // eye
    if (e.hit) {
      ctx.strokeStyle = '#14121c';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(11, -9); ctx.lineTo(14, -6);
      ctx.moveTo(14, -9); ctx.lineTo(11, -6);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#14121c';
      ctx.beginPath();
      ctx.arc(12.5, -7.5, 1.3, 0, TAU);
      ctx.fill();
    }
    // flapping wing
    ctx.fillStyle = '#8a7455';
    ctx.save();
    ctx.translate(-2, -3);
    ctx.rotate(Math.sin(t * 22 + (e.phase || 0)) * 0.9 - 0.3);
    ctx.beginPath();
    ctx.ellipse(-4, -4, 9, 4.5, -0.5, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.restore();
  };

  Art.swooper = function (ctx, e) {
    const t = e.t || 0;
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.scale(e.face || 1, 1);
    const flap = Math.sin(t * 18) * 0.7;
    // wings
    ctx.fillStyle = '#232a52';
    for (const s of [-1, 1]) {
      ctx.save();
      ctx.translate(s * -2, -3);
      ctx.rotate(s === 1 ? -flap * 0.3 : flap);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-14 * (s === 1 ? 0.6 : 1), -16, -26 * (s === 1 ? 0.5 : 1), -8 + flap * 6);
      ctx.quadraticCurveTo(-14, -1, 0, 4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    // body
    ctx.fillStyle = '#1e2340';
    ctx.beginPath();
    ctx.ellipse(0, 0, 11, 7, 0.15, 0, TAU);
    ctx.fill();
    // tail
    ctx.beginPath();
    ctx.moveTo(-9, 0); ctx.lineTo(-18, -3); ctx.lineTo(-17, 4); ctx.lineTo(-8, 3);
    ctx.closePath();
    ctx.fill();
    // head
    ctx.beginPath();
    ctx.arc(10, -4, 5.5, 0, TAU);
    ctx.fill();
    // beak
    ctx.fillStyle = '#8f93a8';
    ctx.beginPath();
    ctx.moveTo(14, -5); ctx.lineTo(21, -3); ctx.lineTo(14, -1.6);
    ctx.closePath();
    ctx.fill();
    // menacing red eye
    ctx.fillStyle = '#ff4d5e';
    ctx.beginPath();
    ctx.arc(11, -5, 1.5, 0, TAU);
    ctx.fill();
    ctx.restore();
  };

  /* the giant bird boss.  b: {x,y,face,t,fold(0..1 wings folded),headDrop(0..1),flash,angry} */
  Art.boss = function (ctx, b) {
    const t = b.t || 0;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.scale(b.face || 1, 1);
    const flap = Math.sin(t * (b.fold > 0.5 ? 4 : 11)) * (1 - b.fold);
    const BODY = '#a06b2c', DARK = '#7a4c1c', CHEST = '#c08c46';

    // tail feathers
    ctx.fillStyle = DARK;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.ellipse(-40, 8 + i * 8, 22, 6, i * 0.22 + 0.15, 0, TAU);
      ctx.fill();
    }
    // far wing
    drawWing(ctx, -1, flap, b.fold, DARK);
    // body
    ctx.fillStyle = BODY;
    ctx.beginPath();
    ctx.ellipse(0, 0, 36, 27, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = CHEST;
    ctx.beginPath();
    ctx.ellipse(6, 9, 24, 15, 0.1, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = DARK; // chest feather marks
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(4 + i * 8, 8 + (i % 2) * 5, 5, 0.3, Math.PI - 0.3);
      ctx.stroke();
    }
    // near wing
    drawWing(ctx, 1, flap, b.fold, BODY);
    // talons
    ctx.strokeStyle = '#f2b135';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-6, 22); ctx.lineTo(-8, 34 - b.fold * 2);
    ctx.moveTo(10, 22); ctx.lineTo(10, 34 - b.fold * 2);
    ctx.stroke();
    ctx.lineWidth = 2.5;
    for (const fx of [-8, 10]) {
      ctx.beginPath();
      ctx.moveTo(fx, 33); ctx.lineTo(fx - 4, 37);
      ctx.moveTo(fx, 33); ctx.lineTo(fx + 1, 38);
      ctx.moveTo(fx, 33); ctx.lineTo(fx + 5, 36);
      ctx.stroke();
    }
    // head (drops down when perched — that's the stompable spot)
    const hx2 = 34, hy2 = -26 + b.headDrop * 22 + Math.sin(t * 3) * 2 * b.fold;
    ctx.fillStyle = BODY;
    ctx.strokeStyle = BODY;
    ctx.lineWidth = 16;
    ctx.beginPath(); // neck
    ctx.moveTo(18, -12);
    ctx.lineTo(hx2 - 6, hy2 + 6);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(hx2, hy2, 16, 0, TAU);
    ctx.fill();
    // red crest
    ctx.fillStyle = '#d8383e';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(hx2 - 8 + i * 6, hy2 - 12);
      ctx.lineTo(hx2 - 10 + i * 6, hy2 - 24 - i * 2 + Math.sin(t * 5 + i) * 1.5);
      ctx.lineTo(hx2 - 2 + i * 6, hy2 - 13);
      ctx.closePath();
      ctx.fill();
    }
    // hooked beak
    ctx.fillStyle = '#f2b135';
    ctx.beginPath();
    ctx.moveTo(hx2 + 12, hy2 - 6);
    ctx.quadraticCurveTo(hx2 + 34, hy2 - 4, hx2 + 28, hy2 + 8);
    ctx.quadraticCurveTo(hx2 + 24, hy2 + 12, hx2 + 20, hy2 + 6);
    ctx.quadraticCurveTo(hx2 + 16, hy2 + 4, hx2 + 12, hy2 + 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#c9871c';
    ctx.beginPath();
    ctx.moveTo(hx2 + 13, hy2 + 5); ctx.lineTo(hx2 + 24, hy2 + 7); ctx.lineTo(hx2 + 14, hy2 + 8);
    ctx.closePath();
    ctx.fill();
    // fierce eye
    ctx.fillStyle = '#fff2d8';
    ctx.beginPath();
    ctx.arc(hx2 + 3, hy2 - 5, 5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#1c1006';
    ctx.beginPath();
    ctx.arc(hx2 + 4.5, hy2 - 4.5, 2.4, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#3a2408';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(hx2 - 4, hy2 - 11); ctx.lineTo(hx2 + 9, hy2 - 8);
    ctx.stroke();
    // hit flash
    if (b.flash > 0) {
      ctx.globalAlpha = Math.min(1, b.flash * 2);
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.ellipse(0, 0, 38, 29, 0, 0, TAU);
      ctx.arc(hx2, hy2, 18, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  };

  function drawWing(ctx, side, flap, fold, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.translate(side * -4, -10);
    if (fold > 0.6) {
      ctx.beginPath();
      ctx.ellipse(-6, 6, 26, 12, 0.25, 0, TAU);
      ctx.fill();
    } else {
      ctx.rotate(-0.2 - flap * 0.55);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-30, -34 - flap * 14, -74, -26 - flap * 26);
      // scalloped trailing edge
      ctx.quadraticCurveTo(-58, -10 - flap * 10, -52, -6 - flap * 6);
      ctx.quadraticCurveTo(-42, -2, -34, 2);
      ctx.quadraticCurveTo(-18, 6, 0, 8);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      ctx.lineWidth = 2;
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-8 * i, 2);
        ctx.quadraticCurveTo(-16 * i, -8 - flap * 6, -20 * i - 8, -8 - flap * (6 + i * 4));
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /* ================================================= PROPS */
  Art.pumpkin = function (ctx, x, y, t, s) {
    s = s || 1;
    const bobY = y + Math.sin((t || 0) * 3 + x * 0.05) * 3 * s;
    ctx.save();
    ctx.translate(x, bobY);
    ctx.scale(s, s);
    // glow
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 17);
    g.addColorStop(0, 'rgba(255,170,60,0.35)');
    g.addColorStop(1, 'rgba(255,170,60,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 17, 0, TAU);
    ctx.fill();
    // body
    ctx.fillStyle = '#e78a2e';
    ctx.beginPath();
    ctx.ellipse(-5, 0, 5.5, 8, 0.15, 0, TAU);
    ctx.ellipse(5, 0, 5.5, 8, -0.15, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#f39c3e';
    ctx.beginPath();
    ctx.ellipse(0, 0, 5.5, 8.6, 0, 0, TAU);
    ctx.fill();
    // stem
    ctx.strokeStyle = '#4a7a2f';
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.quadraticCurveTo(1.5, -12, 4.5, -12.5);
    ctx.stroke();
    // tiny glowing face
    ctx.fillStyle = '#ffe9b0';
    ctx.beginPath();
    ctx.moveTo(-3.6, -1.6); ctx.lineTo(-1.6, -1.6); ctx.lineTo(-2.6, -3.6);
    ctx.moveTo(1.6, -1.6); ctx.lineTo(3.6, -1.6); ctx.lineTo(2.6, -3.6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ffe9b0';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, 1.6, 2.6, 0.3, Math.PI - 0.3);
    ctx.stroke();
    ctx.restore();
  };

  Art.cage = function (ctx, x, y, broken, t) {
    // y = ground line under the cage
    ctx.save();
    ctx.translate(x, y);
    // stone base
    ctx.fillStyle = '#4a4458';
    rr(ctx, -56, -12, 112, 12, 3);
    ctx.fill();
    ctx.fillStyle = '#5b5470';
    ctx.fillRect(-56, -12, 112, 3);
    const barCol = '#7c86a0', barDark = '#525a72';
    ctx.lineCap = 'round';
    if (!broken) {
      // dome bars
      ctx.strokeStyle = barCol;
      ctx.lineWidth = 3.4;
      for (let i = -3; i <= 3; i++) {
        const bx = i * 14;
        ctx.beginPath();
        ctx.moveTo(bx, -12);
        ctx.quadraticCurveTo(bx * 1.02, -78, bx * 0.32, -102);
        ctx.stroke();
      }
      // bands
      ctx.strokeStyle = barDark;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-46, -46); ctx.quadraticCurveTo(0, -54, 46, -46);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-30, -84); ctx.quadraticCurveTo(0, -90, 30, -84);
      ctx.stroke();
      // finial
      ctx.fillStyle = '#f5b731';
      ctx.beginPath();
      ctx.arc(0, -106, 4.5, 0, TAU);
      ctx.fill();
    } else {
      // burst open — bent bars flung outward
      ctx.strokeStyle = barCol;
      ctx.lineWidth = 3.4;
      for (const [x0, x1, y1] of [[-42, -74, -60], [-28, -50, -88], [30, 56, -80], [44, 78, -50]]) {
        ctx.beginPath();
        ctx.moveTo(x0, -12);
        ctx.quadraticCurveTo(x0, -46, x1, y1);
        ctx.stroke();
      }
      ctx.strokeStyle = barDark;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-46, -40); ctx.quadraticCurveTo(-20, -50, -6, -42);
      ctx.stroke();
    }
    ctx.restore();
  };

  Art.rainbow = function (ctx, x, baseY, t) {
    const cols = ['#e5484d', '#f2994a', '#f2c94c', '#6fcf97', '#56ccf2', '#5b8def', '#9b51e0'];
    ctx.save();
    ctx.globalAlpha = 0.82;
    ctx.lineCap = 'butt';
    for (let i = 0; i < cols.length; i++) {
      ctx.strokeStyle = cols[i];
      ctx.lineWidth = 15;
      ctx.beginPath();
      ctx.arc(x, baseY, 310 - i * 15, Math.PI, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // cloud feet
    ctx.fillStyle = 'rgba(245,240,252,0.95)';
    for (const fx of [x - 310 + 45, x + 310 - 45]) {
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(fx - 40 + i * 27, baseY + Math.sin(i * 2.4) * 6, 24 - (i % 2) * 5, 0, TAU);
        ctx.fill();
      }
    }
    // twinkles
    for (let i = 0; i < 6; i++) {
      const a = Math.PI + (i / 5.5) * Math.PI;
      const r = 320 + Math.sin((t || 0) * 3 + i * 2) * 8;
      ctx.fillStyle = 'rgba(255,255,255,' + (0.3 + 0.3 * Math.sin((t || 0) * 4 + i * 1.7)) + ')';
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * r, baseY + Math.sin(a) * r, 3, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  };

  Art.heart = function (ctx, x, y, s, on) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.beginPath();
    ctx.moveTo(0, 3.4);
    ctx.bezierCurveTo(-5.4, -1, -3.6, -5.4, 0, -2.6);
    ctx.bezierCurveTo(3.6, -5.4, 5.4, -1, 0, 3.4);
    if (on) {
      ctx.fillStyle = '#ff4d6d';
      ctx.fill();
      ctx.strokeStyle = '#ffd0da';
      ctx.lineWidth = 0.7;
      ctx.stroke();
    } else {
      ctx.strokeStyle = 'rgba(255,110,140,0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();
  };

  Art.catIcon = function (ctx, x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.fillStyle = '#17111f';
    ctx.beginPath();
    ctx.moveTo(-4.5, -2); ctx.lineTo(-5.5, -8); ctx.lineTo(-1, -4.5);
    ctx.moveTo(1, -4.5); ctx.lineTo(5.5, -8); ctx.lineTo(4.5, -2);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, 5.5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#9dff57';
    ctx.beginPath();
    ctx.ellipse(-2, -0.5, 1.1, 1.5, 0, 0, TAU);
    ctx.ellipse(2, -0.5, 1.1, 1.5, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  };

  /* ================================================= BACKGROUNDS */
  /* draw a horizontally repeating layer with parallax */
  function tiled(ctx, tileW, par, camX, drift, fn) {
    const scroll = camX * par + (drift || 0);
    const off = ((scroll % tileW) + tileW) % tileW;
    ctx.save();
    ctx.translate(-off, 0);
    const n = Math.ceil(W / tileW) + 1;
    for (let i = 0; i < n; i++) {
      fn();
      ctx.translate(tileW, 0);
    }
    ctx.restore();
  }

  /* caches (deterministic layouts) */
  let starCache = null;
  function stars() {
    if (!starCache) {
      const r = U.seeded(1234);
      starCache = [];
      for (let i = 0; i < 90; i++)
        starCache.push({ x: r() * W, y: r() * 300, r: 0.6 + r() * 1.4, tw: 1 + r() * 3, ph: r() * 6.3 });
    }
    return starCache;
  }

  function drawStars(ctx, t, alpha, parX) {
    for (const s of stars()) {
      const x = (((s.x - parX) % W) + W) % W;
      ctx.globalAlpha = alpha * (0.35 + 0.55 * (0.5 + 0.5 * Math.sin(t * s.tw + s.ph)));
      ctx.fillStyle = '#e8e2ff';
      ctx.beginPath();
      ctx.arc(x, s.y, s.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawMoon(ctx, x, y, r) {
    const g = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 2.6);
    g.addColorStop(0, 'rgba(240,230,200,0.35)');
    g.addColorStop(1, 'rgba(240,230,200,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r * 2.6, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#efe6c8';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ddd2b0';
    ctx.beginPath();
    ctx.arc(x - r * 0.3, y - r * 0.2, r * 0.22, 0, TAU);
    ctx.arc(x + r * 0.25, y + r * 0.3, r * 0.15, 0, TAU);
    ctx.arc(x + r * 0.35, y - r * 0.35, r * 0.11, 0, TAU);
    ctx.fill();
  }

  function skyGrad(ctx, stops) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    for (const [p, c] of stops) g.addColorStop(p, c);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  /* ------------------- Level 1: moonlit graveyard ------------------- */
  Art.bgGrave = function (G, ctx) {
    const c = G.cam, t = G.t;
    skyGrad(ctx, [[0, '#0d0819'], [0.55, '#1c1136'], [1, '#33204f']]);
    drawStars(ctx, t, 1, c.x * 0.05);

    // drifting clouds (behind the moon)
    ctx.fillStyle = 'rgba(46,30,74,0.75)';
    tiled(ctx, 1100, 0.08, c.x, t * 7, () => {
      for (const [cx, cy, cw] of [[140, 90, 90], [420, 150, 120], [800, 70, 100]]) {
        ctx.beginPath();
        ctx.ellipse(cx, cy, cw, 17, 0, 0, TAU);
        ctx.ellipse(cx + cw * 0.4, cy - 9, cw * 0.55, 13, 0, 0, TAU);
        ctx.fill();
      }
    });
    drawMoon(ctx, 790 - c.x * 0.02, 92, 42);

    // far hills with a sinister church
    ctx.fillStyle = '#150d28';
    tiled(ctx, 1000, 0.16, c.x, 0, () => {
      ctx.beginPath();
      ctx.moveTo(0, 470);
      ctx.quadraticCurveTo(160, 380, 330, 440);
      ctx.quadraticCurveTo(480, 490, 640, 420);
      ctx.quadraticCurveTo(820, 350, 1000, 452);
      ctx.lineTo(1000, 540);
      ctx.lineTo(0, 540);
      ctx.closePath();
      ctx.fill();
      // church silhouette
      ctx.fillRect(560, 330, 60, 110);
      ctx.fillRect(575, 280, 30, 60);
      ctx.beginPath();
      ctx.moveTo(571, 285); ctx.lineTo(590, 240); ctx.lineTo(609, 285);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(588, 226, 4, 16);
      ctx.fillRect(582, 232, 16, 4);
      // faint lit windows
      ctx.fillStyle = 'rgba(190,150,60,0.5)';
      ctx.fillRect(578, 360, 7, 12);
      ctx.fillRect(595, 360, 7, 12);
      ctx.fillStyle = '#150d28';
    });

    // mid silhouettes: dead trees, fences, stones
    ctx.fillStyle = '#0e0918';
    ctx.strokeStyle = '#0e0918';
    tiled(ctx, 760, 0.4, c.x, 0, () => {
      // crooked tree
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(120, 505);
      ctx.quadraticCurveTo(112, 430, 130, 385);
      ctx.stroke();
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(126, 420); ctx.quadraticCurveTo(90, 395, 74, 365);
      ctx.moveTo(128, 400); ctx.quadraticCurveTo(165, 380, 180, 345);
      ctx.moveTo(130, 385); ctx.quadraticCurveTo(128, 355, 142, 330);
      ctx.stroke();
      // stones
      for (const [sx, sw, sh] of [[300, 26, 34], [370, 20, 26], [560, 30, 40]]) {
        rr(ctx, sx, 505 - sh, sw, sh + 6, 8);
        ctx.fill();
      }
      // iron fence
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(420, 480); ctx.lineTo(530, 480);
      ctx.stroke();
      for (let fx = 424; fx <= 528; fx += 13) {
        ctx.beginPath();
        ctx.moveTo(fx, 505); ctx.lineTo(fx, 468);
        ctx.stroke();
      }
    });

    // low ground haze
    const hz = ctx.createLinearGradient(0, 400, 0, 540);
    hz.addColorStop(0, 'rgba(90,70,140,0)');
    hz.addColorStop(1, 'rgba(90,70,140,0.16)');
    ctx.fillStyle = hz;
    ctx.fillRect(0, 400, W, 140);
  };

  /* ------------------- Level 2: dawn sky flight ------------------- */
  Art.bgFlight = function (G, ctx) {
    const c = G.cam, t = G.t;
    skyGrad(ctx, [[0, '#2b1a52'], [0.4, '#6c3a76'], [0.72, '#c76a60'], [1, '#f2b26b']]);
    drawStars(ctx, t, 0.35, c.x * 0.02);
    // rising sun
    const g = ctx.createRadialGradient(710, 400, 20, 710, 400, 220);
    g.addColorStop(0, 'rgba(255,220,150,0.85)');
    g.addColorStop(0.25, 'rgba(255,190,110,0.35)');
    g.addColorStop(1, 'rgba(255,190,110,0)');
    ctx.fillStyle = g;
    ctx.fillRect(430, 160, 560, 380);
    ctx.fillStyle = '#ffd9a0';
    ctx.beginPath();
    ctx.arc(710, 400, 46, 0, TAU);
    ctx.fill();

    // far streak clouds
    ctx.fillStyle = 'rgba(150,90,145,0.5)';
    tiled(ctx, 1200, 0.1, c.x, 0, () => {
      for (const [cx, cy, cw] of [[200, 160, 150], [640, 230, 190], [980, 120, 120]]) {
        ctx.beginPath();
        ctx.ellipse(cx, cy, cw, 10, 0, 0, TAU);
        ctx.fill();
      }
    });
    // mountains
    ctx.fillStyle = '#3a2454';
    tiled(ctx, 1400, 0.18, c.x, 0, () => {
      ctx.beginPath();
      ctx.moveTo(0, 540);
      ctx.lineTo(180, 400); ctx.lineTo(340, 500); ctx.lineTo(560, 370);
      ctx.lineTo(760, 495); ctx.lineTo(1000, 390); ctx.lineTo(1210, 505);
      ctx.lineTo(1400, 430); ctx.lineTo(1400, 540);
      ctx.closePath();
      ctx.fill();
    });
    // mid puffy clouds
    ctx.fillStyle = 'rgba(214,140,165,0.55)';
    tiled(ctx, 900, 0.42, c.x, t * 12, () => {
      for (const [cx, cy] of [[150, 110], [480, 320], [720, 200]]) {
        ctx.beginPath();
        ctx.arc(cx, cy, 26, 0, TAU);
        ctx.arc(cx + 30, cy - 10, 20, 0, TAU);
        ctx.arc(cx + 58, cy + 2, 23, 0, TAU);
        ctx.ellipse(cx + 26, cy + 10, 55, 16, 0, 0, TAU);
        ctx.fill();
      }
    });
    // near bright clouds
    ctx.fillStyle = 'rgba(248,205,205,0.5)';
    tiled(ctx, 700, 0.8, c.x, t * 20, () => {
      for (const [cx, cy] of [[120, 430], [430, 80], [580, 470]]) {
        ctx.beginPath();
        ctx.arc(cx, cy, 18, 0, TAU);
        ctx.arc(cx + 24, cy - 7, 14, 0, TAU);
        ctx.ellipse(cx + 18, cy + 6, 40, 11, 0, 0, TAU);
        ctx.fill();
      }
    });
    // dark treetops far below
    ctx.fillStyle = '#241536';
    tiled(ctx, 800, 0.9, c.x, 0, () => {
      ctx.beginPath();
      ctx.moveTo(0, 540);
      for (let bx = 0; bx <= 800; bx += 50)
        ctx.quadraticCurveTo(bx + 25, 518 - ((bx * 7919) % 17), bx + 50, 534);
      ctx.lineTo(800, 540);
      ctx.closePath();
      ctx.fill();
    });

    // speed streaks when going fast
    const p = G.player;
    if (p && p.flySpeed > 330) {
      ctx.strokeStyle = 'rgba(255,255,255,0.16)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        const yy = ((i * 173 + t * 60) % 1) * 0; // deterministic rows
        const sy2 = (i * 67) % H;
        const sx2 = W - (((t * (700 + i * 60)) + i * 313) % (W + 220)) + 110;
        ctx.beginPath();
        ctx.moveTo(sx2, sy2 + yy);
        ctx.lineTo(sx2 + 60 + i * 8, sy2 + yy);
        ctx.stroke();
      }
    }
  };

  /* ------------------- Level 3: the giant tree ------------------- */
  Art.bgClimb = function (G, ctx) {
    const c = G.cam, t = G.t;
    const hRatio = U.clamp(1 - c.y / Math.max(1, G.level.h - H), 0, 1); // 1 at top
    skyGrad(ctx, [[0, '#171029'], [0.6, '#2c1a47'], [1, '#4a2a60']]);
    ctx.globalAlpha = hRatio * 0.85;
    skyGrad(ctx, [[0, '#0a0716'], [0.7, '#180f2e'], [1, '#241543']]);
    ctx.globalAlpha = 1;
    drawStars(ctx, t, 0.25 + hRatio * 0.75, c.x * 0.05 + c.y * 0.02);
    drawMoon(ctx, 160, 90 + (1 - hRatio) * 60, 34);

    // distant canopy layers (parallax on y too)
    ctx.fillStyle = 'rgba(24,16,40,0.9)';
    tiled(ctx, 900, 0.2, c.x, 0, () => {
      const yy = 470 + (G.level.h - H - c.y) * 0.12;
      ctx.beginPath();
      ctx.moveTo(0, 540);
      for (let bx = 0; bx <= 900; bx += 90)
        ctx.quadraticCurveTo(bx + 45, yy - 60 - ((bx * 31) % 40), bx + 90, yy);
      ctx.lineTo(900, 540);
      ctx.closePath();
      ctx.fill();
    });

    // soft cloud bands drifting past at fixed world heights
    ctx.fillStyle = 'rgba(200,180,235,0.10)';
    for (let i = 0; i < 5; i++) {
      const wy = G.level.h - 700 - i * 850;
      const sy2 = wy - c.y;
      if (sy2 < -80 || sy2 > H + 80) continue;
      const drift = ((t * (14 + i * 5) + i * 400) % (W + 500)) - 250;
      ctx.beginPath();
      ctx.ellipse(drift, sy2, 170, 26, 0, 0, TAU);
      ctx.ellipse(drift + 120, sy2 + 12, 110, 18, 0, 0, TAU);
      ctx.fill();
    }
  };

  Art.bg = function (G, ctx) {
    const ty = G.level ? G.level.type : 'foot';
    if (ty === 'fly') Art.bgFlight(G, ctx);
    else if (ty === 'climb') Art.bgClimb(G, ctx);
    else Art.bgGrave(G, ctx);
  };

  /* ================================================= TERRAIN (world space) */
  Art.terrain = function (G, ctx) {
    for (const s of G.solids) drawSolid(ctx, s, G);
    for (const s of G.oneways) drawOneway(ctx, s, G);
  };

  function drawSolid(ctx, s, G) {
    if (s.kind === 'wall') return;
    if (s.kind === 'nest') { drawNest(ctx, s); return; }
    if (s.x + s.w < G.cam.x - 60 || s.x > G.cam.x + W + 60) return;
    if (s.kind === 'stone' || s.kind === 'crypt') {
      const g = ctx.createLinearGradient(0, s.y, 0, s.y + s.h);
      g.addColorStop(0, '#57506b');
      g.addColorStop(1, '#39334c');
      ctx.fillStyle = g;
      rr(ctx, s.x, s.y, s.w, s.h, 4);
      ctx.fill();
      ctx.strokeStyle = '#292440';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      ctx.fillRect(s.x + 3, s.y + 2, s.w - 6, 3);
      // moss
      const r = U.seeded(s.x * 7 + s.y);
      ctx.fillStyle = 'rgba(92,122,79,0.7)';
      for (let i = 0; i < s.w / 30; i++) {
        ctx.beginPath();
        ctx.arc(s.x + 8 + r() * (s.w - 16), s.y + 3, 2 + r() * 3, 0, Math.PI);
        ctx.fill();
      }
      return;
    }
    // ground (graveyard / forest floor)
    const g = ctx.createLinearGradient(0, s.y, 0, s.y + s.h);
    g.addColorStop(0, '#241633');
    g.addColorStop(1, '#130b1e');
    ctx.fillStyle = g;
    ctx.fillRect(s.x, s.y, s.w, s.h);
    // grass lip
    ctx.fillStyle = '#3c5c40';
    ctx.fillRect(s.x, s.y, s.w, 7);
    ctx.fillStyle = '#4d7350';
    ctx.fillRect(s.x, s.y, s.w, 2.5);
    // tufts
    const r = U.seeded(s.x * 13 + 5);
    ctx.strokeStyle = '#4d7350';
    ctx.lineWidth = 1.6;
    const n = Math.floor(s.w / 46);
    for (let i = 0; i < n; i++) {
      const tx = s.x + 10 + r() * (s.w - 20);
      ctx.beginPath();
      ctx.moveTo(tx, s.y + 1); ctx.lineTo(tx - 3, s.y - 6);
      ctx.moveTo(tx, s.y + 1); ctx.lineTo(tx + 1, s.y - 8);
      ctx.moveTo(tx, s.y + 1); ctx.lineTo(tx + 4, s.y - 5);
      ctx.stroke();
    }
    // buried rocks
    ctx.fillStyle = 'rgba(90,80,120,0.35)';
    for (let i = 0; i < n; i++) {
      ctx.beginPath();
      ctx.ellipse(s.x + 20 + r() * (s.w - 40), s.y + 20 + r() * (s.h - 30), 6 + r() * 8, 4 + r() * 5, r(), 0, TAU);
      ctx.fill();
    }
  }

  function drawOneway(ctx, s, G) {
    if (s.x + s.w < G.cam.x - 120 || s.x > G.cam.x + W + 120) return;
    if (s.kind === 'branch') {
      const dir = s.dir || 1; // 1: grows to the right from base
      const bx = dir > 0 ? s.x : s.x + s.w;
      const tx = dir > 0 ? s.x + s.w : s.x;
      const r = U.seeded((s.x * 31 + s.y) >>> 0);
      // branch wood: thick at base, tapers with a droop
      ctx.fillStyle = '#5a3a22';
      ctx.beginPath();
      ctx.moveTo(bx, s.y - 2);
      ctx.quadraticCurveTo((bx + tx) / 2, s.y - 5, tx, s.y + 2);
      ctx.lineTo(tx, s.y + 8);
      ctx.quadraticCurveTo((bx + tx) / 2, s.y + 13, bx, s.y + 17);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#442a18';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(bx, s.y + 6);
      ctx.quadraticCurveTo((bx + tx) / 2, s.y + 3, tx - dir * 8, s.y + 5);
      ctx.stroke();
      // leaf tufts
      for (let i = 0; i < 2 + Math.floor(r() * 2); i++) {
        const lx = bx + dir * (s.w * (0.35 + r() * 0.6));
        const ly = s.y - 4 - r() * 6;
        ctx.fillStyle = i % 2 ? '#2e5c34' : '#3a7042';
        ctx.beginPath();
        ctx.arc(lx, ly, 9 + r() * 6, 0, TAU);
        ctx.arc(lx + 10, ly + 3, 7 + r() * 5, 0, TAU);
        ctx.arc(lx - 9, ly + 4, 7 + r() * 4, 0, TAU);
        ctx.fill();
      }
      return;
    }
    // floating stone slab
    const g = ctx.createLinearGradient(0, s.y, 0, s.y + 14);
    g.addColorStop(0, '#5b5470');
    g.addColorStop(1, '#3c3650');
    ctx.fillStyle = g;
    rr(ctx, s.x, s.y, s.w, 14, 4);
    ctx.fill();
    ctx.strokeStyle = '#292440';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(s.x + 3, s.y + 1.5, s.w - 6, 2.5);
  }

  function drawNest(ctx, s) {
    const cx = s.x + s.w / 2;
    const r = U.seeded(97);
    // bowl
    ctx.fillStyle = '#4a2e18';
    ctx.beginPath();
    ctx.ellipse(cx, s.y + s.h / 2 + 8, s.w / 2 + 14, s.h + 22, 0, 0, Math.PI);
    ctx.fill();
    ctx.fillStyle = '#5f3d20';
    ctx.beginPath();
    ctx.ellipse(cx, s.y + 4, s.w / 2 + 10, 15, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#3a2412';
    ctx.beginPath();
    ctx.ellipse(cx, s.y + 4, s.w / 2 - 12, 9, 0, 0, TAU);
    ctx.fill();
    // woven twigs
    for (let i = 0; i < 26; i++) {
      const a = r() * Math.PI;
      const rx2 = cx - s.w / 2 - 10 + r() * (s.w + 20);
      const ry2 = s.y + 2 + r() * (s.h + 18);
      ctx.strokeStyle = ['#6a4426', '#8a5a30', '#4a2e18'][i % 3];
      ctx.lineWidth = 2 + r() * 1.6;
      ctx.beginPath();
      ctx.moveTo(rx2 - Math.cos(a) * 14, ry2 - Math.sin(a) * 4);
      ctx.quadraticCurveTo(rx2, ry2 + 3, rx2 + Math.cos(a) * 14, ry2 + Math.sin(a) * 4);
      ctx.stroke();
    }
  }

  /* ================================================= DECORATIONS */
  Art.decos = function (G, ctx) {
    for (const d of G.decos) {
      if (d.x + 300 < G.cam.x || d.x - 300 > G.cam.x + W) continue;
      if (d.kind === 'trunk') { drawTrunk(ctx, d); continue; }
      ctx.save();
      ctx.translate(d.x, d.y);
      switch (d.kind) {
        case 'tomb': {
          ctx.rotate(d.tilt || 0);
          const g = ctx.createLinearGradient(0, -34, 0, 0);
          g.addColorStop(0, '#5d5773');
          g.addColorStop(1, '#443e59');
          ctx.fillStyle = g;
          rr(ctx, -13, -34, 26, 34, 11);
          ctx.fill();
          ctx.strokeStyle = '#2c2740';
          ctx.lineWidth = 1.6;
          ctx.stroke();
          ctx.strokeStyle = '#332e4a';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(0, -26); ctx.lineTo(0, -14);
          ctx.moveTo(-5, -22); ctx.lineTo(5, -22);
          ctx.stroke();
          break;
        }
        case 'cross': {
          ctx.rotate(d.tilt || 0);
          ctx.fillStyle = '#524c68';
          rr(ctx, -3.5, -40, 7, 40, 2); ctx.fill();
          rr(ctx, -13, -30, 26, 7, 2); ctx.fill();
          break;
        }
        case 'tree': {
          ctx.strokeStyle = '#191026';
          ctx.fillStyle = '#191026';
          ctx.lineCap = 'round';
          ctx.lineWidth = 13;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.quadraticCurveTo(-8, -70, 4, -110);
          ctx.stroke();
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.moveTo(-2, -75); ctx.quadraticCurveTo(-40, -95, -52, -128);
          ctx.moveTo(0, -95); ctx.quadraticCurveTo(38, -110, 52, -145);
          ctx.moveTo(4, -110); ctx.quadraticCurveTo(0, -140, 14, -165);
          ctx.stroke();
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(-40, -115); ctx.lineTo(-58, -140);
          ctx.moveTo(40, -125); ctx.lineTo(58, -122);
          ctx.stroke();
          break;
        }
        case 'fence': {
          ctx.strokeStyle = '#232036';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(0, -26); ctx.lineTo(90, -26);
          ctx.moveTo(0, -10); ctx.lineTo(90, -10);
          ctx.stroke();
          for (let fx = 4; fx <= 86; fx += 13.5) {
            ctx.beginPath();
            ctx.moveTo(fx, 0); ctx.lineTo(fx, -34);
            ctx.stroke();
            ctx.fillStyle = '#232036';
            ctx.beginPath();
            ctx.moveTo(fx - 3, -34); ctx.lineTo(fx, -41); ctx.lineTo(fx + 3, -34);
            ctx.closePath();
            ctx.fill();
          }
          break;
        }
        case 'lantern': {
          const gl = 0.28 + 0.1 * Math.sin(G.t * 3 + d.x);
          ctx.strokeStyle = '#2c2740';
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.moveTo(0, 0); ctx.lineTo(0, -64);
          ctx.stroke();
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(0, -64); ctx.lineTo(14, -60);
          ctx.stroke();
          const g = ctx.createRadialGradient(14, -50, 2, 14, -50, 32);
          g.addColorStop(0, 'rgba(255,184,78,' + gl + ')');
          g.addColorStop(1, 'rgba(255,184,78,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(14, -50, 32, 0, TAU);
          ctx.fill();
          ctx.fillStyle = '#1c1830';
          rr(ctx, 9, -58, 10, 14, 2);
          ctx.fill();
          ctx.fillStyle = '#ffca6a';
          ctx.fillRect(11.5, -54.5, 5, 7);
          break;
        }
        case 'bush': {
          ctx.fillStyle = '#1c142e';
          ctx.beginPath();
          ctx.arc(-10, -8, 11, 0, TAU);
          ctx.arc(4, -12, 13, 0, TAU);
          ctx.arc(16, -7, 10, 0, TAU);
          ctx.fill();
          break;
        }
        case 'leaves': {
          const r = U.seeded(d.x * 3 + d.y);
          for (let i = 0; i < 5; i++) {
            ctx.fillStyle = i % 2 ? 'rgba(40,74,46,0.85)' : 'rgba(52,94,58,0.85)';
            ctx.beginPath();
            ctx.arc((r() - 0.5) * 90, (r() - 0.5) * 60, 16 + r() * 18, 0, TAU);
            ctx.fill();
          }
          break;
        }
        case 'sign': {
          ctx.fillStyle = '#4a3220';
          ctx.fillRect(-3, -46, 6, 46);
          ctx.fillStyle = '#6a4a2c';
          rr(ctx, -46, -66, 92, 26, 4);
          ctx.fill();
          ctx.strokeStyle = '#3a2716';
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.fillStyle = '#e8d8b0';
          ctx.font = "700 10px 'Trebuchet MS', Verdana, sans-serif";
          ctx.textAlign = 'center';
          ctx.fillText(d.text || 'THIS WAY', 0, -55);
          ctx.fillText('→', 0, -44);
          break;
        }
      }
      ctx.restore();
    }
  };

  function drawTrunk(ctx, d) {
    const g = ctx.createLinearGradient(d.x, 0, d.x + d.w, 0);
    g.addColorStop(0, '#2e1c10');
    g.addColorStop(0.35, '#4a3020');
    g.addColorStop(0.65, '#503524');
    g.addColorStop(1, '#291a0e');
    ctx.fillStyle = g;
    ctx.fillRect(d.x, d.y, d.w, d.h);
    // bark streaks
    const r = U.seeded(555);
    ctx.strokeStyle = 'rgba(20,10,4,0.5)';
    for (let i = 0; i < 40; i++) {
      const bx = d.x + 10 + r() * (d.w - 20);
      const by = d.y + r() * d.h;
      const len = 60 + r() * 160;
      ctx.lineWidth = 1.5 + r() * 2.5;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(bx + (r() - 0.5) * 16, by + len / 2, bx + (r() - 0.5) * 10, by + len);
      ctx.stroke();
    }
    // knots
    ctx.fillStyle = 'rgba(20,10,4,0.6)';
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      ctx.ellipse(d.x + 20 + r() * (d.w - 40), d.y + 100 + r() * (d.h - 200), 6 + r() * 6, 10 + r() * 9, 0, 0, TAU);
      ctx.fill();
    }
  }

  /* ================================================= FOREGROUND ATMOSPHERE */
  Art.fore = function (G, ctx) {
    const t = G.t;
    const ty = G.level ? G.level.type : 'foot';
    if (ty === 'foot') {
      // drifting fog
      ctx.fillStyle = 'rgba(185,168,216,0.055)';
      for (let i = 0; i < 3; i++) {
        const fx = ((t * (18 + i * 9) + i * 420) % (W + 560)) - 280;
        const fy = 440 + i * 30 + Math.sin(t * 0.7 + i * 2) * 12;
        ctx.beginPath();
        ctx.ellipse(fx, fy, 240, 34, 0, 0, TAU);
        ctx.ellipse(fx + 160, fy + 14, 170, 24, 0, 0, TAU);
        ctx.fill();
      }
    }
  };

  let vigCache = null;
  Art.vignette = function (ctx) {
    if (!vigCache) {
      vigCache = document.createElement('canvas');
      vigCache.width = W;
      vigCache.height = H;
      const vctx = vigCache.getContext('2d');
      const g = vctx.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 0.95);
      g.addColorStop(0, 'rgba(5,2,12,0)');
      g.addColorStop(1, 'rgba(5,2,12,0.44)');
      vctx.fillStyle = g;
      vctx.fillRect(0, 0, W, H);
    }
    ctx.drawImage(vigCache, 0, 0);
  };
})();
