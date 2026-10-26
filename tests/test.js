'use strict';
var assert = require('assert');
var path = require('path');
require(path.join(__dirname, '../data.js'));
require(path.join(__dirname, '../logic.js'));
var EG = global.EG, n = 0;
function t(name, fn) { fn(); n++; console.log('ok - ' + name); }

t('type chart sane', function () {
  assert.strictEqual(EG.typeMult('sun', 'shadow'), 2);
  assert.strictEqual(EG.typeMult('shadow', 'nile'), 2);
  assert.strictEqual(EG.typeMult('nile', 'sun'), 2);   // starter triangle
  assert.strictEqual(EG.typeMult('sun', 'nile'), 0.5);
  assert.strictEqual(EG.typeMult('plain', 'sun'), 1);
  Object.keys(EG.CHART).forEach(function (a) { Object.keys(EG.CHART[a]).forEach(function (d) { assert(EG.TYPES[d], d); }); assert(EG.TYPES[a]); });
});

t('data integrity', function () {
  assert(EG.SPECIES_LIST.length >= 12 && EG.SPECIES_LIST.length <= 15, 'species count ' + EG.SPECIES_LIST.length);
  EG.SPECIES_LIST.forEach(function (k) {
    var s = EG.SPECIES[k];
    assert(EG.TYPES[s.t], k + ' type'); assert(s.base.length === 4); assert(s.art && s.pal);
    s.learn.forEach(function (e) { assert(EG.MOVES[e[1]], k + ' move ' + e[1]); });
    if (s.evo) assert(EG.SPECIES[s.evo.to], k + ' evo');
    var c = EG.makeCreature(k, 5); assert(c.moves.length >= 2 && c.moves.length <= 4, k + ' moves at 5: ' + c.moves);
  });
  Object.keys(EG.MOVES).forEach(function (m) { assert(EG.TYPES[EG.MOVES[m].t]); });
  assert.deepStrictEqual(EG.makeCreature('scarabit', 5).moves.sort(), ['flare', 'glare', 'strike', 'brace'].sort());
});

t('stats and damage', function () {
  var a = EG.makeCreature('scarabit', 5), b = EG.makeCreature('jackling', 5), z = { atk: 0, def: 0, spd: 0 };
  assert(EG.maxHp(a) > 15 && EG.maxHp(a) < 40, 'hp ' + EG.maxHp(a));
  var rng = EG.makeRng(1), lo = 1e9, hi = 0;
  for (var i = 0; i < 300; i++) { var r = EG.calcDamage(a, b, EG.MOVES.flare, z, z, rng); lo = Math.min(lo, r.dmg); hi = Math.max(hi, r.dmg); assert.strictEqual(r.eff, 2); }
  assert(lo >= 1 && hi > lo && hi < EG.maxHp(b) * 1.2, lo + '-' + hi);
  var rn = EG.makeRng(2), rr = EG.calcDamage(b, a, EG.MOVES.shadeclaw, z, z, rn); assert.strictEqual(rr.eff, 0.5);
  assert.strictEqual(EG.calcDamage(a, b, EG.MOVES.brace, z, z, rng).dmg, 0);
  // defence stage reduces damage
  var d1 = EG.calcDamage(a, b, EG.MOVES.strike, z, { atk: 0, def: 0, spd: 0 }, EG.makeRng(5)).dmg;
  var d2 = EG.calcDamage(a, b, EG.MOVES.strike, z, { atk: 0, def: 2, spd: 0 }, EG.makeRng(5)).dmg;
  assert(d2 < d1);
});

t('xp / level up / learn / evolve', function () {
  var S = EG.newState(); S.team.push(EG.makeCreature('scarabit', 5));
  var B = EG.newBattle(S, { kind: 'wild', foe: [EG.makeCreature('aspling', 5)] });
  var rng = EG.makeRng(3), levels = 0, guard = 0;
  while (S.team[0].lv < 9 && guard++ < 200) {
    S.team[0].hp = EG.maxHp(S.team[0]);
    B = EG.newBattle(S, { kind: 'wild', foe: [EG.makeCreature('aspling', 5)] });
    var g2 = 0;
    while (!B.over && g2++ < 50) { var ev = EG.playerTurn(B, { type: 'fight', move: 'flare' }, rng); ev.forEach(function (e) { if (e.t === 'levelup') levels++; }); if (B.needSwitch) break; }
  }
  assert(S.team[0].lv >= 9 && levels >= 4, 'lv ' + S.team[0].lv);
  assert(S.team[0].moves.indexOf('sunbeam') >= 0, 'learned sunbeam: ' + S.team[0].moves);
  assert(S.team[0].moves.length <= 4);
  var c = S.team[0]; c.lv = 16; assert.strictEqual(EG.checkEvolve(c), 'scarablaze');
  var hp0 = c.hp; assert(EG.evolve(c)); assert.strictEqual(c.sp, 'scarablaze'); assert(c.hp >= hp0 && c.hp <= EG.maxHp(c));
  assert.strictEqual(EG.checkEvolve(c), null);
});

