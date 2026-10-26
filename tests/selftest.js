// Drives the real game headlessly (manual frame stepping) and reports into #out.
(function () {
  var G = EG.game, log = [], fails = 0;
  function ok(c, m) { log.push((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; }
  var sb = 0, sm = 0;
  async function frames(n) { for (var i = 0; i < n; i++) { G.tick(); await null; await null; var m = G.G.bt && G.G.bt.menu; if (m && !sb && m.cells[0] === 'FIGHT' && G.G.frame % 3 === 0) { sb = 1; shot('battle'); } if (m && sb && !sm && m.cells[0] !== 'FIGHT') { sm = 1; shot('moves'); } } G.render(); }
  async function tap(b, n) { G.press(b); await frames(n || 3); }
  async function until(fn, max, label) { for (var i = 0; i < max; i++) { if (fn()) return true; await frames(1); } log.push('TIMEOUT ' + label); fails++; return false; }
  async function mash(n, f) { for (var i = 0; i < n; i++) { if (f && f()) return; G.press('a'); await frames(4); } }
  async function walk(dir, tiles) { for (var t = 0; t < tiles; t++) { G.setHeld(dir); for (var i = 0; i < 40 && !G.G.p.moving && !G.G.locked; i++) await frames(1); G.setHeld(null); for (var j = 0; j < 40 && G.G.p.moving; j++) await frames(1); await frames(2); if (G.G.locked) { await settle(); } } }
  async function settle() { for (var i = 0; i < 60; i++) { await frames(6); if (!G.G.locked && !G.G.dialog && G.G.fade < 0.05) return; G.press('a'); } }
  var S;
  function shot(name) { G.render(); var c = document.getElementById('screen'), i = new Image(); i.src = c.toDataURL(); i.width = 320; i.title = name; i.style.cssText = 'image-rendering:pixelated;margin:2px'; document.getElementById('shots').appendChild(i); }
  async function main() {
    var Gs = G.G;
    localStorage.clear();
    await frames(5);
    ok(Gs.mode === 'title', 'boots to title');
    shot('title');
    await tap('a', 3);                   // press A to start
    await tap('a', 3);                   // NEW GAME
    await mash(20, function () { return Gs.mode === 'world' && Gs.fade < 0.05 && !Gs.dialog; });
    await frames(40);
    S = G.getS();
    ok(Gs.mode === 'world' && Gs.map.id === 'chamber', 'new game starts in chamber');
    shot('chamber');
    // walk up to the middle pedestal (6,2): from (5,5) go up to (5,3)? pedestal at (6,2); stand (6,3)
    await walk('right', 1); await walk('up', 2);
    ok(Gs.p.x === 6 && Gs.p.y === 3, 'walked to (6,3): ' + Gs.p.x + ',' + Gs.p.y);
    await tap('a', 3);
    await mash(8, function () { return Gs.dialog === null && Gs.overlays.length > 0; });
    await frames(5);
    shot('pedestal');
    ok(Gs.overlays.length === 1, 'take-it menu open');
    await tap('a', 3);                   // TAKE IT
    await mash(12, function () { return Gs.dialog === null && !Gs.locked; });
    await frames(10);
    ok(S.team.length === 1 && S.team[0].sp === 'jackling' && S.flags.starter, 'got jackling starter');
    // leave: walk down to exit
    await walk('left', 1); await walk('down', 5);
    await mash(3, function () { return false; });
    await until(function () { return Gs.map.id === 'town'; }, 300, 'enter town');
    await settle();
    ok(Gs.map.id === 'town' && S.flags.uncle, 'town reached, uncle intro done');
    // open menu and walk through each screen
    shot('town');
    await tap('start', 3); ok(Gs.overlays.length === 1, 'menu opens'); shot('menu');
    await tap('a', 3); shot('team'); await tap('a', 3); shot('summary'); await tap('a', 3); await tap('b', 3); await tap('b', 3); await tap('b', 3);
    await tap('down', 2); await tap('a', 3); await tap('b', 3);     // items
    await tap('down', 2); await tap('a', 3); await tap('b', 3);     // journal
    for (var k = 0; k < 4; k++) await tap('b', 3);
    ok(Gs.overlays.length === 0 && !Gs.locked, 'menu closed');
    // force a wild battle and play it out
    S.team[0].lv = 9; S.team[0].xp = EG.xpFor(9); S.team[0].hp = EG.maxHp(S.team[0]);
    EG.rollWild = (function (o) { return function (t, r) { return EG.makeCreature('horlet', 3); }; })(EG.rollWild);
    G.loadMap('route', 5, 12, 'down'); await frames(2);
    G.setRng(function () { return 0.01; });
    Gs.lastEnc = -99; S.steps = 0;
    var moved = 0;
    for (var i = 0; i < 40 && Gs.mode !== 'battle'; i++) { await walk(i % 2 ? 'left' : 'right', 1); if (Gs.locked) break; }
    await until(function () { return Gs.mode === 'battle'; }, 400, 'battle starts');
    ok(Gs.mode === 'battle', 'wild battle starts');
    var shotB = false, shotE = 0;
    for (var n = 0; n < 40 && Gs.mode === 'battle'; n++) {
      await until(function () { return Gs.mode !== 'battle' || (Gs.bt && Gs.bt.menu) || Gs.dialog; }, 900, 'turn ' + n);
      if (Gs.dialog) { if (shotE++ == 1) shot('battle-text'); await tap('a', 4); n--; continue; }
      if (!shotB && Gs.bt && Gs.bt.menu) { shotB = true; shot('battle'); }
      if (Gs.bt && Gs.bt.menu && Gs.bt.menu.cells.length === 4 && Gs.bt.menu.cells[0] === 'FIGHT') { await tap('a', 3); shot('moves'); await tap('a', 3); }
      else if (Gs.bt && Gs.bt.menu) await tap('a', 3);
    }
    await until(function () { return Gs.mode === 'world' && !Gs.locked; }, 900, 'battle ends');
    shot('after');
    ok(Gs.mode === 'world', 'battle finished, back in world; xp=' + S.team[0].xp);
    // shop + heal + trainer via direct calls through input
    G.loadMap('town', 18, 4, 'up'); await frames(2); S.gold = 500;
    await tap('a', 3); await mash(4, function () { return Gs.overlays.length === 1; });
    ok(Gs.overlays.length === 1, 'shop open');
    await tap('a', 3); ok(S.gold < 500, 'bought item, gold=' + S.gold);
    await tap('b', 3); await mash(6, function () { return !Gs.locked; });
    // save/load roundtrip
    ok(G.save() && !!EG.validateSave(JSON.parse(localStorage.getItem('sandkeepers.save.v1'))), 'save roundtrips');
    ok(!window.__egError, 'no runtime errors: ' + (window.__egError || ''));
    document.getElementById('out').textContent = (fails ? 'FAILED ' + fails : 'ALL OK') + '\n' + log.join('\n');
    document.title = fails ? 'FAIL' : 'OK';
  }
  EG.game.setRng = EG.game.setRng; 
  window.addEventListener('load', function () { setTimeout(function () { main().catch(function (e) { document.getElementById('out').textContent = 'EXCEPTION ' + (e && e.stack || e) + '\n' + log.join('\n'); }); }, 50); });
})();
