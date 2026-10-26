/* Sandkeepers - game logic (creatures, battles, catching, xp, saves). Pure: no DOM. */
(function (root) {
  'use strict';
  var EG = root.EG;

  EG.makeRng = function (seed) {
    var a = (seed >>> 0) || 1;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  };

  EG.MAX_LEVEL = 50;
  EG.xpFor = function (lv) { return lv * lv * lv; };
  EG.stats = function (c) {
    var b = EG.SPECIES[c.sp].base, L = c.lv;
    function f(v) { return Math.floor(2 * v * L / 100) + 5; }
    return { hp: Math.floor(2 * b[0] * L / 100) + L + 10, atk: f(b[1]), def: f(b[2]), spd: f(b[3]) };
  };
  EG.maxHp = function (c) { return EG.stats(c).hp; };
  EG.learnedMoves = function (sp, lv) {
    var list = EG.SPECIES[sp].learn.filter(function (e) { return e[0] <= lv; }).map(function (e) { return e[1]; });
    var out = [];
    list.forEach(function (m) { if (out.indexOf(m) < 0) out.push(m); });
    return out.slice(-4);
  };
  EG.makeCreature = function (sp, lv) {
    var c = { sp: sp, lv: lv, xp: EG.xpFor(lv), hp: 1, moves: EG.learnedMoves(sp, lv), nick: null };
    c.hp = EG.maxHp(c);
    return c;
  };
  EG.nameOf = function (c) { return c.nick || EG.SPECIES[c.sp].n; };
  EG.alive = function (c) { return c.hp > 0; };
  EG.healAll = function (team) { team.forEach(function (c) { c.hp = EG.maxHp(c); }); };
  EG.stageMult = function (s) { return s >= 0 ? (2 + s) / 2 : 2 / (2 - s); };

  EG.calcDamage = function (att, def, mv, aSt, dSt, rng) {
    if (!mv.p) return { dmg: 0, eff: 1, crit: false };
    var A = EG.stats(att).atk * EG.stageMult(aSt.atk);
    var D = EG.stats(def).def * EG.stageMult(dSt.def);
    var base = Math.floor(Math.floor((2 * att.lv / 5 + 2) * mv.p * A / D) / 50) + 2;
    var eff = EG.typeMult(mv.t, EG.SPECIES[def.sp].t);
    var stab = EG.SPECIES[att.sp].t === mv.t ? 1.5 : 1;
    var crit = rng() < 1 / 16;
    var mod = stab * eff * (0.85 + 0.15 * rng()) * (crit ? 1.5 : 1);
    var dmg = eff === 0 ? 0 : Math.max(1, Math.floor(base * mod));
    return { dmg: dmg, eff: eff, crit: crit };
  };

  /* ---------- party / inventory ---------- */
  EG.newState = function () {
    return {
      v: 1, team: [], box: [], items: { charm: 5, salve: 3 }, gold: 100, flags: {}, done: {},
      map: EG.START.map, x: EG.START.x, y: EG.START.y, dir: EG.START.dir,
      heal: { map: 'town', x: 11, y: 4 }, dex: { seen: {}, caught: {} }, opts: { sound: true }, steps: 0, t: 0
    };
  };
  EG.addCreature = function (S, c) {
    S.dex.seen[c.sp] = 1; S.dex.caught[c.sp] = 1;
    if (S.team.length < 6) { S.team.push(c); return 'team'; }
    S.box.push(c); return 'box';
  };
  EG.firstAlive = function (team) { for (var i = 0; i < team.length; i++) if (team[i].hp > 0) return i; return -1; };
  EG.anyAlive = function (team) { return EG.firstAlive(team) >= 0; };
  EG.maxTeamLevel = function (team) { return team.reduce(function (m, c) { return Math.max(m, c.lv); }, 0); };

  EG.useHeal = function (S, itemId, idx) {
    var it = EG.ITEMS[itemId], c = S.team[idx];
    if (!it || !it.heal || !c || !(S.items[itemId] > 0)) return { ok: false, msg: 'Cannot use that.' };
    var mx = EG.maxHp(c);
    if (c.hp <= 0) return { ok: false, msg: 'It has fainted. Rest at the shrine.' };
    if (c.hp >= mx) return { ok: false, msg: 'HP is already full.' };
    var before = c.hp; c.hp = Math.min(mx, c.hp + it.heal);
    S.items[itemId]--; if (S.items[itemId] <= 0) delete S.items[itemId];
    return { ok: true, healed: c.hp - before, msg: EG.nameOf(c) + ' recovered ' + (c.hp - before) + ' HP!' };
  };

  EG.checkEvolve = function (c) {
    var e = EG.SPECIES[c.sp].evo;
    return (e && c.lv >= e.lv) ? e.to : null;
  };
  EG.evolve = function (c) {
    var to = EG.checkEvolve(c); if (!to) return false;
    var oldMax = EG.maxHp(c), old = c.sp;
    if (c.nick === EG.SPECIES[old].n) c.nick = null;
    c.sp = to;
    c.hp += EG.maxHp(c) - oldMax;
    EG.learnedMoves(to, c.lv).forEach(function (m) { if (c.moves.indexOf(m) < 0) learnMove(c, m); });
    return true;
  };
  function learnMove(c, m) {
    if (c.moves.indexOf(m) >= 0) return null;
    if (c.moves.length < 4) { c.moves.push(m); return { learned: m }; }
    var wi = 0, wp = 999;
    c.moves.forEach(function (id, i) { var p = EG.MOVES[id].p; if (p < wp) { wp = p; wi = i; } });
    var forgot = c.moves[wi]; c.moves[wi] = m;
    return { learned: m, forgot: forgot };
  }

  /* ---------- battle ---------- */
  EG.newBattle = function (S, opts) {
    var foe = opts.foe;
    var B = {
      S: S, kind: opts.kind, name: opts.name || '', boss: !!opts.boss, foeTeam: foe, fi: 0,
      pi: EG.firstAlive(S.team), st: { p: blankSt(), f: blankSt() }, runTries: 0, over: false, result: null,
      needSwitch: false, part: {}, caughtTo: null
    };
    B.part[B.pi] = 1;
    S.dex.seen[foe[0].sp] = 1;
    return B;
  };
  function blankSt() { return { atk: 0, def: 0, spd: 0 }; }
  EG.curP = function (B) { return B.S.team[B.pi]; };
  EG.curF = function (B) { return B.foeTeam[B.fi]; };
  function nm(B, side) {
    var c = side === 'p' ? EG.curP(B) : EG.curF(B);
    if (side === 'p') return EG.nameOf(c);
    return (B.kind === 'wild' ? 'Wild ' : 'Foe ') + EG.SPECIES[c.sp].n;
  }
  EG.battleIntro = function (B) {
    var ev = [];
    if (B.kind === 'wild') ev.push({ t: 'msg', text: 'A wild ' + EG.SPECIES[EG.curF(B).sp].n + ' appeared!' });
    else ev.push({ t: 'msg', text: B.name + ' wants to battle!' });
    if (B.kind !== 'wild') ev.push({ t: 'msg', text: B.name + ' sent out ' + EG.SPECIES[EG.curF(B).sp].n + '!' });
    ev.push({ t: 'msg', text: 'Go, ' + EG.nameOf(EG.curP(B)) + '!' });
    return ev;
  };

  function aiPick(B, rng) {
    var f = EG.curF(B), p = EG.curP(B), best = null, bs = -1;
    var scores = f.moves.map(function (id) {
      var m = EG.MOVES[id], s;
      if (m.p) s = m.p * EG.typeMult(m.t, EG.SPECIES[p.sp].t) * (EG.SPECIES[f.sp].t === m.t ? 1.5 : 1) * (m.a / 100);
      else s = (B.st.f.atk > -2 && m.fx && !m.fx.self ? 18 : 0) + (m.fx && m.fx.self && B.st.f[m.fx.stat] < 2 ? 14 : 0);
      return s;
    });
    if (rng() < 0.7) { scores.forEach(function (s, i) { if (s > bs) { bs = s; best = i; } }); return f.moves[best]; }
    return f.moves[Math.floor(rng() * f.moves.length)];
  }

  // one attack. returns true if the defender fainted.
  function doAttack(B, side, moveId, rng, ev) {
    var other = side === 'p' ? 'f' : 'p';
    var att = side === 'p' ? EG.curP(B) : EG.curF(B);
    var def = other === 'p' ? EG.curP(B) : EG.curF(B);
    var mv = EG.MOVES[moveId];
    ev.push({ t: 'msg', text: nm(B, side) + ' used ' + mv.n + '!' });
    if (mv.a < 100 && rng() * 100 >= mv.a) { ev.push({ t: 'msg', text: nm(B, side) + "'s attack missed!" }); return false; }
    ev.push({ t: 'anim', kind: 'attack', side: side, type: mv.t });
    if (!mv.p) {
      var fx = mv.fx, tgtSide = fx.self ? side : other, st = B.st[tgtSide];
      var nv = Math.max(-6, Math.min(6, st[fx.stat] + fx.st));
      var label = { atk: 'Attack', def: 'Defense', spd: 'Speed' }[fx.stat];
      if (nv === st[fx.stat]) ev.push({ t: 'msg', text: nm(B, tgtSide) + "'s " + label + " won't go any " + (fx.st > 0 ? 'higher!' : 'lower!') });
      else { st[fx.stat] = nv; ev.push({ t: 'stat', side: tgtSide, up: fx.st > 0 }); ev.push({ t: 'msg', text: nm(B, tgtSide) + "'s " + label + (fx.st > 0 ? ' rose!' : ' fell!') }); }
      return false;
    }
    var r = EG.calcDamage(att, def, mv, B.st[side], B.st[other], rng);
    if (r.eff === 0) { ev.push({ t: 'msg', text: "It doesn't affect " + nm(B, other) + '...' }); return false; }
    def.hp = Math.max(0, def.hp - r.dmg);
    ev.push({ t: 'hp', side: other, hp: def.hp, max: EG.maxHp(def), eff: r.eff });
    if (r.crit) ev.push({ t: 'msg', text: 'A critical hit!' });
    if (r.eff > 1) ev.push({ t: 'msg', text: "It's super effective!" });
    else if (r.eff < 1) ev.push({ t: 'msg', text: "It's not very effective..." });
    if (def.hp <= 0) { faint(B, other, rng, ev); return true; }
    return false;
  }

  function faint(B, side, rng, ev) {
    ev.push({ t: 'faint', side: side });
    ev.push({ t: 'msg', text: nm(B, side) + ' fainted!' });
    if (side === 'f') {
      var foe = EG.curF(B), gain = Math.floor(EG.SPECIES[foe.sp].exp * foe.lv / 5 * (B.kind === 'wild' ? 1 : 1.5));
      gain = Math.max(1, gain);
      var parts = Object.keys(B.part).map(Number).filter(function (i) { return B.S.team[i] && B.S.team[i].hp > 0; });
      parts.forEach(function (i) {
        var c = B.S.team[i], g = i === B.pi ? gain : Math.max(1, Math.floor(gain / 2));
        ev.push({ t: 'msg', text: EG.nameOf(c) + ' gained ' + g + ' XP!' });
        giveXp(B, i, g, ev);
      });
      B.part = {}; if (B.S.team[B.pi] && B.S.team[B.pi].hp > 0) B.part[B.pi] = 1;
      if (B.fi + 1 < B.foeTeam.length) {
        B.fi++; B.st.f = blankSt();
        B.S.dex.seen[EG.curF(B).sp] = 1;
        ev.push({ t: 'msg', text: B.name + ' sent out ' + EG.SPECIES[EG.curF(B).sp].n + '!' });
        ev.push({ t: 'send', side: 'f' });
      } else {
        B.over = true; B.result = 'win';
        if (B.kind !== 'wild') {
          var g2 = 0; B.reward = B.reward || 0;
          ev.push({ t: 'msg', text: 'You defeated ' + B.name + '!' });
        }
        ev.push({ t: 'end', result: 'win' });
      }
    } else {
      if (EG.anyAlive(B.S.team)) { B.needSwitch = true; ev.push({ t: 'needSwitch' }); }
      else {
        B.over = true; B.result = 'lose';
        ev.push({ t: 'msg', text: 'You have no creatures left that can fight!' });
        ev.push({ t: 'end', result: 'lose' });
      }
    }
  }

  function giveXp(B, i, g, ev) {
    var c = B.S.team[i];
    c.xp += g;
    ev.push({ t: 'xp', idx: i, xp: c.xp, lv: c.lv });
    while (c.lv < EG.MAX_LEVEL && c.xp >= EG.xpFor(c.lv + 1)) {
      var oldMax = EG.maxHp(c);
      c.lv++;
      c.hp += EG.maxHp(c) - oldMax;
      ev.push({ t: 'levelup', idx: i, lv: c.lv, hp: c.hp, max: EG.maxHp(c), isActive: i === B.pi });
      ev.push({ t: 'msg', text: EG.nameOf(c) + ' grew to Lv ' + c.lv + '!' });
      EG.SPECIES[c.sp].learn.forEach(function (e) {
        if (e[0] === c.lv) {
          var r = learnMove(c, e[1]);
          if (r) ev.push({ t: 'msg', text: EG.nameOf(c) + ' learned ' + EG.MOVES[r.learned].n + (r.forgot ? ' and forgot ' + EG.MOVES[r.forgot].n : '') + '!' });
        }
      });
    }
  }

  function foeAttack(B, rng, ev) {
    if (B.over) return;
    doAttack(B, 'f', aiPick(B, rng), rng, ev);
  }

  function speedOrder(B, rng) {
    var ps = EG.stats(EG.curP(B)).spd * EG.stageMult(B.st.p.spd), fs = EG.stats(EG.curF(B)).spd * EG.stageMult(B.st.f.spd);
    if (ps === fs) return rng() < 0.5;
    return ps > fs;
  }

  // action: {type:'fight', move:id} | {type:'item', item, idx?} | {type:'swap', idx} | {type:'run'}
  EG.playerTurn = function (B, action, rng) {
    var ev = [];
    if (B.over || B.needSwitch) return ev;
    var S = B.S;
    if (action.type === 'fight') {
      var pm = action.move, pFirst = speedOrder(B, rng);
      if (pFirst) {
        if (!doAttack(B, 'p', pm, rng, ev)) foeAttack(B, rng, ev);
      } else {
        var pBefore = EG.curP(B);
        foeAttack(B, rng, ev);
        if (!B.over && !B.needSwitch && EG.curP(B) === pBefore && pBefore.hp > 0) doAttack(B, 'p', pm, rng, ev);
      }
    } else if (action.type === 'item') {
      var it = EG.ITEMS[action.item];
      if (!it || !(S.items[action.item] > 0)) return ev;
      if (it.heal) {
        var c = S.team[action.idx !== undefined ? action.idx : B.pi];
        var r = EG.useHeal(S, action.item, S.team.indexOf(c));
        if (!r.ok) { ev.push({ t: 'msg', text: r.msg }); ev.push({ t: 'noturn' }); return ev; }
        ev.push({ t: 'msg', text: 'Used ' + it.n + '. ' + r.msg });
        ev.push({ t: 'hp', side: 'p', hp: c.hp, max: EG.maxHp(c), heal: true, idx: S.team.indexOf(c) });
        foeAttack(B, rng, ev);
      } else if (it.ball) {
        if (B.kind !== 'wild') { ev.push({ t: 'msg', text: "You can't catch another trainer's creature!" }); ev.push({ t: 'noturn' }); return ev; }
        S.items[action.item]--; if (S.items[action.item] <= 0) delete S.items[action.item];
        var f = EG.curF(B), mx = EG.maxHp(f);
        var a = ((3 * mx - 2 * f.hp) * EG.SPECIES[f.sp].rate * it.ball) / (3 * mx);
        var ok = rng() * 255 < a;
        var shakes = ok ? 3 : Math.min(2, Math.floor(rng() * 3));
        ev.push({ t: 'msg', text: 'You threw a ' + it.n + '!' });
        ev.push({ t: 'catch', shakes: shakes, ok: ok });
        if (ok) {
          var dest = EG.addCreature(S, f);
          B.over = true; B.result = 'caught'; B.caughtTo = dest;
          ev.push({ t: 'msg', text: 'Gotcha! ' + EG.SPECIES[f.sp].n + ' was caught!' });
          if (dest === 'box') ev.push({ t: 'msg', text: 'Your team is full. It was sent to the Ankh Box.' });
          ev.push({ t: 'end', result: 'caught' });
        } else {
          ev.push({ t: 'msg', text: shakes >= 2 ? 'So close! It broke free!' : 'It broke free!' });
          foeAttack(B, rng, ev);
        }
      }
    } else if (action.type === 'swap') {
      var nc = S.team[action.idx];
      if (!nc || nc.hp <= 0 || action.idx === B.pi) return ev;
      ev.push({ t: 'msg', text: 'Come back, ' + EG.nameOf(EG.curP(B)) + '!' });
      B.pi = action.idx; B.st.p = blankSt(); B.part[B.pi] = 1;
      ev.push({ t: 'msg', text: 'Go, ' + EG.nameOf(nc) + '!' });
      ev.push({ t: 'send', side: 'p' });
      foeAttack(B, rng, ev);
    } else if (action.type === 'run') {
      if (B.kind !== 'wild') { ev.push({ t: 'msg', text: "You can't run from a trainer battle!" }); ev.push({ t: 'noturn' }); return ev; }
      B.runTries++;
      var ps = EG.stats(EG.curP(B)).spd, fs2 = EG.stats(EG.curF(B)).spd;
      var chance = Math.min(1, 0.35 + 0.65 * ps / (ps + fs2) + 0.12 * B.runTries);
      if (rng() < chance) { B.over = true; B.result = 'run'; ev.push({ t: 'msg', text: 'Got away safely!' }); ev.push({ t: 'end', result: 'run' }); }
      else { ev.push({ t: 'msg', text: "Can't escape!" }); foeAttack(B, rng, ev); }
    }
    return ev;
  };

  EG.forceSwitch = function (B, idx) {
    var ev = [], nc = B.S.team[idx];
    if (!B.needSwitch || !nc || nc.hp <= 0) return ev;
    B.needSwitch = false; B.pi = idx; B.st.p = blankSt(); B.part[idx] = 1;
    ev.push({ t: 'msg', text: 'Go, ' + EG.nameOf(nc) + '!' });
    ev.push({ t: 'send', side: 'p' });
    return ev;
  };

  /* ---------- wild encounters ---------- */
  EG.rollWild = function (table, rng) {
    var tot = table.reduce(function (s, e) { return s + e[3]; }, 0), r = rng() * tot, e = table[0];
    for (var i = 0; i < table.length; i++) { r -= table[i][3]; if (r < 0) { e = table[i]; break; } }
    var lv = e[1] + Math.floor(rng() * (e[2] - e[1] + 1));
    return EG.makeCreature(e[0], lv);
  };

  /* ---------- save validation ---------- */
  EG.validateSave = function (o) {
    if (!o || typeof o !== 'object' || !Array.isArray(o.team) || !EG.MAPS[o.map]) return false;
    function okc(c) { return c && EG.SPECIES[c.sp] && c.lv >= 1 && c.lv <= EG.MAX_LEVEL && Array.isArray(c.moves) && c.moves.every(function (m) { return EG.MOVES[m]; }) && typeof c.hp === 'number'; }
    if (!o.team.every(okc) || o.team.length > 6) return false;
    if (o.box && !(Array.isArray(o.box) && o.box.every(okc))) return false;
    if (typeof o.x !== 'number' || typeof o.y !== 'number') return false;
    var base = EG.newState(), out = {};
    Object.keys(base).forEach(function (k) { out[k] = (o[k] !== undefined && o[k] !== null) ? o[k] : base[k]; });
    out.items = out.items && typeof out.items === 'object' ? out.items : base.items;
    return out;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = EG;
})(typeof self !== 'undefined' ? self : globalThis);
