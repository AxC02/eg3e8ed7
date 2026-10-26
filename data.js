/* Sandkeepers - game data (types, moves, creatures, items, maps). Works in browser and node. */
(function (root) {
  'use strict';
  var EG = root.EG = root.EG || {};

  /* ---------- types ---------- */
  EG.TYPES = { plain: 'Plain', sun: 'Sun', sand: 'Sand', nile: 'Nile', shadow: 'Shadow', venom: 'Venom' };
  // CHART[attacker][defender] -> multiplier (missing = 1)
  EG.CHART = {
    sun:    { shadow: 2, venom: 2, nile: 0.5, sand: 0.5, sun: 0.5 },
    sand:   { sun: 2, venom: 2, nile: 0.5, sand: 0.5 },
    nile:   { sand: 2, sun: 2, nile: 0.5 },
    shadow: { nile: 2, venom: 2, sun: 0.5, shadow: 0.5 },
    venom:  { shadow: 2, sand: 0.5, sun: 0.5, venom: 0.5 },
    plain:  {}
  };
  EG.typeMult = function (a, d) { var r = EG.CHART[a]; return (r && r[d] !== undefined) ? r[d] : 1; };

  /* ---------- moves ---------- */
  // fx: {stat, st, self}
  EG.MOVES = {
    strike:    { n: 'Strike',       t: 'plain',  p: 40, a: 100 },
    pounce:    { n: 'Pounce',       t: 'plain',  p: 55, a: 95 },
    peck:      { n: 'Wing Peck',    t: 'plain',  p: 45, a: 100 },
    brace:     { n: 'Brace',        t: 'plain',  p: 0,  a: 100, fx: { stat: 'def', st: 1,  self: true } },
    quicken:   { n: 'Quicken',      t: 'plain',  p: 0,  a: 100, fx: { stat: 'spd', st: 1,  self: true } },
    glare:     { n: 'Glare',        t: 'plain',  p: 0,  a: 100, fx: { stat: 'atk', st: -1, self: false } },
    wrap:      { n: 'Linen Wrap',   t: 'shadow', p: 0,  a: 100, fx: { stat: 'spd', st: -1, self: false } },
    flare:     { n: 'Sun Flare',    t: 'sun',    p: 40, a: 100 },
    sunbeam:   { n: 'Sunbeam',      t: 'sun',    p: 60, a: 95 },
    blaze:     { n: "Ra's Wrath",   t: 'sun',    p: 85, a: 85 },
    dust:      { n: 'Dust Kick',    t: 'sand',   p: 40, a: 100 },
    sandblast: { n: 'Sandblast',    t: 'sand',   p: 60, a: 95 },
    dunecrash: { n: 'Dune Crash',   t: 'sand',   p: 85, a: 85 },
    ripple:    { n: 'Ripple',       t: 'nile',   p: 40, a: 100 },
    flood:     { n: 'Nile Flood',   t: 'nile',   p: 60, a: 95 },
    tidal:     { n: 'River Surge',  t: 'nile',   p: 85, a: 85 },
    shadeclaw: { n: 'Shade Claw',   t: 'shadow', p: 40, a: 100 },
    nightbite: { n: 'Night Bite',   t: 'shadow', p: 60, a: 95 },
    soulrend:  { n: 'Soul Rend',    t: 'shadow', p: 85, a: 85 },
    sting:     { n: 'Sting',        t: 'venom',  p: 40, a: 100 },
    spit:      { n: 'Toxic Spit',   t: 'venom',  p: 60, a: 95 },
    fang:      { n: 'Venom Fang',   t: 'venom',  p: 85, a: 85 }
  };

  /* ---------- creatures ----------
     base: [hp, atk, def, spd]   exp: base xp yield   rate: catch rate (0-255)
     art: sprite archetype, pal: colours, evo: {lv, to}  */
  function P(b, d, l, a) { return { b: b, d: d, l: l, a: a }; }
  EG.SPECIES = {
    scarabit:   { n: 'Scarabit',   t: 'sun',    base: [45, 49, 55, 35], exp: 62,  rate: 90,  art: 'beetle',  pal: P('#d9a21e', '#8a5a10', '#f6d86a', '#2fbfb5'), evo: { lv: 16, to: 'scarablaze' },
      learn: [[1, 'strike'], [1, 'flare'], [1, 'glare'], [5, 'brace'], [9, 'sunbeam'], [20, 'blaze']], info: 'A gold scarab that rolls the sun across the sky.' },
    scarablaze: { n: 'Scarablaze', t: 'sun',    base: [68, 72, 82, 52], exp: 150, rate: 45,  art: 'beetle',  evo2: true, pal: P('#e8751c', '#8a3a10', '#ffd070', '#2a5fa8'),
      learn: [[1, 'strike'], [1, 'flare'], [1, 'glare'], [5, 'brace'], [9, 'sunbeam'], [20, 'blaze']], info: 'Its blazing shell burns like a midday sun.' },
    jackling:   { n: 'Jackling',   t: 'shadow', base: [40, 55, 40, 62], exp: 62,  rate: 90,  art: 'canine',  pal: P('#3b3b4f', '#1c1c2b', '#7a6fb0', '#e9b949'), evo: { lv: 16, to: 'duskhal' },
      learn: [[1, 'strike'], [1, 'shadeclaw'], [1, 'glare'], [5, 'quicken'], [9, 'nightbite'], [20, 'soulrend']], info: 'A pup that guides lost spirits through the dark.' },
    duskhal:    { n: 'Duskhal',    t: 'shadow', base: [64, 84, 60, 88], exp: 150, rate: 45,  art: 'canine',  evo2: true, pal: P('#2a2548', '#100e22', '#8a5fd0', '#e9b949'),
      learn: [[1, 'strike'], [1, 'shadeclaw'], [1, 'glare'], [5, 'quicken'], [9, 'nightbite'], [20, 'soulrend']], info: 'Swift guardian of the night road.' },
    crocklet:   { n: 'Crocklet',   t: 'nile',   base: [50, 52, 48, 36], exp: 62,  rate: 90,  art: 'croc',    pal: P('#2fa89a', '#17655d', '#8be0cf', '#f5efe0'), evo: { lv: 16, to: 'crocarch' },
      learn: [[1, 'strike'], [1, 'ripple'], [1, 'glare'], [5, 'brace'], [9, 'flood'], [20, 'tidal']], info: 'A baby river guardian with a big appetite.' },
    crocarch:   { n: 'Crocarch',   t: 'nile',   base: [82, 84, 80, 48], exp: 150, rate: 45,  art: 'croc',    evo2: true, pal: P('#1f6fb0', '#0f3a68', '#5bb8e8', '#e9b949'),
      learn: [[1, 'strike'], [1, 'ripple'], [1, 'glare'], [5, 'brace'], [9, 'flood'], [20, 'tidal']], info: 'Lord of the river. Nothing crosses the Nile unnoticed.' },
    skorrah:    { n: 'Skorrah',    t: 'venom',  base: [40, 55, 55, 36], exp: 60,  rate: 150, art: 'scorpion', pal: P('#8a46b0', '#4a2266', '#c58be0', '#9be84a'),
      learn: [[1, 'strike'], [1, 'sting'], [6, 'brace'], [10, 'spit'], [16, 'fang']], info: 'A scorpion whose tail drips glowing venom.' },
    aspling:    { n: 'Aspling',    t: 'venom',  base: [36, 50, 36, 55], exp: 58,  rate: 150, art: 'snake',   pal: P('#4aa84a', '#246024', '#a8e07a', '#e9b949'), evo: { lv: 18, to: 'uraeon' },
      learn: [[1, 'strike'], [1, 'sting'], [4, 'glare'], [8, 'spit'], [16, 'fang']], info: 'A small asp that hides in warm cracks.' },
    uraeon:     { n: 'Uraeon',     t: 'venom',  base: [62, 82, 56, 84], exp: 140, rate: 60,  art: 'snake',   evo2: true, pal: P('#7a46b8', '#3a2070', '#c8a0f0', '#e9b949'),
      learn: [[1, 'strike'], [1, 'sting'], [4, 'glare'], [8, 'spit'], [16, 'fang']], info: 'A royal cobra. Its hood glows when it strikes.' },
    horlet:     { n: 'Horlet',     t: 'sun',    base: [38, 50, 36, 72], exp: 58,  rate: 190, art: 'falcon',  pal: P('#c98a2a', '#6a4410', '#f5e0a0', '#2a5fa8'),
      learn: [[1, 'peck'], [1, 'flare'], [5, 'quicken'], [9, 'sunbeam'], [17, 'blaze']], info: 'A falcon chick that chases the sunrise.' },
    bastkit:    { n: 'Bastkit',    t: 'sand',   base: [40, 48, 38, 68], exp: 58,  rate: 190, art: 'cat',     pal: P('#d8b060', '#8a6a30', '#f5e3b0', '#2fbfb5'),
      learn: [[1, 'strike'], [1, 'dust'], [5, 'pounce'], [10, 'sandblast'], [19, 'dunecrash']], info: 'A sleek desert cat. It naps on warm stone.' },
    ibisk:      { n: 'Ibisk',      t: 'nile',   base: [42, 45, 40, 55], exp: 58,  rate: 190, art: 'ibis',    pal: P('#f0ead8', '#9a9a8c', '#ffffff', '#2a2a3a'),
      learn: [[1, 'peck'], [1, 'ripple'], [4, 'glare'], [11, 'flood']], info: 'A wading bird that carries river wisdom.' },
    riddlit:    { n: 'Riddlit',    t: 'sand',   base: [58, 56, 62, 28], exp: 90,  rate: 75,  art: 'sphinx',  pal: P('#c9a05a', '#7a5a2a', '#f2d890', '#2a5fa8'),
      learn: [[1, 'strike'], [1, 'dust'], [4, 'brace'], [10, 'sandblast'], [16, 'dunecrash']], info: 'A tiny sphinx that loves to ask questions.' },
    wrappet:    { n: 'Wrappet',    t: 'shadow', base: [48, 52, 50, 28], exp: 75,  rate: 120, art: 'mummy',   pal: P('#e8dcc0', '#a89870', '#fff6e0', '#d03a3a'),
      learn: [[1, 'strike'], [1, 'shadeclaw'], [5, 'wrap'], [9, 'nightbite'], [15, 'soulrend']], info: 'A restless little mummy wrapped in old linen.' },
    sekhmar:    { n: 'Sekhmar',    t: 'sun',    base: [90, 96, 84, 76], exp: 200, rate: 3,   art: 'lion',    pal: P('#e8a830', '#8a5a10', '#ffe090', '#2a5fa8'),
      learn: [[1, 'strike'], [1, 'glare'], [1, 'sunbeam'], [1, 'blaze']], info: 'The lion spirit that guards the tomb of the Warden.' }
  };
  EG.SPECIES_LIST = Object.keys(EG.SPECIES);
  EG.WILD_LIST = EG.SPECIES_LIST.filter(function (k) { return k !== 'sekhmar'; });
  EG.STARTERS = ['scarabit', 'jackling', 'crocklet'];

  /* ---------- items ---------- */
  EG.ITEMS = {
    salve:  { n: 'Lotus Salve',  heal: 25, price: 30,  info: 'Heals 25 HP.' },
    tonic:  { n: 'Nile Tonic',   heal: 60, price: 70,  info: 'Heals 60 HP.' },
    charm:  { n: 'Scarab Charm', ball: 1,   price: 40,  info: 'Throw at a wild creature to catch it.' },
    ankh:   { n: 'Gold Ankh',    ball: 1.8, price: 100, info: 'A better catching charm.' }
  };
  EG.SHOP = ['charm', 'salve', 'tonic', 'ankh'];

  /* ---------- maps ---------- */
  function grid(w, h, ch) { var g = []; for (var y = 0; y < h; y++) { g.push([]); for (var x = 0; x < w; x++) g[y].push(ch); } return g; }
  function fill(g, x, y, w, h, ch) { for (var j = y; j < y + h; j++) for (var i = x; i < x + w; i++) if (g[j] && g[j][i] !== undefined) g[j][i] = ch; }
  function put(g, x, y, ch) { if (g[y] && g[y][x] !== undefined) g[y][x] = ch; }
  function rows(g) { return g.map(function (r) { return r.join(''); }); }
  function border(g, ch) { var h = g.length, w = g[0].length; fill(g, 0, 0, w, 1, ch); fill(g, 0, h - 1, w, 1, ch); fill(g, 0, 0, 1, h, ch); fill(g, w - 1, 0, 1, h, ch); }

  // tile properties
  EG.TILE = {
    '.': { walk: 1 }, ',': { walk: 1, enc: 'scrub' }, '"': { walk: 1, enc: 'reeds' }, '=': { walk: 1 },
    '#': {}, 'T': {}, '~': {}, 'H': {}, 'R': {}, 'D': {}, 'W': {}, 'X': {}, 'P': {}, 'A': {}, 'S': {}, '^': {}, 'J': {}, 'c': {}, 'L': {}, 'N': {}, 'V': {},
    'F': { walk: 1 }, 'G': { walk: 1, enc: 'tomb' }, 'E': { walk: 1 }, 'U': { walk: 1 }, 'r': { walk: 1 }
  };

  function buildChamber() {
    var g = grid(12, 9, 'F');
    border(g, 'X');
    fill(g, 1, 1, 10, 1, 'F'); put(g, 1, 1, 'L'); put(g, 10, 1, 'L');
    put(g, 3, 2, 'J'); put(g, 6, 2, 'J'); put(g, 9, 2, 'J');
    put(g, 3, 4, 'P'); put(g, 8, 4, 'P');
    fill(g, 5, 5, 2, 3, 'r');
    fill(g, 5, 8, 2, 1, 'U');
    return {
      id: 'chamber', name: 'Hidden Tomb', music: 'tomb', rows: rows(g), enc: {},
      warps: [{ x: 5, y: 8, to: 'town', tx: 13, ty: 12, dir: 'down', req: 'starter' }, { x: 6, y: 8, to: 'town', tx: 13, ty: 12, dir: 'down', req: 'starter' }],
      ents: [
        { id: 'ped0', type: 'pedestal', x: 3, y: 2, sp: 'scarabit' },
        { id: 'ped1', type: 'pedestal', x: 6, y: 2, sp: 'jackling' },
        { id: 'ped2', type: 'pedestal', x: 9, y: 2, sp: 'crocklet' }
      ]
    };
  }

  function buildTown() {
    var g = grid(24, 18, '.');
    border(g, '#');
    fill(g, 23, 8, 1, 2, '=');
    fill(g, 1, 8, 22, 2, '=');
    fill(g, 11, 4, 2, 4, '=');
    fill(g, 11, 10, 2, 3, '=');
    // uncle's house
    fill(g, 3, 2, 5, 2, 'R'); fill(g, 3, 4, 5, 2, 'H'); put(g, 5, 5, 'D');
    // shrine
    fill(g, 9, 1, 5, 2, 'W'); put(g, 9, 3, 'L'); put(g, 10, 3, 'W'); put(g, 11, 3, 'A'); put(g, 12, 3, 'W'); put(g, 13, 3, 'L');
    // market
    fill(g, 16, 2, 5, 1, 'R'); fill(g, 16, 3, 5, 1, 'S');
    // second house
    fill(g, 16, 12, 5, 2, 'R'); fill(g, 16, 14, 5, 2, 'H'); put(g, 18, 15, 'D');
    // pool
    fill(g, 3, 12, 6, 3, '~');
    [[2, 11], [9, 11], [2, 15], [9, 15], [5, 16], [21, 6], [1, 5], [22, 11]].forEach(function (p) { put(g, p[0], p[1], 'T'); });
    [[7, 7], [20, 10], [14, 16]].forEach(function (p) { put(g, p[0], p[1], 'c'); });
    put(g, 13, 13, 'V');
    return {
      id: 'town', name: 'Dunewell', music: 'town', rows: rows(g), enc: {},
      warps: [{ x: 23, y: 8, to: 'route', tx: 1, ty: 9, dir: 'right' }, { x: 23, y: 9, to: 'route', tx: 1, ty: 10, dir: 'right' }],
      ents: [
        { id: 'shrine', type: 'heal', x: 11, y: 3, text: 'The Oasis Shrine glows warmly.' },
        { id: 'shop', type: 'shop', x: 18, y: 3, look: { shirt: '#2a5fa8', hair: '#3a2a1a', skin: '#c68a5a', pants: '#e8dcc0', cap: '#e9b949' }, text: 'Welcome to the Dunewell Market!' },
        { id: 'uncle', type: 'npc', x: 14, y: 12, dir: 'left', look: { shirt: '#b89a5a', hair: '#5a4a3a', skin: '#c68a5a', pants: '#6a5a3a', cap: '#b89a5a' },
          text: ["Heading for the pyramid? The guard won't let weak explorers inside. A creature at Level 6 or higher should do.", 'Heal at the Oasis Shrine any time. It is free!'] },
        { id: 'kid', type: 'npc', x: 8, y: 10, dir: 'right', look: { shirt: '#d03a3a', hair: '#1a1a1a', skin: '#a8703a', pants: '#2a5fa8', cap: '#d03a3a' },
          text: ['Wild creatures hide in the dry grass out on Route 1!', 'Weaken them first, then throw a Scarab Charm to catch them!'] },
        { id: 'granny', type: 'npc', x: 15, y: 6, dir: 'down', look: { shirt: '#2fbfb5', hair: '#cfcfcf', skin: '#c68a5a', pants: '#2fbfb5', cap: '#cfcfcf' },
          text: ['The old stories say a Warden sleeps inside the pyramid, guarding the lion spirit.', 'Be kind to your creatures, dear.'] },
        { id: 'boy', type: 'npc', x: 14, y: 4, dir: 'right', look: { shirt: '#e9b949', hair: '#3a2a1a', skin: '#c68a5a', pants: '#3a3a4a', cap: '#e9b949' },
          text: ['Gold buys Charms and Salves at the Market. Win trainer battles to earn gold!'] },
        { id: 'sign1', type: 'sign', x: 20, y: 7, text: ['DUNEWELL', 'East: Route 1 and the Great Pyramid.'] },
        { id: 'sign2', type: 'sign', x: 10, y: 5, text: ['OASIS SHRINE', 'Rest here. Your whole team will be healed.'] },
        { id: 'pit', type: 'sign', x: 13, y: 13, text: ['A hole in the sand. This is where you climbed out of the hidden tomb.'] }
      ]
    };
  }

  function buildRoute() {
    var g = grid(32, 20, '.');
    border(g, '#');
    fill(g, 0, 9, 1, 2, '=');
    fill(g, 1, 9, 23, 2, '=');
    fill(g, 22, 6, 2, 3, '=');
    fill(g, 19, 1, 10, 5, '^'); put(g, 23, 5, 'E');
    fill(g, 3, 2, 9, 5, ','); fill(g, 14, 2, 4, 6, ','); fill(g, 17, 12, 11, 5, ','); fill(g, 4, 12, 6, 2, ',');
    fill(g, 2, 14, 15, 2, '"'); fill(g, 2, 16, 15, 2, '~'); fill(g, 1, 14, 1, 4, '"');
    [[2, 8], [13, 8], [14, 12], [26, 8], [29, 3], [18, 17], [30, 18], [2, 2], [12, 7], [27, 10]].forEach(function (p) { put(g, p[0], p[1], 'T'); });
    [[7, 8], [12, 12], [29, 14], [17, 8], [27, 6]].forEach(function (p) { put(g, p[0], p[1], 'c'); });
    [[16, 8], [20, 14], [28, 10]].forEach(function (p) { put(g, p[0], p[1], '#'); });
    return {
      id: 'route', name: 'Route 1: Sunbaked Dunes', music: 'route', rows: rows(g),
      enc: {
        scrub: [['horlet', 3, 6, 28], ['bastkit', 3, 6, 28], ['jackling', 3, 5, 14], ['skorrah', 4, 7, 14], ['aspling', 4, 7, 12], ['riddlit', 5, 7, 4]],
        reeds: [['ibisk', 4, 7, 42], ['crocklet', 4, 6, 18], ['aspling', 4, 6, 20], ['skorrah', 4, 6, 20]]
      },
      warps: [
        { x: 0, y: 9, to: 'town', tx: 22, ty: 8, dir: 'left' }, { x: 0, y: 10, to: 'town', tx: 22, ty: 9, dir: 'left' },
        { x: 23, y: 5, to: 'pyramid', tx: 10, ty: 24, dir: 'up', req: 'guard' }
      ],
      ents: [
        { id: 'guard', type: 'guard', x: 23, y: 6, alt: { x: 22, y: 6 }, dir: 'up', look: { shirt: '#2a2a3a', hair: '#1a1a1a', skin: '#a8703a', pants: '#2a2a3a', cap: '#e9b949' } },
        { id: 'tr_timo', type: 'trainer', x: 9, y: 8, dir: 'down', sight: 3, name: 'Scout Timo', gold: 100, look: { shirt: '#3a8a3a', hair: '#3a2a1a', skin: '#c68a5a', pants: '#6a5a3a', cap: '#3a8a3a' },
          intro: "You found the dunes! Let's see how strong your partner is!", win: 'Whoa! You are good!', team: [['horlet', 5], ['bastkit', 5]] },
        { id: 'tr_neferi', type: 'trainer', x: 15, y: 11, dir: 'up', sight: 3, name: 'Fisher Neferi', gold: 160, look: { shirt: '#2fbfb5', hair: '#1a1a1a', skin: '#a8703a', pants: '#2a5fa8', cap: '#2fbfb5' },
          intro: 'The Nile gave me strong friends. Care to battle?', win: 'The river carries you well.', team: [['ibisk', 6], ['crocklet', 7]] },
        { id: 'tr_hamid', type: 'trainer', x: 20, y: 8, dir: 'down', sight: 2, name: 'Digger Hamid', gold: 220, look: { shirt: '#8a46b0', hair: '#3a2a1a', skin: '#c68a5a', pants: '#3a3a4a', cap: '#8a46b0' },
          intro: 'I dig up ruins and creatures! Watch out for my venom!', win: 'Ow! Okay, you beat me fair.', team: [['skorrah', 7], ['aspling', 8]] },
        { id: 'it_r1', type: 'item', x: 5, y: 7, item: 'salve', qty: 1 },
        { id: 'it_r2', type: 'item', x: 15, y: 4, item: 'charm', qty: 3 },
        { id: 'it_r3', type: 'item', x: 27, y: 13, item: 'charm', qty: 2 },
        { id: 'it_r4', type: 'item', x: 26, y: 17, item: 'tonic', qty: 1 },
        { id: 'sign3', type: 'sign', x: 3, y: 8, text: ['ROUTE 1', 'Sunbaked Dunes. Creatures lurk in the dry grass and the reeds.'] },
        { id: 'sign4', type: 'sign', x: 21, y: 6, text: ['GREAT PYRAMID', 'Explorers at Level 6 or higher only.'] }
      ]
    };
  }

  function buildPyramid() {
    var g = grid(20, 26, 'W');
    fill(g, 7, 21, 7, 4, 'F');                       // room A
    fill(g, 10, 18, 1, 3, 'F');
    fill(g, 3, 13, 14, 5, 'G');                      // room B
    [[6, 14], [13, 14], [6, 16], [13, 16]].forEach(function (p) { put(g, p[0], p[1], 'P'); });
    fill(g, 10, 11, 1, 2, 'F');
    fill(g, 4, 7, 12, 4, 'G');                       // room C
    [[6, 8], [13, 8]].forEach(function (p) { put(g, p[0], p[1], 'P'); });
    fill(g, 10, 4, 1, 3, 'F');
    fill(g, 6, 1, 8, 3, 'F');                        // boss room
    fill(g, 9, 1, 3, 1, 'N');
    put(g, 7, 0, 'L'); put(g, 12, 0, 'L'); put(g, 3, 12, 'L'); put(g, 16, 12, 'L'); put(g, 8, 20, 'L'); put(g, 12, 20, 'L');
    put(g, 10, 25, 'U');
    for (var x = 0; x < 20; x++) for (var y = 0; y < 26; y++) if (g[y][x] === 'W' && ((x * 7 + y * 13) % 5 === 0)) g[y][x] = 'X';
    put(g, 7, 0, 'L'); put(g, 12, 0, 'L'); put(g, 3, 12, 'L'); put(g, 16, 12, 'L'); put(g, 8, 20, 'L'); put(g, 12, 20, 'L');
    return {
      id: 'pyramid', name: 'Great Pyramid', music: 'tomb', rows: rows(g),
      enc: { tomb: [['wrappet', 8, 11, 40], ['aspling', 8, 10, 18], ['skorrah', 8, 11, 18], ['riddlit', 9, 11, 14], ['jackling', 8, 10, 10]] },
      warps: [{ x: 10, y: 25, to: 'route', tx: 23, ty: 6, dir: 'down' }],
      ents: [
        { id: 'tr_zara', type: 'trainer', x: 10, y: 14, dir: 'down', sight: 3, name: 'Raider Zara', gold: 320, look: { shirt: '#c98a2a', hair: '#3a2a1a', skin: '#c68a5a', pants: '#3a3a4a', cap: '#3a3a4a' },
          intro: 'Nobody gets past me and my relic hunters!', win: 'Tch. Take the treasure road, then.', team: [['wrappet', 9], ['skorrah', 9], ['riddlit', 10]] },
        { id: 'tr_menkh', type: 'trainer', x: 10, y: 8, dir: 'down', sight: 3, name: 'Priest Menkh', gold: 400, look: { shirt: '#f0ead8', hair: '#1a1a1a', skin: '#a8703a', pants: '#f0ead8', cap: '#e9b949' },
          intro: 'The Warden rests ahead. Prove your heart is pure!', win: 'Your bond is strong. Go on.', team: [['aspling', 10], ['wrappet', 11], ['jackling', 11]] },
        { id: 'boss', type: 'trainer', boss: true, x: 10, y: 2, dir: 'down', sight: 3, name: 'Tomb Warden Khet', gold: 800, look: { shirt: '#14110f', hair: '#14110f', skin: '#a8703a', pants: '#14110f', cap: '#e9b949' },
          intro: 'I am Khet, Warden of this tomb. Only a true Keeper may leave with the lion spirit. Show me your bond!',
          win: 'Impossible... Your creatures fight with real heart. The tomb accepts you, Keeper.',
          team: [['wrappet', 9], ['riddlit', 10], ['aspling', 10], ['sekhmar', 11]] },
        { id: 'ankhstatue', type: 'heal', x: 15, y: 7, text: 'An ankh statue glows with gentle light.' },
        { id: 'it_p1', type: 'item', x: 4, y: 10, item: 'charm', qty: 3 },
        { id: 'it_p2', type: 'item', x: 3, y: 13, item: 'tonic', qty: 2 },
        { id: 'it_p3', type: 'item', x: 16, y: 17, item: 'ankh', qty: 2 },
        { id: 'it_p4', type: 'item', x: 15, y: 10, item: 'tonic', qty: 1 },
        { id: 'sarc', type: 'sign', x: 10, y: 1, text: 'sarcophagus' }
      ]
    };
  }

  EG.MAPS = { chamber: buildChamber(), town: buildTown(), route: buildRoute(), pyramid: buildPyramid() };
  EG.START = { map: 'chamber', x: 5, y: 5, dir: 'up' };

  if (typeof module !== 'undefined' && module.exports) module.exports = EG;
})(typeof self !== 'undefined' ? self : globalThis);
