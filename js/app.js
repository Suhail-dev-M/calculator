/* app.js - UI layer: builds the DOM, renders the model, wires clicks / keyboard / history / memory. */
(function (g) {
  'use strict';
  const Calc = g.Calc;
  const { Storage, History, Memory, Calculator, Keyboard } = Calc;
  const S = Calc.Scientific;
  const doc = g.document;

  const MODES = ['standard', 'scientific'];
  const ANGLES = ['DEG', 'RAD'];
  const THEMES = ['dark', 'light'];

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pick = (v, list, fallback) => (list.indexOf(v) >= 0 ? v : fallback);

  /* ---------- icons ---------- */
  const svg = (d) => '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  const ICON = {
    sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
    moon: svg('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),
    history: svg('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>'),
    close: svg('<path d="M18 6 6 18M6 6l12 12"/>'),
    copy: svg('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>'),
    trash: svg('<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>'),
    reuse: svg('<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>')
  };

  /* ---------- keypad definitions ---------- */
  // t = action type, v = value, c = style class, aria = accessible name, key = keyboard key it mirrors
  const K = (label, t, v, c, aria, key, extra) =>
    Object.assign({ label, t, v, c: c || 'fn', aria: aria || label, key: key || (v != null ? v : label) }, extra);
  const D = (n) => K(n, 'digit', n, 'num', n, n);
  const sup = (base, s) => base + '<sup>' + s + '</sup>';
  const F = (label, name, aria, extra) => K(label, 'fn', name, 'fn', aria, name, extra);

  const NUM_KEYS = [
    K('C', 'clear', null, 'clear', 'Clear', 'Escape'),
    K('(', 'lp', null, 'fn', 'Open parenthesis', '('),
    K(')', 'rp', null, 'fn', 'Close parenthesis', ')'),
    K('\u232b', 'back', null, 'fn', 'Backspace', 'Backspace'),
    D('7'), D('8'), D('9'), K('\u00f7', 'op', '\u00f7', 'op', 'Divide', '/'),
    D('4'), D('5'), D('6'), K('\u00d7', 'op', '\u00d7', 'op', 'Multiply', '*'),
    D('1'), D('2'), D('3'), K('\u2212', 'op', '\u2212', 'op', 'Subtract', '-'),
    D('0'), K('.', 'dot', null, 'num', 'Decimal point', '.'), K('%', 'post', '%', 'fn', 'Percent', '%'), K('+', 'op', '+', 'op', 'Add', '+'),
    K('\u00b1', 'sign', null, 'fn', 'Toggle sign', 'Negate'),
    K('=', 'eq', null, 'eq', 'Equals', 'Enter', { wide: true })
  ];

  const STD_KEYS = [
    K('1/x', 'post', '\u207b\u00b9', 'fn', 'Reciprocal'),
    K(sup('x', '2'), 'post', '\u00b2', 'fn', 'Square'),
    F('\u221a', '\u221a', 'Square root'),
    K('Ans', 'const', 'Ans', 'fn', 'Previous answer')
  ];

  const SCI_KEYS = [
    F('sin', 'sin', 'Sine'), F('cos', 'cos', 'Cosine'), F('tan', 'tan', 'Tangent'),
    F(sup('sin', '\u22121'), 'asin', 'Inverse sine'), F(sup('cos', '\u22121'), 'acos', 'Inverse cosine'),
    F(sup('tan', '\u22121'), 'atan', 'Inverse tangent'), F('log', 'log', 'Logarithm base 10'), F('ln', 'ln', 'Natural logarithm'),
    F('log<sub>2</sub>', 'log2', 'Logarithm base 2'), F('|x|', 'abs', 'Absolute value'),
    F(sup('10', 'x'), 'exp10', 'Ten to the power x'), F(sup('e', 'x'), 'exp', 'e to the power x'),
    K(sup('x', '2'), 'post', '\u00b2', 'fn', 'Square'), K(sup('x', '3'), 'post', '\u00b3', 'fn', 'Cube'),
    K(sup('x', 'y'), 'op', '^', 'fn', 'x to the power y', '^'),
    F('\u221a', '\u221a', 'Square root'), F('\u221b', '\u221b', 'Cube root'),
    F(sup('y', '') + '\u221ax', 'root', 'Nth root: x, then comma, then n', { open: true }),
    K('1/x', 'post', '\u207b\u00b9', 'fn', 'Reciprocal'), K('n!', 'post', '!', 'fn', 'Factorial', '!'),
    F('floor', 'floor', 'Floor'), F('ceil', 'ceil', 'Ceiling'), F('round', 'round', 'Round'),
    K('mod', 'op', 'mod', 'fn', 'Modulo', 'mod'), K('EXP', 'expo', null, 'fn', 'Scientific notation: times ten to the power', 'EXP'),
    K('\u03c0', 'const', '\u03c0', 'fn', 'Pi'), K('e', 'const', 'e', 'fn', "Euler's number"),
    K('\u03c6', 'const', '\u03c6', 'fn', 'Golden ratio'), K('Ans', 'const', 'Ans', 'fn', 'Previous answer'),
    K(',', 'comma', null, 'fn', 'Argument separator', ',')
  ];

  const TEMPLATE =
    '<div class="shell">' +
    '<div class="stage"><main class="calc" data-mode="standard">' +
    '<header class="topbar">' +
    '<div class="seg" role="group" aria-label="Calculator mode">' +
    '<button type="button" class="seg-btn" data-set-mode="standard">Standard</button>' +
    '<button type="button" class="seg-btn" data-set-mode="scientific">Scientific</button></div>' +
    '<div class="topbar-actions">' +
    '<button type="button" class="icon-btn" id="themeBtn" aria-label="Switch theme"></button>' +
    '<button type="button" class="icon-btn" id="historyBtn" aria-label="Toggle history" aria-expanded="false" aria-controls="history">' + ICON.history + '</button>' +
    '</div></header>' +
    '<section class="display" aria-label="Display">' +
    '<div class="display-meta">' +
    '<div class="seg seg-sm" role="group" aria-label="Angle unit">' +
    '<button type="button" class="seg-btn" data-set-angle="DEG" title="Degrees">DEG</button>' +
    '<button type="button" class="seg-btn" data-set-angle="RAD" title="Radians">RAD</button></div>' +
    '<span class="badge" id="memBadge" hidden>M</span>' +
    '<div class="prev" id="prev"></div></div>' +
    '<div class="main" id="main">0</div>' +
    '<div class="preview" id="preview"></div></section>' +
    '<div class="memrow" role="group" aria-label="Memory">' +
    '<button type="button" class="mem-btn" data-mem="MC" aria-label="Memory clear">MC</button>' +
    '<button type="button" class="mem-btn" data-mem="MR" aria-label="Memory recall">MR</button>' +
    '<button type="button" class="mem-btn" data-mem="M+" aria-label="Memory add">M+</button>' +
    '<button type="button" class="mem-btn" data-mem="M-" aria-label="Memory subtract">M\u2212</button>' +
    '<button type="button" class="mem-btn" data-mem="MS" aria-label="Memory store">MS</button>' +
    '<span class="mem-val" id="memVal"></span></div>' +
    '<div class="keypad"><div class="keys keys-fn cols-4"></div><div class="keys keys-num cols-4"></div></div>' +
    '</main></div>' +
    '<aside class="history" id="history" aria-label="Calculation history" aria-hidden="true">' +
    '<div class="h-head"><h2>History</h2><div>' +
    '<button type="button" class="text-btn" id="historyClear">Clear all</button>' +
    '<button type="button" class="icon-btn" id="historyClose" aria-label="Close history">' + ICON.close + '</button></div></div>' +
    '<ul class="h-list" id="hList"></ul></aside>' +
    '<div class="backdrop" id="backdrop"></div></div>' +
    '<div class="toast" id="toast" role="status" aria-live="polite"></div>' +
    '<div class="sr-only" id="srStatus" aria-live="polite"></div>';

  function systemTheme() {
    return g.matchMedia && g.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  async function copyText(text) {
    try {
      await g.navigator.clipboard.writeText(text);
      return true;
    } catch (e) { /* fall through to the legacy path */ }
    try {
      const ta = doc.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
      doc.body.appendChild(ta);
      ta.select();
      const ok = doc.execCommand('copy');
      ta.remove();
      return ok;
    } catch (e) {
      return false;
    }
  }

  function mount(root, options) {
    const opts = options || {};
    root.innerHTML = TEMPLATE;
    const $ = (sel) => root.querySelector(sel);
    const els = {
      calc: $('.calc'), shell: $('.shell'), main: $('#main'), prev: $('#prev'), preview: $('#preview'),
      fnKeys: $('.keys-fn'), numKeys: $('.keys-num'), memBadge: $('#memBadge'), memVal: $('#memVal'),
      themeBtn: $('#themeBtn'), historyBtn: $('#historyBtn'), history: $('#history'), hList: $('#hList'),
      hClear: $('#historyClear'), toast: $('#toast'), sr: $('#srStatus')
    };

    const state = {
      mode: pick(Storage.get('mode'), MODES, 'standard'),
      angle: pick(Storage.get('angle'), ANGLES, 'DEG'),
      theme: pick(Storage.get('theme'), THEMES, systemTheme()),
      historyOpen: opts.historyOpen !== undefined ? opts.historyOpen
        : !!(g.matchMedia && g.matchMedia('(min-width: 1100px)').matches)
    };

    const calc = new Calculator({
      onResult(r) {
        Storage.set('ans', r.value);
        if (!r.trivial) History.add(r.expression, r.result, r.value);
      }
    });
    calc.angle = state.angle;
    const savedAns = Storage.get('ans', 0);
    calc.ans = typeof savedAns === 'number' && Number.isFinite(savedAns) ? savedAns : 0;

    const numActions = {};
    let fnActions = {};
    let toastTimer = null;

    /* ---------- keypad ---------- */
    const keyHTML = (d, id) =>
      '<button type="button" class="key key-' + d.c + (d.wide ? ' wide' : '') + '" data-id="' + id +
      '" data-k="' + esc(d.key) + '" aria-label="' + esc(d.aria) + '">' + d.label + '</button>';

    function buildFnKeys(animate) {
      const defs = state.mode === 'scientific' ? SCI_KEYS : STD_KEYS;
      fnActions = {};
      els.fnKeys.className = 'keys keys-fn ' + (state.mode === 'scientific' ? 'cols-5' : 'cols-4');
      els.fnKeys.innerHTML = defs.map((d, i) => { fnActions['f' + i] = d; return keyHTML(d, 'f' + i); }).join('');
      if (animate) {
        els.fnKeys.classList.remove('anim');
        void els.fnKeys.offsetWidth; // restart the CSS animation
        els.fnKeys.classList.add('anim');
      }
    }
    els.numKeys.innerHTML = NUM_KEYS.map((d, i) => { numActions['n' + i] = d; return keyHTML(d, 'n' + i); }).join('');
    const actionFor = (btn) => (btn.dataset.id[0] === 'f' ? fnActions : numActions)[btn.dataset.id];

    /* ---------- rendering ---------- */
    function fit() {
      const m = els.main;
      m.style.fontSize = '';
      let size = parseFloat(g.getComputedStyle(m).fontSize);
      if (Number.isFinite(size)) {
        while (m.scrollWidth > m.clientWidth && size > 20) {
          size -= 2;
          m.style.fontSize = size + 'px';
        }
      }
      m.scrollLeft = m.scrollWidth;
    }

    function render() {
      const err = calc.error;
      els.main.classList.toggle('error', !!err);
      els.main.textContent = err || calc.expr || '0';
      els.prev.textContent = err ? calc.expr : calc.prev;
      const p = calc.preview();
      els.preview.textContent = p ? '= ' + p : '';
      fit();
      els.prev.scrollLeft = els.prev.scrollWidth;
    }

    function renderControls() {
      root.querySelectorAll('[data-set-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.setMode === state.mode)));
      root.querySelectorAll('[data-set-angle]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.setAngle === state.angle)));
      els.themeBtn.innerHTML = state.theme === 'dark' ? ICON.sun : ICON.moon;
      els.themeBtn.setAttribute('aria-label', state.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
      els.historyBtn.setAttribute('aria-expanded', String(state.historyOpen));
      els.shell.classList.toggle('history-open', state.historyOpen);
      els.history.setAttribute('aria-hidden', String(!state.historyOpen));
    }

    function renderMemory() {
      const has = Memory.has();
      els.memBadge.hidden = !has;
      root.querySelectorAll('[data-mem="MC"],[data-mem="MR"]').forEach((b) => { b.disabled = !has; });
      els.memVal.textContent = has ? 'M = ' + S.format(Memory.value) : '';
    }

    function renderHistory() {
      const items = History.getAll();
      els.hClear.disabled = !items.length;
      if (!items.length) {
        els.hList.innerHTML = '<li class="h-empty">No calculations yet.<br>Results appear here after you press =.</li>';
        return;
      }
      const stamp = (t) => new Date(t).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
      els.hList.innerHTML = items.map((h) =>
        '<li class="h-item" data-id="' + esc(h.id) + '">' +
        '<button type="button" class="h-main" data-act="use" aria-label="Use result ' + esc(h.result) + '">' +
        '<span class="h-expr">' + esc(h.expression) + ' =</span><span class="h-res">' + esc(h.result) + '</span></button>' +
        '<div class="h-foot"><time datetime="' + new Date(h.timestamp).toISOString() + '">' + esc(stamp(h.timestamp)) + '</time>' +
        '<span class="h-actions">' +
        '<button type="button" data-act="expr" aria-label="Reuse expression" title="Reuse expression">' + ICON.reuse + '</button>' +
        '<button type="button" data-act="copy" aria-label="Copy result" title="Copy result">' + ICON.copy + '</button>' +
        '<button type="button" data-act="del" aria-label="Delete entry" title="Delete entry">' + ICON.trash + '</button>' +
        '</span></div></li>'
      ).join('');
    }

    function toast(message) {
      els.toast.textContent = message;
      els.toast.classList.add('show');
      g.clearTimeout(toastTimer);
      toastTimer = g.setTimeout(() => els.toast.classList.remove('show'), 1800);
    }
    const announce = (text) => { els.sr.textContent = text; };

    /* ---------- state changes ---------- */
    function setMode(mode, initial) {
      state.mode = pick(mode, MODES, 'standard');
      Storage.set('mode', state.mode);
      els.calc.dataset.mode = state.mode;
      buildFnKeys(!initial); // keypad is rebuilt in place: no reload, history/memory/Ans untouched
      renderControls();
    }

    function setAngle(angle) {
      state.angle = pick(angle, ANGLES, 'DEG');
      calc.angle = state.angle;
      Storage.set('angle', state.angle);
      renderControls();
      render();
    }

    function setTheme(theme) {
      state.theme = pick(theme, THEMES, 'dark');
      Storage.set('theme', state.theme);
      doc.documentElement.setAttribute('data-theme', state.theme);
      renderControls();
    }

    function setHistoryOpen(open) {
      state.historyOpen = !!open;
      renderControls();
    }

    function memoryOp(op) {
      if (op === 'MC') { Memory.clear(); toast('Memory cleared'); return; }
      if (op === 'MR') {
        if (!Memory.has()) { toast('Memory is empty'); return; }
        calc.insertValue(S.toExpression(Memory.value));
        return;
      }
      const v = calc.currentValue();
      if (v === null) { toast('Enter a valid number first'); return; }
      if (op === 'MS') Memory.store(v);
      else if (op === 'M+') Memory.add(v);
      else Memory.subtract(v);
      toast('Memory = ' + S.format(Memory.value));
    }

    function run(a) {
      if (!a) return;
      switch (a.t) {
        case 'digit': calc.typeDigit(a.v); break;
        case 'dot': calc.typeDecimal(); break;
        case 'op': calc.typeOperator(a.v); break;
        case 'fn': calc.typeFunction(a.v, a.open); break;
        case 'const': calc.typeConstant(a.v); break;
        case 'lp': calc.typeParen('('); break;
        case 'rp': calc.typeParen(')'); break;
        case 'comma': calc.typeComma(); break;
        case 'post': calc.typePostfix(a.v); break;
        case 'expo': calc.typeExponent(); break;
        case 'sign': calc.toggleSign(); break;
        case 'back': calc.backspace(); break;
        case 'clear': calc.clear(); break;
        case 'ekey':
          if (!calc.justEvaluated && /[0-9]$/.test(calc.expr)) calc.typeExponent();
          else calc.typeConstant('e');
          break;
        case 'eq': {
          const r = calc.equals();
          if (r.ok && !r.noop) announce('Result ' + calc.expr);
          else if (!r.ok) announce('Error: ' + r.error);
          break;
        }
        case 'mem': memoryOp(a.v); break;
        default: break;
      }
      render();
    }

    async function historyAction(btn) {
      const item = btn.closest('.h-item');
      const entry = item && History.get(item.dataset.id);
      if (!entry) return;
      switch (btn.dataset.act) {
        case 'use':
          calc.insertValue(entry.result);
          render();
          if (!g.matchMedia || !g.matchMedia('(min-width: 1100px)').matches) setHistoryOpen(false);
          break;
        case 'expr':
          calc.setExpression(entry.expression);
          render();
          if (!g.matchMedia || !g.matchMedia('(min-width: 1100px)').matches) setHistoryOpen(false);
          break;
        case 'copy':
          toast((await copyText(entry.result.replace(/\u2212/g, '-'))) ? 'Copied ' + entry.result : 'Copy failed');
          break;
        case 'del':
          History.remove(entry.id);
          break;
        default: break;
      }
    }

    function flash(key) {
      const btn = Array.prototype.find.call(root.querySelectorAll('[data-k]'), (b) => b.dataset.k === key);
      if (!btn) return;
      btn.classList.add('pressed');
      g.setTimeout(() => btn.classList.remove('pressed'), 120);
    }

    /* ---------- events ---------- */
    function onClick(e) {
      const t = e.target;
      const keyBtn = t.closest('.key');
      if (keyBtn) { run(actionFor(keyBtn)); return; }
      const modeBtn = t.closest('[data-set-mode]');
      if (modeBtn) { setMode(modeBtn.dataset.setMode); return; }
      const angleBtn = t.closest('[data-set-angle]');
      if (angleBtn) { setAngle(angleBtn.dataset.setAngle); return; }
      const memBtn = t.closest('[data-mem]');
      if (memBtn) { run({ t: 'mem', v: memBtn.dataset.mem }); return; }
      if (t.closest('#themeBtn')) { setTheme(state.theme === 'dark' ? 'light' : 'dark'); return; }
      if (t.closest('#historyBtn')) { setHistoryOpen(!state.historyOpen); return; }
      if (t.closest('#historyClose') || t.closest('#backdrop')) { setHistoryOpen(false); return; }
      if (t.closest('#historyClear')) { History.clear(); toast('History cleared'); return; }
      const act = t.closest('[data-act]');
      if (act) historyAction(act);
    }
    root.addEventListener('click', onClick);

    const stopKeyboard = Keyboard.init((a) => { run(a); flash(a.key); });
    const offHistory = History.onChange(renderHistory);
    const offMemory = Memory.onChange(renderMemory);

    /* ---------- start ---------- */
    History.init();
    Memory.init();
    doc.documentElement.setAttribute('data-theme', state.theme);
    setMode(state.mode, true);
    render();
    renderMemory();
    renderHistory();

    return {
      calc, state, run, render, setMode, setAngle, setTheme, setHistoryOpen,
      destroy() {
        stopKeyboard(); offHistory(); offMemory();
        root.removeEventListener('click', onClick);
        root.innerHTML = '';
      }
    };
  }

  Calc.App = { mount };

  function autostart() {
    const el = doc.getElementById('app');
    if (el && doc.body.dataset.autostart !== 'false') Calc.app = mount(el);
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', autostart);
  else autostart();
})(typeof globalThis !== 'undefined' ? globalThis : window);
