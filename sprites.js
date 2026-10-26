/* Sandkeepers - procedural pixel art. Creatures are drawn from 8-column half-sprites that are mirrored. */
(function (root) {
  'use strict';
  var EG = root.EG;

  // k outline, b body, d dark, l light, a accent, w white, y gold, . clear
  EG.ART = {
    beetle: ['......ka', '.....kka', '....kbbk', '....kwkb', '.k..kbbb', '.kk.kkbb', '..kkkbld', 'k..kblbd', 'kk.kblld', '..kkblbd', 'k.kbbbbd', '..kkbbbd', 'k..kbbbd', '...kkbbd', '....kkkk', '......kk'],
    canine: ['...kk...', '..kbbk..', '..kbbkkk', '..kbdbbb', '...kbbbb', '...kbwkb', '...kbbbl', '....kbll', '....kblk', '....kkbl', '...kaaaa', '..kbbbbb', '..kbbdbb', '..kbbbbb', '..kbbkbb', '..kkkkkk'],
    croc: ['........', '........', '...kkkk.', '..kbwkbk', '..kbbbbb', '.kbbbbbb', '.kblllll', '.kbllllk', '.kkkkkkk', '.kwkwkwk', '.kkkkkkk', '.kbbddbb', 'kbbbbbbb', 'kbdbbbbb', 'kbbkbbkb', 'kkk.kkk.'],
    scorpion: ['......ka', '......kb', '..kkk.kb', '.klllk.k', '.klbbkkb', 'kbbbbbbb', 'kbwkbbbb', '.kbbbbbb', '..kbbdbb', '.kk.kbbb', 'k.k..kbb', '.....kdb', '..k..kbb', '.k.k.kbb', '.....kkk', '........'],
    snake: ['........', '....kkkk', '...kbbbb', '..kbbbbb', '..kbwkbb', '..kbbbbb', '..kbaaab', '...kbbab', '....kbbl', '....kbbl', '...kbblb', '..kbbbbb', '.kbbblbb', '.kbbbbbb', '.kkbbbbb', '..kkkkkk'],
    falcon: ['......kk', '....kkbb', '...kbbbb', '...kbwkb', '...kbbaa', '..kk.kaa', '.kbbkkbb', 'kbbbbkbl', 'kbddbbbl', 'kbddbbll', 'kbbdbblb', '.kbbkbbb', '..kkkbbb', '....kbbb', '....kaka', '....kkkk'],
    cat: ['..kk....', '..kbbk..', '..kbbbbb', '..kbbbbb', '..kbwkbb', 'kk.kbbbl', '...kbllk', '...kbbbb', '..kbbbbb', '..kbaabb', '..kbbbbb', '..kbbbbb', '..kbbdbb', '..kbbbbb', '..kbbkbb', '..kkkkkk'],
    ibis: ['........', '....kkkk', '...kaaaa', '..kaaaaa', '..kawkaa', '..kaaayy', '...kaayy', '....kayy', '....kbby', '...kbbbb', '..kbblbb', '.kbbbbbb', '.kbbdbbb', '..kbbdab', '...kkyky', '....y.y.'],
    sphinx: ['....kkkk', '...kayay', '..kayaya', '..kaybbb', '..kaybwk', '..kaybbb', '..kaybkk', '...kaybb', '..kbbbbb', '.kbbbbbb', '.kbbblbb', 'kbbbbbbb', 'kbbbbbbd', 'kbbbbkbb', 'kbbkkkkb', 'kkkk..kk'],
    mummy: ['....kkkk', '...kbbbb', '..kbdbbd', '..kbbbbb', '..kddadd', '..kbbbbb', '..kbdbdb', '...kbbbb', '..kbbbbb', '.kbdbdbd', '.kbbbbbb', '.kbdbdbd', '..kbbbbb', '..kbdbbd', '..kbbkbb', '..kkkkkk'],
    lion: ['...kkkkk', '..kddddd', '.kdddddd', '.kdbbbbb', '.kdbwkbb', '.kdbbbbb', '.kddbllb', '.kddbkkl', '..kdbbbb', '..kkdbbb', '.kbbbbbb', 'kbbbaabb', 'kbbbbbbd', 'kbbbbbbb', 'kbbkbbkb', 'kkk.kkk.']
  };

  // overworld people (down/up are half-sprites, mirrored). c cap, h hair, s skin, t shirt, p pants, o shoe, k outline
  EG.PEOPLE = {
    down: ['........', '....kkkk', '...kcccc', '..kccccc', '..kkkkkk', '..khsssh', '..khskss', '..khssss', '...ksskk', '..kktttt', '..kttttt', '.kstttts', '.kkttttk', '..kpppph', '..kpppkk', '..kooook'],
    up:   ['........', '....kkkk', '...kcccc', '..kccccc', '..kccccc', '..khhhhh', '..khhhhh', '..khhhhh', '...khhhk', '..kktttt', '..kttttt', '.kstttts', '.kkttttk', '..kpppph', '..kpppkk', '..kooook'],
    side: ['................', '......kkkkk.....', '.....kcccccck...', '....kccccccccck.', '....kkkkkkkkkk..', '....khhsssssk...', '....khhsskssk...', '....khhssssk....', '.....khssskk....', '.....kkttttk....', '....kktttttk....', '....ksttttsk....', '....kkttttkk....', '.....kppppk.....', '.....kppkpk.....', '.....kooook.....']
  };

  function hex(c) { return c; }
  var FIXED = { k: '#14110f', w: '#f5efe0', y: '#e9b949' };

  EG.spriteCanvas = function (rowsSpec, mirror, pal) {
    var cv = document.createElement('canvas'); cv.width = 16; cv.height = 16;
    var g = cv.getContext('2d');
    for (var y = 0; y < 16; y++) {
      var half = rowsSpec[y] || '';
      var full = mirror ? half + half.split('').reverse().join('') : half;
      for (var x = 0; x < 16; x++) {
        var ch = full[x]; if (!ch || ch === '.') continue;
        var col = pal[ch] || FIXED[ch]; if (!col) continue;
        g.fillStyle = col; g.fillRect(x, y, 1, 1);
      }
    }
    return cv;
  };

  var cache = {};
  EG.creatureSprite = function (sp) {
    if (cache[sp]) return cache[sp];
    var s = EG.SPECIES[sp], cv = EG.spriteCanvas(EG.ART[s.art], true, s.pal), g = cv.getContext('2d');
    if (s.evo2) { // evolved: gold crown pieces and a bright eye-glint
      g.fillStyle = '#e9b949';
      [[7, 0], [8, 0], [6, 1], [9, 1]].forEach(function (p) { if (g.getImageData(p[0], p[1], 1, 1).data[3] === 0) g.fillRect(p[0], p[1], 1, 1); });
      g.fillStyle = '#fff6c0'; g.fillRect(7, 0, 2, 1);
    }
    cache[sp] = cv; return cv;
  };

  var pcache = {};
  EG.personSprite = function (look, dir, frame) {
    var key = JSON.stringify(look) + dir + frame;
    if (pcache[key]) return pcache[key];
    var pal = { c: look.cap, h: look.hair, s: look.skin, t: look.shirt, p: look.pants, o: '#3a2a1a' };
    var cv;
    if (dir === 'down') cv = EG.spriteCanvas(EG.PEOPLE.down, true, pal);
    else if (dir === 'up') cv = EG.spriteCanvas(EG.PEOPLE.up, true, pal);
    else cv = EG.spriteCanvas(EG.PEOPLE.side, false, pal);
    // walking: mirror the sprite on odd frames (classic trick); side view bobs.
    var out = document.createElement('canvas'); out.width = 16; out.height = 16; var g = out.getContext('2d');
    if (frame === 1 && dir !== 'left' && dir !== 'right') { g.translate(16, 0); g.scale(-1, 1); }
    if (dir === 'left') { g.translate(16, 0); g.scale(-1, 1); }
    g.drawImage(cv, 0, 0);
    pcache[key] = out; return out;
  };

  /* ---------- tiles ---------- */
  function h(x, y, i) { var n = Math.sin(x * 127.1 + y * 311.7 + i * 74.7) * 43758.5453; return n - Math.floor(n); }
  function R(g, c, x, y, w, hh) { g.fillStyle = c; g.fillRect(x, y, w, hh); }
  var C = { sand: '#e6c77a', sand2: '#d8b565', sand3: '#f0d891', gold: '#e9b949', lapis: '#2a5fa8', lapis2: '#4a86d0', turq: '#2fbfb5', black: '#14110f' };

  function sandBase(g, seed) {
    R(g, C.sand, 0, 0, 16, 16);
    for (var i = 0; i < 9; i++) { R(g, h(i, seed, 1) > 0.5 ? C.sand2 : C.sand3, Math.floor(h(i, seed, 2) * 15), Math.floor(h(i, seed, 3) * 15), 1, 1); }
  }
  var DRAW = {
    '.': function (g) { sandBase(g, 1); },
    '=': function (g) {
      R(g, '#c49a52', 0, 0, 16, 16);
      R(g, '#a67c3c', 0, 7, 16, 1); R(g, '#a67c3c', 0, 15, 16, 1);
      R(g, '#a67c3c', 4, 0, 1, 7); R(g, '#a67c3c', 11, 8, 1, 7);
      R(g, '#d8b06a', 1, 2, 2, 1); R(g, '#d8b06a', 7, 10, 2, 1); R(g, '#d8b06a', 13, 3, 1, 1);
    },
    ',': function (g) {
      sandBase(g, 2); R(g, '#d4b866', 0, 0, 16, 16);
      for (var i = 0; i < 7; i++) {
        var x = 1 + (i * 5) % 14, y = 4 + ((i * 7) % 10);
        R(g, '#8a8a2c', x, y - 3, 1, 4); R(g, '#b0a640', x + 1, y - 4, 1, 4); R(g, '#8a8a2c', x - 1, y - 2, 1, 3);
        R(g, '#6a6a1c', x, y, 2, 1);
      }
    },
    '"': function (g) {
      R(g, '#c9b774', 0, 0, 16, 16);
      for (var i = 0; i < 6; i++) {
        var x = 1 + (i * 3) % 15, y = 6 + ((i * 5) % 9);
        R(g, '#1f7a64', x, y - 6, 1, 7); R(g, '#35b090', x + 1, y - 5, 1, 6); R(g, '#1f6a5a', x - 1, y - 3, 1, 4);
        R(g, '#6a4a2a', x, y - 7, 1, 2);
      }
    },
    '~': function (g, f) {
      R(g, C.lapis, 0, 0, 16, 16);
      var o = f ? 4 : 0;
      for (var y = 2; y < 16; y += 5) { R(g, C.lapis2, (o + y * 3) % 12, y, 4, 1); R(g, C.lapis2, (o + y * 3 + 7) % 14, y + 2, 3, 1); }
    },
    '#': function (g) {
      R(g, '#b0884a', 0, 0, 16, 16); R(g, '#c29a58', 1, 1, 14, 6); R(g, '#9a7238', 0, 11, 16, 5);
      R(g, '#d8b46e', 2, 2, 5, 2); R(g, '#8a642e', 3, 8, 8, 1); R(g, '#8a642e', 0, 15, 16, 1);
    },
    'T': function (g) {
      sandBase(g, 3); R(g, '#6a4a2a', 7, 7, 3, 9); R(g, '#8a6a3a', 7, 7, 1, 9);
      R(g, '#1f7a44', 2, 3, 12, 3); R(g, '#35a85a', 4, 1, 8, 3); R(g, '#1f7a44', 1, 5, 4, 2); R(g, '#1f7a44', 11, 5, 4, 2); R(g, '#145a30', 6, 5, 4, 1);
      R(g, '#e9b949', 6, 6, 1, 1); R(g, '#e9b949', 9, 6, 1, 1);
    },
    'H': function (g) {
      R(g, '#eadbb0', 0, 0, 16, 16); R(g, '#cdb988', 0, 7, 16, 1); R(g, '#cdb988', 0, 15, 16, 1); R(g, '#cdb988', 5, 0, 1, 7); R(g, '#cdb988', 11, 8, 1, 7);
      R(g, '#14110f', 3, 9, 4, 4); R(g, C.lapis, 4, 10, 2, 2);
    },
    'R': function (g) {
      R(g, C.turq, 0, 0, 16, 16); for (var x = 0; x < 16; x += 4) R(g, '#1c8c85', x, 0, 2, 16);
      R(g, '#e9b949', 0, 14, 16, 2); R(g, '#a8782a', 0, 13, 16, 1);
    },
    'D': function (g) {
      R(g, '#eadbb0', 0, 0, 16, 16); R(g, '#e9b949', 3, 1, 10, 15); R(g, '#3a2418', 4, 2, 8, 14);
      R(g, '#5a3a24', 5, 3, 3, 13); R(g, '#e9b949', 10, 9, 1, 2);
    },
    'W': function (g) {
      R(g, '#8a6a38', 0, 0, 16, 16); R(g, '#5a4222', 0, 7, 16, 1); R(g, '#5a4222', 0, 15, 16, 1); R(g, '#5a4222', 7, 0, 1, 7); R(g, '#5a4222', 3, 8, 1, 7); R(g, '#5a4222', 12, 8, 1, 7);
      R(g, '#a88a52', 1, 1, 5, 1); R(g, '#a88a52', 9, 9, 2, 1);
    },
    'X': function (g, f, x0, y0) {
      DRAW.W(g); var k = (x0 * 3 + y0 * 5) % 3; R(g, '#e9b949', 0, 0, 0, 0);
      if (k === 0) { R(g, '#e9b949', 6, 2, 4, 1); R(g, '#e9b949', 5, 3, 1, 1); R(g, '#e9b949', 10, 3, 1, 1); R(g, '#14110f', 7, 3, 2, 1); R(g, '#e9b949', 6, 4, 4, 1); }
      else if (k === 1) { R(g, '#e9b949', 7, 1, 2, 1); R(g, '#e9b949', 6, 2, 1, 2); R(g, '#e9b949', 9, 2, 1, 2); R(g, '#e9b949', 7, 4, 2, 1); R(g, '#e9b949', 5, 5, 6, 1); R(g, '#e9b949', 7, 6, 2, 1); }
      else { R(g, C.lapis, 4, 2, 2, 3); R(g, C.lapis, 8, 3, 3, 2); R(g, '#e9b949', 4, 5, 8, 1); }
    },
    'F': function (g) {
      R(g, '#7d6a45', 0, 0, 16, 16); R(g, '#5e4e30', 0, 0, 16, 1); R(g, '#5e4e30', 0, 0, 1, 16); R(g, '#8e7a52', 2, 2, 12, 1); R(g, '#8e7a52', 2, 2, 1, 12);
    },
    'G': function (g, f, x0, y0) {
      R(g, '#5a4a30', 0, 0, 16, 16); R(g, '#463a24', 0, 0, 16, 1); R(g, '#463a24', 0, 0, 1, 16);
      for (var i = 0; i < 8; i++) R(g, '#c4a45a', Math.floor(h(i, x0 + y0 * 9, 5) * 15), Math.floor(h(i, x0 + y0 * 9, 6) * 15), 1, 1);
      R(g, '#6e5a38', 3, 6, 5, 1); R(g, '#6e5a38', 8, 12, 4, 1);
    },
    'P': function (g) {
      DRAW.F(g); R(g, '#b9a67a', 3, 0, 10, 16); R(g, '#8e7a52', 3, 0, 2, 16); R(g, '#e9b949', 2, 0, 12, 2); R(g, '#e9b949', 2, 14, 12, 2); R(g, '#d6c496', 9, 2, 1, 12); R(g, C.turq, 6, 7, 4, 2);
    },
    'A': function (g) {
      R(g, '#8a6a38', 0, 0, 16, 16); R(g, '#b9a67a', 1, 4, 14, 12); R(g, '#e9b949', 1, 4, 14, 1);
      R(g, C.turq, 6, 6, 4, 4); R(g, '#a8fff0', 7, 7, 2, 2); R(g, '#e9b949', 7, 11, 2, 4); R(g, '#e9b949', 5, 12, 6, 1);
    },
    'S': function (g) {
      sandBase(g, 6); R(g, '#6a4a2a', 0, 4, 16, 12); R(g, '#8a6a3a', 0, 4, 16, 2); R(g, C.lapis, 0, 8, 16, 3); R(g, '#e9b949', 0, 11, 16, 1); R(g, '#e9b949', 0, 7, 16, 1);
      R(g, '#c0392b', 2, 1, 3, 3); R(g, '#e9b949', 8, 2, 3, 2); R(g, C.turq, 12, 1, 2, 3);
    },
    '^': function (g, f, x0, y0) {
      R(g, '#d9b45c', 0, 0, 16, 16); for (var y = 0; y < 16; y += 4) R(g, '#a8842e', 0, y + 3, 16, 1);
      for (var y2 = 0; y2 < 16; y2 += 4) R(g, '#a8842e', ((y2 / 4 + x0) % 2) * 8 + 3, y2, 1, 3);
      R(g, '#f0cf7a', 1, 1, 6, 1); R(g, '#f0cf7a', 9, 5, 5, 1);
    },
    'E': function (g) {
      DRAW['^'](g, 0, 0, 0); R(g, '#e9b949', 2, 2, 12, 14); R(g, '#14110f', 4, 4, 8, 12); R(g, '#3a2a14', 5, 8, 6, 8); R(g, C.turq, 7, 5, 2, 2);
    },
    'J': function (g) {
      DRAW.F(g); R(g, '#b9a67a', 2, 6, 12, 10); R(g, '#8e7a52', 2, 6, 12, 2); R(g, '#e9b949', 2, 5, 12, 1); R(g, '#d6c496', 4, 9, 8, 1);
    },
    'c': function (g) {
      sandBase(g, 8); R(g, '#2f8a44', 6, 3, 4, 12); R(g, '#3fa855', 7, 3, 1, 12); R(g, '#2f8a44', 2, 6, 4, 2); R(g, '#2f8a44', 2, 4, 2, 4); R(g, '#2f8a44', 10, 8, 4, 2); R(g, '#2f8a44', 12, 5, 2, 5);
      R(g, '#e9b949', 8, 5, 1, 1); R(g, '#e9b949', 7, 10, 1, 1);
    },
    'L': function (g, f, x0, y0) {
      DRAW.W(g); R(g, '#3a2a14', 7, 7, 2, 8); R(g, '#e9b949', 6, 6, 4, 2);
      R(g, '#ff9a1c', 6, 2, 4, 4); R(g, '#ffe070', 7, 3, 2, 3); if (f) R(g, '#ff9a1c', 7, 1, 2, 2);
    },
    'N': function (g) {
      DRAW.F(g); R(g, C.lapis, 3, 0, 10, 16); R(g, '#e9b949', 3, 0, 10, 1); R(g, '#e9b949', 3, 0, 1, 16); R(g, '#e9b949', 12, 0, 1, 16);
      R(g, '#e9b949', 6, 4, 4, 2); R(g, C.turq, 7, 8, 2, 4); R(g, '#e9b949', 5, 13, 6, 1);
    },
    'V': function (g) {
      sandBase(g, 9); R(g, '#a8842e', 2, 3, 12, 11); R(g, '#14110f', 3, 4, 10, 9); R(g, '#2a2014', 5, 6, 6, 5);
    },
    'U': function (g) {
      DRAW.F(g); R(g, '#fff0b0', 0, 0, 16, 16); R(g, '#ffe070', 2, 2, 12, 12); R(g, '#ffffff', 5, 5, 6, 6);
    },
    'r': function (g) {
      R(g, C.lapis, 0, 0, 16, 16); R(g, '#e9b949', 0, 0, 16, 1); R(g, '#e9b949', 0, 15, 16, 1); R(g, '#e9b949', 3, 3, 10, 1); R(g, '#e9b949', 3, 12, 10, 1);
      R(g, C.turq, 7, 6, 2, 4); R(g, '#8ab8e8', 1, 5, 1, 1); R(g, '#8ab8e8', 14, 9, 1, 1);
    }
  };
  var tcache = {};
  EG.tileCanvas = function (ch, frame, x, y) {
    var key = ch + (ch === '~' || ch === 'L' ? frame : '') + ((ch === 'X' || ch === 'G' || ch === '^') ? ':' + (x % 3) + ':' + (y % 5) : '');
    if (tcache[key]) return tcache[key];
    var cv = document.createElement('canvas'); cv.width = 16; cv.height = 16;
    var g = cv.getContext('2d'); (DRAW[ch] || DRAW['.'])(g, frame, x, y);
    tcache[key] = cv; return cv;
  };

  // small item pouch for ground items
  EG.itemCanvas = function () {
    if (cache._item) return cache._item;
    var cv = document.createElement('canvas'); cv.width = 16; cv.height = 16; var g = cv.getContext('2d');
    R(g, '#14110f', 4, 6, 8, 8); R(g, '#c49a52', 5, 7, 6, 6); R(g, '#e9b949', 5, 5, 6, 2); R(g, '#14110f', 6, 4, 4, 1); R(g, C.turq, 7, 9, 2, 2);
    cache._item = cv; return cv;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = EG;
})(typeof self !== 'undefined' ? self : globalThis);