t('catching: odds rise as HP falls, full team goes to box', function () {
  function rate(hpFrac, ball, runs) {
    var wins = 0, rng = EG.makeRng(11);
    for (var i = 0; i < runs; i++) {
      var S = EG.newState(); S.team.push(EG.makeCreature('jackling', 20)); S.items = { charm: 1, ankh: 1 };
      var f = EG.makeCreature('horlet', 5); f.hp = Math.max(1, Math.floor(EG.maxHp(f) * hpFrac));
      var B = EG.newBattle(S, { kind: 'wild', foe: [f] });
      EG.playerTurn(B, { type: 'item', item: ball }, rng);
      if (B.result === 'caught') { wins++; assert.strictEqual(S.team.length, 2); assert(S.dex.caught.horlet); }
    }
    return wins / runs;
  }
  var full = rate(1, 'charm', 600), low = rate(0.1, 'charm', 600), ankh = rate(0.1, 'ankh', 600);
  assert(low > full + 0.2, full + ' ' + low); assert(ankh >= low - 0.03);
  assert(full > 0.1 && low > 0.4 && low < 1, full + ' ' + low);
  var S = EG.newState(); for (var i = 0; i < 6; i++) S.team.push(EG.makeCreature('bastkit', 5));
  assert.strictEqual(EG.addCreature(S, EG.makeCreature('ibisk', 4)), 'box'); assert.strictEqual(S.box.length, 1);
  // cannot catch trainer creatures; no charm = no-op
  var S2 = EG.newState(); S2.team.push(EG.makeCreature('jackling', 5));
  var B2 = EG.newBattle(S2, { kind: 'trainer', name: 'X', foe: [EG.makeCreature('horlet', 5)] });
  var ev = EG.playerTurn(B2, { type: 'item', item: 'charm' }, EG.makeRng(1)); assert(ev.some(function (e) { return e.t === 'noturn'; })); assert.strictEqual(S2.items.charm, 5);
});

t('healing items', function () {
  var S = EG.newState(); S.team.push(EG.makeCreature('crocklet', 10)); var c = S.team[0];
  assert(!EG.useHeal(S, 'salve', 0).ok); c.hp = 3;
  var r = EG.useHeal(S, 'salve', 0); assert(r.ok && c.hp === 28 || c.hp === EG.maxHp(c)); assert.strictEqual(S.items.salve, 2);
  c.hp = 0; assert(!EG.useHeal(S, 'salve', 0).ok);
  EG.healAll(S.team); assert.strictEqual(c.hp, EG.maxHp(c));
});

