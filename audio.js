/* Sandkeepers - tiny WebAudio chiptune: beeps and a looping tune per area. Mute toggle supported. */
(function (root) {
  'use strict';
  var EG = root.EG;
  var A = EG.audio = {};
  var ac = null, master = null, muted = false, want = null, cur = null, timer = null, nextT = 0, step = 0;

  // E-phrygian-dominant scale in semitones from the root
  var SC = [0, 1, 4, 5, 7, 8, 10, 12, 13, 16, 17, 19, 20, 22, 24];
  var TRACKS = {
    title:  { bpm: 84,  root: 164.8, lead: [7, -1, 4, 5, 4, 2, 1, -1, 7, 8, 7, 5, 4, -1, 2, -1, 0, 2, 4, 5, 7, 5, 4, 2, 1, -1, 0, -1, 1, -1, 0, -1], bass: [0, 0, 4, 4, 5, 5, 4, 4] },
    town:   { bpm: 100, root: 196.0, lead: [4, -1, 5, 4, 2, -1, 1, 2, 4, -1, 7, 5, 4, -1, 2, -1, 5, 4, 2, 1, 0, -1, 1, 2, 4, 2, 1, 0, 1, -1, -1, -1], bass: [0, 4, 0, 4, 5, 4, 1, 4] },
    route:  { bpm: 116, root: 174.6, lead: [0, 1, 4, 1, 0, 1, 4, 5, 7, 5, 4, 1, 4, -1, 1, -1, 7, 8, 7, 5, 4, 5, 4, 1, 0, 1, 2, 1, 0, -1, -1, -1], bass: [0, 0, 4, 4, 0, 0, 5, 4] },
    tomb:   { bpm: 72,  root: 130.8, lead: [0, -1, -1, 1, -1, -1, 4, -1, 1, -1, -1, 0, -1, -1, -1, -1, 0, -1, 1, -1, 4, -1, 5, -1, 4, -1, 1, -1, 0, -1, -1, -1], bass: [0, 0, 0, 0, 1, 1, 0, 0] },
    battle: { bpm: 150, root: 220.0, lead: [7, 7, 8, 7, 5, 7, 4, -1, 7, 7, 8, 7, 9, 8, 7, 5, 4, 4, 5, 4, 2, 4, 1, -1, 0, 1, 2, 4, 5, 4, 2, 1], bass: [0, 0, 1, 1, 0, 0, 4, 1] },
    boss:   { bpm: 160, root: 185.0, lead: [7, 8, 7, 5, 7, 8, 9, 8, 7, 5, 4, 5, 4, 2, 1, 2, 7, 8, 7, 5, 7, 8, 10, 9, 8, 7, 5, 4, 5, 4, 2, 1], bass: [0, 0, 0, 1, 0, 0, 1, 1] },
    win:    { bpm: 130, root: 261.6, lead: [0, 2, 4, 7, 4, 7, 9, -1, -1, -1, -1, -1, -1, -1, -1, -1], bass: [0, 4] }
  };

  A.unlock = function () {
    try {
      if (!ac) {
        var C = window.AudioContext || window.webkitAudioContext; if (!C) return;
        ac = new C(); master = ac.createGain(); master.gain.value = muted ? 0 : 0.22; master.connect(ac.destination);
      }
      if (ac.state === 'suspended') ac.resume();
      if (want && !cur) A.music(want);
    } catch (e) { /* audio is optional */ }
  };
  A.setMuted = function (m) { muted = !!m; if (master) master.gain.value = muted ? 0 : 0.22; };
  A.isMuted = function () { return muted; };

  function tone(f, t, d, type, v, to) {
    if (!ac) return;
    var o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'square'; o.frequency.setValueAtTime(f, t);
    if (to) o.frequency.linearRampToValueAtTime(to, t + d);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + d + 0.02);
  }
  var SFX = {
    select:  [[880, 0.04]],
    confirm: [[660, 0.05], [990, 0.07]],
    bump:    [[110, 0.06, 'square', 0.18]],
    hit:     [[220, 0.08, 'sawtooth', 0.3, 80]],
    super:   [[330, 0.07, 'sawtooth', 0.3, 90], [440, 0.1, 'sawtooth', 0.3, 60]],
    weak:    [[160, 0.1, 'square', 0.15, 120]],
    faint:   [[440, 0.1, 'square', 0.25, 300], [300, 0.12, 'square', 0.25, 160], [180, 0.2, 'square', 0.25, 60]],
    catchhit:[[500, 0.05], [700, 0.05]],
    shake:   [[300, 0.05, 'triangle', 0.3], [260, 0.05, 'triangle', 0.3]],
    caught:  [[523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.25]],
    levelup: [[523, 0.09], [659, 0.09], [784, 0.09], [1047, 0.09], [784, 0.09], [1047, 0.3]],
    heal:    [[523, 0.1], [659, 0.1], [784, 0.1], [988, 0.1], [1175, 0.25]],
    item:    [[784, 0.07], [988, 0.07], [1319, 0.15]],
    encounter: [[300, 0.06, 'square', 0.25, 600], [400, 0.06, 'square', 0.25, 800], [300, 0.06, 'square', 0.25, 600], [500, 0.1, 'square', 0.25, 1000]],
    evolve:  [[392, 0.12], [494, 0.12], [587, 0.12], [784, 0.12], [988, 0.12], [1175, 0.4]],
    warp:    [[600, 0.05, 'triangle', 0.25, 300], [400, 0.08, 'triangle', 0.25, 200]]
  };
  A.sfx = function (name) {
    if (!ac || muted) return;
    var s = SFX[name]; if (!s) return;
    var t = ac.currentTime + 0.01;
    s.forEach(function (n) { tone(n[0], t, n[1], n[2], n[3] || 0.28, n[4]); t += n[1]; });
  };

  function schedule() {
    var tr = TRACKS[cur]; if (!tr || !ac) return;
    var beat = 60 / tr.bpm / 2;      // eighth notes
    while (nextT < ac.currentTime + 0.5) {
      var i = step % tr.lead.length, n = tr.lead[i];
      if (n >= 0) tone(tr.root * 2 * Math.pow(2, SC[n] / 12), nextT, beat * 0.9, 'square', 0.07);
      if (step % 4 === 0) { var b = tr.bass[(step / 4 | 0) % tr.bass.length]; tone(tr.root / 2 * Math.pow(2, SC[b] / 12), nextT, beat * 3.6, 'triangle', 0.16); }
      nextT += beat; step++;
    }
  }
  A.music = function (name) {
    want = name;
    if (!ac) return;
    if (cur === name) return;
    cur = name; step = 0; nextT = ac.currentTime + 0.05;
    if (!timer) timer = setInterval(function () { try { schedule(); } catch (e) {} }, 120);
  };
  A.stopMusic = function () { want = null; cur = null; };
  if (typeof module !== 'undefined' && module.exports) module.exports = EG;
})(typeof self !== 'undefined' ? self : globalThis);
