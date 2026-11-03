/* keyboard.js - maps physical keys to calculator actions. Pure mapping + one document listener. */
(function (g) {
  'use strict';
  const Calc = g.Calc;

  /** Returns an action ({ t, v, key }) for a KeyboardEvent, or null when the key is not ours. */
  function map(e) {
    const k = e.key;
    if (/^[0-9]$/.test(k)) return { t: 'digit', v: k, key: k };
    switch (k) {
      case '.': return { t: 'dot', key: '.' };
      case '+': return { t: 'op', v: '+', key: '+' };
      case '-': return { t: 'op', v: '\u2212', key: '-' };
      case '*': return { t: 'op', v: '\u00d7', key: '*' };
      case '/': return { t: 'op', v: '\u00f7', key: '/' };
      case '^': return { t: 'op', v: '^', key: '^' };
      case '%': return { t: 'post', v: '%', key: '%' };
      case '!': return { t: 'post', v: '!', key: '!' };
      case '(': return { t: 'lp', key: '(' };
      case ')': return { t: 'rp', key: ')' };
      case ',': return { t: 'comma', key: ',' };
      case 'Enter':
      case '=': return { t: 'eq', key: 'Enter' };
      case 'Backspace': return { t: 'back', key: 'Backspace' };
      case 'Escape':
      case 'Delete': return { t: 'clear', key: 'Escape' };
      case 'p':
      case 'P': return { t: 'const', v: '\u03c0', key: '\u03c0' };
      case 'e': return { t: 'ekey', key: 'e' }; // "1e5" -> exponent, otherwise Euler's number
      default: return null;
    }
  }

  /** Start listening. Returns a function that stops listening. */
  function init(onAction) {
    function onKeyDown(e) {
      // Leave browser/OS shortcuts (Ctrl+C, Ctrl+R, Alt+Left ...) alone.
      if (e.defaultPrevented || e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      if (t && t.closest) {
        if (t.closest('input, textarea, select, [contenteditable="true"]')) return;
        // Enter on a focused header/history button should still activate that button.
        if (e.key === 'Enter' && t.closest('button') && !t.closest('.keypad')) return;
      }
      const action = map(e);
      if (!action) return;
      e.preventDefault();
      onAction(action);
    }
    g.document.addEventListener('keydown', onKeyDown);
    return () => g.document.removeEventListener('keydown', onKeyDown);
  }

  Calc.Keyboard = { init, map };
})(typeof globalThis !== 'undefined' ? globalThis : window);
