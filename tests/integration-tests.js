/* integration-tests.js - drives the real UI (keyboard events, clicks, DOM). Browser only; see tests/tests.html. */
(function (g) {
  'use strict';

  g.registerIntegrationTests = function (T, Calc, sandbox) {
    const doc = g.document;
    const sleep = (ms) => new Promise((r) => g.setTimeout(r, ms));
    const isJsdom = /jsdom/i.test((g.navigator && g.navigator.userAgent) || '');
    let app = null;

    const $ = (sel) => sandbox.querySelector(sel);
    const display = () => $('#main').textContent;
    const press = (key, opts) => {
      const ev = new g.KeyboardEvent('keydown', Object.assign({ key, bubbles: true, cancelable: true }, opts || {}));
      doc.dispatchEvent(ev);
      return ev;
    };
    const typeKeys = (s) => s.split('').forEach((c) => press(c));
    const click = (el) => el.dispatchEvent(new g.MouseEvent('click', { bubbles: true }));
    const keyBtn = (k) => Array.prototype.find.call(sandbox.querySelectorAll('.key'), (b) => b.dataset.k === k);
    const reset = () => { app.calc.clear(); app.render(); };

    T.suite('UI integration (keyboard, mode switching, history, themes, responsive)');

    T.test('mount: standard keypad is rendered', () => {
      Calc.Storage.setNamespace('calc.test.ui.');
      Calc.History.clear();
      Calc.Memory.clear();
      app = Calc.App.mount(sandbox, { historyOpen: false });
      T.ok(keyBtn('7') && keyBtn('Enter') && keyBtn('Backspace'), 'core keys exist');
      T.ok(!keyBtn('sin'), 'no scientific keys in standard mode');
      T.eq(display(), '0');
    });

    T.test('keyboard: 2+3 Enter = 5', () => { reset(); typeKeys('2+3'); press('Enter'); T.eq(display(), '5'); });
    T.test('keyboard: precedence 2+3*4 = 14', () => { reset(); typeKeys('2+3*4'); press('Enter'); T.eq(display(), '14'); });
    T.test('keyboard: parentheses, decimal point and "=" key', () => {
      reset(); typeKeys('(1.5+2.5)*2'); press('='); T.eq(display(), '8');
    });
    T.test('keyboard: Backspace deletes, Escape clears', () => {
      reset(); typeKeys('123'); press('Backspace'); T.eq(display(), '12');
      press('Escape'); T.eq(display(), '0');
    });
    T.test('keyboard: division by zero shows a friendly message', () => {
      reset(); typeKeys('5/0'); press('Enter');
      T.eq(display(), 'Cannot divide by zero');
      T.ok($('#main').classList.contains('error'));
      press('Escape');
    });
    T.test('keyboard: browser shortcuts (Ctrl+C, Alt+Left) are not hijacked', () => {
      reset(); typeKeys('7');
      const a = press('c', { ctrlKey: true });
      const b = press('ArrowLeft', { altKey: true });
      const c = press('r', { metaKey: true });
      T.ok(!a.defaultPrevented && !b.defaultPrevented && !c.defaultPrevented, 'default not prevented');
      T.eq(display(), '7');
    });
    T.test('keyboard: handled keys are prevented, unknown keys are ignored', () => {
      reset();
      T.ok(press('5').defaultPrevented, 'digit handled');
      T.ok(!press('q').defaultPrevented, 'q ignored');
      T.ok(!press('Tab').defaultPrevented, 'Tab ignored');
    });
    T.test('keyboard: Enter on a header button is left to the browser', () => {
      reset(); typeKeys('1');
      const btn = $('#themeBtn');
      const ev = new g.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
      btn.dispatchEvent(ev);
      T.ok(!ev.defaultPrevented);
      T.eq(display(), '1');
    });
    T.test('click: keypad buttons work like the keyboard', () => {
      reset();
      ['8', '\u00d7', '9'].forEach((label) => click(Array.prototype.find.call(sandbox.querySelectorAll('.key'), (b) => b.textContent === label)));
      click(keyBtn('Enter'));
      T.eq(display(), '72');
    });
    T.test('standard keys: sqrt, square, reciprocal, sign, percent', () => {
      reset(); typeKeys('9'); click(keyBtn('\u221a')); click(keyBtn('Enter')); T.eq(display(), '3');
      reset(); typeKeys('7'); click(keyBtn('\u00b2')); click(keyBtn('Enter')); T.eq(display(), '49');
      reset(); typeKeys('8'); click(keyBtn('\u207b\u00b9')); click(keyBtn('Enter')); T.eq(display(), '0.125');
      reset(); typeKeys('5'); click(keyBtn('Negate')); T.eq(display(), '\u22125');
      reset(); typeKeys('200+10%'); click(keyBtn('Enter')); T.eq(display(), '220');
    });

    T.test('mode switch: keypad changes dynamically and the choice is saved', () => {
      reset();
      click($('[data-set-mode="scientific"]'));
      T.eq(app.state.mode, 'scientific');
      T.ok(keyBtn('sin') && keyBtn('asin') && keyBtn('log2') && keyBtn('root') && keyBtn('\u03c0'), 'scientific keys present');
      T.eq(Calc.Storage.get('mode'), 'scientific');
      T.eq($('.calc').dataset.mode, 'scientific');
      click($('[data-set-mode="standard"]'));
      T.ok(!keyBtn('sin'), 'scientific keys removed');
      T.eq(Calc.Storage.get('mode'), 'standard');
    });
    T.test('mode switch preserves Ans, history, memory and the typed expression', () => {
      reset(); Calc.History.clear(); Calc.Memory.clear();
      typeKeys('6*7'); press('Enter');
      click($('[data-mem="MS"]'));
      T.eq(Calc.Memory.value, 42);
      typeKeys('+1');
      click($('[data-set-mode="scientific"]'));
      T.eq(display(), '42+1', 'expression kept');
      T.eq(app.calc.ans, 42, 'Ans kept');
      T.eq(Calc.History.getAll().length, 1, 'history kept');
      T.eq(Calc.Memory.value, 42, 'memory kept');
      click(keyBtn('Enter'));
      T.eq(display(), '43');
      click($('[data-set-mode="standard"]'));
      T.eq(Calc.Memory.value, 42);
    });
    T.test('scientific keys: sin, log, pi, factorial, nth root, EXP', () => {
      click($('[data-set-mode="scientific"]'));
      reset(); click(keyBtn('sin')); typeKeys('30'); press('Enter'); T.eq(display(), '0.5');
      reset(); click(keyBtn('log')); typeKeys('1000'); press('Enter'); T.eq(display(), '3');
      reset(); typeKeys('5'); click(keyBtn('!')); press('Enter'); T.eq(display(), '120');
      reset(); typeKeys('27'); click(keyBtn('root')); typeKeys(',3'); press('Enter'); T.eq(display(), '3');
      reset(); typeKeys('2'); click(keyBtn('EXP')); typeKeys('3'); press('Enter'); T.eq(display(), '2000');
      reset(); click(keyBtn('\u03c0')); press('Enter'); T.eq(display(), '3.14159265358979');
      reset(); typeKeys('1e3'); press('Enter'); T.eq(display(), '1000', 'e after a digit is an exponent');
    });
    T.test('DEG / RAD switch changes results and is saved', () => {
      reset();
      click($('[data-set-angle="DEG"]'));
      click(keyBtn('sin')); typeKeys('90'); press('Enter'); T.eq(display(), '1');
      reset();
      click($('[data-set-angle="RAD"]'));
      T.eq(Calc.Storage.get('angle'), 'RAD');
      click(keyBtn('sin')); click(keyBtn('\u03c0')); typeKeys('/2'); press('Enter'); T.eq(display(), '1');
      reset();
      click(keyBtn('asin')); typeKeys('1'); press('Enter'); T.eq(display(), '1.5707963267949', 'asin(1) in radians');
      reset();
      click($('[data-set-angle="DEG"]'));
      click(keyBtn('asin')); typeKeys('1'); press('Enter'); T.eq(display(), '90', 'asin(1) in degrees');
      click($('[data-set-mode="standard"]'));
    });

    T.test('memory buttons: MS, M+, M-, MR, MC and the M indicator', () => {
      reset(); Calc.Memory.clear();
      T.ok($('#memBadge').hidden, 'indicator hidden when empty');
      T.ok($('[data-mem="MR"]').disabled, 'MR disabled when empty');
      typeKeys('10'); click($('[data-mem="MS"]'));
      T.ok(!$('#memBadge').hidden, 'indicator visible');
      reset(); typeKeys('5'); click($('[data-mem="M+"]')); T.eq(Calc.Memory.value, 15);
      reset(); typeKeys('3'); click($('[data-mem="M-"]')); T.eq(Calc.Memory.value, 12);
      reset(); click($('[data-mem="MR"]')); T.eq(display(), '12');
      click($('[data-mem="MC"]')); T.eq(Calc.Memory.value, null);
      T.ok($('#memBadge').hidden);
    });

    T.test('history: entries appear, can be reused, deleted and cleared', () => {
      reset(); Calc.History.clear();
      typeKeys('1+1'); press('Enter');
      typeKeys('2+3'); press('Enter');
      const items = sandbox.querySelectorAll('.h-item');
      T.eq(items.length, 2);
      T.ok(/2\+3/.test(items[0].textContent), 'newest first');
      T.ok(items[0].querySelector('time'), 'timestamp shown');
      reset();
      click(items[1].querySelector('[data-act="use"]'));
      T.eq(display(), '2');
      reset();
      click(sandbox.querySelectorAll('.h-item')[0].querySelector('[data-act="expr"]'));
      T.eq(display(), '2+3');
      click(sandbox.querySelectorAll('.h-item')[0].querySelector('[data-act="del"]'));
      T.eq(sandbox.querySelectorAll('.h-item').length, 1);
      click($('#historyClear'));
      T.eq(sandbox.querySelectorAll('.h-item').length, 0);
      T.eq(Calc.Storage.get('history').length, 0);
      reset();
    });
    T.test('history persists in storage and survives a re-mount', () => {
      reset(); Calc.History.clear();
      typeKeys('9*9'); press('Enter');
      app.destroy();
      app = Calc.App.mount(sandbox, { historyOpen: false });
      T.eq(sandbox.querySelectorAll('.h-item').length, 1);
      T.ok(/9\u00d79/.test($('.h-item').textContent));
      T.eq(app.calc.ans, 81, 'Ans restored');
    });
    T.test('history entries are escaped (no HTML injection from storage)', () => {
      Calc.Storage.set('history', [{ id: 'x1', expression: '<img src=x onerror=alert(1)>', result: '1', timestamp: Date.now() }]);
      app.destroy();
      app = Calc.App.mount(sandbox, { historyOpen: false });
      T.eq(sandbox.querySelectorAll('.h-list img').length, 0);
      Calc.History.clear();
    });
    T.test('history panel toggles open and closed', () => {
      app.setHistoryOpen(false);
      T.ok(!$('.shell').classList.contains('history-open'));
      click($('#historyBtn'));
      T.ok($('.shell').classList.contains('history-open'));
      T.eq($('#historyBtn').getAttribute('aria-expanded'), 'true');
      click($('#historyClose'));
      T.ok(!$('.shell').classList.contains('history-open'));
    });

    T.test('theme: toggle switches dark/light and is saved', () => {
      app.setTheme('dark');
      click($('#themeBtn'));
      T.eq(doc.documentElement.getAttribute('data-theme'), 'light');
      T.eq(Calc.Storage.get('theme'), 'light');
      click($('#themeBtn'));
      T.eq(doc.documentElement.getAttribute('data-theme'), 'dark');
      T.eq(Calc.Storage.get('theme'), 'dark');
    });
    T.test('saved mode, angle and theme are restored on a fresh mount', () => {
      app.setMode('scientific'); app.setAngle('RAD'); app.setTheme('light');
      app.destroy();
      app = Calc.App.mount(sandbox, { historyOpen: false });
      T.eq(app.state.mode, 'scientific');
      T.eq(app.state.angle, 'RAD');
      T.eq(app.state.theme, 'light');
      T.ok(!!keyBtn('sin'));
      app.setTheme('dark'); app.setAngle('DEG'); app.setMode('standard');
    });

    T.test('mobile layout (360px wide): no horizontal scroll, touch-friendly keys', async () => {
      if (isJsdom) return 'skip'; // needs a real layout engine
      app.setHistoryOpen(false);
      sandbox.style.width = '360px';
      for (const mode of ['standard', 'scientific']) {
        app.setMode(mode);
        await sleep(450); // let the max-width transition finish
        const box = sandbox.getBoundingClientRect();
        T.ok(sandbox.scrollWidth <= sandbox.clientWidth + 1, mode + ': horizontal overflow');
        const keys = Array.prototype.slice.call(sandbox.querySelectorAll('.key'));
        T.ok(keys.every((k) => k.getBoundingClientRect().height >= 44), mode + ': a key is shorter than 44px');
        T.ok(keys.every((k) => k.getBoundingClientRect().right <= box.right + 1), mode + ': a key sticks out');
      }
      app.setMode('standard');
    });
    T.test('long expressions shrink/scroll instead of widening the layout', async () => {
      if (isJsdom) return 'skip';
      sandbox.style.width = '360px';
      reset(); typeKeys('1234567890+1234567890+1234567890+1234567890');
      T.ok(sandbox.scrollWidth <= sandbox.clientWidth + 1, 'overflow');
      reset();
    });
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