t('running, swapping, forced switch, losing', function () {
  var S = EG.newState(); S.team.push(EG.makeCreature('scarabit', 5), EG.makeCreature('jackling', 5));
  var B = EG.newBattle(S, { kind: 'wild', foe: [EG.makeCreature('wrappet', 20)] }), rng = EG.makeRng(8);
  var tries = 0; while (!B.over && tries++ < 30) { S.team[0].hp = EG.maxHp(S.team[0]); S.team[1].hp = EG.maxHp(S.team[1]); EG.playerTurn(B, { type: 'run' }, rng); }
  assert.strictEqual(B.result, 'run');
  B = EG.newBattle(S, { kind: 'wild', foe: [EG.makeCreature('wrappet', 30)] });
  var ev = EG.playerTurn(B, { type: 'swap', idx: 1 }, rng); assert.strictEqual(B.pi, 1); assert(ev.some(function (e) { return e.t === 'send'; }));
  // faint: foe overpowers; need switch then lose
  S.team[0].hp = 1; S.team[1].hp = 1; EG.healAll([]);
  var guard = 0; B.pi = 0;
  while (!B.over && guard++ < 20) {
    if (B.needSwitch) { var idx = EG.firstAlive(S.team); EG.forceSwitch(B, idx); }
    EG.playerTurn(B, { type: 'fight', move: 'strike' }, rng);
  }
  assert.strictEqual(B.result, 'lose'); assert(!EG.anyAlive(S.team));
  // trainer win path
  var S3 = EG.newState(); S3.team.push(EG.makeCreature('crocklet', 40));
  var B3 = EG.newBattle(S3, { kind: 'trainer', name: 'T', foe: [EG.makeCreature('horlet', 3), EG.makeCreature('bastkit', 3)] });
  var evs = []; guard = 0; while (!B3.over && guard++ < 30) evs = evs.concat(EG.playerTurn(B3, { type: 'fight', move: 'flood' }, rng));
  assert.strictEqual(B3.result, 'win'); assert(evs.filter(function (e) { return e.t === 'faint'; }).length === 2); assert.strictEqual(B3.fi, 1);
});

t('save validate / roundtrip', function () {
  var S = EG.newState(); S.team.push(EG.makeCreature('scarabit', 7)); S.flags.starter = 1; S.map = 'town'; S.x = 3; S.y = 4;
  var json = JSON.stringify(S), back = EG.validateSave(JSON.parse(json));
  assert(back); assert.deepStrictEqual(back.team, S.team); assert.strictEqual(back.map, 'town');
  assert(!EG.validateSave({ team: [{ sp: 'pikachu', lv: 5, moves: [], hp: 5 }], map: 'town', x: 1, y: 1 }));
  assert(!EG.validateSave(null)); assert(!EG.validateSave({ team: [], map: 'nowhere', x: 1, y: 1 }));
  var old = { team: S.team, map: 'town', x: 1, y: 1 }; var up = EG.validateSave(old); assert(up && up.items && up.dex && up.flags);
});

t('maps: well-formed, reachable, entities placed sensibly', function () {
  Object.keys(EG.MAPS).forEach(function (id) {
    var m = EG.MAPS[id], w = m.rows[0].length, h = m.rows.length;
    m.rows.forEach(function (r, y) { assert.strictEqual(r.length, w, id + ' row ' + y); for (var x = 0; x < w; x++) assert(EG.TILE[r[x]], id + ' bad tile ' + r[x] + ' at ' + x + ',' + y); });
    function walk(x, y) { return x >= 0 && y >= 0 && x < w && y < h && EG.TILE[m.rows[y][x]].walk; }
    var occ = {};
    m.ents.forEach(function (e) {
      var k = e.x + ',' + e.y; assert(!occ[k], id + ' overlap ' + k); occ[k] = e;
      if (e.type === 'item') assert(walk(e.x, e.y), id + ' item ' + e.id + ' not on floor');
      if (e.type === 'trainer') { assert(walk(e.x, e.y), id + ' trainer ' + e.id); e.team.forEach(function (p) { assert(EG.SPECIES[p[0]] && p[1] > 0); }); }
      if (e.type === 'npc') assert(walk(e.x, e.y), id + ' npc ' + e.id);
    });
    m.warps.forEach(function (wp) { assert(walk(wp.x, wp.y), id + ' warp tile'); var dm = EG.MAPS[wp.to]; assert(dm, 'dest'); assert(EG.TILE[dm.rows[wp.ty][wp.tx]].walk, id + '->' + wp.to + ' landing tile ' + dm.rows[wp.ty][wp.tx]); });
    // BFS from every warp-landing tile into this map + start
    var starts = [];
    if (EG.START.map === id) starts.push([EG.START.x, EG.START.y]);
    Object.keys(EG.MAPS).forEach(function (o) { EG.MAPS[o].warps.forEach(function (wp) { if (wp.to === id) starts.push([wp.tx, wp.ty]); }); });
    assert(starts.length, id + ' has no way in');
    var seen = {}, q = starts.slice(); starts.forEach(function (s) { seen[s.join()] = 1; });
    while (q.length) { var p = q.shift(); [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) { var nx = p[0] + d[0], ny = p[1] + d[1]; if (!walk(nx, ny) || seen[nx + ',' + ny]) return; var oc = occ[nx + ',' + ny]; if (oc && oc.type !== 'item' && !(oc.id === 'guard' || oc.type === 'trainer')) return; seen[nx + ',' + ny] = 1; q.push([nx, ny]); }); }
    m.ents.forEach(function (e) { if (e.type === 'item' || e.type === 'trainer') assert(seen[e.x + ',' + e.y], id + ' unreachable ' + e.id); });
    m.warps.forEach(function (wp) { if (wp.req !== 'starter') assert(seen[wp.x + ',' + wp.y], id + ' warp unreachable ' + wp.x + ',' + wp.y); });
    // encounter tables refer to existing tiles
    Object.keys(m.enc).forEach(function (k) { var has = m.rows.join('').split('').some(function (c) { return EG.TILE[c].enc === k; }); assert(has, id + ' enc ' + k); m.enc[k].forEach(function (e) { assert(EG.SPECIES[e[0]]); }); });
  });
  // every warp has a return path
  assert(EG.MAPS.town.warps.some(function (w) { return w.to === 'route'; }) && EG.MAPS.route.warps.some(function (w) { return w.to === 'town'; }));
});

