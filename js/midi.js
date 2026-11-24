// MIDI reading/writing and song operations (port of Midi.cs from the desktop app).
// Event: { tick, status, meta, d1, d2, data }   Sequence: { ppq, tracks: [[event]], length }
(function (global) {
  'use strict';

  const ev = {
    isMeta: e => e.status === 0xFF,
    isSysex: e => e.status === 0xF0 || e.status === 0xF7,
    isChannel: e => e.status >= 0x80 && e.status < 0xF0,
    type: e => e.status & 0xF0,
    channel: e => e.status & 0x0F,
    isNoteOn: e => e.status >= 0x90 && e.status < 0xA0 && e.d2 > 0,
    isNoteOff: e => (e.status >= 0x80 && e.status < 0x90) || (e.status >= 0x90 && e.status < 0xA0 && e.d2 === 0),
    isTempo: e => e.status === 0xFF && e.meta === 0x51 && e.data && e.data.length === 3,
    isConductor: e => e.status === 0xFF && (e.meta === 0x51 || e.meta === 0x58 || e.meta === 0x59),
    noteKey: e => ((e.status & 0x0F) << 8) | e.d1,
  };
  const clone = e => Object.assign({}, e);
  const newSeq = (ppq, length) => ({ ppq: ppq, tracks: [], length: length || 0 });

  class MidiError extends Error { constructor(code, msg) { super(msg); this.code = code; } }

  // ---------- tempo map ----------
  class TempoMap {
    constructor(s) {
      this.ppq = s.ppq;
      this.ticks = [0]; this.uspq = [500000]; this.secAt = [0];
      const tempos = stableSortByTick(s.tracks.flat().filter(ev.isTempo));
      for (const e of tempos) {
        const v = (e.data[0] << 16) | (e.data[1] << 8) | e.data[2];
        if (v <= 0) continue;
        const n = this.ticks.length - 1;
        if (e.tick === this.ticks[n]) { this.uspq[n] = v; continue; }
        const sec = this.secAt[n] + (e.tick - this.ticks[n]) * (this.uspq[n] / 1e6) / this.ppq;
        this.ticks.push(e.tick); this.uspq.push(v); this.secAt.push(sec);
      }
    }
    seg(tick) { let i = this.ticks.length - 1; while (i > 0 && this.ticks[i] > tick) i--; return i; }
    tempoAt(tick) { return this.uspq[this.seg(tick)]; }
    tickToSec(tick) { const i = this.seg(tick); return this.secAt[i] + (tick - this.ticks[i]) * (this.uspq[i] / 1e6) / this.ppq; }
    secToTick(sec) {
      let i = this.secAt.length - 1;
      while (i > 0 && this.secAt[i] > sec) i--;
      return this.ticks[i] + Math.round((sec - this.secAt[i]) * this.ppq / (this.uspq[i] / 1e6));
    }
  }

  function stableSortByTick(list) {
    return list.map((e, i) => [e, i]).sort((a, b) => a[0].tick - b[0].tick || a[1] - b[1]).map(x => x[0]);
  }

  // ---------- reading / writing ----------
  function load(bytes) {
    const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const be16 = p => (b[p] << 8) | b[p + 1];
    const be32 = p => ((b[p] << 24) | (b[p + 1] << 16) | (b[p + 2] << 8) | b[p + 3]) >>> 0;
    const is = (p, s) => b[p] === s.charCodeAt(0) && b[p + 1] === s.charCodeAt(1) && b[p + 2] === s.charCodeAt(2) && b[p + 3] === s.charCodeAt(3);
    let start = 0;
    if (b.length > 20 && is(0, 'RIFF')) {   // RIFF RMID wrapper
      for (let i = 12; i + 4 < b.length; i++) if (is(i, 'MThd')) { start = i; break; }
    }
    if (b.length < start + 14 || !is(start, 'MThd')) throw new MidiError('notMidi', 'Not a standard MIDI file.');
    const hdrLen = be32(start + 4), ntr = be16(start + 10), div = be16(start + 12);
    if (div & 0x8000) throw new MidiError('smpte', 'SMPTE time-division MIDI files are not supported.');
    if (div === 0) throw new MidiError('notMidi', 'Invalid time division.');
    const seq = newSeq(div);
    let p = start + 8 + hdrLen;
    const st = { maxTick: 0 };
    while (p + 8 <= b.length && seq.tracks.length < ntr) {
      const len = be32(p + 4);
      const isTrk = is(p, 'MTrk');
      p += 8;
      const end = p + len > b.length ? b.length : p + len;
      if (isTrk) seq.tracks.push(parseTrack(b, p, end, st));
      p = end;
    }
    if (seq.tracks.length === 0) throw new MidiError('notMidi', 'The file contains no tracks.');
    seq.length = st.maxTick;
    return seq;
  }

  function parseTrack(b, p, end, st) {
    const list = [];
    let tick = 0, running = 0;
    const vlq = () => { let v = 0; for (let i = 0; i < 4 && p < end; i++) { const c = b[p++]; v = v * 128 + (c & 0x7F); if (!(c & 0x80)) break; } return v; };
    while (p < end) {
      tick += vlq();
      if (p >= end) break;
      let s = b[p];
      if (s < 0x80) { if (running === 0) break; s = running; }
      else { p++; running = s < 0xF0 ? s : 0; }
      if (s === 0xFF) {
        if (p >= end) break;
        const type = b[p++];
        const len = vlq();
        if (p + len > end) break;
        const data = b.slice(p, p + len); p += len;
        if (tick > st.maxTick) st.maxTick = tick;
        if (type === 0x2F) continue;   // end of track is regenerated on save
        list.push({ tick, status: 0xFF, meta: type, d1: 0, d2: 0, data });
      } else if (s === 0xF0 || s === 0xF7) {
        const len = vlq();
        if (p + len > end) break;
        const data = b.slice(p, p + len); p += len;
        list.push({ tick, status: s, meta: 0, d1: 0, d2: 0, data });
      } else {
        const n = ((s & 0xF0) === 0xC0 || (s & 0xF0) === 0xD0) ? 1 : 2;
        if (p + n > end) break;
        const e = { tick, status: s, meta: 0, d1: b[p++], d2: 0, data: null };
        if (n === 2) e.d2 = b[p++];
        list.push(e);
        if (tick > st.maxTick) st.maxTick = tick;
      }
    }
    return list;
  }

  function save(seq) {
    const out = [];
    const be = (v, n) => { for (let i = n - 1; i >= 0; i--) out.push((v >>> (8 * i)) & 0xFF); };
    const vlqTo = (arr, v) => {
      const buf = [v & 0x7F]; v = Math.floor(v / 128);
      while (v > 0) { buf.unshift((v & 0x7F) | 0x80); v = Math.floor(v / 128); }
      for (const x of buf) arr.push(x);
    };
    out.push(0x4D, 0x54, 0x68, 0x64); be(6, 4); be(seq.tracks.length > 1 ? 1 : 0, 2); be(seq.tracks.length, 2); be(seq.ppq, 2);
    for (const track of seq.tracks) {
      const t = [];
      let last = 0;
      for (const e of orderForPlayback(track)) {
        vlqTo(t, Math.max(0, e.tick - last));
        last = e.tick;
        if (ev.isMeta(e)) { t.push(0xFF, e.meta); vlqTo(t, e.data.length); for (const x of e.data) t.push(x); }
        else if (ev.isSysex(e)) { t.push(e.status); vlqTo(t, e.data.length); for (const x of e.data) t.push(x); }
        else { t.push(e.status, e.d1); if (ev.type(e) !== 0xC0 && ev.type(e) !== 0xD0) t.push(e.d2); }
      }
      vlqTo(t, Math.max(0, seq.length - last));
      t.push(0xFF, 0x2F, 0);
      out.push(0x4D, 0x54, 0x72, 0x6B); be(t.length, 4);
      for (const x of t) out.push(x);
    }
    return new Uint8Array(out);
  }

  // Events in time order. At the same tick, note-offs of earlier notes go first so a repeated note is not cut short,
  // but a note that starts and ends on that very tick keeps its on-before-off order.
  function orderForPlayback(events) {
    const sorted = stableSortByTick(Array.from(events));
    const res = [];
    let i = 0;
    while (i < sorted.length) {
      let j = i; while (j < sorted.length && sorted[j].tick === sorted[i].tick) j++;
      if (j - i === 1) { res.push(sorted[i]); i = j; continue; }
      const openHere = new Set(), first = [], rest = [];
      for (let k = i; k < j; k++) {
        const e = sorted[k];
        if (ev.isNoteOn(e)) { openHere.add(ev.noteKey(e)); rest.push(e); }
        else if (ev.isNoteOff(e) && openHere.has(ev.noteKey(e))) { openHere.delete(ev.noteKey(e)); rest.push(e); }
        else if (ev.isNoteOff(e)) first.push(e);
        else rest.push(e);
      }
      res.push(...first, ...rest);
      i = j;
    }
    return res;
  }

  const durationSeconds = s => new TempoMap(s).tickToSec(s.length);

  // Cuts the sequence to [startSec, endSec). endSec <= 0 means "to the end".
  function trim(src, startSec, endSec) {
    const tm = new TempoMap(src);
    const total = tm.tickToSec(src.length);
    const st = startSec <= 0 ? 0 : tm.secToTick(startSec);
    const en = (endSec <= 0 || endSec >= total) ? src.length : tm.secToTick(endSec);
    if (st >= src.length) throw new MidiError('startBeyond', 'Start is beyond the end of the file.');
    if (en <= st) throw new MidiError('endBefore', 'End must be after start.');
    const res = newSeq(src.ppq, en - st);
    src.tracks.forEach((track, ti) => {
      const out = [];
      const ordered = stableSortByTick(track);
      const latestMeta = new Map(), state = new Map(), active = new Map(), headers = [];
      if (ti === 0) {
        const t = tm.tempoAt(st);
        out.push({ tick: 0, status: 0xFF, meta: 0x51, d1: 0, d2: 0, data: new Uint8Array([(t >> 16) & 255, (t >> 8) & 255, t & 255]) });
      }
      let i = 0;
      for (; i < ordered.length && ordered[i].tick < st; i++) {
        const e = ordered[i];
        if (ev.isMeta(e)) {
          if (e.meta === 0x03 || e.meta === 0x04 || e.meta === 0x58 || e.meta === 0x59) latestMeta.set(e.meta, e);
          else if (isKarHeader(e)) headers.push(e);
        }
        else if (ev.isNoteOn(e)) active.set(ev.noteKey(e), e);
        else if (ev.isNoteOff(e)) active.delete(ev.noteKey(e));
        else if (ev.isChannel(e)) state.set((ev.channel(e) << 16) | (ev.type(e) << 8) | (ev.type(e) === 0xB0 ? e.d1 : 0), e);
      }
      for (const m of [headers, latestMeta.values(), state.values(), active.values()]) for (const e of m) { const c = clone(e); c.tick = 0; out.push(c); }
      for (; i < ordered.length && ordered[i].tick <= en; i++) {
        const e = ordered[i];
        if (e.tick === en && !ev.isNoteOff(e)) continue;
        if (ev.isTempo(e) && e.tick === st) continue;
        if (ev.isNoteOn(e)) active.set(ev.noteKey(e), e);
        else if (ev.isNoteOff(e)) active.delete(ev.noteKey(e));
        const c = clone(e); c.tick = e.tick - st; out.push(c);
      }
      for (const e of active.values()) out.push({ tick: en - st, status: 0x80 | ev.channel(e), meta: 0, d1: e.d1, d2: 0, data: null });
      res.tracks.push(out);
    });
    if (res.tracks.length === 0) res.tracks.push([]);
    return res;
  }

  function rescale(s, ppq) {
    if (s.ppq === ppq) return s;
    const f = ppq / s.ppq;
    const r = newSeq(ppq, Math.round(s.length * f));
    for (const t of s.tracks) r.tracks.push(t.map(e => { const c = clone(e); c.tick = Math.round(e.tick * f); return c; }));
    return r;
  }

  const cc = (tick, ch, num, value) => ({ tick, status: 0xB0 | ch, meta: 0, d1: num, d2: Math.max(0, Math.min(127, Math.round(value))), data: null });

  function activeChannels(s, from, to, map) {
    const h = new Set();
    for (const t of s.tracks) for (const e of t)
      if ((ev.isNoteOn(e) || ev.isNoteOff(e)) && ev.channel(e) !== 9 && e.tick >= from && e.tick <= to)
        h.add(map && map.has(ev.channel(e)) ? map.get(ev.channel(e)) : ev.channel(e));
    return Array.from(h).sort((a, b) => a - b);
  }
  function usedChannels(s) {
    const h = new Set();
    for (const t of s.tracks) for (const e of t) if (ev.isChannel(e) && ev.channel(e) !== 9) h.add(ev.channel(e));
    return h;
  }
  function exprAt(d, ch, tick) {
    const l = d.get(ch); if (!l) return 127;
    let v = 127, best = -1;
    for (const [k, val] of l) if (k <= tick && k >= best) { best = k; v = val; }
    return v;
  }

  // Plays the clips one after another; overlaps[i] (seconds) is the overlap between clip i and clip i+1.
  // During an overlap the new song's timing is kept exactly; with fade the old song fades out and the new one fades in.
  function concatenate(clips, overlaps, fade) {
    const ppq = clips[0].ppq;
    const res = newSeq(ppq);
    const slots = [[]];   // slot 0 = conductor
    clips = clips.map(c => rescale(c, ppq));
    const words = karaokePlan(clips, true);
    const wordsSlot = words.track + 1;
    while (slots.length <= wordsSlot) slots.push([]);
    const fadeTrack = [];
    let offset = 0, prev = null, prevMap = null, prevExpr = new Map();
    for (let k = 0; k < clips.length; k++) {
      const clip = clips[k];
      const overlapSec = (k > 0 && k - 1 < overlaps.length) ? overlaps[k - 1] : 0;
      let ov = 0, cut = 0, o = 0, ctm = null;
      if (prev && overlapSec > 0) {
        const prevDur = durationSeconds(prev), curDur = durationSeconds(clip);
        o = Math.min(overlapSec, Math.min(prevDur, curDur));
        const tail = prev.length - new TempoMap(prev).secToTick(prevDur - o);
        ctm = new TempoMap(clip);
        ov = Math.max(0, Math.min(tail, prev.length));
        cut = Math.max(0, Math.min(ctm.secToTick(o), clip.length));
        if (ov <= 0 || cut <= 0 || o <= 0) { ov = 0; cut = 0; o = 0; ctm = null; }
      }
      const start = offset - ov;
      const place = tick => {
        if (ov <= 0) return start + tick;
        if (tick < cut) return start + Math.min(ov, Math.round(ov * (ctm.tickToSec(tick) / o)));
        return start + ov + (tick - cut);
      };

      const curCh = usedChannels(clip);
      const map = new Map(); for (const ch of curCh) map.set(ch, ch);
      const shared = new Set(), fadeOut = [], fadeIn = [];
      if (fade && ov > 0) {
        const prevAct = activeChannels(prev, prev.length - ov, Number.MAX_SAFE_INTEGER, prevMap);
        const curAct = activeChannels(clip, 0, cut, null);
        const used = new Set([...prevAct, ...curCh]);
        for (const ch of Array.from(curCh).filter(x => prevAct.includes(x))) {
          let free = -1;
          for (let x = 0; x < 16; x++) if (x !== 9 && !used.has(x)) { free = x; break; }
          if (free >= 0) { map.set(ch, free); used.add(free); } else shared.add(ch);
        }
        fadeOut.push(...prevAct.filter(x => !shared.has(x)));
        for (const x of curAct) { const m = map.get(x); if (!shared.has(m) && !fadeIn.includes(m)) fadeIn.push(m); }
      }

      const curExpr = new Map();
      let pendingTempo = null;
      clip.tracks.forEach((track, ti) => {
        while (slots.length <= ti + 1) slots.push([]);
        for (const e of track) {
          if (ev.isTempo(e) && ov > 0 && e.tick < cut) {
            if (!pendingTempo || e.tick >= pendingTempo.tick) pendingTempo = e;
            continue;
          }
          const c = clone(e);
          c.tick = place(e.tick);
          if (ev.isChannel(c) && ev.channel(c) !== 9 && map.has(ev.channel(c)) && map.get(ev.channel(c)) !== ev.channel(c))
            c.status = (c.status & 0xF0) | map.get(ev.channel(c));
          if (ev.isChannel(c) && ev.channel(c) !== 9 && ev.type(c) === 0xB0 && c.d1 === 11) {
            if (!curExpr.has(ev.channel(c))) curExpr.set(ev.channel(c), []);
            curExpr.get(ev.channel(c)).push([e.tick, c.d2]);
          }
          if (words.onWordsTrack(k, e)) { words.convert(k, e, c); slots[wordsSlot].push(c); }
          else (ev.isConductor(e) ? slots[0] : slots[ti + 1]).push(c);
        }
      });
      if (pendingTempo) { const c = clone(pendingTempo); c.tick = start + ov; slots[0].push(c); }
      if (fade && ov > 0) {
        const N = 16;
        for (const ch of fadeOut) {
          const b = exprAt(prevExpr, ch, prev.length - ov);
          for (let i = 1; i < N; i++) fadeTrack.push(cc(start + Math.floor(ov * i / N), ch, 11, Math.floor(b * (N - i) / N)));
          fadeTrack.push(cc(start + ov + 1, ch, 11, b));
        }
        for (const ch of fadeIn) {
          const b = exprAt(curExpr, ch, cut);
          fadeTrack.push(cc(Math.max(0, start - 1), ch, 11, 0));
          for (let i = 1; i <= N; i++) fadeTrack.push(cc(start + Math.floor(ov * i / N), ch, 11, Math.floor(b * i / N)));
        }
      }
      offset = place(clip.length);
      prev = clip; prevMap = map; prevExpr = curExpr;
    }
    if (fadeTrack.length > 0) slots.push(fadeTrack);
    res.length = offset;
    res.tracks = slots.filter((s, i) => i === 0 || s.length > 0);
    return res;
  }

  // Plays all clips together from the start. Tempo comes from the first clip.
  function overlay(clips) {
    const ppq = clips[0].ppq;
    const res = newSeq(ppq);
    const conductor = [], wordsTrack = [];
    res.tracks.push(conductor);
    clips = clips.map(c => rescale(c, ppq));
    const words = karaokePlan(clips);
    clips.forEach((clip, k) => {
      res.length = Math.max(res.length, clip.length);
      clip.tracks.forEach((t, ti) => {
        const isWords = k === words.clip && ti === words.track;
        const nt = isWords ? wordsTrack : [];
        for (const e of t) {
          if (ev.isConductor(e)) { if (k === 0) conductor.push(clone(e)); continue; }
          const c = clone(e);
          if (words.onWordsTrack(k, e)) { words.convert(k, e, c); wordsTrack.push(c); } else nt.push(c);
        }
        if (isWords || nt.length > 0) res.tracks.push(nt);
      });
    });
    return res;
  }

  // General MIDI program in use on each melodic channel that plays notes (first program change, else 0).
  function programsUsed(s) {
    const all = s.tracks.flat();
    const res = new Map();
    for (const e of all) if (ev.isNoteOn(e) && ev.channel(e) !== 9 && !res.has(ev.channel(e))) res.set(ev.channel(e), 0);
    for (const ch of res.keys()) {
      const pcs = stableSortByTick(all.filter(e => ev.isChannel(e) && ev.channel(e) === ch && ev.type(e) === 0xC0));
      if (pcs.length) res.set(ch, pcs[0].d1);
    }
    return new Map(Array.from(res.entries()).sort((a, b) => a[0] - b[0]));
  }

  function mapEvents(src, fn) {
    const res = newSeq(src.ppq, src.length);
    for (const t of src.tracks) res.tracks.push(t.map(e => { const c = clone(e); fn(c); return c; }));
    return res;
  }

  // Forces the given instrument on a channel for the whole song. map: { channel: program }
  function changeInstruments(src, map) {
    const res = newSeq(src.ppq, src.length);
    for (const t of src.tracks) res.tracks.push(t.filter(e => !(ev.isChannel(e) && ev.type(e) === 0xC0 && (ev.channel(e) in map))).map(clone));
    if (res.tracks.length === 0) res.tracks.push([]);
    for (const k of Object.keys(map)) res.tracks[0].push({ tick: 0, status: 0xC0 | (+k), meta: 0, d1: map[k], d2: 0, data: null });
    return res;
  }

  const scaleVelocity = (src, f) => mapEvents(src, c => { if (ev.isNoteOn(c)) c.d2 = Math.max(1, Math.min(127, Math.round(c.d2 * f))); });

  function measureLoudness(s) {
    const vol = new Array(16).fill(100), expr = new Array(16).fill(127);
    let sum = 0, n = 0;
    for (const e of stableSortByTick(s.tracks.flat().filter(ev.isChannel))) {
      if (ev.type(e) === 0xB0 && e.d1 === 7) vol[ev.channel(e)] = e.d2;
      else if (ev.type(e) === 0xB0 && e.d1 === 11) expr[ev.channel(e)] = e.d2;
      else if (ev.isNoteOn(e)) { sum += e.d2 * (vol[ev.channel(e)] / 127) * (expr[ev.channel(e)] / 127); n++; }
    }
    return n === 0 ? 0 : sum / n;
  }

  const firstBpm = s => 60000000 / new TempoMap(s).tempoAt(0);

  // Key: { tonic, minor, estimated } or null. Key signature if present, otherwise Krumhansl-Schmuckler from the notes.
  function guessKey(s) {
    const all = s.tracks.flat();
    const ks = stableSortByTick(all.filter(e => ev.isMeta(e) && e.meta === 0x59 && e.data && e.data.length === 2))[0];
    if (ks) {
      const sf = ks.data[0] > 127 ? ks.data[0] - 256 : ks.data[0];
      const minor = ks.data[1] === 1;
      let tonic = (((sf * 7) % 12) + 12) % 12;
      if (minor) tonic = (tonic + 9) % 12;
      return { tonic, minor, estimated: false };
    }
    const hist = new Array(12).fill(0);
    for (const e of all) if (ev.isNoteOn(e) && ev.channel(e) !== 9) hist[e.d1 % 12]++;
    if (hist.reduce((a, b) => a + b, 0) < 8) return null;
    const maj = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
    const min = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
    let best = -Infinity, tonic = 0, minor = false;
    for (let t = 0; t < 12; t++) for (let m = 0; m < 2; m++) {
      const prof = m === 0 ? maj : min;
      const rot = []; for (let i = 0; i < 12; i++) rot.push(prof[(i - t + 12) % 12]);
      const r = corr(hist, rot);
      if (r > best) { best = r; tonic = t; minor = m === 1; }
    }
    return { tonic, minor, estimated: true };
  }
  function corr(a, b) {
    const ma = a.reduce((x, y) => x + y, 0) / a.length, mb = b.reduce((x, y) => x + y, 0) / b.length;
    let sab = 0, saa = 0, sbb = 0;
    for (let i = 0; i < a.length; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; }
    return saa === 0 || sbb === 0 ? 0 : sab / Math.sqrt(saa * sbb);
  }

  function transpose(src, semis) {
    return mapEvents(src, c => {
      const t = ev.type(c);
      if (ev.isChannel(c) && ev.channel(c) !== 9 && (t === 0x80 || t === 0x90 || t === 0xA0)) {
        let n = c.d1 + semis; while (n < 0) n += 12; while (n > 127) n -= 12; c.d1 = n;
      }
    });
  }

  function changeSpeed(src, factor) {
    return mapEvents(src, c => {
      if (ev.isTempo(c)) {
        let v = (c.data[0] << 16) | (c.data[1] << 8) | c.data[2];
        v = Math.max(1, Math.min(0xFFFFFF, Math.round(v / factor)));
        c.data = new Uint8Array([(v >> 16) & 255, (v >> 8) & 255, v & 255]);
      }
    });
  }

  // Time (seconds) of the first note start and the last note event, or null if there are no notes.
  function findNoteSpan(s) {
    let min = Infinity, max = -1;
    for (const t of s.tracks) for (const e of t) {
      if (ev.isNoteOn(e) && e.tick < min) min = e.tick;
      if ((ev.isNoteOn(e) || ev.isNoteOff(e)) && e.tick > max) max = e.tick;
    }
    if (max < 0 || min === Infinity) return null;
    const tm = new TempoMap(s);
    return { first: tm.tickToSec(min), last: tm.tickToSec(max) };
  }

  // ---------- text encodings ----------
  const encoders = {};
  function encoderFor(cp) {
    if (encoders[cp]) return encoders[cp];
    const dec = new TextDecoder('windows-' + cp);
    const m = new Map();
    for (let i = 0; i < 256; i++) { const ch = dec.decode(new Uint8Array([i])); if (ch !== '�' && !m.has(ch)) m.set(ch, i); }
    return (encoders[cp] = m);
  }
  // Single-byte encode; returns null if a character does not fit (strict) or uses '?' otherwise.
  function encodeSingle(t, cp, strict) {
    const m = encoderFor(cp), out = [];
    for (const ch of t) { const b = m.get(ch); if (b === undefined) { if (strict) return null; out.push(63); } else out.push(b); }
    return new Uint8Array(out);
  }
  // cp 0 = automatic: UTF-8 if the bytes are valid UTF-8, otherwise Windows-1250.
  function decodeText(d, cp) {
    if (cp) return new TextDecoder(cp === 65001 ? 'utf-8' : 'windows-' + cp).decode(d);
    try { return new TextDecoder('utf-8', { fatal: true }).decode(d); }
    catch (e) { return new TextDecoder('windows-1250').decode(d); }
  }
  // cp 0 = automatic: Windows-1250 if every character fits, otherwise UTF-8.
  function encodeText(t, cp) {
    if (cp === 65001) return new TextEncoder().encode(t);
    if (cp) return encodeSingle(t, cp, false);
    return encodeSingle(t, 1250, true) || new TextEncoder().encode(t);
  }

  // ---------- karaoke text ----------
  const isKarHeader = e => ev.isMeta(e) && e.meta === 0x01 && e.data && e.data.length > 0 && e.data[0] === 64 /* '@' */;
  function lyricEvents(s) {
    const evs = stableSortByTick(s.tracks.flat().filter(e => ev.isMeta(e) && e.data && e.data.length > 0));
    let src = evs.filter(e => e.meta === 0x05);
    if (src.length === 0) src = evs.filter(e => e.meta === 0x01 && !isKarHeader(e));
    return src;
  }

  function withLyrics(s, texts, cp) {
    const map = new Map();
    const evs = lyricEvents(s);
    for (let i = 0; i < evs.length && i < texts.length; i++) if (texts[i] != null) map.set(evs[i], texts[i]);
    const res = newSeq(s.ppq, s.length);
    for (const t of s.tracks) res.tracks.push(t.map(e => { const c = clone(e); if (map.has(e)) c.data = encodeText(map.get(e), cp); return c; }));
    return res;
  }

  const CreditMarks = ['rights reserved', 'copyright', '©', '®', '(c)', 'phone', 'tel:', 'tel.', 'e-mail', 'email', 'mail:',
    'http', 'www', '@', 'midi from', 'collection', 'distributed by', 'sequenced by', 'created by', 'written by', 'generated by',
    'arranged by', 'music by', 'lyrics by', 'words by', 'music:', 'lyrics:', 'midified', 'gnmidi', 'cromidi', 'kmidi', 'midifajlovi', 'gmail', 'hotmail', 'yahoo'];
  const countRe = (t, re) => (t.match(re) || []).length;
  const isBlankText = t => !/[\p{L}\p{Nd}]/u.test(t);
  const isNumberBit = t => !/\p{L}/u.test(t) && countRe(t, /\p{Nd}/gu) >= 2;
  const hasLetters = data => /\p{L}/u.test(decodeText(data, 0));
  function looksLikeCredit(t) {
    const l = t.toLowerCase().replace(/_/g, ' ');
    if (CreditMarks.some(m => l.includes(m))) return true;
    if (/\b(midi|karaoke)\b|\bfax\s?:/.test(l)) return true;
    if (/^\p{Lu}\p{Ll}+_\p{Lu}\p{Ll}+$/u.test(t.trim())) return true;
    if (/[a-z0-9]{2,}\.(com|net|org|co\.yu|rs|hr|ba|de|si|me)\b/.test(l)) return true;
    const tr = t.trim();
    if (tr.length >= 8 && countRe(tr, /_/g) >= 2) return true;
    if (/^\+\s?\d/.test(tr)) return true;
    return countRe(l, /\p{Nd}/gu) >= 7;
  }
  // The words of the song without its credit blocks.
  function withoutCredits(evs, cp) {
    const n = evs.length;
    const texts = evs.map(e => decodeText(e.data, cp));
    const keep = new Array(n).fill(true);
    let i = 0;
    while (i < n && isBlankText(texts[i])) keep[i++] = false;
    const junk = t => isBlankText(t) || isNumberBit(t) || looksLikeCredit(t);
    let j = 0;
    while (j < n) {
      if (junk(texts[j])) {
        let k = j, credit = false;
        while (k < n && junk(texts[k])) { if (looksLikeCredit(texts[k])) credit = true; k++; }
        if (credit) for (let m = j; m < k; m++) keep[m] = false;
        j = k;
      } else j++;
    }
    return evs.filter((e, idx) => keep[idx]);
  }

  const hasKaraoke = s => withoutCredits(lyricEvents(s), 0).filter(e => hasLetters(e.data)).length >= 3;

  // How the sung words of several songs go into one merged file:
  // - all of them, with the karaoke header lines (@KMIDI, @T, ...), on one track: the words track of the first
  //   karaoke song (clip, track), because many players read the words from a single track;
  // - Text-style words become Lyric events when the result has any Lyric event, because then players (and
  //   lyricEvents) ignore Text events and that song's words would disappear;
  // - with breaks, every karaoke song after the first starts a new paragraph (on its first line, and on its
  //   first sung line when credits come before it, so the break stays when credits are hidden).
  // The text with a paragraph break in front: '\' in .kar style ('/' and '\' mark lines), else two CRs.
  function newParagraph(d, kar) {
    if (d[0] === 0x5C) return d;
    let i = 0;
    if (kar) { if (d[0] === 0x2F) i = 1; }
    else while (i < d.length && (d[i] === 0x0D || d[i] === 0x0A)) i++;
    const head = kar ? [0x5C] : [0x0D, 0x0D];
    const r = new Uint8Array(head.length + d.length - i);
    r.set(head); r.set(d.subarray(i), head.length);
    return r;
  }
  function karaokePlan(clips, breaks) {
    const words = clips.map(c => hasKaraoke(c) ? new Set(lyricEvents(c)) : null);
    const toLyric = clips.some(c => c.tracks.some(t => t.some(e => ev.isMeta(e) && e.meta === 0x05 && e.data && e.data.length > 0)));
    const clip = words.findIndex(w => w !== null);
    const first = clip >= 0 ? lyricEvents(clips[clip])[0] : null;
    const track = clip >= 0 ? clips[clip].tracks.findIndex(t => t.includes(first)) : -1;
    const starts = words.map((w, k) => {
      if (!breaks || w === null || k <= clip) return null;
      const evs = lyricEvents(clips[k]);
      return { at: new Set([evs[0], withoutCredits(evs, 0)[0]]), kar: evs.some(e => e.data[0] === 0x5C || e.data[0] === 0x2F) };
    });
    return {
      clip, track,
      onWordsTrack: (k, e) => words[k] !== null && (words[k].has(e) || isKarHeader(e)),
      convert: (k, e, c) => {
        if (words[k] === null || !words[k].has(e)) return;
        if (toLyric && c.meta === 0x01) c.meta = 0x05;
        if (starts[k] && starts[k].at.has(e)) c.data = newParagraph(c.data, starts[k].kar);
      },
    };
  }

  // The words as plain text plus, for every syllable, where it sits in that text and when it is sung.
  function lyricsWithSpans(s, cp, hideCredits) {
    const spans = [];
    let sb = '';
    let src = lyricEvents(s);
    if (hideCredits) src = withoutCredits(src, cp);
    for (const e of src) {
      let t = decodeText(e.data, cp).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      if (t.startsWith('\\')) { if (sb.length) sb += '\n\n'; t = t.substring(1); }
      else if (t.startsWith('/')) { if (sb.length) sb += '\n'; t = t.substring(1); }
      spans.push({ tick: e.tick, start: sb.length, length: t.length });
      sb += t;
    }
    return { text: sb, spans };
  }

  function extractLyrics(s, cp, hideCredits) {
    let src = lyricEvents(s);
    if (hideCredits) src = withoutCredits(src, cp);
    let sb = '';
    for (const e of src) {
      let t = decodeText(e.data, cp).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      if (t.startsWith('\\')) { sb += '\n\n'; t = t.substring(1); }
      else if (t.startsWith('/')) { sb += '\n'; t = t.substring(1); }
      sb += t;
    }
    return sb.replace(/^[\n ]+|[\n ]+$/g, '');
  }

  global.Midi = {
    ev, TempoMap, MidiError, load, save, orderForPlayback, durationSeconds, trim, concatenate, overlay,
    programsUsed, changeInstruments, scaleVelocity, measureLoudness, firstBpm, guessKey, transpose, changeSpeed,
    findNoteSpan, decodeText, encodeText, lyricEvents, withLyrics, withoutCredits, hasKaraoke, lyricsWithSpans, extractLyrics,
  };
})(window);
