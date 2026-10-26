/* Sandkeepers - game engine: rendering, input, world, menus, battle UI. Needs data.js, logic.js, sprites.js, audio.js */
(function () {
  'use strict';
  var EG = self.EG, VW = 160, VH = 144, TS = 16, SAVE_KEY = 'sandkeepers.save.v1';
  var cv = document.getElementById('screen'), ctx = cv.getContext('2d');
  var INK = '#14110f', PAPER = '#f5efe0', GOLD = '#e9b949', LAPIS = '#2a5fa8', TURQ = '#2fbfb5', SAND = '#e8d29a', RED = '#d03a3a', GREEN = '#3fa855';
  var FONT = 'bold 8px "Courier New", Courier, monospace';
  var TCOL = { plain: '#b8b0a0', sun: '#f0a020', sand: '#c49a52', nile: '#2a8fd0', shadow: '#6a50a0', venom: '#4aa840' };

  var S = null;                        // saved game state
  var G = {                            // runtime state (not saved)
    mode: 'boot', frame: 0, held: null, locked: false, overlays: [], dialog: null, fade: 0, map: null, ents: [], cam: { x: 0, y: 0 },
    p: { x: 0, y: 0, dir: 'down', moving: false, prog: 0, tx: 0, ty: 0, turnT: 0, step: 0 }, banner: null, excl: null, preview: null, bt: null, steps: 0, lastSave: 0
  };
  var inputs = [], anims = [], scale = 4, rng = Math.random;

  /* ---------- helpers ---------- */
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function sfx(n) { EG.audio.sfx(n); }
  function music(n) { EG.audio.music(n); }
  function anim(n, fn) { return new Promise(function (res) { anims.push({ n: n, t: 0, fn: fn, res: res }); }); }
  function wait(n) { return anim(n); }
  function pushInput(f) { inputs.push(f); }
  function popInput() { inputs.pop(); }
  function R(c, x, y, w, h) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); }
  function T(s, x, y, c) { ctx.fillStyle = c || INK; ctx.fillText(s, Math.round(x), Math.round(y)); }
  function TR(s, x, y, c) { ctx.fillStyle = c || INK; ctx.fillText(s, Math.round(x - ctx.measureText(s).width), Math.round(y)); }
  function tri(x, y, c) { ctx.fillStyle = c || INK; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 4, y + 3); ctx.lineTo(x, y + 6); ctx.fill(); }
  function box(x, y, w, h) { R(INK, x, y, w, h); R(GOLD, x + 1, y + 1, w - 2, h - 2); R(PAPER, x + 2, y + 2, w - 4, h - 4); }
  function bar(x, y, w, frac, col) { R(INK, x, y, w, 4); R('#6a6358', x + 1, y + 1, w - 2, 2); R(col, x + 1, y + 1, Math.round((w - 2) * clamp(frac, 0, 1)), 2); }
  function hpCol(f) { return f > 0.5 ? GREEN : f > 0.2 ? GOLD : RED; }
  function spName(sp) { return EG.SPECIES[sp].n; }
  function ucase(s) { return s.toUpperCase(); }

  function wrapPages(text) {
    var arr = Array.isArray(text) ? text : [text], pages = [];
    arr.forEach(function (para) {
      var words = String(para).split(' '), lines = [], cur = '';
      words.forEach(function (w) { if ((cur + ' ' + w).trim().length > 29) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); });
      if (cur) lines.push(cur);
      for (var i = 0; i < lines.length; i += 2) pages.push(lines.slice(i, i + 2));
    });
    return pages;
  }

  /* ---------- dialog ---------- */
  function say(text, o) {
    o = o || {};
    return new Promise(function (res) {
      var d = G.dialog = { pages: wrapPages(text), pi: 0, n: 0, auto: !!o.auto, w: 0, res: res };
      function len() { return d.pages[d.pi].join('\n').length; }
      d.len = len;
      pushInput(function (b) {
        if (b !== 'a' && b !== 'b') return;
        if (d.n < len()) { d.n = len(); return; }
        next();
      });
      function next() {
        d.pi++; d.n = 0; d.w = 0;
        if (d.pi >= d.pages.length) { G.dialog = null; popInput(); res(); }
      }
      d.next = next;
    });
  }
  function drawDialog() {
    var d = G.dialog; if (!d) return;
    box(0, 104, VW, 40);
    var pg = d.pages[d.pi], n = Math.floor(d.n), shown = 0;
    pg.forEach(function (l, i) { var part = l.slice(0, Math.max(0, n - shown)); shown += l.length + 1; T(part, 8, 111 + i * 13); });
    if (d.n >= d.len() && !d.auto && (G.frame >> 4) & 1) { ctx.fillStyle = RED; ctx.beginPath(); ctx.moveTo(147, 131); ctx.lineTo(153, 131); ctx.lineTo(150, 135); ctx.fill(); }
  }
  function updateDialog() {
    var d = G.dialog; if (!d) return;
    if (d.n < d.len()) d.n += 1.2;
    else if (d.auto) { d.w++; if (d.w > 36) d.next(); }
  }

  /* ---------- list menus ---------- */
  function listMenu(o) {
    if (!o.items.length) return Promise.resolve(-1);
    return new Promise(function (res) {
      var m = { x: o.x, y: o.y, w: o.w, items: o.items, sel: o.sel || 0, top: 0, rows: Math.min(o.rows || o.items.length, o.items.length), title: o.title, rowH: o.rowH || 11, draw: o.draw, cancel: o.cancel !== false, hint: o.hint };
      G.overlays.push(m);
      function close() { popInput(); var i = G.overlays.indexOf(m); if (i >= 0) G.overlays.splice(i, 1); }
      function fix() { if (m.sel < m.top) m.top = m.sel; if (m.sel >= m.top + m.rows) m.top = m.sel - m.rows + 1; }
      fix();
      m.api = { setItems: function (it) { m.items = it; m.rows = Math.min(o.rows || it.length, it.length); m.sel = clamp(m.sel, 0, it.length - 1); fix(); } };
      pushInput(function (b) {
        if (b === 'up') { m.sel = (m.sel + m.items.length - 1) % m.items.length; sfx('select'); fix(); }
        else if (b === 'down') { m.sel = (m.sel + 1) % m.items.length; sfx('select'); fix(); }
        else if (b === 'a') { if (m.items[m.sel].disabled) sfx('bump'); else { sfx('confirm'); close(); res(m.sel); } }
        else if (b === 'b' && m.cancel) { close(); res(-1); }
      });
      if (o.onOpen) o.onOpen(m);
    });
  }
  function drawMenu(m) {
    var title = typeof m.title === 'function' ? m.title() : m.title, th = title ? 12 : 0, h = m.rows * m.rowH + 8 + th;
    box(m.x, m.y, m.w, h);
    if (title) T(title, m.x + 8, m.y + 5, '#8a5a10');
    for (var i = 0; i < m.rows; i++) {
      var idx = m.top + i, it = m.items[idx]; if (!it) break;
      var y = m.y + 5 + th + i * m.rowH;
      if (m.draw) m.draw(it, m.x + 4, y, m.w - 8, idx === m.sel, idx);
      else {
        T(it.label, m.x + 12, y + 1, it.disabled ? '#9a9080' : INK);
        if (it.right) TR(it.right, m.x + m.w - 6, y + 1, it.disabled ? '#9a9080' : INK);
      }
      if (idx === m.sel) tri(m.x + 4, y + (m.draw ? m.rowH / 2 - 3 : 2), RED);
    }
    if (m.top > 0) T('^', m.x + m.w - 9, m.y + 2, RED);
    if (m.top + m.rows < m.items.length) T('v', m.x + m.w - 9, m.y + h - 10, RED);
    if (m.hint) m.hint(m);
  }
  function ask(opts, x, y) {
    var w = Math.max.apply(null, opts.map(function (s) { return s.length; })) * 5 + 22;
    return listMenu({ x: x === undefined ? VW - w : x, y: y === undefined ? 104 - opts.length * 11 - 8 : y, w: w, items: opts.map(function (s) { return { label: s }; }), cancel: true });
  }
  function anyKey() { return new Promise(function (res) { pushInput(function (b) { if (b === 'a' || b === 'b') { popInput(); res(); } }); }); }

  /* ---------- creature widgets ---------- */
  function drawIcon(sp, x, y, s) { ctx.drawImage(EG.creatureSprite(sp), x, y, s || 16, s || 16); }
  function creatureRow(c, x, y, w, sel, dim) {
    drawIcon(c.sp, x + 6, y, 16);
    T(ucase(EG.nameOf(c)), x + 25, y + 1, c.hp <= 0 ? '#9a9080' : INK);
    TR('L' + c.lv, x + w - 2, y + 1);
    var mx = EG.maxHp(c);
    T('HP', x + 25, y + 11, '#8a5a10'); bar(x + 38, y + 12, 52, c.hp / mx, hpCol(c.hp / mx));
    TR(c.hp + '/' + mx, x + w - 2, y + 11);
  }
  // pick a team member. o: {title, disabled(c,i), cancel}
  function pickTeam(o) {
    o = o || {};
    var items = S.team.map(function (c, i) { return { c: c, disabled: o.disabled ? o.disabled(c, i) : false }; });
    var s0 = o.sel || 0; if (items[s0] && items[s0].disabled) { var fi = items.findIndex(function (x) { return !x.disabled; }); if (fi >= 0) s0 = fi; }
    return listMenu({ x: 0, y: 0, w: VW, items: items, rows: Math.min(6, items.length), rowH: 21, title: o.title || 'Choose a creature', cancel: o.cancel !== false, sel: s0,
      draw: function (it, x, y, w) { creatureRow(it.c, x, y, w); if (it.disabled) { ctx.globalAlpha = 0.35; R(PAPER, x + 8, y - 1, w - 8, 20); ctx.globalAlpha = 1; } } });
  }
  function typeTag(t, x, y) { R(INK, x, y, 25, 9); R(TCOL[t], x + 1, y + 1, 23, 7); ctx.font = 'bold 6px "Courier New", monospace'; T(EG.TYPES[t].toUpperCase().slice(0, 5), x + 2, y + 1.5, '#14110f'); ctx.font = FONT; }

  async function summary(c) {
    var sp = EG.SPECIES[c.sp], st = EG.stats(c);
    var o = { draw: function () {
      box(0, 0, VW, VH);
      R('#d9c58f', 6, 6, 52, 52); R(INK, 6, 6, 52, 1); R(INK, 6, 57, 52, 1);
      ctx.drawImage(EG.creatureSprite(c.sp), 8, 6, 48, 48);
      T(ucase(EG.nameOf(c)), 64, 7); T('Lv ' + c.lv, 64, 18); typeTag(sp.t, 64, 30);
      var mx = EG.maxHp(c);
      T('HP ' + c.hp + '/' + mx, 64, 42); bar(64, 52, 88, c.hp / mx, hpCol(c.hp / mx));
      var cur = EG.xpFor(c.lv), nxt = EG.xpFor(c.lv + 1);
      T('ATK ' + st.atk + '  DEF ' + st.def, 8, 64); T('SPD ' + st.spd, 8, 75);
      if (c.lv < EG.MAX_LEVEL) { T('XP', 80, 75, '#8a5a10'); bar(94, 76, 58, (c.xp - cur) / (nxt - cur), TURQ); }
      c.moves.forEach(function (id, i) { var mv = EG.MOVES[id]; var x = 8 + (i % 2) * 74, y = 90 + Math.floor(i / 2) * 20;
        R(TCOL[mv.t], x, y, 3, 16); T(mv.n, x + 6, y + 1); T(mv.p ? 'Pow ' + mv.p : 'Status', x + 6, y + 9, '#6a6358'); });
    } };
    G.overlays.push(o); await anyKey(); G.overlays.splice(G.overlays.indexOf(o), 1);
  }

  /* ---------- sound + save ---------- */
  function applySound() { EG.audio.setMuted(!S.opts.sound); var b = document.getElementById('btn-snd'); if (b) b.textContent = S.opts.sound ? 'SOUND ON' : 'SOUND OFF'; }
  function save() {
    try { S.t = (S.t || 0); localStorage.setItem(SAVE_KEY, JSON.stringify(S)); G.lastSave = G.frame; return true; } catch (e) { return false; }
  }
  function loadSave() {
    try { var raw = localStorage.getItem(SAVE_KEY); if (!raw) return null; return EG.validateSave(JSON.parse(raw)) || null; } catch (e) { return null; }
  }
  function trackPos() { S.map = G.map.id; S.x = G.p.x; S.y = G.p.y; S.dir = G.p.dir; }

  /* ---------- world ---------- */
  var DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }, OPP = { up: 'down', down: 'up', left: 'right', right: 'left' }, STEP = 10;
  var PLAYER_LOOK = { shirt: '#2a5fa8', hair: '#3a2a1a', skin: '#c68a5a', pants: '#6a5a3a', cap: '#d03a3a' };

  function tileAt(x, y) { var r = G.map.rows[y]; return r ? (r[x] || '#') : '#'; }
  function entAt(x, y) { for (var i = 0; i < G.ents.length; i++) { var e = G.ents[i]; if (e.type !== 'item' && e.x === x && e.y === y) return e; } return null; }
  function walkable(x, y) { var t = EG.TILE[tileAt(x, y)]; return !!(t && t.walk) && !entAt(x, y); }

  function loadMap(id, x, y, dir) {
    var m = EG.MAPS[id]; G.map = m; G.mapW = m.rows[0].length; G.mapH = m.rows.length;
    G.ents = m.ents.map(function (e) { var c = {}; for (var k in e) c[k] = e[k]; c.ox = 0; c.oy = 0; return c; });
    G.ents.forEach(function (e) { if (e.type === 'guard' && S.flags.guard) { e.x = e.alt.x; e.y = e.alt.y; } });
    var p = G.p; p.x = x; p.y = y; p.dir = dir || 'down'; p.moving = false; p.prog = 0; p.turnT = 0;
    G.banner = { text: m.name, t: 0 }; G.lastEnc = S.steps;
    music(m.music); trackPos();
  }
  function fadeTo(v, n) { var from = G.fade; return anim(n, function (t) { G.fade = from + (v - from) * t; }); }
  function runLocked(fn) {
    if (G.locked) return Promise.resolve();
    G.locked = true;
    return fn().catch(function (e) { console.error(e); window.__egError = (window.__egError || '') + String(e && e.stack || e) + '\n'; }).then(function () { G.locked = false; });
  }
  function moveEnt(e, dir) {
    var v = DIRS[dir]; e.dir = dir;
    return anim(10, function (t) { e.ox = v[0] * TS * t; e.oy = v[1] * TS * t; }).then(function () { e.x += v[0]; e.y += v[1]; e.ox = 0; e.oy = 0; });
  }

  function worldUpdate() {
    var p = G.p;
    if (G.banner) { G.banner.t++; if (G.banner.t > 110) G.banner = null; }
    for (var guard = 0; guard < 2; guard++) {
      if (p.moving) {
        p.prog++;
        if (p.prog < STEP) return;
        p.x = p.tx; p.y = p.ty; p.moving = false; p.prog = 0; p.step ^= 1;
        trackPos(); S.steps++;
        var job = stepJob(); if (job) { runLocked(job); return; }
        continue;                       // try to chain the next step this same frame
      }
      var d = G.held;
      if (!d) { p.turnT = 0; p.bumped = false; return; }
      if (d !== p.dir) { p.dir = d; p.turnT = 5; return; }
      if (p.turnT > 0) { p.turnT--; return; }
      var v = DIRS[d], nx = p.x + v[0], ny = p.y + v[1];
      if (walkable(nx, ny)) { p.moving = true; p.tx = nx; p.ty = ny; p.prog = 0; p.bumped = false; }
      else { if (!p.bumped) { sfx('bump'); p.bumped = true; } return; }
    }
  }

  function sees(e) {
    var v = DIRS[e.dir], p = G.p;
    for (var i = 1; i <= (e.sight || 3); i++) {
      var x = e.x + v[0] * i, y = e.y + v[1] * i;
      if (x === p.x && y === p.y) return true;
      if (!(EG.TILE[tileAt(x, y)] || {}).walk || entAt(x, y)) return false;
    }
    return false;
  }
  function stepJob() {
    var p = G.p, m = G.map, i;
    for (i = 0; i < m.warps.length; i++) { if (m.warps[i].x === p.x && m.warps[i].y === p.y) { var w = m.warps[i]; return function () { return doWarp(w); }; } }
    for (i = 0; i < G.ents.length; i++) { var it = G.ents[i]; if (it.type === 'item' && it.x === p.x && it.y === p.y && !S.done[it.id]) return function () { return pickup(it); }; }
    for (i = 0; i < G.ents.length; i++) { var tr = G.ents[i]; if (tr.type === 'trainer' && !S.done[tr.id] && sees(tr)) return function () { return trainerChallenge(tr, true); }; }
    var info = EG.TILE[tileAt(p.x, p.y)];
    if (info && info.enc && m.enc[info.enc] && S.steps - G.lastEnc >= 4 && rng() < 0.12 && EG.firstAlive(S.team) >= 0) {
      var tbl = m.enc[info.enc]; return function () { return wildEncounter(tbl); };
    }
    return null;
  }

  async function doWarp(w) {
    if (w.req && !S.flags[w.req]) {
      var v = DIRS[G.p.dir]; G.p.x -= v[0]; G.p.y -= v[1]; trackPos();
      await say(w.req === 'starter' ? 'You need a partner before you leave! Choose one from the pedestals.' : 'Something blocks the way.');
      return;
    }
    sfx('warp'); await fadeTo(1, 12);
    loadMap(w.to, w.tx, w.ty, w.dir);
    await fadeTo(0, 12);
    if (G.map.id === 'town' && !S.flags.uncle) await uncleIntro();
    save();
  }
  async function uncleIntro() {
    S.flags.uncle = 1;
    await say(['There you are! The sand swallowed you whole! I was so worried!', 'A creature partner? Amazing! Keepers of old bonded with creatures just like that.',
      'Here, take these Scarab Charms and Salves. Press START to open your menu.', 'Heal at the Oasis Shrine up north. Then try Route 1 to the east, past the sand.']);
  }
  async function pickup(it) {
    S.done[it.id] = 1; S.items[it.item] = Math.min(99, (S.items[it.item] || 0) + it.qty);
    sfx('item'); await say('You found ' + it.qty + ' ' + EG.ITEMS[it.item].n + (it.qty > 1 ? 's' : '') + '!'); save();
  }

  async function trainerChallenge(e, walk) {
    G.excl = { e: e }; sfx('encounter'); await wait(45); G.excl = null;
    var p = G.p;
    if (walk) {
      var dist = Math.abs(e.x - p.x) + Math.abs(e.y - p.y);
      for (var i = 0; i < dist - 1; i++) await moveEnt(e, e.dir);
    }
    var dx = p.x - e.x, dy = p.y - e.y;
    e.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    p.dir = OPP[e.dir];
    await say(e.intro);
    await fightTrainer(e);
  }
  async function fightTrainer(e) {
    var B = EG.newBattle(S, { kind: 'trainer', name: e.name, boss: !!e.boss, foe: e.team.map(function (t) { return EG.makeCreature(t[0], t[1]); }) });
    var r = await runBattle(B, e.boss ? 'boss' : 'trainer');
    if (r === 'win') {
      S.done[e.id] = 1; S.gold += e.gold;
      await say(e.win); sfx('item'); await say('You won ' + e.gold + ' gold!');
      await postBattle();
      if (e.boss) await ending();
    } else if (r === 'lose') await blackout();
    save();
  }
  async function wildEncounter(tbl) {
    G.lastEnc = S.steps; sfx('encounter');
    for (var i = 0; i < 2; i++) { await fadeTo(0.85, 4); await fadeTo(0, 4); }
    var f = EG.rollWild(tbl, rng), B = EG.newBattle(S, { kind: 'wild', foe: [f] });
    var r = await runBattle(B, G.map.id === 'pyramid' ? 'tomb' : 'desert');
    if (r === 'lose') await blackout(); else await postBattle();
    save();
  }
  async function postBattle() {
    for (var i = 0; i < S.team.length; i++) { var c = S.team[i]; if (EG.checkEvolve(c)) await evolveScene(c); }
  }
  async function evolveScene(c) {
    var to = EG.checkEvolve(c), from = c.sp, nm = EG.nameOf(c);
    var ov = { t: 0, draw: function () {
      R(INK, 0, 0, VW, VH);
      var flick = ov.t > 40 && ov.t < 130 && ((ov.t >> 2) & 1), sp = flick ? to : from;
      ctx.drawImage(EG.creatureSprite(sp), 40, 14, 80, 80);
      if (ov.t > 130) { ctx.globalAlpha = Math.max(0, 1 - (ov.t - 130) / 20); R('#fff', 0, 0, VW, VH); ctx.globalAlpha = 1; }
    } };
    G.overlays.push(ov); music('win');
    var tick = anim(170, function (t) { ov.t = t * 170; });
    await say('What? ' + nm + ' is evolving!', { auto: true }); sfx('evolve');
    await tick; ov.t = 150;
    EG.evolve(c); S.dex.seen[c.sp] = 1; S.dex.caught[c.sp] = 1; ov.draw = function () { R(INK, 0, 0, VW, VH); ctx.drawImage(EG.creatureSprite(c.sp), 40, 14, 80, 80); };
    await say(nm + ' evolved into ' + spName(c.sp) + '!');
    G.overlays.splice(G.overlays.indexOf(ov), 1); music(G.map.music);
  }
  async function blackout() {
    await say('You have no creatures left that can fight... You rush back to safety.');
    EG.healAll(S.team); await fadeTo(1, 14);
    var h = S.heal; loadMap(h.map, h.x, h.y, 'down'); await fadeTo(0, 14);
  }
  async function ending() {
    S.flags.boss = 1;
    music('win');
    var c = EG.makeCreature('sekhmar', 12), dest = EG.addCreature(S, c);
    await say(['Khet places a golden amulet in your hands. The lion spirit Sekhmar chooses to follow you!']);
    sfx('caught'); await say('Sekhmar joined ' + (dest === 'team' ? 'your team!' : 'the Ankh Box!'));
    await say(['The tomb begins to glow. Sunlight pours through the ceiling stones.', 'You are a true Keeper now. But there are many more creatures hiding in the sand...', 'THE END of Chapter 1. Thanks for playing! You can keep exploring, catching and battling.']);
    save(); music(G.map.music);
  }

  /* ---------- interaction ---------- */
  async function interact() {
    var p = G.p, v = DIRS[p.dir], e = entAt(p.x + v[0], p.y + v[1]);
    if (!e) return;
    if (e.type === 'npc' || e.type === 'trainer') e.dir = OPP[p.dir];
    switch (e.type) {
      case 'npc': await say(e.text); break;
      case 'sign': await say(e.text === 'sarcophagus' ? (S.flags.boss ? 'The sarcophagus is quiet. The Warden can rest at last.' : "A huge sarcophagus carved with sun symbols. The Warden's tomb.") : e.text); break;
      case 'heal': await healScene(e); break;
      case 'shop': await say(e.text); await shopScene(); await say('Come again!'); break;
      case 'guard': await guardTalk(e); break;
      case 'pedestal': await pedestal(e); break;
      case 'trainer':
        if (S.done[e.id]) await say(e.win); else { await say(e.intro); await fightTrainer(e); }
        break;
    }
  }
  async function healScene(e) {
    await say(e.text);
    await fadeTo(0.7, 10); sfx('heal'); EG.healAll(S.team); await wait(25); await fadeTo(0, 10);
    S.heal = { map: G.map.id, x: G.p.x, y: G.p.y };
    await say('Your whole team is fully healed!'); save();
  }
  async function guardTalk(e) {
    if (S.flags.guard) { await say('Welcome, explorer. The Great Pyramid awaits.'); return; }
    var lv = EG.maxTeamLevel(S.team);
    if (lv < 6) { await say(['Halt! The Great Pyramid is dangerous.', 'Come back when one of your creatures is Level 6 or higher. You are at Level ' + lv + '.']); return; }
    await say(['Halt! ...Level ' + lv + '? Impressive for a young explorer.', 'Very well. You may pass. Be careful in there!']);
    S.flags.guard = 1; await moveEnt(e, 'left'); e.dir = 'down'; save();
  }
  async function pedestal(e) {
    if (S.flags.starter) { await say('The pedestal is empty. Dust drifts in the lamplight.'); return; }
    var sp = EG.SPECIES[e.sp];
    G.preview = { sp: e.sp };
    await say(['A glowing creature rests here: ' + sp.n + ', a ' + EG.TYPES[sp.t] + ' type.', sp.info]);
    var i = await ask(['TAKE IT', 'NOT YET'], 92, 40);
    if (i === 0) {
      G.preview = null;
      var c = EG.makeCreature(e.sp, 5); EG.addCreature(S, c); S.flags.starter = 1;
      sfx('caught'); await say(['You chose ' + sp.n + '! It hops happily into your arms.', 'A stairway of light appears to the south.', 'Tip: Sun beats Shadow, Shadow beats Nile, and Nile beats Sun.']);
      save();
    }
    G.preview = null;
  }
  async function shopScene() {
    var sel = 0;
    for (;;) {
      var items = EG.SHOP.map(function (id) { return { id: id, label: EG.ITEMS[id].n, right: EG.ITEMS[id].price + 'g' }; }).concat([{ label: 'LEAVE' }]);
      var i = await listMenu({ x: 0, y: 0, w: VW, items: items, sel: sel, title: function () { return 'MARKET     Gold: ' + S.gold; },
        hint: function (m) { var it = m.items[m.sel]; box(0, 104, VW, 40); if (it.id) { T(EG.ITEMS[it.id].info, 8, 111); T('You have: ' + (S.items[it.id] || 0), 8, 124, '#8a5a10'); } else T('Come back any time.', 8, 111); } });
      if (i < 0 || !items[i].id) return;
      sel = i; var id = items[i].id, price = EG.ITEMS[id].price;
      if (S.gold < price) { await say('Not enough gold!'); continue; }
      if ((S.items[id] || 0) >= 99) { await say('You cannot carry any more.'); continue; }
      S.gold -= price; S.items[id] = (S.items[id] || 0) + 1; sfx('item');
    }
  }

  /* ---------- menus ---------- */
  function typeLines() {
    var out = [];
    Object.keys(EG.TYPES).forEach(function (a) {
      var r = EG.CHART[a]; if (!r) return;
      var good = [], bad = [];
      Object.keys(r).forEach(function (d) { if (r[d] > 1) good.push(EG.TYPES[d]); else if (r[d] < 1) bad.push(EG.TYPES[d] + (r[d] === 0 ? ' (none)' : '')); });
      if (good.length || bad.length) out.push(EG.TYPES[a].toUpperCase() + ' moves: strong vs ' + (good.join(', ') || '-') + '. Weak vs ' + (bad.join(', ') || '-') + '.');
    });
    return out;
  }
  async function mainMenu() {
    sfx('select'); var sel = 0;
    for (;;) {
      var labels = ['TEAM', 'ITEMS', 'JOURNAL', 'BOX', 'TYPES', 'SAVE', 'BACKUP', 'SOUND', 'CLOSE'];
      var items = labels.map(function (l) { return { label: l, right: l === 'SOUND' ? (S.opts.sound ? 'ON' : 'OFF') : '' }; });
      var i = await listMenu({ x: 88, y: 0, w: 72, items: items, sel: sel, title: function () { return 'G ' + S.gold; } });
      if (i < 0 || labels[i] === 'CLOSE') return;
      sel = i;
      if (labels[i] === 'TEAM') await teamMenu();
      else if (labels[i] === 'ITEMS') await itemsMenu();
      else if (labels[i] === 'JOURNAL') await journal();
      else if (labels[i] === 'BOX') await boxMenu();
      else if (labels[i] === 'TYPES') await say(typeLines());
      else if (labels[i] === 'SAVE') { await say(save() ? 'Game saved!' : 'Could not save. Storage may be blocked.'); }
      else if (labels[i] === 'BACKUP') await openBackup();
      else if (labels[i] === 'SOUND') { S.opts.sound = !S.opts.sound; applySound(); EG.audio.unlock(); save(); }
    }
  }
  async function teamMenu() {
    var sel = 0;
    for (;;) {
      if (!S.team.length) { await say('You have no creatures yet.'); return; }
      var idx = await pickTeam({ title: 'TEAM', sel: sel }); if (idx < 0) return; sel = idx;
      var opts = ['SUMMARY', 'SWITCH', 'TO BOX', 'BACK'];
      var o = await ask(opts, 96, 60);
      if (o === 0) await summary(S.team[idx]);
      else if (o === 1 && S.team.length > 1) {
        var j = await pickTeam({ title: 'Swap with who?', disabled: function (c, k) { return k === idx; } });
        if (j >= 0) { var t = S.team[idx]; S.team[idx] = S.team[j]; S.team[j] = t; sel = j; }
      } else if (o === 2) {
        var alive = S.team.filter(function (c, k) { return k !== idx && c.hp > 0; }).length;
        if (S.team.length < 2 || alive < 1) await say('You need another healthy creature on your team first.');
        else { var c = S.team.splice(idx, 1)[0]; S.box.push(c); await say(EG.nameOf(c) + ' went to the Ankh Box.'); sel = 0; }
      }
    }
  }
  async function itemsMenu() {
    var sel = 0;
    for (;;) {
      var ids = Object.keys(S.items).filter(function (k) { return S.items[k] > 0 && EG.ITEMS[k]; });
      if (!ids.length) { await say('You have no items.'); return; }
      var items = ids.map(function (id) { return { id: id, label: EG.ITEMS[id].n, right: 'x' + S.items[id] }; });
      var i = await listMenu({ x: 0, y: 0, w: VW, items: items, sel: Math.min(sel, items.length - 1), title: 'ITEMS', rows: 6,
        hint: function (m) { var it = m.items[m.sel]; box(0, 104, VW, 40); T(EG.ITEMS[it.id].info, 8, 114); } });
      if (i < 0) return; sel = i;
      var id = ids[i];
      if (EG.ITEMS[id].heal) {
        var t = await pickTeam({ title: 'Use on who?' }); if (t < 0) continue;
        var r = EG.useHeal(S, id, t); if (r.ok) sfx('heal');
        await say(r.msg);
      } else await say('Use it during a battle with a wild creature.');
    }
  }
  async function journal() {
    var order = EG.SPECIES_LIST;
    var seen = Object.keys(S.dex.seen).length, got = Object.keys(S.dex.caught).length;
    var items = order.map(function (sp, i) { var s = S.dex.seen[sp], c = S.dex.caught[sp]; return { sp: sp, label: (i + 1 < 10 ? '0' : '') + (i + 1) + ' ' + (s ? ucase(spName(sp)) : '-----'), right: c ? 'OWN' : s ? 'SEEN' : '' }; });
    var sel = 0;
    for (;;) {
      var i = await listMenu({ x: 0, y: 0, w: 108, items: items, rows: 8, sel: sel, title: 'JOURNAL ' + got + '/' + order.length,
        hint: function (m) { var it = m.items[m.sel]; box(110, 6, 50, 56); if (S.dex.seen[it.sp]) { ctx.drawImage(EG.creatureSprite(it.sp), 112, 10, 46, 46); typeTag(EG.SPECIES[it.sp].t, 120, 52); } } });
      if (i < 0) return; sel = i;
      var sp = items[i].sp;
      if (S.dex.seen[sp]) { G.preview = { sp: sp }; await say(EG.SPECIES[sp].info); G.preview = null; }
    }
  }
  async function boxMenu() {
    for (;;) {
      if (!S.box.length) { await say('The Ankh Box is empty. Extra catches are stored here.'); return; }
      var items = S.box.map(function (c) { return { c: c, label: ucase(EG.nameOf(c)), right: 'L' + c.lv }; });
      var i = await listMenu({ x: 0, y: 0, w: VW, items: items, rows: 8, title: 'ANKH BOX' });
      if (i < 0) return;
      var c = S.box[i], full = S.team.length >= 6;
      var o = await ask([full ? 'SWAP IN' : 'TO TEAM', 'SUMMARY', 'BACK'], 96, 50);
      if (o === 1) await summary(c);
      else if (o === 0) {
        if (!full) { S.box.splice(i, 1); S.team.push(c); await say(EG.nameOf(c) + ' joined your team!'); }
        else { var j = await pickTeam({ title: 'Swap with who?' }); if (j >= 0) { S.box[i] = S.team[j]; S.team[j] = c; await say('Swapped!'); } }
      }
    }
  }
  function openBackup() {
    return new Promise(function (res) {
      var p = document.getElementById('backup'), ta = document.getElementById('bk-text'), msg = document.getElementById('bk-msg'), armed = false;
      ta.value = JSON.stringify(S); msg.textContent = 'Copy this text to keep a backup. Paste a backup and tap Import to restore it.'; p.hidden = false;
      var rs = document.getElementById('bk-reset'); rs.textContent = 'Erase everything';
      function done() { p.hidden = true; ['bk-copy', 'bk-import', 'bk-reset', 'bk-close'].forEach(function (id) { document.getElementById(id).onclick = null; }); res(); }
      document.getElementById('bk-close').onclick = done;
      document.getElementById('bk-copy').onclick = function () {
        ta.focus(); ta.select();
        try { if (navigator.clipboard) navigator.clipboard.writeText(ta.value); else document.execCommand('copy'); msg.textContent = 'Copied!'; } catch (e) { msg.textContent = 'Select the text and copy it by hand.'; }
      };
      document.getElementById('bk-import').onclick = function () {
        try { var v = EG.validateSave(JSON.parse(ta.value)); if (!v) throw new Error('bad'); localStorage.setItem(SAVE_KEY, JSON.stringify(v)); msg.textContent = 'Imported! Reloading...'; setTimeout(function () { location.reload(); }, 600); }
        catch (e) { msg.textContent = 'That text is not a valid backup.'; }
      };
      rs.onclick = function () {
        if (!armed) { armed = true; rs.textContent = 'Tap again to erase'; return; }
        try { localStorage.removeItem(SAVE_KEY); } catch (e) {} location.reload();
      };
    });
  }

  /* ---------- battle UI ---------- */
  function gridMenu(cells, o) {
    return new Promise(function (res) {
      var m = { cells: cells, sel: o.sel || 0, x: o.x, y: o.y, cw: o.cw, ch: o.ch, cols: o.cols || 2, draw: o.draw };
      G.bt.menu = m;
      pushInput(function (b) {
        var c = m.cols, n = cells.length, s = m.sel;
        if (b === 'left' && s % c > 0) s--; else if (b === 'right' && s % c < c - 1 && s + 1 < n) s++;
        else if (b === 'up' && s - c >= 0) s -= c; else if (b === 'down' && s + c < n) s += c;
        else if (b === 'a') { sfx('confirm'); popInput(); G.bt.menu = null; res(m.sel); return; }
        else if (b === 'b' && o.cancel) { popInput(); G.bt.menu = null; res(-1); return; }
        if (s !== m.sel) { m.sel = s; sfx('select'); }
      });
    });
  }
  function syncSide(side) {
    var bt = G.bt, B = bt.B, c = side === 'p' ? EG.curP(B) : EG.curF(B);
    bt[side + 'Sp'] = c.sp; bt[side + 'Name'] = ucase(EG.nameOf(c)); bt[side + 'Lv'] = c.lv; bt[side + 'Hp'] = c.hp; bt[side + 'Max'] = EG.maxHp(c);
    if (side === 'p') bt.pXp = xpFrac(c);
  }
  function xpFrac(c) { var a = EG.xpFor(c.lv), b = EG.xpFor(c.lv + 1); return clamp((c.xp - a) / (b - a), 0, 1); }
  function slideIn(side) {
    var bt = G.bt, from = side === 'p' ? -50 : 50; bt[side + 'Vis'] = 1;
    return anim(14, function (t) { bt[side + 'Off'].x = from * (1 - t); bt[side + 'Off'].y = 0; });
  }
  async function applyEvent(e) {
    var bt = G.bt, B = bt.B, other;
    switch (e.t) {
      case 'msg': await say(e.text, { auto: true }); break;
      case 'anim': {
        var s = e.side, dir = s === 'p' ? 1 : -1, off = bt[s + 'Off'];
        await anim(10, function (t) { var k = Math.sin(t * Math.PI); off.x = dir * 14 * k; off.y = -dir * 7 * k; });
        off.x = 0; off.y = 0; other = s === 'p' ? 'f' : 'p';
        bt.fx = { side: other, color: TCOL[e.type] || '#fff', t: 0 };
        await anim(12, function (t) { bt.fx.t = t; }); bt.fx = null; break;
      }
      case 'hp': {
        var sd = e.side, from = bt[sd + 'Hp'];
        if (e.heal) {
          if (e.idx !== B.pi) break;
          sfx('heal'); bt[sd + 'Max'] = e.max;
        } else { sfx(e.eff > 1 ? 'super' : e.eff < 1 ? 'weak' : 'hit'); bt[sd + 'Blink'] = 18; }
        var n = Math.max(12, Math.min(40, Math.abs(e.hp - from) / bt[sd + 'Max'] * 60));
        await anim(n, function (t) { bt[sd + 'Hp'] = from + (e.hp - from) * t; });
        bt[sd + 'Hp'] = e.hp; bt[sd + 'Blink'] = 0; break;
      }
      case 'faint': {
        var f = e.side; sfx('faint');
        await anim(26, function (t) { bt[f + 'Off'].y = 36 * t; bt[f + 'Alpha'] = 1 - t; });
        bt[f + 'Vis'] = 0; bt[f + 'Off'].y = 0; bt[f + 'Alpha'] = 1; break;
      }
      case 'send': syncSide(e.side); bt[e.side + 'Alpha'] = 1; sfx('confirm'); await slideIn(e.side); break;
      case 'xp': if (e.idx === B.pi) { var c = B.S.team[e.idx], tgt = e.xp >= EG.xpFor(e.lv + 1) ? 1 : (e.xp - EG.xpFor(e.lv)) / (EG.xpFor(e.lv + 1) - EG.xpFor(e.lv)), fr = bt.pXp; await anim(24, function (t) { bt.pXp = fr + (tgt - fr) * t; }); } break;
      case 'levelup': if (e.isActive) { sfx('levelup'); bt.pLv = e.lv; bt.pHp = e.hp; bt.pMax = e.max; bt.pXp = xpFrac(B.S.team[e.idx]); await wait(20); } break;
      case 'stat': sfx('select'); bt.fx = { side: e.side, color: e.up ? '#6fd06f' : '#d06f6f', t: 0 }; await anim(14, function (t) { bt.fx.t = t; }); bt.fx = null; break;
      case 'catch': await catchAnim(e); break;
    }
  }
  async function catchAnim(e) {
    var bt = G.bt, ball = bt.ball = { x: 30, y: 80, wob: 0 };
    sfx('catchhit');
    await anim(26, function (t) { ball.x = 30 + 92 * t; ball.y = 80 + (46 - 80) * t - 38 * Math.sin(t * Math.PI); });
    await anim(10, function (t) { bt.fScale = 1 - t; });
    bt.fVis = 0;
    await anim(10, function (t) { ball.y = 46 + 22 * t; });
    for (var i = 0; i < e.shakes; i++) { await wait(14); sfx('shake'); await anim(26, function (t) { ball.wob = Math.sin(t * Math.PI * 2) * 3; }); ball.wob = 0; }
    await wait(14);
    if (e.ok) { sfx('caught'); await wait(40); }
    else { sfx('hit'); bt.ball = null; bt.fVis = 1; await anim(10, function (t) { bt.fScale = t; }); bt.fScale = 1; }
  }
  async function play(evs) {
    var noturn = false;
    for (var i = 0; i < evs.length; i++) { if (evs[i].t === 'noturn') noturn = true; else await applyEvent(evs[i]); }
    return noturn;
  }
  function effText(mv, B) {
    if (!mv.p) return '';
    var m = EG.typeMult(mv.t, EG.SPECIES[EG.curF(B).sp].t);
    return m > 1 ? 'x2' : m === 0 ? 'x0' : m < 1 ? 'x.5' : '';
  }
  async function chooseAction(B) {
    var bt = G.bt, p = EG.curP(B), sel = 0;
    for (;;) {
      bt.prompt = 'What will ' + EG.nameOf(p) + ' do?';
      var main = await gridMenu(['FIGHT', 'ITEM', 'TEAM', 'RUN'], { x: 88, y: 108, cw: 36, ch: 15, cols: 2, sel: sel, draw: function (c, x, y) { T(c, x + 7, y + 3); } });
      sel = main; bt.prompt = null;
      if (main === 0) {
        var mi = await gridMenu(p.moves, { x: 6, y: 107, cw: 76, ch: 16, cols: 2, cancel: true, draw: function (id, x, y) {
          var mv = EG.MOVES[id]; T(mv.n, x + 7, y); R(TCOL[mv.t], x + 7, y + 9, 3, 5);
          T((mv.p ? 'P' + mv.p : '--') + ' ' + effText(mv, B), x + 12, y + 8, '#6a6358'); } });
        bt.full = false;
        if (mi >= 0) return { type: 'fight', move: p.moves[mi] };
      } else if (main === 1) {
        var ids = Object.keys(S.items).filter(function (k) { return S.items[k] > 0 && EG.ITEMS[k]; });
        if (!ids.length) { await say('You have no items.', { auto: true }); continue; }
        var items = ids.map(function (id) { return { id: id, label: EG.ITEMS[id].n, right: 'x' + S.items[id] }; });
        var ii = await listMenu({ x: 48, y: 0, w: 112, items: items, rows: Math.min(5, items.length), title: 'ITEMS',
          hint: function (m) { box(0, 104, VW, 40); T(EG.ITEMS[m.items[m.sel].id].info, 8, 114); } });
        if (ii < 0) continue;
        var id = ids[ii];
        if (EG.ITEMS[id].heal) {
          var t = await pickTeam({ title: 'Use on who?', disabled: function (c) { return c.hp <= 0 || c.hp >= EG.maxHp(c); } });
          if (t < 0) continue;
          return { type: 'item', item: id, idx: t };
        }
        return { type: 'item', item: id };
      } else if (main === 2) {
        var j = await pickTeam({ title: 'Switch to who?', disabled: function (c, k) { return c.hp <= 0 || k === B.pi; } });
        if (j >= 0) return { type: 'swap', idx: j };
      } else if (main === 3) return { type: 'run' };
    }
  }
  async function runBattle(B, kind) {
    var boss = kind === 'boss';
    await fadeTo(1, 8);
    G.mode = 'battle';
    G.bt = { B: B, bg: kind, menu: null, prompt: null, pOff: { x: 0, y: 0 }, fOff: { x: 0, y: 0 }, pVis: 0, fVis: 0, pAlpha: 1, fAlpha: 1, fScale: 1, pBlink: 0, fBlink: 0, fx: null, ball: null };
    syncSide('p'); syncSide('f');
    music(boss ? 'boss' : 'battle');
    await fadeTo(0, 8);
    await slideIn('f');
    var intro = EG.battleIntro(B);
    for (var i = 0; i < intro.length; i++) {
      if (/^Go, /.test(intro[i].text || '')) { sfx('confirm'); await slideIn('p'); }
      await applyEvent(intro[i]);
    }
    while (!B.over) {
      if (B.needSwitch) {
        var idx = await pickTeam({ title: 'Send out who?', cancel: false, disabled: function (c) { return c.hp <= 0; } });
        await play(EG.forceSwitch(B, idx)); continue;
      }
      var act = await chooseAction(B);
      await play(EG.playerTurn(B, act, rng));
    }
    await wait(10);
    var result = B.result;
    await fadeTo(1, 10);
    G.bt = null; G.mode = 'world'; music(G.map.music);
    await fadeTo(0, 10);
    return result;
  }

  /* ---------- drawing ---------- */
  function drawBattleBg(kind) {
    var tomb = kind === 'tomb' || kind === 'boss';
    if (!tomb) {
      R('#8fd8e0', 0, 0, VW, 56); R('#b8e8ea', 0, 36, VW, 20); R(GOLD, 22, 12, 22, 22); R('#f6d86a', 25, 15, 16, 16);
      R(SAND, 0, 56, VW, 48); R('#d4b878', 0, 56, VW, 3); R('#dcc487', 0, 80, VW, 2); R('#d4b878', 0, 94, VW, 2);
      ctx.fillStyle = '#c9a85e'; ctx.beginPath(); ctx.moveTo(100, 56); ctx.lineTo(128, 36); ctx.lineTo(156, 56); ctx.fill();
      ctx.fillStyle = '#a58444'; ctx.beginPath(); ctx.moveTo(128, 36); ctx.lineTo(156, 56); ctx.lineTo(132, 56); ctx.fill();
    } else {
      R('#2b2438', 0, 0, VW, 60); R('#4a3f5c', 0, 60, VW, 44);
      for (var y = 0; y < 60; y += 10) { R('#382f4a', 0, y, VW, 1); for (var x = (y / 10 % 2) * 10; x < VW; x += 20) R('#382f4a', x, y, 1, 10); }
      for (var k = 0; k < 2; k++) { var tx = k ? 140 : 18; R('#6a4a20', tx, 24, 3, 12); R(GOLD, tx - 1, 18, 5, 6); R('#ff9a30', tx, 15, 3, 4); ctx.globalAlpha = 0.18 + 0.05 * ((G.frame >> 3) & 1); R(GOLD, tx - 12, 6, 27, 34); ctx.globalAlpha = 1; }
      R('#3b3050', 0, 60, VW, 2);
      if (kind === 'boss') { R(GOLD, 0, 0, VW, 2); R(GOLD, 0, 58, VW, 1); }
    }
  }
  function plat(x, y, rx) { ctx.fillStyle = 'rgba(20,17,15,0.28)'; ctx.beginPath(); ctx.ellipse(x, y, rx, 5, 0, 0, 7); ctx.fill(); }
  function drawFx(x, y, fx) {
    var a = Math.sin(fx.t * Math.PI); ctx.globalAlpha = 0.65 * a; R(fx.color, x + 4, y + 4, 56, 56); ctx.globalAlpha = a;
    for (var i = 0; i < 6; i++) R('#fff', x + 6 + ((i * 37 + G.frame * 5) % 52), y + 6 + ((i * 53 + G.frame * 3) % 52), 3, 3);
    ctx.globalAlpha = 1;
  }
  function drawSide(side, x, y) {
    var bt = G.bt; if (!bt[side + 'Vis']) return;
    var off = bt[side + 'Off'], bl = bt[side + 'Blink'];
    if (bl > 0) { bt[side + 'Blink'] = bl - 1; if ((bl >> 1) & 1) return; }
    var sc = side === 'f' ? bt.fScale : 1, sz = 64 * sc, bob = ((G.frame >> 5) & 1);
    ctx.globalAlpha = bt[side + 'Alpha'];
    ctx.drawImage(EG.creatureSprite(bt[side + 'Sp']), x + off.x + (64 - sz) / 2, y + off.y + (64 - sz) / 2 + bob - (side === 'f' ? 0 : 0), sz, sz);
    ctx.globalAlpha = 1;
    if (bt.fx && bt.fx.side === side) drawFx(x + off.x, y + off.y, bt.fx);
  }
  function drawBattle() {
    var bt = G.bt; drawBattleBg(bt.bg);
    plat(120, 72, 32); plat(44, 104, 34);
    drawSide('f', 88, 6); drawSide('p', 12, 38);
    if (bt.ball) { var b = bt.ball; ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(b.x + b.wob, b.y, 5, 0, 7); ctx.fill(); ctx.fillStyle = LAPIS; ctx.beginPath(); ctx.arc(b.x + b.wob, b.y, 4, 0, 7); ctx.fill(); R(GOLD, b.x + b.wob - 4, b.y - 1, 8, 2); R(PAPER, b.x + b.wob - 1, b.y - 1, 2, 2); }
    // info boxes
    box(2, 4, 84, 27); T(bt.fName, 8, 8); TR('L' + bt.fLv, 82, 8);
    T('HP', 8, 19, '#8a5a10'); bar(22, 20, 56, bt.fHp / bt.fMax, hpCol(bt.fHp / bt.fMax));
    box(78, 74, 80, 29); T(bt.pName, 84, 78); TR('L' + bt.pLv, 154, 78);
    T('HP', 84, 88, '#8a5a10'); bar(98, 89, 54, bt.pHp / bt.pMax, hpCol(bt.pHp / bt.pMax));
    R(INK, 84, 97, 68, 3); R(TURQ, 85, 98, Math.round(66 * bt.pXp), 1);
    if (bt.menu || bt.prompt) {
      box(0, 104, VW, 40);
      if (bt.prompt) { if (bt.menu) { T('What will', 8, 111); T(EG.nameOf(EG.curP(bt.B)) + ' do?', 8, 124); } else wrapPages(bt.prompt)[0].forEach(function (l, i) { T(l, 8, 111 + i * 13); }); }
      var m = bt.menu; if (m) {
        m.cells.forEach(function (c, i) { var x = m.x + (i % m.cols) * m.cw, y = m.y + Math.floor(i / m.cols) * m.ch; m.draw(c, x, y, i === m.sel); if (i === m.sel) tri(x + 1, y + 2, RED); });
      }
    }
  }
  function drawPerson(look, dir, frame, x, y) { ctx.drawImage(EG.personSprite(look, dir, frame), Math.round(x), Math.round(y)); }
  function drawWorld() {
    var m = G.map, p = G.p, w = G.mapW * TS, h = G.mapH * TS;
    var ox = p.moving ? (p.tx - p.x) * TS * p.prog / STEP : 0, oy = p.moving ? (p.ty - p.y) * TS * p.prog / STEP : 0;
    var px = p.x * TS + ox, py = p.y * TS + oy;
    var cx = w <= VW ? -Math.round((VW - w) / 2) : clamp(Math.round(px + 8 - VW / 2), 0, w - VW);
    var cy = h <= VH ? -Math.round((VH - h) / 2) : clamp(Math.round(py + 8 - VH / 2), 0, h - VH);
    G.cam.x = cx; G.cam.y = cy;
    R(INK, 0, 0, VW, VH);
    var fr = (G.frame >> 5) & 1, x0 = Math.max(0, Math.floor(cx / TS)), y0 = Math.max(0, Math.floor(cy / TS)), x1 = Math.min(G.mapW - 1, Math.floor((cx + VW) / TS)), y1 = Math.min(G.mapH - 1, Math.floor((cy + VH) / TS));
    for (var ty = y0; ty <= y1; ty++) for (var tx = x0; tx <= x1; tx++) ctx.drawImage(EG.tileCanvas(m.rows[ty][tx], fr, tx, ty), tx * TS - cx, ty * TS - cy);
    var list = [];
    G.ents.forEach(function (e) {
      if (e.type === 'item' && !S.done[e.id]) list.push({ y: e.y * TS, f: function () { ctx.drawImage(EG.itemCanvas(), e.x * TS - cx, e.y * TS - cy); } });
      else if (e.type === 'pedestal' && !S.flags.starter) list.push({ y: e.y * TS - 1, f: function () { var bob = Math.sin(G.frame / 14) * 1.5; ctx.drawImage(EG.creatureSprite(e.sp), e.x * TS - cx, e.y * TS - cy - 9 + bob); } });
      else if (e.look) list.push({ y: e.y * TS + e.oy, f: function () { drawPerson(e.look, e.dir || 'down', 0, e.x * TS + e.ox - cx, e.y * TS + e.oy - cy - 2); } });
    });
    list.push({ y: py, f: function () { drawPerson(PLAYER_LOOK, p.dir, p.moving && p.prog % 10 < 5 ? 1 : 0, px - cx, py - cy - 2); } });
    list.sort(function (a, b) { return a.y - b.y; }).forEach(function (o) { o.f(); });
    if (G.excl) { var e = G.excl.e, ex = e.x * TS + e.ox - cx, ey = e.y * TS + e.oy - cy - 12; R(INK, ex + 4, ey, 8, 11); R(PAPER, ex + 5, ey + 1, 6, 9); R(RED, ex + 7, ey + 2, 2, 4); R(RED, ex + 7, ey + 7, 2, 2); }
    if (G.banner) { var bt = G.banner.t, by = bt < 12 ? -16 + bt * 1.5 : bt > 98 ? 2 - (bt - 98) * 1.5 : 2; box(16, Math.round(by), 128, 14); var tw = ctx.measureText(G.banner.text).width; T(G.banner.text, 80 - tw / 2, Math.round(by) + 4); }
  }
  function drawTitle() {
    var bands = ['#14224f', '#1c3270', '#2a5fa8', '#3f86c4', '#78b8d8', '#e9b949', '#f0cf70'];
    bands.forEach(function (c, i) { R(c, 0, i * 14, VW, 14); });
    for (var i = 0; i < 24; i++) R('#fff6c0', (i * 53) % 160, (i * 29) % 50, 1, 1);
    R(SAND, 0, 100, VW, 44); R('#d6bd80', 0, 100, VW, 2);
    ctx.fillStyle = GOLD; ctx.beginPath(); ctx.arc(80, 98, 22, Math.PI, 0); ctx.fill(); ctx.fillStyle = '#fff1a8'; ctx.beginPath(); ctx.arc(80, 98, 15, Math.PI, 0); ctx.fill();
    function pyr(x, w, hgt, a, b) { ctx.fillStyle = a; ctx.beginPath(); ctx.moveTo(x, 100); ctx.lineTo(x + w / 2, 100 - hgt); ctx.lineTo(x + w, 100); ctx.fill(); ctx.fillStyle = b; ctx.beginPath(); ctx.moveTo(x + w / 2, 100 - hgt); ctx.lineTo(x + w, 100); ctx.lineTo(x + w / 2 + 2, 100); ctx.fill(); }
    pyr(4, 56, 34, '#c49a52', '#8a6a30'); pyr(100, 60, 40, '#c49a52', '#8a6a30'); pyr(54, 52, 26, '#d4ae66', '#9a7a3a');
    ctx.font = 'bold 16px "Courier New", Courier, monospace'; var t = 'SANDKEEPERS', w = ctx.measureText(t).width;
    T(t, 80 - w / 2 + 1, 15, INK); T(t, 80 - w / 2, 14, GOLD);
    ctx.font = FONT; var s = 'A Desert Creature Quest'; T(s, 80 - ctx.measureText(s).width / 2, 36, PAPER);
    if (G.titlePrompt && (G.frame >> 5) & 1) { var q = 'PRESS A TO START'; T(q, 80 - ctx.measureText(q).width / 2, 92, INK); }
  }
  function render() {
    ctx.setTransform(scale, 0, 0, scale, 0, 0); ctx.imageSmoothingEnabled = false; ctx.font = FONT; ctx.textBaseline = 'top'; ctx.globalAlpha = 1;
    R(INK, 0, 0, VW, VH);
    if (G.mode === 'world' && G.map) drawWorld();
    else if (G.mode === 'battle' && G.bt) drawBattle();
    else if (G.mode === 'title') drawTitle();
    if (G.preview) { box(48, 4, 64, 66); R('#d9c58f', 52, 8, 56, 56); ctx.drawImage(EG.creatureSprite(G.preview.sp), 56, 10, 48, 48); }
    G.overlays.slice().forEach(function (o) { if (o.draw && !o.items) o.draw(); else drawMenu(o); });
    drawDialog();
    if (G.fade > 0.01) { ctx.globalAlpha = Math.min(1, G.fade); R(INK, 0, 0, VW, VH); ctx.globalAlpha = 1; }
  }

  /* ---------- loop, input ---------- */
  function tick() {
    G.frame++;
    anims.slice().forEach(function (a) {
      a.t++; if (a.fn) a.fn(Math.min(1, a.t / a.n));
      if (a.t >= a.n) { var i = anims.indexOf(a); if (i >= 0) anims.splice(i, 1); a.res(); }
    });
    updateDialog();
    if (G.mode === 'world' && !G.locked) worldUpdate();
    if (inputs.length && G.held) { G.hc = (G.hc || 0) + 1; if (G.hc > 18 && G.hc % 6 === 0) press(G.held, true); } else G.hc = 0;
    if (G.mode === 'world' && !G.locked && S && G.frame - G.lastSave > 1800) save();
  }
  function press(b, repeat) {
    if (!repeat) EG.audio.unlock();
    var h = inputs[inputs.length - 1];
    if (h) { h(b === 'start' ? 'b' : b); return; }
    if (G.mode === 'world' && !G.locked) { if (b === 'a') runLocked(interact); else if (b === 'start') runLocked(mainMenu); }
  }
  function setHeld(d) { if (d === G.held) return; G.held = d; G.hc = 0; if (d) press(d); }

  function resize() {
    var wrap = document.getElementById('screen-wrap'), r = wrap.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    var fit = Math.min(r.width / VW, r.height / VH);
    scale = Math.max(1, Math.floor(fit * dpr));
    cv.width = VW * scale; cv.height = VH * scale;
    cv.style.width = (VW * scale / dpr) + 'px'; cv.style.height = (VH * scale / dpr) + 'px';
  }
  function bindInput() {
    var keys = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };
    var down = {};
    window.addEventListener('keydown', function (e) {
      if (e.target && e.target.tagName === 'TEXTAREA') return;
      var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (keys[k]) { down[k] = 1; setHeld(keys[k]); e.preventDefault(); }
      else if (k === 'z' || k === ' ' || k === 'Enter') { if (!e.repeat) press(k === 'Enter' ? 'a' : 'a'); e.preventDefault(); }
      else if (k === 'x' || k === 'Escape' || k === 'Backspace') { if (!e.repeat) press('b'); e.preventDefault(); }
      else if (k === 'm' || k === 'Tab') { if (!e.repeat) press('start'); e.preventDefault(); }
    });
    window.addEventListener('keyup', function (e) {
      var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (keys[k]) { delete down[k]; var rest = Object.keys(down); setHeld(rest.length ? keys[rest[rest.length - 1]] : null); }
    });
    var pad = document.getElementById('dpad');
    function dirFrom(e) {
      var r = pad.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2), dz = r.width * 0.14;
      if (Math.abs(dx) < dz && Math.abs(dy) < dz) return null;
      return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    }
    pad.addEventListener('pointerdown', function (e) { e.preventDefault(); try { pad.setPointerCapture(e.pointerId); } catch (x) {} setHeld(dirFrom(e)); });
    pad.addEventListener('pointermove', function (e) { if (e.buttons || e.pointerType === 'touch') setHeld(dirFrom(e)); });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (n) { pad.addEventListener(n, function (e) { setHeld(null); }); });
    [['btn-a', 'a'], ['btn-b', 'b'], ['btn-start', 'start']].forEach(function (p) {
      var el = document.getElementById(p[0]);
      el.addEventListener('pointerdown', function (e) { e.preventDefault(); el.classList.add('on'); press(p[1]); });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (n) { el.addEventListener(n, function () { el.classList.remove('on'); }); });
    });
    var snd = document.getElementById('btn-snd');
    snd.addEventListener('pointerdown', function (e) { e.preventDefault(); EG.audio.unlock(); if (S) { S.opts.sound = !S.opts.sound; applySound(); } else { EG.audio.setMuted(EG.audio.isMuted() ? false : true); snd.textContent = EG.audio.isMuted() ? 'SOUND OFF' : 'SOUND ON'; } });
    document.addEventListener('contextmenu', function (e) { if (!(e.target && e.target.tagName === 'TEXTAREA')) e.preventDefault(); });
    document.addEventListener('visibilitychange', function () { if (document.hidden && S && G.mode === 'world') save(); });
    window.addEventListener('pagehide', function () { if (S && G.mode === 'world') save(); });
    window.addEventListener('resize', resize); window.addEventListener('orientationchange', function () { setTimeout(resize, 200); });
  }

  /* ---------- title / boot ---------- */
  function enterWorld() {
    G.mode = 'world'; G.fade = 0;
    var m = EG.MAPS[S.map] ? S : EG.START;
    loadMap(m.map || S.map, m.x, m.y, m.dir);
  }
  async function newGame() {
    S = EG.newState(); applySound(); G.mode = 'intro'; music('tomb');
    await say(['You were exploring the desert with your uncle when the sand gave way beneath your feet!', 'You tumbled into a hidden tomb deep underground...',
      'Three creatures sleep on ancient pedestals. One of them seems to be calling to you.', 'Walk up to a pedestal and press A to meet it. D-pad to move, START for the menu.']);
    G.fade = 1; G.mode = 'world'; loadMap(EG.START.map, EG.START.x, EG.START.y, EG.START.dir); await fadeTo(0, 20); save();
  }
  async function titleFlow() {
    G.mode = 'title'; G.titlePrompt = true; G.fade = 0; music('title');
    await new Promise(function (res) { pushInput(function (b) { if (b === 'a' || b === 'b') { popInput(); res(); } }); });
    G.titlePrompt = false; sfx('confirm');
    var saved = loadSave();
    for (;;) {
      var opts = saved ? ['CONTINUE', 'NEW GAME'] : ['NEW GAME'];
      var i = await listMenu({ x: 44, y: 88, w: 72, items: opts.map(function (s) { return { label: s }; }), cancel: false });
      if (saved && i === 0) { S = saved; applySound(); await fadeTo(1, 10); enterWorld(); await fadeTo(0, 10); return; }
      if (saved) {
        await say('Starting over will erase your saved game. Are you sure?');
        var c = await ask(['NO', 'YES, ERASE'], 60, 60);
        if (c !== 1) continue;
      }
      await fadeTo(1, 10); await newGame(); return;
    }
  }
  function boot() {
    S = null; resize(); bindInput(); EG.audio.setMuted(false);
    var snd = document.getElementById('btn-snd'); if (snd) snd.textContent = 'SOUND ON';
    var saved = loadSave(); if (saved) { EG.audio.setMuted(!saved.opts.sound); if (snd) snd.textContent = saved.opts.sound ? 'SOUND ON' : 'SOUND OFF'; }
    runLocked(titleFlow);
    if (location.search.indexOf('manual') < 0) {
      var last = 0, acc = 0;
      (function loop(ts) {
        requestAnimationFrame(loop); if (!last) last = ts; acc += Math.min(100, ts - last); last = ts;
        var n = 0; while (acc >= 16.667 && n < 4) { tick(); acc -= 16.667; n++; } if (acc > 34) acc = 0;
        if (n) render();
      })(0);
    }
  }
  EG.game = { press: press, setHeld: setHeld, tick: tick, render: render, G: G, getS: function () { return S; }, setS: function (s) { S = s; }, boot: boot, setRng: function (r) { rng = r; }, loadMap: loadMap, save: save };
  window.addEventListener('error', function (e) { window.__egError = (window.__egError || '') + e.message + '\n'; });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
