// Small UI toolkit: element builder, floating/modal windows, message boxes, tooltips.
(function (global) {
  'use strict';

  // el('button.primary', { onclick }, 'text', child...)
  function el(spec, props, ...kids) {
    const m = spec.match(/^([a-z0-9]+)?((?:[.#][\w-]+)*)$/i);
    const node = document.createElement((m && m[1]) || 'div');
    if (m && m[2]) for (const part of m[2].match(/[.#][\w-]+/g)) {
      if (part[0] === '.') node.classList.add(part.slice(1)); else node.id = part.slice(1);
    }
    if (props) for (const k of Object.keys(props)) {
      const v = props[k];
      if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
      else if (k in node && k !== 'list') node[k] = v;
      else node.setAttribute(k, v);
    }
    for (const k of kids.flat()) if (k != null && k !== false) node.append(k instanceof Node ? k : document.createTextNode(String(k)));
    return node;
  }

  const layer = () => document.getElementById('layer');
  let zTop = 100;
  const openWins = [];

  // opts: { title, body, foot: [nodes], modal, width, height, className, onClose, closeOnEsc }
  function openWin(opts) {
    let backdrop = null;
    if (opts.modal) { backdrop = el('div.backdrop'); layer().append(backdrop); }
    const titleSpan = el('span', null, opts.title || '');
    const btnX = el('button.wclose', { title: L.t('close'), 'aria-label': L.t('close') }, '✕');
    const head = el('div.wtitle', null, titleSpan, btnX);
    const body = el('div.wbody');
    if (opts.body) body.append(opts.body);
    const win = el('div.win' + (opts.className ? '.' + opts.className.split(' ').join('.') : ''), { role: 'dialog' }, head, body);
    let foot = null;
    if (opts.foot) { foot = el('div.wfoot', null, opts.foot); win.append(foot); }
    if (opts.width) win.style.width = opts.width;
    if (opts.height) win.style.height = opts.height;
    win.style.zIndex = ++zTop;
    if (backdrop) backdrop.style.zIndex = zTop - 0.5;
    layer().append(win);

    // centre on screen (slightly offset for each extra non-modal window)
    const r = win.getBoundingClientRect();
    const off = opts.modal ? 0 : openWins.filter(w => !w.modal).length * 24;
    win.style.left = Math.max(8, (innerWidth - r.width) / 2 + off) + 'px';
    win.style.top = Math.max(8, (innerHeight - r.height) / 2.4 + off) + 'px';

    const w = {
      el: win, body, foot, modal: !!opts.modal, closed: false,
      setTitle(t) { titleSpan.textContent = t; },
      close(result) {
        if (w.closed) return;
        w.closed = true;
        win.remove(); if (backdrop) backdrop.remove();
        const i = openWins.indexOf(w); if (i >= 0) openWins.splice(i, 1);
        if (opts.onClose) opts.onClose(result);
      },
      front() { win.style.zIndex = ++zTop; },
    };
    btnX.addEventListener('click', () => w.close());
    win.addEventListener('pointerdown', () => { if (!w.modal) w.front(); });

    // dragging by the title bar
    head.addEventListener('pointerdown', e => {
      if (e.target === btnX || e.button !== 0) return;
      const rect = win.getBoundingClientRect();
      const dx = e.clientX - rect.left, dy = e.clientY - rect.top;
      head.setPointerCapture(e.pointerId);
      const move = ev => {
        win.style.left = Math.min(innerWidth - 60, Math.max(-rect.width + 80, ev.clientX - dx)) + 'px';
        win.style.top = Math.min(innerHeight - 40, Math.max(0, ev.clientY - dy)) + 'px';
      };
      const up = () => { head.removeEventListener('pointermove', move); head.removeEventListener('pointerup', up); };
      head.addEventListener('pointermove', move);
      head.addEventListener('pointerup', up);
    });
    openWins.push(w);
    return w;
  }

  function topWin() { return openWins.length ? openWins.reduce((a, b) => (+a.el.style.zIndex > +b.el.style.zIndex ? a : b)) : null; }
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const w = topWin();
    if (w) { e.preventDefault(); w.close(); }
  });

  // Message box. buttons: array of { text, value, primary }. Resolves with the value (undefined if closed).
  function msgBox(text, title, buttons) {
    buttons = buttons || [{ text: L.t('ok'), value: true, primary: true }];
    return new Promise(resolve => {
      let result;
      const btns = buttons.map(b => el('button' + (b.primary ? '.primary' : ''), { onclick: () => { result = b.value; w.close(); } }, b.text));
      const w = openWin({ title: title || L.t('title'), body: el('div.msgtext', null, text), foot: btns, modal: true, onClose: () => resolve(result) });
      setTimeout(() => (btns.find((b, i) => buttons[i].primary) || btns[0]).focus(), 0);
    });
  }
  const askYesNo = (text, title) => msgBox(text, title, [{ text: L.t('yes'), value: true, primary: true }, { text: L.t('no'), value: false }]);

  // tooltips for [data-tip] (keys into L) and [title-text]
  let tipEl = null, tipTimer = null;
  document.addEventListener('mouseover', e => {
    const t = e.target.closest && e.target.closest('[data-tip]');
    clearTimeout(tipTimer);
    if (tipEl) { tipEl.remove(); tipEl = null; }
    if (!t) return;
    tipTimer = setTimeout(() => {
      tipEl = el('div.tip', null, L.t(t.dataset.tip));
      document.body.append(tipEl);
      const r = t.getBoundingClientRect(), tr = tipEl.getBoundingClientRect();
      tipEl.style.left = Math.max(4, Math.min(innerWidth - tr.width - 4, r.left)) + 'px';
      tipEl.style.top = (r.bottom + 6 + tr.height > innerHeight ? r.top - tr.height - 6 : r.bottom + 6) + 'px';
    }, 450);
  });
  document.addEventListener('mousedown', () => { clearTimeout(tipTimer); if (tipEl) { tipEl.remove(); tipEl = null; } });

  global.UI = { el, openWin, msgBox, askYesNo };
})(window);