t('balance sim: a player who fights through wild routes and trainers can beat the boss', function () {
  var rng = EG.makeRng(99), wins = 0, N = 40;
  function smartFight(S, B, items) {
    var guard = 0;
    while (!B.over && guard++ < 200) {
      if (B.needSwitch) { EG.forceSwitch(B, EG.firstAlive(S.team)); continue; }
      var p = EG.curP(B), f = EG.curF(B), best = null, bs = -1;
      p.moves.forEach(function (id) { var m = EG.MOVES[id]; var s = m.p * EG.typeMult(m.t, EG.SPECIES[f.sp].t) * (EG.SPECIES[p.sp].t === m.t ? 1.5 : 1); if (s > bs) { bs = s; best = id; } });
      if (p.hp < EG.maxHp(p) * 0.3 && S.items.tonic) { EG.playerTurn(B, { type: 'item', item: 'tonic' }, rng); continue; }
      if (p.hp < EG.maxHp(p) * 0.3 && S.items.salve) { EG.playerTurn(B, { type: 'item', item: 'salve' }, rng); continue; }
      EG.playerTurn(B, { type: 'fight', move: best }, rng);
    }
  }
  for (var run = 0; run < N; run++) {
    var S = EG.newState(); S.team.push(EG.makeCreature(EG.STARTERS[run % 3], 5)); S.items = { charm: 5, salve: 3, tonic: 2 };
    // grind wild fights until lvl target (simulates exploring + route trainers)
    var target = 12 + (run % 3), g = 0;
    while (S.team[0].lv < target && g++ < 400) {
      if (S.team[0].hp < EG.maxHp(S.team[0]) * 0.5) EG.healAll(S.team);
      var tbl = EG.MAPS.route.enc.scrub; var foe = EG.rollWild(S.team[0].lv < 8 ? tbl : EG.MAPS.pyramid.enc.tomb, rng);
      var B = EG.newBattle(S, { kind: 'wild', foe: [foe] }); smartFight(S, B);
      if (B.result === 'lose') EG.healAll(S.team);
      if (EG.checkEvolve(S.team[0])) EG.evolve(S.team[0]);
    }
    // catch teammates: assume a second creature at similar level
    S.team.push(EG.makeCreature(['horlet', 'bastkit', 'ibisk'][run % 3], Math.max(8, target - 2)), EG.makeCreature(['skorrah', 'riddlit', 'wrappet'][run % 3], Math.max(8, target - 3)));
    S.team.forEach(function (c) { if (EG.checkEvolve(c)) EG.evolve(c); });
    EG.healAll(S.team);
    var boss = EG.MAPS.pyramid.ents.filter(function (e) { return e.id === 'boss'; })[0];
    var BB = EG.newBattle(S, { kind: 'trainer', name: boss.name, boss: true, foe: boss.team.map(function (p) { return EG.makeCreature(p[0], p[1]); }) });
    smartFight(S, BB); if (BB.result === 'win') wins++;
  }
  console.log('   boss win rate with lv ~12-14 lead team of 3: ' + wins + '/' + N);
  assert(wins >= N * 0.4 && wins <= N, 'boss too hard? ' + wins);
});

console.log('\n' + n + ' test groups passed');
