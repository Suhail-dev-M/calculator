/* harness.js - a tiny test harness that works in the browser and in Node. */
(function (g) {
  'use strict';

  g.createHarness = function () {
    const tests = [];
    let suite = '';
    const fail = (message) => { throw new Error(message); };
    const show = (v) => (typeof v === 'string' ? JSON.stringify(v) : String(v));

    const T = {
      suite(name) { suite = name; },
      test(name, fn) { tests.push({ suite, name, fn }); },

      ok(cond, message) { if (!cond) fail(message || 'expected a truthy value'); },
      eq(actual, expected, message) {
        if (actual !== expected && !Object.is(actual, expected)) {
          fail((message ? message + ': ' : '') + 'expected ' + show(expected) + ' but got ' + show(actual));
        }
      },
      near(actual, expected, eps) {
        const tol = (eps || 1e-9) * Math.max(1, Math.abs(expected));
        if (!(Math.abs(actual - expected) <= tol)) fail('expected about ' + expected + ' but got ' + actual);
      },
      throws(fn, part) {
        try { fn(); } catch (e) {
          if (part && String(e.message).toLowerCase().indexOf(String(part).toLowerCase()) < 0) {
            fail('error "' + e.message + '" does not mention "' + part + '"');
          }
          return;
        }
        fail('expected an error' + (part ? ' mentioning "' + part + '"' : ''));
      },

      /** Runs every test in order. A test may be async and may return 'skip'. */
      async run(onResult) {
        const results = [];
        for (const t of tests) {
          const r = { suite: t.suite, name: t.name, status: 'pass', error: null };
          try {
            if ((await t.fn()) === 'skip') r.status = 'skip';
          } catch (e) {
            r.status = 'fail';
            r.error = e && e.message ? e.message : String(e);
          }
          results.push(r);
          if (onResult) onResult(r);
        }
        return results;
      }
    };
    return T;
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
