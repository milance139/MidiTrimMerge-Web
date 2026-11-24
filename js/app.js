// MIDI Trim & Merge - web version. Port of MainForm.cs / .Player / .Undo / .Safety / .Advanced.
(function () {
  'use strict';
  const { el, openWin, msgBox, askYesNo } = UI;
  const $ = id => document.getElementById(id);
  const T = (...a) => L.t(...a);

  // ---------- settings (kept in this browser) ----------
  const Levels = [0.85, 1, 1.15, 1.3, 1.5, 1.75, 2];
  const SKEY = 'MidiTrimMerge.settings';
  const st = {
    lang: /^(sr|hr|bs)/i.test(navigator.language || '') ? 1 : 0,
    level: 1, saveCount: 0, remember: true, restore: true, hideCredits: true,
    mode: 0, overlap: 0, fade: true, device: null,
  };
  try { Object.assign(st, JSON.parse(localStorage.getItem(SKEY) || '{}')); } catch (e) { }
  function saveSettings() {
    const o = { lang: st.lang, level: st.level, saveCount: st.saveCount, remember: st.remember, restore: st.restore, hideCredits: st.hideCredits };
    if (st.remember) Object.assign(o, { mode: mode(), overlap: overlapVal(), fade: chkFade.checked, device: st.device });
    try { localStorage.setItem(SKEY, JSON.stringify(o)); } catch (e) { }
  }
  L.lang = st.lang;

  // ---------- elements ----------
  const body = $('songBody'), cmbMode = $('cmbMode'), overlapIn = $('overlap'), chkFade = $('chkFade');
  const startMin = $('startMin'), startSec = $('startSec'), endMin = $('endMin'), endSec = $('endSec');
  const seek = $('seek'), lblPos = $('lblPos');
  const btn = id => $(id);

  // ---------- data ----------
  let clips = [];
  let sel = -1;
  let dataVersion = 0;
  const mode = () => +cmbMode.value;
  const overlapVal = () => { const v = parseFloat(overlapIn.value); return isNaN(v) ? 0 : Math.max(0, Math.min(60, Math.round(v * 10) / 10)); };

  const source = c => c.edited || c.seq;
  const effEnd = c => (c.end > 0 && c.end < c.duration ? c.end : c.duration);
  const isTrimmed = c => c.start > 0 || (c.end > 0 && c.end < c.duration);
  const selected = () => (sel >= 0 && sel < clips.length ? clips[sel] : null);

  function makeClip(name, bytes) {
    const seq = Midi.load(bytes);
    const c = {
      name, bytes, seq, karaoke: Midi.hasKaraoke(seq), duration: Midi.durationSeconds(seq), bpm: Midi.firstBpm(seq),
      volume: 100, programs: null, keyPc: 0, keyMinor: false, keyKnown: false, keyEst: false,
      edited: null, lyricTexts: null, lyricEnc: 0, transpose: 0, speed: 100, overlapAfter: -1, start: 0, end: 0,
    };
    const k = Midi.guessKey(seq);
    if (k) { c.keyKnown = true; c.keyPc = k.tonic; c.keyMinor = k.minor; c.keyEst = k.estimated; }
    return c;
  }

  // The song as it will be used: trimmed, new instruments, volume, transposed, speed changed.
  function prepare(c) {
    let s = Midi.trim(source(c), c.start, c.end);
    if (c.programs && Object.keys(c.programs).length) s = Midi.changeInstruments(s, c.programs);
    if (c.volume !== 100) s = Midi.scaleVelocity(s, c.volume / 100);
    if (c.transpose !== 0) s = Midi.transpose(s, c.transpose);
    if (c.speed !== 100) s = Midi.changeSpeed(s, c.speed / 100);
    return s;
  }
  const overlaps = () => { const g = overlapVal(), r = []; for (let i = 0; i + 1 < clips.length; i++) r.push(clips[i].overlapAfter >= 0 ? clips[i].overlapAfter : g); return r; };
  function buildMerged() {
    const prepared = clips.map(prepare);
    if (prepared.length === 1) return prepared[0];
    return mode() === 0 ? Midi.concatenate(prepared, overlaps(), chkFade.checked) : Midi.overlay(prepared);
  }

  // ---------- formatting ----------
  function fmt(sec) { if (sec < 0) sec = 0; const m = Math.floor(sec / 60); return m + ':' + (sec - m * 60).toFixed(2).padStart(5, '0'); }
  function fmtT(sec) { if (sec < 0) sec = 0; const t = Math.floor(sec); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); }
  const PcNames = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
  function usedText(c) {
    const s = isTrimmed(c) ? fmt(c.start) + ' - ' + fmt(effEnd(c)) : T('whole');
    const extra = [];
    if (c.transpose !== 0) extra.push((c.transpose > 0 ? '+' : '') + c.transpose);
    if (c.speed !== 100) extra.push(c.speed + '%');
    if (c.volume !== 100) extra.push('vol ' + c.volume + '%');
    if (c.programs && Object.keys(c.programs).length) extra.push('instr.');
    return extra.length ? s + ' (' + extra.join(', ') + ')' : s;
  }
  const karText = c => (c.karaoke ? (c.edited ? '♫*' : '♫') : '–');
  const bpmText = c => String(Math.round(c.bpm * c.speed / 100));
  function keyText(c) {
    if (!c.keyKnown) return '–';
    const pc = (((c.keyPc + c.transpose) % 12) + 12) % 12;
    return PcNames[pc] + (c.keyMinor ? 'm' : '') + (c.keyEst ? '?' : '');
  }
  function localize(e) {
    if (e && e.code === 'smpte') return T('errSmpte');
    if (e && e.code === 'notMidi') return T('errNotMidi');
    if (e && e.code === 'startBeyond') return T('startBeyond');
    if (e && e.code === 'endBefore') return T('endBefore');
    return (e && e.message) || String(e);
  }
  const setStatus = s => { $('status').textContent = s; $('status').title = s; };

  // ---------- time boxes ----------
  function getTime(mi, se) { return (Math.max(0, parseFloat(mi.value) || 0)) * 60 + Math.max(0, parseFloat(se.value) || 0); }
  function setTime(mi, se, total) {
    if (total < 0) total = 0;
    let m = Math.floor(total / 60), s = Math.round((total - m * 60) * 100) / 100;
    if (s >= 60) { m++; s = 0; }
    mi.value = Math.min(m, 999);
    se.value = Math.min(s, 59.99).toFixed(2);
  }
  for (const s of [startSec, endSec]) s.addEventListener('change', () => { const v = parseFloat(s.value); s.value = (isNaN(v) ? 0 : Math.max(0, Math.min(59.99, v))).toFixed(2); });
  for (const m of [startMin, endMin]) m.addEventListener('change', () => { const v = parseInt(m.value, 10); m.value = isNaN(v) ? 0 : Math.max(0, Math.min(999, v)); });

  // ---------- list ----------
  function refresh(select) {
    dataVersion++;
    requestAutosave();
    body.textContent = '';
    clips.forEach((c, i) => {
      const tr = el('tr', { draggable: true },
        el('td.c-num', null, i + 1), el('td.c-file', { title: c.name }, c.name), el('td.c-len', null, fmt(c.duration)),
        el('td.c-used', null, usedText(c)), el('td.c-kar', null, karText(c)), el('td.c-bpm', null, bpmText(c)), el('td.c-key', null, keyText(c)));
      tr.dataset.i = i;
      body.append(tr);
    });
    $('emptyHint').textContent = clips.length ? '' : T('statusHelp');
    sel = select != null && select >= 0 && select < clips.length ? select : -1;
    markSelection();
    onSelect();
    updateTotal();
    updatePlayButtons();
    syncAdvanced();
  }
  function markSelection() {
    Array.from(body.rows).forEach((r, i) => r.classList.toggle('sel', i === sel));
    const r = body.rows[sel]; if (r) r.scrollIntoView({ block: 'nearest' });
  }
  function selectRow(i) {
    if (i === sel) return;
    sel = i;
    markSelection();
    onSelect(); updatePlayButtons(); syncAdvanced();
  }
  function rowCells(c) {
    const i = clips.indexOf(c), r = body.rows[i];
    if (!r) return;
    r.cells[3].textContent = usedText(c); r.cells[4].textContent = karText(c);
    r.cells[5].textContent = bpmText(c); r.cells[6].textContent = keyText(c);
  }

  function setTrimEnabled(on) {
    for (const x of [startMin, startSec, endMin, endSec, btn('btnApply'), btn('btnReset'), btn('btnSaveOne')]) x.disabled = !on;
  }
  function onSelect() {
    const c = selected();
    setTrimEnabled(!!c);
    btn('btnRemove').disabled = !c;
    btn('btnUp').disabled = !c || sel === 0;
    btn('btnDown').disabled = !c || sel === clips.length - 1;
    if (!c) {
      $('info').textContent = clips.length === 0 ? T('hintEmpty') : T('hintSelect');
      setTime(startMin, startSec, 0); setTime(endMin, endSec, 0);
      return;
    }
    const notes = c.seq.tracks.reduce((a, t) => a + t.filter(Midi.ev.isNoteOn).length, 0);
    $('info').textContent = c.name + '\n' + T('infoLen') + ': ' + fmt(c.duration) + '\n' + T('infoTracks') + ': ' + c.seq.tracks.length + '   ' + T('infoNotes') + ': ' + notes;
    setTime(startMin, startSec, c.start);
    setTime(endMin, endSec, effEnd(c));
  }

  function updateTotal() {
    let v;
    try { v = clips.length === 0 ? fmt(0) : (getSeq(2, false), fmt(cacheTotal[2])); } catch (e) { v = '-'; }
    $('totalLabel').textContent = T('total') + '\n' + v;
  }

  // ---------- actions ----------
  async function addFiles(files) {
    const errors = [];
    let added = 0;
    const list = Array.from(files).filter(f => !/\.mtm$/i.test(f.name));
    if (!list.length) return;
    pushUndo('add');
    for (const f of list) {
      try { clips.push(makeClip(f.name, new Uint8Array(await f.arrayBuffer()))); added++; }
      catch (e) { errors.push(f.name + ': ' + localize(e)); }
    }
    refresh(clips.length - 1);
    setStatus(T('added', added, clips.length));
    if (errors.length) msgBox(errors.join('\n'), T('loadFail'));
  }
  function removeSelected() {
    if (sel < 0) return;
    pushUndo('remove');
    const i = sel;
    clips.splice(i, 1);
    refresh(Math.min(i, clips.length - 1));
  }
  function moveClip(from, insertAt) {
    if (from < 0 || from >= clips.length) return;
    insertAt = Math.max(0, Math.min(clips.length, insertAt));
    if (from < insertAt) insertAt--;
    if (insertAt === from) return;
    pushUndo('move');
    const c = clips.splice(from, 1)[0];
    clips.splice(insertAt, 0, c);
    refresh(insertAt);
  }
  function moveItem(dir) {
    const i = sel, j = i + dir;
    if (i < 0 || j < 0 || j >= clips.length) return;
    pushUndo('move');
    [clips[i], clips[j]] = [clips[j], clips[i]];
    refresh(j);
  }
  function applyTrim() {
    const c = selected();
    if (!c) return false;
    const s = getTime(startMin, startSec);
    let e = getTime(endMin, endSec);
    if (e >= c.duration - 0.005) e = 0;
    if (s >= c.duration) { msgBox(T('startBeyond'), T('badTimeT')); return false; }
    if (e > 0 && e <= s) { msgBox(T('endBefore'), T('badTimeT')); return false; }
    if (Math.abs(c.start - s) > 0.005 || Math.abs(c.end - e) > 0.005) pushUndo('trim');
    c.start = s; c.end = e;
    refresh(sel);
    setStatus(T('trimSet', c.name));
    return true;
  }
  function resetTrim() {
    const c = selected(); if (!c) return;
    pushUndo('trim');
    c.start = 0; c.end = 0;
    refresh(sel);
  }

  // Saves bytes: a real "Save as" dialog where the browser has one, otherwise a download. Returns the name or null.
  async function saveFile(data, name, mime, desc, ext) {
    const blob = new Blob([data], { type: mime });
    if (window.showSaveFilePicker) {
      try {
        const h = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: desc, accept: { [mime]: [ext] } }] });
        const w = await h.createWritable();
        await w.write(blob); await w.close();
        return h.name;
      } catch (e) {
        if (e && e.name === 'AbortError') return null;
        if (!(e && (e.name === 'SecurityError' || e.name === 'NotAllowedError'))) throw e;
      }
    }
    const a = el('a', { href: URL.createObjectURL(blob), download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    return name;
  }
  const saveMidi = (bytes, name) => saveFile(bytes, name, 'audio/midi', 'MIDI file', '.mid');
  const baseName = n => n.replace(/\.[^.]*$/, '');

  async function saveSelected() {
    const c = selected();
    if (!c || !applyTrim()) return;
    try {
      const bytes = Midi.save(prepare(c));
      const name = await saveMidi(bytes, baseName(c.name) + '_trimmed.mid');
      if (name) setStatus(T('saved', name));
    } catch (e) { msgBox(localize(e), T('saveFail')); }
  }

  async function mergeAll() {
    if (clips.length < 2) { msgBox(T('need2'), T('title')); return; }
    let bytes, merged;
    try { merged = buildMerged(); bytes = Midi.save(merged); }
    catch (e) { msgBox(localize(e), T('mergeFail')); return; }
    try {
      const name = await saveMidi(bytes, 'merged.mid');
      if (!name) return;
      setStatus(T('merged', clips.length, name, fmt(Midi.durationSeconds(merged))));
      st.saveCount++;
      saveSettings();
      showSaveNotice();
    } catch (e) { msgBox(localize(e), T('mergeFail')); }
  }

  // ---------- undo / redo ----------
  let undoStack = [], redoStack = [], lastUndoKind = null, lastUndoTime = 0, undoSuppress = 0;
  const takeSnapshot = () => ({ clips: clips.map(c => Object.assign({}, c)), mode: mode(), overlap: overlapVal(), fade: chkFade.checked, sel });
  function pushUndo(kind) {
    dataVersion++;
    requestAutosave();
    if (undoSuppress > 0) return;
    const key = kind + '#' + sel, now = Date.now();
    if (key === lastUndoKind && undoStack.length && now - lastUndoTime < 1500) { lastUndoTime = now; return; }
    lastUndoKind = key; lastUndoTime = now;
    undoStack.push(takeSnapshot());
    if (undoStack.length > 100) undoStack.shift();
    redoStack = [];
    updateUndoButtons();
  }
  function clearUndo() { undoStack = []; redoStack = []; lastUndoKind = null; updateUndoButtons(); }
  function updateUndoButtons() { btn('btnUndo').disabled = !undoStack.length; btn('btnRedo').disabled = !redoStack.length; }
  function restoreSnapshot(s) {
    undoSuppress++;
    try {
      clips = s.clips.map(c => Object.assign({}, c));
      cmbMode.value = s.mode; overlapIn.value = s.overlap; chkFade.checked = s.fade;
      applyModeEnabled();
      refresh(Math.min(s.sel, clips.length - 1));
    } finally { undoSuppress--; }
    lastUndoKind = null;
    updateUndoButtons();
  }
  function undo() { if (!undoStack.length) return; const t = undoStack.pop(); redoStack.push(takeSnapshot()); restoreSnapshot(t); }
  function redo() { if (!redoStack.length) return; const t = redoStack.pop(); undoStack.push(takeSnapshot()); restoreSnapshot(t); }

  // ---------- player ----------
  const player = new MidiPlayer.Player();
  let playingWhich = 0, curWhich = 1, seekPos = 0, seeking = false, lastSeekSel = -2, playSeq = null, playTotal = 0, seekTimer = null;
  const cacheSeq = [], cacheKey = [], cacheTotal = [];

  function getSeq(which, doApplyTrim) {
    if (which === 1) {
      if (!selected()) return null;
      if (doApplyTrim && !applyTrim()) return null;
    } else if (clips.length === 0) return null;
    const key = dataVersion + ':' + sel;
    if (cacheSeq[which] && cacheKey[which] === key) return cacheSeq[which];
    const seq = which === 1 ? prepare(selected()) : buildMerged();
    cacheSeq[which] = seq; cacheKey[which] = key; cacheTotal[which] = Midi.durationSeconds(seq);
    return seq;
  }

  function updatePlayButtons() {
    const playing = player.isPlaying;
    const bp = btn('btnPlay'), ba = btn('btnPlayAll');
    bp.textContent = playing && playingWhich === 1 ? '■ ' + T('stop') : '▶ ' + T('play');
    ba.textContent = playing && playingWhich === 2 ? '■ ' + T('stop') : '▶ ' + T('playAll');
    bp.classList.toggle('on', playing && playingWhich === 1);
    ba.classList.toggle('on', playing && playingWhich === 2);
    bp.disabled = !selected() || (playing && playingWhich !== 1);
    ba.disabled = clips.length === 0 || (playing && playingWhich !== 2);
    updateSeekUi();
  }

  async function playClicked(which) {
    if (player.isPlaying) {
      seekPos = Math.min(player.position, playTotal);
      player.stop(true);
      stopSeekTimer();
      updatePlayButtons();
      setStatus(T('statusHelp'));
      return;
    }
    let seq;
    try {
      seq = getSeq(which, true);
      if (!seq) return;
    } catch (e) { msgBox(T('playFail', localize(e)), T('title')); return; }
    const total = cacheTotal[which];
    if (which !== curWhich) seekPos = 0;
    curWhich = which;
    lastSeekSel = sel;
    if (seekPos >= total - 0.2) seekPos = 0;
    playSeq = seq; playTotal = total; playingWhich = which;
    const p = player.start(seq, seekPos, st.device);
    startSeekTimer();
    updatePlayButtons();
    setStatus(T('playing'));
    try { await p; }
    catch (e) {
      stopSeekTimer(); updatePlayButtons(); setStatus(T('statusHelp'));
      msgBox(T('playFail', localize(e)), T('title'));
    }
  }
  player.onLoading = on => { if (player.isPlaying) setStatus(on ? T('loadingSounds') : T('playing')); };
  player.onFinished = () => {
    if (player.isPlaying) return;
    if (player.position >= playTotal - 0.35) seekPos = 0;
    stopSeekTimer();
    updatePlayButtons();
    setStatus(T('statusHelp'));
  };
  function startSeekTimer() { stopSeekTimer(); seekTimer = setInterval(updateSeekUi, 100); }
  function stopSeekTimer() { if (seekTimer) clearInterval(seekTimer); seekTimer = null; }

  function barTotal() {
    if (player.isPlaying) return playTotal;
    if (curWhich === 1 && !selected()) return 0;
    if (curWhich === 2 && clips.length === 0) return 0;
    try { return getSeq(curWhich, false) ? cacheTotal[curWhich] : 0; } catch (e) { return 0; }
  }
  function showBarPosition() { const t = barTotal(); lblPos.textContent = fmtT(seek.value / 1000 * t) + ' / ' + fmtT(t); }
  async function applySeek() {
    const total = barTotal();
    if (total <= 0) return;
    seekPos = seek.value / 1000 * total;
    if (player.isPlaying) {
      try { await player.start(playSeq, Math.min(seekPos, Math.max(0, playTotal - 0.05)), st.device); }
      catch (e) { msgBox(T('playFail', localize(e)), T('title')); }
    }
    updateSeekUi();
  }
  function updateSeekUi() {
    if (seeking) return;
    const playing = player.isPlaying;
    if (!playing && curWhich === 1 && sel !== lastSeekSel) seekPos = 0;
    lastSeekSel = sel;
    const total = barTotal();
    const pos = playing ? Math.min(player.position, total) : Math.min(seekPos, total);
    seek.disabled = !(total > 0);
    seek.value = total > 0 ? Math.max(0, Math.min(1000, Math.round(pos / total * 1000))) : 0;
    lblPos.textContent = fmtT(pos) + ' / ' + fmtT(total);
    btn('btnSetStart').disabled = btn('btnSetEnd').disabled = !(curWhich === 1 && selected() && total > 0 && (!playing || playingWhich === 1));
  }
  seek.addEventListener('pointerdown', () => { seeking = true; });
  seek.addEventListener('input', () => { if (seeking) showBarPosition(); else applySeek(); });
  seek.addEventListener('change', () => { seeking = false; applySeek(); });
  seek.addEventListener('pointerup', () => { if (seeking) { seeking = false; applySeek(); } });

  function setTrimPoint(isStart) {
    const c = selected();
    if (!c || curWhich !== 1) return;
    const pos = player.isPlaying ? Math.min(player.position, playTotal) : seekPos;
    let orig = c.start + pos * (c.speed / 100);
    orig = Math.max(0, Math.min(c.duration, orig));
    if (isStart) setTime(startMin, startSec, orig); else setTime(endMin, endSec, orig);
    setStatus(T(isStart ? 'startSet' : 'endSet', fmt(orig)));
  }

  // ---------- live lyrics ----------
  let liveWin = null, liveRefresh = null;
  function showLive() {
    if (liveWin) { liveWin.front(); return; }
    const chk = el('input', { type: 'checkbox', checked: st.hideCredits });
    const chkLbl = el('label.chk', { 'data-tip': 'hideCreditsTip' }, chk, T('hideCredits'));
    const text = el('div');
    const w = openWin({ title: T('liveTitle'), body: text, foot: [chkLbl], className: 'live', width: 'min(44rem, 96vw)', height: 'min(36rem, 85vh)',
      onClose: () => { clearInterval(timer); liveWin = null; liveRefresh = null; } });
    liveWin = w;
    let shown = null, spans = null, times = null, nodes = null, lastIdx = -2;
    const timer = setInterval(() => {
      let seq = null;
      try { seq = player.isPlaying ? playSeq : getSeq(curWhich, false); } catch (e) { }
      if (seq !== shown) {
        shown = seq; spans = null; times = null; nodes = null; lastIdx = -2;
        text.textContent = '';
        if (seq) {
          const c = curWhich === 1 ? selected() : null;
          const r = Midi.lyricsWithSpans(seq, c ? c.lyricEnc : 0, st.hideCredits);
          if (r.spans.length) {
            spans = r.spans;
            const tm = new Midi.TempoMap(seq);
            times = spans.map(sp => tm.tickToSec(sp.tick));
            nodes = [];
            let pos = 0;
            spans.forEach(sp => {
              if (sp.start > pos) text.append(r.text.slice(pos, sp.start));
              const s = el('span', null, r.text.substr(sp.start, sp.length));
              nodes.push(s); text.append(s);
              pos = sp.start + sp.length;
            });
            if (pos < r.text.length) text.append(r.text.slice(pos));
          }
        }
        if (!spans) { text.textContent = T('liveNone'); return; }
      }
      if (!spans) return;
      const pos = player.isPlaying ? player.position : seekPos;
      let idx = -1, lo = 0, hi = times.length - 1;
      while (lo <= hi) { const mid = (lo + hi) >> 1; if (times[mid] <= pos) { idx = mid; lo = mid + 1; } else hi = mid - 1; }
      if (idx === lastIdx) return;
      const from = idx > lastIdx && lastIdx >= -1 && idx - lastIdx < 40 ? Math.max(0, lastIdx) : 0;
      if (from === 0) nodes.forEach(n => (n.className = ''));
      for (let i = from; i < idx; i++) nodes[i].className = 'sung';
      if (idx >= 0) { nodes[idx].className = 'now'; nodes[idx].scrollIntoView({ block: 'center', behavior: 'smooth' }); }
      else w.body.scrollTop = 0;
      lastIdx = idx;
    }, 60);
    chk.addEventListener('change', () => { st.hideCredits = chk.checked; saveSettings(); shown = null; });
    liveRefresh = () => { chk.checked = st.hideCredits; shown = null; };
  }

  // ---------- help / debt / notice ----------
  let helpWin = null;
  function showHelp() {
    if (helpWin) { helpWin.front(); return; }
    helpWin = openWin({ title: T('helpTitle'), body: el('pre.helpbox', null, T('helpText')), width: 'min(42rem, 96vw)', height: 'min(34rem, 86vh)',
      foot: [el('button.primary', { onclick: () => helpWin.close() }, T('close'))], onClose: () => { helpWin = null; } });
  }
  function showDebt() {
    const w = openWin({
      title: T('debtTitle'), modal: true, className: 'debt',
      body: el('div', null, el('div', null, T('debtLine')), el('div.amount' + (st.saveCount > 0 ? '.owed' : ''), null, st.saveCount + ' KM'), el('div', null, T('debtNote', st.saveCount))),
      foot: [el('button.primary', { onclick: () => w.close() }, T('close'))],
    });
  }
  function showSaveNotice() {
    const w = openWin({ title: T('title'), modal: true, body: el('div.notice', null, 'Dodješ zetu Milanu ' + st.saveCount + 'KM') });
    setTimeout(() => w.close(), 2000);
  }

  // ---------- advanced settings ----------
  const GmNames = ['Acoustic Grand Piano', 'Bright Acoustic Piano', 'Electric Grand Piano', 'Honky-tonk Piano', 'Electric Piano 1', 'Electric Piano 2', 'Harpsichord', 'Clavinet',
    'Celesta', 'Glockenspiel', 'Music Box', 'Vibraphone', 'Marimba', 'Xylophone', 'Tubular Bells', 'Dulcimer',
    'Drawbar Organ', 'Percussive Organ', 'Rock Organ', 'Church Organ', 'Reed Organ', 'Accordion', 'Harmonica', 'Tango Accordion',
    'Nylon Guitar', 'Steel Guitar', 'Jazz Guitar', 'Clean Guitar', 'Muted Guitar', 'Overdriven Guitar', 'Distortion Guitar', 'Guitar Harmonics',
    'Acoustic Bass', 'Fingered Bass', 'Picked Bass', 'Fretless Bass', 'Slap Bass 1', 'Slap Bass 2', 'Synth Bass 1', 'Synth Bass 2',
    'Violin', 'Viola', 'Cello', 'Contrabass', 'Tremolo Strings', 'Pizzicato Strings', 'Orchestral Harp', 'Timpani',
    'String Ensemble 1', 'String Ensemble 2', 'Synth Strings 1', 'Synth Strings 2', 'Choir Aahs', 'Voice Oohs', 'Synth Voice', 'Orchestra Hit',
    'Trumpet', 'Trombone', 'Tuba', 'Muted Trumpet', 'French Horn', 'Brass Section', 'Synth Brass 1', 'Synth Brass 2',
    'Soprano Sax', 'Alto Sax', 'Tenor Sax', 'Baritone Sax', 'Oboe', 'English Horn', 'Bassoon', 'Clarinet',
    'Piccolo', 'Flute', 'Recorder', 'Pan Flute', 'Blown Bottle', 'Shakuhachi', 'Whistle', 'Ocarina',
    'Square Lead', 'Sawtooth Lead', 'Calliope Lead', 'Chiff Lead', 'Charang Lead', 'Voice Lead', 'Fifths Lead', 'Bass + Lead',
    'New Age Pad', 'Warm Pad', 'Polysynth Pad', 'Choir Pad', 'Bowed Pad', 'Metallic Pad', 'Halo Pad', 'Sweep Pad',
    'Rain FX', 'Soundtrack FX', 'Crystal FX', 'Atmosphere FX', 'Brightness FX', 'Goblins FX', 'Echoes FX', 'Sci-Fi FX',
    'Sitar', 'Banjo', 'Shamisen', 'Koto', 'Kalimba', 'Bag Pipe', 'Fiddle', 'Shanai',
    'Tinkle Bell', 'Agogo', 'Steel Drums', 'Woodblock', 'Taiko Drum', 'Melodic Tom', 'Synth Drum', 'Reverse Cymbal',
    'Guitar Fret Noise', 'Breath Noise', 'Seashore', 'Bird Tweet', 'Telephone Ring', 'Helicopter', 'Applause', 'Gunshot'];

  let adv = null;   // { win, controls... }
  function numInput(min, max, step) { return el('input', { type: 'number', min, max, step }); }
  // A number box that applies its value while typing / clicking the arrows, and clamps when left.
  function bindNum(input, min, max, apply, decimals) {
    const read = () => { const v = parseFloat(input.value); return isNaN(v) ? null : Math.max(min, Math.min(max, decimals ? Math.round(v * 10) / 10 : Math.round(v))); };
    input.addEventListener('input', () => { const v = read(); if (v !== null && !adv.sync) apply(v); });
    input.addEventListener('change', () => { const v = read(); input.value = v === null ? min : v; if (v === null && !adv.sync) apply(min); });
  }

  function showAdvanced() {
    if (adv) { adv.win.front(); return; }
    const a = { sync: false };
    adv = a;
    a.song = el('div.songname');
    a.transpose = numInput(-24, 24, 1); a.speed = numInput(25, 200, 1); a.volume = numInput(10, 300, 5); a.own = numInput(0, 60, 0.5);
    a.chkOwn = el('input', { type: 'checkbox' });
    a.chan = el('select'); a.instr = el('select'); a.device = el('select');
    a.btnResetSong = el('button', { onclick: () => { const c = selected(); if (!c) return; pushUndo('reset'); Object.assign(c, { transpose: 0, speed: 100, volume: 100, overlapAfter: -1, programs: null }); songChanged(c); syncAdvanced(); } });
    a.btnAutoOne = el('button', { onclick: () => autoTrimClicked(false) });
    a.btnAutoAll = el('button', { onclick: () => autoTrimClicked(true) });
    a.btnMatch = el('button', { onclick: matchLoudness });
    a.btnLyrics = el('button', { onclick: showLyrics });
    a.btnPlain = el('button', { onclick: showPlainLyrics });
    a.btnSavePl = el('button', { onclick: savePlaylist });
    a.btnLoadPl = el('button', { onclick: () => $('plInput').click() });
    a.chkRemember = el('input', { type: 'checkbox', checked: st.remember });
    a.chkRestore = el('input', { type: 'checkbox', checked: st.restore });
    a.labels = {};
    const lab = (key, ctl) => (a.labels[key] = el('label', null, T(key)));
    a.ownLbl = el('label.chk.ownlbl', null, a.chkOwn, el('span', null, T('ovOwn')));
    a.ownSec = el('span', null, T('overlapSec'));
    a.grpSong = el('legend'); a.grpAll = el('legend'); a.grpFile = el('legend');
    a.rememberLbl = el('label.chk', null, a.chkRemember, el('span'));
    a.restoreLbl = el('label.chk', null, a.chkRestore, el('span'));

    const content = el('div.adv', null,
      el('fieldset', null, a.grpSong, a.song,
        el('div.arow', null, lab('transpose'), a.transpose),
        el('div.arow', null, lab('speed'), a.speed),
        el('div.arow', null, lab('volume'), a.volume),
        el('div.arow', null, a.ownLbl, a.own, a.ownSec),
        el('div.arow', null, lab('channel'), a.chan),
        el('div.arow', null, lab('instrument'), a.instr),
        el('div.arow', null, a.btnAutoOne, a.btnLyrics, a.btnPlain),
        el('div.arow', null, a.btnResetSong)),
      el('fieldset', null, a.grpAll, el('div.arow', null, a.btnAutoAll, a.btnMatch)),
      el('fieldset', null, a.grpFile,
        el('div.arow', null, a.btnSavePl, a.btnLoadPl),
        el('div.arow', null, lab('device'), a.device),
        el('div.stack', null, a.rememberLbl, a.restoreLbl)));
    a.btnClose = el('button.primary', { onclick: () => a.win.close() });
    a.win = openWin({ title: T('advTitle'), body: content, foot: [a.btnClose], width: 'min(38rem, 96vw)', onClose: () => { adv = null; } });
    a.win.el.style.left = Math.max(8, innerWidth - a.win.el.offsetWidth - 16) + 'px';
    a.win.el.style.top = '12px';

    bindNum(a.transpose, -24, 24, v => { const c = selected(); if (!c) return; pushUndo('transpose'); c.transpose = v; songChanged(c); });
    bindNum(a.speed, 25, 200, v => { const c = selected(); if (!c) return; pushUndo('speed'); c.speed = v; songChanged(c); });
    bindNum(a.volume, 10, 300, v => { const c = selected(); if (!c) return; pushUndo('volume'); c.volume = v; songChanged(c); });
    bindNum(a.own, 0, 60, v => { const c = selected(); if (!c || !a.chkOwn.checked) return; pushUndo('own'); c.overlapAfter = v; songChanged(c); }, true);
    a.chkOwn.addEventListener('change', () => {
      a.own.disabled = !(a.chkOwn.checked && selected());
      const c = selected(); if (!c) return;
      pushUndo('own');
      c.overlapAfter = a.chkOwn.checked ? (parseFloat(a.own.value) || 0) : -1;
      songChanged(c);
    });
    a.chan.addEventListener('change', showChannelInstrument);
    a.instr.addEventListener('change', instrumentPicked);
    a.device.addEventListener('change', deviceChanged);
    a.chkRemember.addEventListener('change', () => { st.remember = a.chkRemember.checked; saveSettings(); });
    a.chkRestore.addEventListener('change', () => { st.restore = a.chkRestore.checked; saveSettings(); if (st.restore) requestAutosave(); else autosaveNow(); });

    fillAdvanced();
    fillDevices();
  }

  function fillAdvanced() {
    const a = adv; if (!a) return;
    a.win.setTitle(T('advTitle'));
    a.grpSong.textContent = T('grpSong'); a.grpAll.textContent = T('grpAll'); a.grpFile.textContent = T('grpFile');
    for (const k of Object.keys(a.labels)) a.labels[k].textContent = T(k);
    a.ownLbl.lastChild.textContent = T('ovOwn'); a.ownSec.textContent = T('overlapSec');
    a.btnResetSong.textContent = T('resetSong'); a.btnAutoOne.textContent = T('autoOne'); a.btnAutoAll.textContent = T('autoAll');
    a.btnMatch.textContent = T('matchLoud'); a.btnLyrics.textContent = T('lyricsBtn'); a.btnPlain.textContent = T('lyricsPlain');
    a.btnSavePl.textContent = T('savePl'); a.btnLoadPl.textContent = T('loadPl');
    a.rememberLbl.lastChild.textContent = T('remember'); a.restoreLbl.lastChild.textContent = T('restoreOpt');
    a.btnClose.textContent = T('close');
    a.instr.textContent = '';
    a.instr.append(el('option', { value: -1 }, T('instrOrig')), ...GmNames.map((n, i) => el('option', { value: i }, (i + 1) + ' ' + n)));
    syncAdvanced();
  }

  // Output devices: built-in synth, plus Web MIDI outputs once the browser allows access.
  async function fillDevices(ask) {
    const a = adv; if (!a) return;
    let names = [];
    let granted = false;
    if (MidiPlayer.hasWebMidi()) {
      try { const p = await navigator.permissions.query({ name: 'midi' }); granted = p.state === 'granted'; } catch (e) { }
      if (granted || ask || st.device) names = await MidiPlayer.getDevices();
    }
    if (!adv) return;
    a.device.textContent = '';
    a.device.append(el('option', { value: '' }, T('devDefault')));
    for (const n of names) a.device.append(el('option', { value: 'dev:' + n }, n));
    if (!MidiPlayer.hasWebMidi()) a.device.append(el('option', { value: 'none', disabled: true }, T('devNoMidi')));
    else if (!names.length) a.device.append(el('option', { value: 'search' }, L.lang ? 'Potraži MIDI uređaje...' : 'Search for MIDI devices...'));
    a.device.value = st.device && names.includes(st.device) ? 'dev:' + st.device : '';
  }
  function deviceChanged() {
    const v = adv.device.value;
    if (v === 'search') { adv.device.value = ''; fillDevices(true); return; }
    st.device = v.startsWith('dev:') ? v.slice(4) : null;
    saveSettings();
  }

  function syncAdvanced() {
    const a = adv; if (!a) return;
    a.sync = true;
    try {
      const c = selected(), has = !!c;
      a.song.textContent = has ? T('advSong') + '\n' + c.name : T('advNone');
      for (const x of [a.transpose, a.speed, a.volume, a.chkOwn, a.btnResetSong, a.btnAutoOne, a.btnLyrics, a.btnPlain]) x.disabled = !has;
      a.transpose.value = has ? c.transpose : 0;
      a.speed.value = has ? c.speed : 100;
      a.volume.value = has ? c.volume : 100;
      const own = has && c.overlapAfter >= 0;
      a.chkOwn.checked = own;
      a.own.value = own ? Math.min(60, Math.round(c.overlapAfter * 10) / 10) : overlapVal();
      a.own.disabled = !own;
      a.btnAutoAll.disabled = a.btnSavePl.disabled = a.btnMatch.disabled = clips.length === 0;
      fillChannels();
    } finally { a.sync = false; }
  }
  function fillChannels() {
    const a = adv, c = selected();
    const keep = a.chan.selectedIndex;
    a.chan.textContent = '';
    a.channels = [];
    if (c) for (const [ch, prog] of Midi.programsUsed(c.seq)) {
      let name = GmNames[Math.max(0, Math.min(127, prog))];
      if (c.programs && ch in c.programs) name += '  →  ' + GmNames[c.programs[ch]];
      a.chan.append(el('option', null, (ch + 1) + ': ' + name));
      a.channels.push(ch);
    }
    if (a.channels.length) a.chan.selectedIndex = keep >= 0 && keep < a.channels.length ? keep : 0;
    a.chan.disabled = a.instr.disabled = a.channels.length === 0;
    showChannelInstrument();
  }
  function showChannelInstrument() {
    const a = adv, c = selected(), i = a.chan.selectedIndex;
    if (!c || i < 0 || i >= a.channels.length) { a.instr.value = -1; return; }
    const ch = a.channels[i];
    a.instr.value = c.programs && ch in c.programs ? c.programs[ch] : -1;
  }
  function instrumentPicked() {
    const a = adv, c = selected(), i = a.chan.selectedIndex;
    if (a.sync || !c || i < 0 || i >= a.channels.length) return;
    pushUndo('instrument');
    const d = Object.assign({}, c.programs || {});
    const prog = +a.instr.value;
    if (prog < 0) delete d[a.channels[i]]; else d[a.channels[i]] = prog;
    c.programs = Object.keys(d).length ? d : null;
    songChanged(c);
    a.sync = true; fillChannels(); a.sync = false;
  }
  function songChanged(c) { rowCells(c); updateTotal(); updateSeekUi(); }

  function matchLoudness() {
    if (!clips.length) return;
    const loud = clips.map(c => { try { return Midi.measureLoudness(Midi.trim(source(c), c.start, c.end)); } catch (e) { return 0; } });
    const ok = loud.filter(x => x > 0);
    if (!ok.length) return;
    const target = ok.reduce((x, y) => x + y, 0) / ok.length;
    pushUndo('loudness');
    let changed = 0;
    clips.forEach((c, i) => {
      if (loud[i] <= 0) return;
      const v = Math.max(10, Math.min(300, Math.round(target / loud[i] * 100 / 5) * 5));
      if (v !== c.volume) changed++;
      c.volume = v;
    });
    refresh(sel);
    setStatus(T('loudDone', changed));
  }

  function autoTrim(c) {
    const span = Midi.findNoteSpan(c.seq);
    if (!span) return false;
    let s = Math.max(0, span.first - 0.05);
    if (s < 0.1) s = 0;
    const e = span.last + 0.2;
    c.start = s;
    c.end = e >= c.duration - 0.005 ? 0 : e;
    return true;
  }
  function autoTrimClicked(all) {
    let changed = 0;
    pushUndo('autotrim');
    if (all) { for (const c of clips) if (autoTrim(c)) changed++; }
    else if (sel >= 0 && autoTrim(clips[sel])) changed = 1;
    refresh(sel);
    setStatus(T('autoDone', changed));
  }

  // ---------- karaoke text ----------
  function showLyrics() {
    const c = selected();
    if (!c) return;
    const evs = Midi.lyricEvents(c.seq);
    if (!evs.length) { msgBox(T('noLyrics'), T('title')); return; }
    const tm = new Midi.TempoMap(c.seq);
    const codes = [0, 1250, 1251, 65001, 1252];
    const encNames = [T('lyEncAuto'), 'Windows-1250 (Latin: č ć š ž đ)', 'Windows-1251 (Cyrillic: ћ ч ш ж ђ)', 'UTF-8', 'Windows-1252 (Western)'];
    const cmbEnc = el('select', null, encNames.map((n, i) => el('option', { value: i }, n)));
    cmbEnc.value = Math.max(0, codes.indexOf(c.lyricEnc));
    const txtFind = el('input', { type: 'text' }), txtRepl = el('input', { type: 'text' });
    const inputs = evs.map(() => el('input', { type: 'text', spellcheck: false }));
    const table = el('table', null,
      el('thead', null, el('tr', null, el('th', null, T('lyTime')), el('th', null, T('lyText')))),
      el('tbody', null, evs.map((e, i) => el('tr', null, el('td.t', null, fmt(tm.tickToSec(e.tick))), el('td', null, inputs[i])))));
    const load = useEdits => {
      const cp = codes[+cmbEnc.value];
      evs.forEach((e, i) => {
        const t = useEdits && c.lyricTexts && i < c.lyricTexts.length ? c.lyricTexts[i] : null;
        inputs[i].value = t != null ? t : Midi.decodeText(e.data, cp);
      });
    };
    load(true);
    let lastEnc = cmbEnc.value;
    cmbEnc.addEventListener('change', async () => {
      if (cmbEnc.value === lastEnc) return;
      if (!(await askYesNo(T('lyEncWarn'), T('title')))) { cmbEnc.value = lastEnc; return; }
      lastEnc = cmbEnc.value;
      load(false);
    });
    const btnRepl = el('button', { onclick: () => {
      if (!txtFind.value) return;
      let n = 0;
      for (const inp of inputs) if (inp.value.includes(txtFind.value)) { inp.value = inp.value.split(txtFind.value).join(txtRepl.value); n++; }
      setStatus(T('lyReplDone', n));
    } }, T('lyReplAll'));
    const content = el('div.lyr', null,
      el('div.tools', null, el('label', null, T('lyEnc')), cmbEnc),
      el('div.tools', null, el('label', null, T('lyFind')), txtFind, el('label', null, T('lyRepl')), txtRepl, btnRepl),
      el('div.hint', null, T('lyHelp')),
      table);
    const bReset = el('button', { onclick: () => {
      pushUndo('lyrics');
      c.edited = null; c.lyricTexts = null; c.lyricEnc = 0;
      cmbEnc.value = 0; lastEnc = '0';
      load(false);
      rowCells(c); updateTotal();
    } }, T('lyReset'));
    const bApply = el('button.primary', { onclick: () => {
      const code = codes[+cmbEnc.value];
      const texts = new Array(evs.length).fill(null);
      let any = false;
      evs.forEach((e, i) => {
        const cell = inputs[i].value;
        if (code === 0 && cell === Midi.decodeText(e.data, 0)) return;
        texts[i] = cell; any = true;
      });
      if (code !== 0 && !any) any = true;
      pushUndo('lyrics');
      c.lyricEnc = code;
      c.lyricTexts = any ? texts : null;
      c.edited = any ? Midi.withLyrics(c.seq, texts, code) : null;
      rowCells(c); updateTotal();
      setStatus(T('lyApplied', c.name));
      w.close();
    } }, T('lyApply'));
    const bCancel = el('button', { onclick: () => w.close() }, T('lyCancel'));
    const w = openWin({ title: T('lyricsTitle', c.name), body: content, foot: [bReset, bApply, bCancel], modal: true, width: 'min(44rem, 96vw)', height: 'min(40rem, 90vh)' });
  }

  function showPlainLyrics() {
    const c = selected();
    if (!c) return;
    const enc = c.lyricEnc;
    const shownText = () => { const t = Midi.extractLyrics(source(c), enc, st.hideCredits); return t.length === 0 && st.hideCredits ? T('onlyCredits') : t; };
    if (Midi.extractLyrics(source(c), enc, false).length === 0) { msgBox(T('noLyrics'), T('title')); return; }
    const box = el('pre.plainbox', null, shownText());
    const chk = el('input', { type: 'checkbox', checked: st.hideCredits });
    chk.addEventListener('change', () => { st.hideCredits = chk.checked; saveSettings(); box.textContent = shownText(); if (liveRefresh) liveRefresh(); });
    const copy = el('button', { onclick: async () => { try { await navigator.clipboard.writeText(box.textContent); } catch (e) { } } }, T('copy'));
    const w = openWin({ title: T('plainTitle', c.name), body: box, modal: true, width: 'min(36rem, 96vw)', height: 'min(34rem, 88vh)',
      foot: [el('label.chk', { 'data-tip': 'hideCreditsTip' }, chk, T('hideCredits')), copy, el('button.primary', { onclick: () => w.close() }, T('close'))] });
  }

  // ---------- playlists ----------
  function b64(bytes) { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); }
  function unb64(s) { const bin = atob(s); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; }

  // The whole list as text (MTM1, the desktop format), with each MIDI file stored after its clip line ("data=").
  function buildPlaylistText() {
    const lines = ['MTM1', 'mode=' + mode(), 'overlap=' + overlapVal(), 'fade=' + (chkFade.checked ? '1' : '0')];
    for (const c of clips) {
      lines.push('clip=' + [
        c.name, String(c.start), String(c.end), String(c.transpose), String(c.speed), String(c.overlapAfter), String(c.lyricEnc),
        c.lyricTexts ? b64(new TextEncoder().encode(c.lyricTexts.map(t => (t == null ? '\u0002' : t)).join('\u0001'))) : '',
        String(c.volume),
        c.programs ? Object.keys(c.programs).map(k => k + ':' + c.programs[k]).join(',') : '',
      ].join('|'));
      lines.push('data=' + b64(c.bytes));
    }
    return lines.join('\r\n') + '\r\n';
  }

  async function savePlaylist() {
    if (!clips.length) return;
    try {
      const name = await saveFile(new TextEncoder().encode(buildPlaylistText()), 'playlist.mtm', 'application/octet-stream', 'Playlist (*.mtm)', '.mtm');
      if (name) setStatus(T('plSaved', name));
    } catch (e) { msgBox(localize(e), T('saveFail')); }
  }

  async function loadPlaylistFiles(files) {
    files = Array.from(files);
    const pl = files.find(f => /\.mtm$/i.test(f.name));
    if (!pl) { msgBox(T('plNone'), T('plFail')); return; }
    let lines;
    try {
      lines = (await pl.text()).replace(/^﻿/, '').split(/\r?\n/);
      if (!lines.length || lines[0].trim() !== 'MTM1') throw new Error(T('plFail'));
    } catch (e) { msgBox(localize(e), T('plFail')); return; }
    if (clips.length && !(await askYesNo(T('plReplace'), T('title')))) return;
    const extra = new Map();
    for (const f of files) if (f !== pl) extra.set(f.name.toLowerCase(), new Uint8Array(await f.arrayBuffer()));
    player.stop();
    pushUndo('playlist');
    const missing = loadPlaylistLines(lines, extra);
    setStatus(T('plLoaded', clips.length));
    if (missing.length) msgBox(T('plMissing') + '\n' + missing.join('\n'), T('loadFail'));
  }

  // Replaces the list with the songs of a playlist text. Returns the files that could not be loaded.
  function loadPlaylistLines(lines, extra) {
    const loaded = [], missing = [];
    let md = -1, fadeOpt = -1, ov = -1;
    const entries = [];
    for (const line of lines.slice(1)) {
      const eq = line.indexOf('=');
      if (eq <= 0) continue;
      const key = line.slice(0, eq), val = line.slice(eq + 1);
      if (key === 'mode') { const m = parseInt(val, 10); if (m === 0 || m === 1) md = m; }
      else if (key === 'overlap') { const o = parseFloat(val); if (!isNaN(o)) ov = Math.max(0, Math.min(60, o)); }
      else if (key === 'fade') fadeOpt = val === '0' ? 0 : 1;
      else if (key === 'clip') entries.push({ p: val.split('|'), data: null });
      else if (key === 'data' && entries.length) entries[entries.length - 1].data = val.trim();
    }
    const current = new Map(clips.map(c => [c.name.toLowerCase(), c.bytes]));
    for (const { p, data } of entries) {
      const name = p[0].split(/[\\/]/).pop();
      try {
        let bytes = null;
        if (data) bytes = unb64(data);
        else bytes = extra.get(name.toLowerCase()) || current.get(name.toLowerCase()) || null;
        if (!bytes) throw new Error(L.lang ? 'fajl nije pronađen' : 'file not found');
        const c = makeClip(name, bytes);
        const num = i => (p.length > i && p[i] !== '' ? Number(p[i]) : NaN);
        let v;
        if (!isNaN(v = num(1)) && v >= 0) c.start = v;
        if (!isNaN(v = num(2)) && v >= 0) c.end = v;
        if (Number.isInteger(v = num(3))) c.transpose = Math.max(-24, Math.min(24, v));
        if (Number.isInteger(v = num(4))) c.speed = Math.max(25, Math.min(200, v));
        if (!isNaN(v = num(5))) c.overlapAfter = v < 0 ? -1 : Math.min(60, v);
        if (c.start >= c.duration) c.start = 0;
        if (p.length > 7 && p[7].length > 0 && Number.isInteger(v = num(6))) {
          try {
            const texts = new TextDecoder().decode(unb64(p[7])).split('\u0001').map(t => (t === '\u0002' ? null : t));
            if (texts.length === Midi.lyricEvents(c.seq).length) {
              c.lyricEnc = v; c.lyricTexts = texts; c.edited = Midi.withLyrics(c.seq, texts, v);
            }
          } catch (e) { /* damaged text entry: keep the original text */ }
        }
        if (Number.isInteger(v = num(8))) c.volume = Math.max(10, Math.min(300, v));
        if (p.length > 9 && p[9]) {
          const prog = {};
          for (const pair of p[9].split(',')) {
            const kv = pair.split(':'), ch = parseInt(kv[0], 10), pr = parseInt(kv[1], 10);
            if (kv.length === 2 && ch >= 0 && ch < 16 && pr >= 0 && pr < 128) prog[ch] = pr;
          }
          if (Object.keys(prog).length) c.programs = prog;
        }
        loaded.push(c);
      } catch (e) { missing.push(name + ': ' + localize(e)); }
    }
    clips = loaded;
    if (md >= 0) cmbMode.value = md;
    if (ov >= 0) overlapIn.value = ov;
    if (fadeOpt >= 0) chkFade.checked = fadeOpt === 1;
    applyModeEnabled();
    dataVersion++;
    seekPos = 0;
    refresh(clips.length ? 0 : -1);
    return missing;
  }

  // ---------- autosave (IndexedDB) and error handling ----------
  let autosaveTimer = null, booting = true;
  function idb() {
    return new Promise((res, rej) => {
      const r = indexedDB.open('MidiTrimMerge', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  async function idbDo(fn) {
    const db = await idb();
    return new Promise((res, rej) => {
      const tx = db.transaction('kv', 'readwrite');
      const req = fn(tx.objectStore('kv'));
      tx.oncomplete = () => { db.close(); res(req && req.result); };
      tx.onerror = () => { db.close(); rej(tx.error); };
    });
  }
  function requestAutosave() {
    if (!st.restore || booting) return;
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(autosaveNow, 2000);
  }
  async function autosaveNow() {
    clearTimeout(autosaveTimer);
    if (booting) return;
    try {
      if (!st.restore || clips.length === 0) await idbDo(s => s.delete('autosave'));
      else await idbDo(s => s.put(buildPlaylistText(), 'autosave'));
    } catch (e) { }
  }
  async function restoreAutosave() {
    if (!st.restore) return;
    try {
      const text = await idbDo(s => s.get('autosave'));
      if (!text) return;
      const lines = text.split(/\r?\n/);
      if (lines[0].trim() !== 'MTM1') return;
      undoSuppress++;
      let missing;
      try { missing = loadPlaylistLines(lines, new Map()); } finally { undoSuppress--; }
      setStatus(T('restored', clips.length));
      if (missing.length) msgBox(missing.join('\n'), T('loadFail'));
    } catch (e) { }
  }

  let crashShown = false;
  function handleCrash(err) {
    try {
      const log = (localStorage.getItem('MidiTrimMerge.log') || '') + new Date().toISOString() + '\n' + ((err && err.stack) || err) + '\n\n';
      localStorage.setItem('MidiTrimMerge.log', log.slice(-20000));
    } catch (e) { }
    try { player.stop(true); stopSeekTimer(); updatePlayButtons(); } catch (e) { }
    autosaveNow();
    if (crashShown) return;
    crashShown = true;
    msgBox(T('crashText', (err && err.message) || String(err)), T('crashTitle')).then(() => { crashShown = false; });
  }
  window.addEventListener('error', e => { if (e.error) handleCrash(e.error); });
  window.addEventListener('unhandledrejection', e => handleCrash(e.reason));
  window.addEventListener('pagehide', () => { autosaveNow(); saveSettings(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { autosaveNow(); saveSettings(); } });

  // ---------- language / text size ----------
  function applyLanguage() {
    document.documentElement.lang = L.lang ? 'sr' : 'en';
    const title = T('title') + ' - Od zeta za Miroslava';
    $('appTitle').textContent = title;
    document.title = T('title');
    document.querySelectorAll('[data-t]').forEach(n => { n.textContent = T(n.dataset.t); });
    cmbMode.options[0].textContent = T('modeSeq');
    cmbMode.options[1].textContent = T('modeLayer');
    if (helpWin) { helpWin.close(); showHelp(); }
    fillAdvanced();
    if (adv) fillDevices();
    refreshKeepUndo();
    setStatus(T('statusHelp'));
  }
  function refreshKeepUndo() { undoSuppress++; try { refresh(sel); } finally { undoSuppress--; } }
  function applyScale() {
    document.documentElement.style.fontSize = (15 * Levels[st.level]) + 'px';
    btn('btnSmaller').disabled = st.level <= 0;
    btn('btnLarger').disabled = st.level >= Levels.length - 1;
  }
  function changeLevel(d) {
    const n = Math.max(0, Math.min(Levels.length - 1, st.level + d));
    if (n === st.level) return;
    st.level = n; saveSettings(); applyScale();
  }
  function applyModeEnabled() { overlapIn.disabled = chkFade.disabled = mode() !== 0; }

  // ---------- wiring ----------
  btn('btnAdd').onclick = () => $('fileInput').click();
  $('fileInput').onchange = e => { addFiles(e.target.files); e.target.value = ''; };
  $('plInput').onchange = e => { loadPlaylistFiles(e.target.files); e.target.value = ''; };
  btn('btnRemove').onclick = removeSelected;
  btn('btnUp').onclick = () => moveItem(-1);
  btn('btnDown').onclick = () => moveItem(1);
  btn('btnUndo').onclick = undo;
  btn('btnRedo').onclick = redo;
  btn('btnApply').onclick = applyTrim;
  btn('btnReset').onclick = resetTrim;
  btn('btnSaveOne').onclick = saveSelected;
  btn('btnMerge').onclick = mergeAll;
  btn('btnPlay').onclick = () => playClicked(1);
  btn('btnPlayAll').onclick = () => playClicked(2);
  btn('btnSetStart').onclick = () => setTrimPoint(true);
  btn('btnSetEnd').onclick = () => setTrimPoint(false);
  btn('btnLive').onclick = showLive;
  btn('btnAdv').onclick = showAdvanced;
  btn('btnHelp').onclick = showHelp;
  btn('btnDebt').onclick = showDebt;
  btn('btnSmaller').onclick = () => changeLevel(-1);
  btn('btnLarger').onclick = () => changeLevel(1);
  $('cmbLang').onchange = e => { st.lang = L.lang = +e.target.value; saveSettings(); applyLanguage(); };
  cmbMode.onchange = () => { pushUndo('global'); applyModeEnabled(); dataVersion++; updateTotal(); saveSettings(); };
  chkFade.onchange = () => { pushUndo('global'); dataVersion++; updateTotal(); saveSettings(); };
  overlapIn.addEventListener('input', () => { pushUndo('global'); dataVersion++; updateTotal(); });
  overlapIn.addEventListener('change', () => { overlapIn.value = overlapVal(); dataVersion++; updateTotal(); saveSettings(); });

  // list: click to select, keyboard, drag to reorder
  body.addEventListener('click', e => { const r = e.target.closest('tr'); if (r) selectRow(+r.dataset.i); });
  body.addEventListener('dblclick', e => { const r = e.target.closest('tr'); if (r) { selectRow(+r.dataset.i); if (!player.isPlaying) playClicked(1); } });
  $('tableWrap').tabIndex = 0;
  $('tableWrap').addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' && clips.length) { e.preventDefault(); selectRow(Math.min(clips.length - 1, sel + 1)); }
    else if (e.key === 'ArrowUp' && clips.length) { e.preventDefault(); selectRow(Math.max(0, sel - 1)); }
    else if (e.key === 'Delete') { e.preventDefault(); removeSelected(); }
  });
  let dragFrom = -1;
  const clearDropMarks = () => body.querySelectorAll('.drop-before,.drop-after').forEach(r => r.classList.remove('drop-before', 'drop-after'));
  function dropTarget(e) {
    const rows = Array.from(body.rows);
    if (!rows.length) return null;
    const r = e.target.closest && e.target.closest('tbody tr');
    if (!r) {
      if (e.clientY < rows[0].getBoundingClientRect().top) return { over: 0, after: false };
      return { over: rows.length - 1, after: true };
    }
    const rect = r.getBoundingClientRect();
    return { over: +r.dataset.i, after: e.clientY > rect.top + rect.height / 2 };
  }
  body.addEventListener('dragstart', e => {
    const r = e.target.closest('tr'); if (!r) return;
    dragFrom = +r.dataset.i;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/x-midi-clip', String(dragFrom));
  });
  $('tableWrap').addEventListener('dragover', e => {
    if (dragFrom < 0) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const t = dropTarget(e);
    clearDropMarks();
    if (t) body.rows[t.over].classList.add(t.after ? 'drop-after' : 'drop-before');
  });
  $('tableWrap').addEventListener('drop', e => {
    if (dragFrom < 0) return;
    e.preventDefault(); e.stopPropagation();
    const t = dropTarget(e);
    clearDropMarks();
    const from = dragFrom; dragFrom = -1;
    if (t) moveClip(from, t.after ? t.over + 1 : t.over);
  });
  body.addEventListener('dragend', () => { dragFrom = -1; clearDropMarks(); });

  // MIDI files dropped from the computer anywhere on the page
  let dragDepth = 0;
  const hasFiles = e => dragFrom < 0 && e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
  window.addEventListener('dragenter', e => { if (hasFiles(e)) { dragDepth++; $('dropOverlay').hidden = false; } });
  window.addEventListener('dragleave', e => { if (hasFiles(e) && --dragDepth <= 0) { dragDepth = 0; $('dropOverlay').hidden = true; } });
  window.addEventListener('dragover', e => { if (hasFiles(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
  window.addEventListener('drop', e => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth = 0; $('dropOverlay').hidden = true;
    const files = Array.from(e.dataTransfer.files);
    if (files.some(f => /\.mtm$/i.test(f.name))) loadPlaylistFiles(files); else addFiles(files);
  });

  // Ctrl+Z / Ctrl+Y (inside a text box they keep working as text undo)
  document.addEventListener('keydown', e => {
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(tag) || !(e.ctrlKey || e.metaKey)) return;
    const k = e.key.toLowerCase();
    if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
  });

  // ---------- start ----------
  $('cmbLang').value = st.lang;
  if (st.remember) {
    cmbMode.value = st.mode === 1 ? 1 : 0;
    overlapIn.value = Math.max(0, Math.min(60, +st.overlap || 0));
    chkFade.checked = st.fade !== false;
  } else st.device = null;
  applyModeEnabled();
  applyScale();
  applyLanguage();
  (async () => {
    await restoreAutosave();
    booting = false;
    clearUndo();
    if (!clips.length) setStatus(T('statusHelp'));
  })();
})();
