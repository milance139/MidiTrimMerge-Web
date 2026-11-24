// Plays a sequence through the built-in browser synthesizer (WebAudioFont GM sounds) or a Web MIDI output.
(function (global) {
  'use strict';
  const { ev, TempoMap, orderForPlayback } = Midi;

  const LOOKAHEAD = 1.0;   // seconds scheduled ahead
  const TICK_MS = 100;

  // Note list and control changes of a sequence, in seconds. Cached per sequence object.
  const prepCache = new WeakMap();
  function prepare(seq) {
    if (prepCache.has(seq)) return prepCache.get(seq);
    const tm = new TempoMap(seq);
    const all = orderForPlayback(seq.tracks.flat().filter(ev.isChannel)).map(e => ({ e, sec: tm.tickToSec(e.tick) }));
    const notes = [], controls = [];
    const prog = new Array(16).fill(0), sustain = new Array(16).fill(false);
    const open = new Map();          // noteKey -> [note]
    const held = [];                 // notes released while the pedal was down, per channel
    for (let c = 0; c < 16; c++) held.push([]);
    for (const { e, sec } of all) {
      const ch = ev.channel(e), t = ev.type(e);
      if (ev.isNoteOn(e)) {
        const n = { sec, end: -1, ch, key: e.d1, vel: e.d2, prog: prog[ch] };
        notes.push(n);
        const k = ev.noteKey(e);
        if (!open.has(k)) open.set(k, []);
        open.get(k).push(n);
      } else if (ev.isNoteOff(e)) {
        const l = open.get(ev.noteKey(e));
        if (l && l.length) { const n = l.shift(); if (sustain[ch]) held[ch].push(n); else n.end = sec; }
      } else if (t === 0xC0) prog[ch] = e.d1;
      else if (t === 0xB0) {
        if (e.d1 === 64) {
          const down = e.d2 >= 64;
          if (!down && sustain[ch]) { for (const n of held[ch]) if (n.end < 0) n.end = sec; held[ch] = []; }
          sustain[ch] = down;
        } else if (e.d1 === 7 || e.d1 === 11 || e.d1 === 10 || e.d1 === 121) controls.push({ sec, ch, num: e.d1, val: e.d2 });
      }
    }
    const total = tm.tickToSec(seq.length);
    for (const n of notes) if (n.end < 0) n.end = total;
    const raw = all.map(x => ({ sec: x.sec, data: x.e.status >= 0xC0 && x.e.status < 0xE0 ? [x.e.status, x.e.d1] : [x.e.status, x.e.d1, x.e.d2] }));
    const r = { notes, controls, raw, total };
    prepCache.set(seq, r);
    return r;
  }

  // ---------- built-in synthesizer ----------
  let ctx = null, wafPlayer = null, compressor = null;
  function audio() {
    if (!ctx) {
      const AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) throw new Error('This browser cannot play sound (no Web Audio).');
      ctx = new AC();
      compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -14; compressor.ratio.value = 6;
      compressor.connect(ctx.destination);
    }
    if (!wafPlayer) {
      if (!global.WebAudioFontPlayer) throw new Error('The sound library could not be loaded (check the internet connection).');
      wafPlayer = new global.WebAudioFontPlayer();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function presetInfo(ch, n) {
    const L = wafPlayer.loader;
    return ch === 9 ? L.drumInfo(L.findDrum(n.key)) : L.instrumentInfo(L.findInstrument(n.prog));
  }

  function loadPresets(infos, isCancelled) {
    const L = wafPlayer.loader;
    for (const i of infos) L.startLoad(ctx, i.url, i.variable);
    return new Promise((resolve, reject) => {
      const t0 = Date.now();
      const check = () => {
        if (isCancelled()) return resolve(false);
        if (infos.every(i => L.loaded(i.variable))) return resolve(true);
        if (Date.now() - t0 > 60000) return reject(new Error('The instrument sounds could not be downloaded (check the internet connection).'));
        setTimeout(check, 100);
      };
      check();
    });
  }

  // ---------- Web MIDI ----------
  let midiAccess = null;
  async function getMidiAccess() {
    if (midiAccess) return midiAccess;
    if (!navigator.requestMIDIAccess) return null;
    try { midiAccess = await navigator.requestMIDIAccess({ sysex: false }); } catch (e) { midiAccess = null; }
    return midiAccess;
  }
  async function getDevices() {
    const a = await getMidiAccess();
    return a ? Array.from(a.outputs.values()).map(o => o.name) : [];
  }

  class Player {
    constructor() { this.run = null; this.onFinished = null; this.onLoading = null; }
    get isPlaying() { return !!this.run; }
    get position() {
      const r = this.run;
      if (!r) return this.lastPos || 0;
      if (!r.started) return r.startSec;
      return r.startSec + Math.max(0, r.now() - r.t0);
    }

    // device: null = built-in synthesizer, otherwise the name of a Web MIDI output.
    async start(seq, startSec, device) {
      this.stop(true);
      startSec = Math.max(0, startSec || 0);
      const p = prepare(seq);
      const run = { startSec, started: false, cancelled: false, total: p.total };
      this.run = run;
      try {
        if (device) await this._startMidi(run, p, device);
        else await this._startSynth(run, p);
      } catch (e) {
        if (this.run === run) { this.run = null; }
        throw e;
      }
    }

    async _startSynth(run, p) {
      const c = audio();
      // sounds needed from the start position on
      const infos = new Map();
      for (const n of p.notes) if (n.sec >= run.startSec) { const i = presetInfo(n.ch, n); infos.set(i.variable, i); }
      const L = wafPlayer.loader;
      if (Array.from(infos.values()).some(i => !L.loaded(i.variable)) && this.onLoading) this.onLoading(true);
      const ok = await loadPresets(Array.from(infos.values()), () => run.cancelled);
      if (this.onLoading) this.onLoading(false);
      if (!ok || run.cancelled) return;

      const master = c.createGain(); master.gain.value = 0.9; master.connect(compressor);
      const chans = [];
      const vol = new Array(16).fill(100), expr = new Array(16).fill(127), pan = new Array(16).fill(64);
      for (const k of p.controls) {
        if (k.sec >= run.startSec) break;
        if (k.num === 7) vol[k.ch] = k.val; else if (k.num === 11) expr[k.ch] = k.val; else if (k.num === 10) pan[k.ch] = k.val;
        else if (k.num === 121) { expr[k.ch] = 127; }
      }
      const gainOf = ch => Math.pow(vol[ch] / 127, 2) * Math.pow(expr[ch] / 127, 2);
      for (let ch = 0; ch < 16; ch++) {
        const g = c.createGain(); g.gain.value = gainOf(ch);
        let out = g;
        if (c.createStereoPanner) { const pn = c.createStereoPanner(); pn.pan.value = (pan[ch] - 64) / 64; g.connect(pn); pn.connect(master); chans.push({ g, pn }); }
        else { g.connect(master); chans.push({ g, pn: null }); }
        void out;
      }
      run.master = master; run.chans = chans;
      run.now = () => c.currentTime;
      run.t0 = c.currentTime + 0.12;
      run.started = true;
      let ni = p.notes.findIndex(n => n.sec >= run.startSec); if (ni < 0) ni = p.notes.length;
      let ki = p.controls.findIndex(k => k.sec >= run.startSec); if (ki < 0) ki = p.controls.length;
      const at = sec => run.t0 + (sec - run.startSec);
      const pump = () => {
        if (run.cancelled) return;
        const until = c.currentTime + LOOKAHEAD;
        while (ki < p.controls.length && at(p.controls[ki].sec) <= until) {
          const k = p.controls[ki++];
          const t = Math.max(c.currentTime, at(k.sec));
          if (k.num === 7) vol[k.ch] = k.val; else if (k.num === 11) expr[k.ch] = k.val; else if (k.num === 121) expr[k.ch] = 127;
          if (k.num === 10) { if (chans[k.ch].pn) chans[k.ch].pn.pan.setValueAtTime((k.val - 64) / 64, t); }
          else chans[k.ch].g.gain.setValueAtTime(gainOf(k.ch), t);
        }
        while (ni < p.notes.length && at(p.notes[ni].sec) <= until) {
          const n = p.notes[ni++];
          const info = presetInfo(n.ch, n);
          const preset = global[info.variable];
          if (!preset) continue;
          let dur = Math.max(0.05, n.end - n.sec);
          if (n.ch === 9) dur = Math.max(dur, 0.6);
          const v = Math.pow(n.vel / 127, 1.6) * 0.55;
          try { wafPlayer.queueWaveTable(c, chans[n.ch].g, preset, at(n.sec), n.key, dur, v); } catch (e) { /* skip this note */ }
        }
        if (c.currentTime > at(run.total) + 0.3) { this._finish(run); return; }
        run.timer = setTimeout(pump, TICK_MS);
      };
      pump();
    }

    async _startMidi(run, p, device) {
      const a = await getMidiAccess();
      const out = a && Array.from(a.outputs.values()).find(o => o.name === device);
      if (!out) throw new Error('The MIDI output "' + device + '" is not available.');
      if (run.cancelled) return;
      run.out = out;
      for (const m of p.raw) { if (m.sec >= run.startSec) break; const t = m.data[0] & 0xF0; if (t !== 0x80 && t !== 0x90) out.send(m.data); }
      run.now = () => performance.now() / 1000;
      run.t0 = run.now() + 0.12;
      run.started = true;
      let i = p.raw.findIndex(m => m.sec >= run.startSec); if (i < 0) i = p.raw.length;
      const at = sec => run.t0 + (sec - run.startSec);
      const pump = () => {
        if (run.cancelled) return;
        const until = run.now() + LOOKAHEAD;
        while (i < p.raw.length && at(p.raw[i].sec) <= until) {
          const m = p.raw[i++];
          try { out.send(m.data, at(m.sec) * 1000); } catch (e) { /* ignore a bad message */ }
        }
        if (run.now() > at(run.total) + 0.3) { this._finish(run); return; }
        run.timer = setTimeout(pump, TICK_MS);
      };
      pump();
    }

    _silence(run) {
      clearTimeout(run.timer);
      if (run.master) {
        try { wafPlayer.cancelQueue(ctx); } catch (e) { }
        try { run.master.gain.setValueAtTime(0, ctx.currentTime); run.master.disconnect(); } catch (e) { }
      }
      if (run.out) {
        try { if (run.out.clear) run.out.clear(); } catch (e) { }
        for (let ch = 0; ch < 16; ch++) { try { run.out.send([0xB0 | ch, 123, 0]); run.out.send([0xB0 | ch, 120, 0]); } catch (e) { } }
      }
    }

    _finish(run) {
      this.lastPos = Math.min(this.position, run.total);
      run.cancelled = true;
      this._silence(run);
      if (this.run === run) this.run = null;
      if (this.onFinished) this.onFinished();
    }

    stop(quiet) {
      const run = this.run;
      if (!run) return;
      this.lastPos = this.position;
      run.cancelled = true;
      this._silence(run);
      this.run = null;
      if (!quiet && this.onFinished) this.onFinished();
    }
  }

  global.MidiPlayer = { Player, getDevices, hasWebMidi: () => !!navigator.requestMIDIAccess };
})(window);
