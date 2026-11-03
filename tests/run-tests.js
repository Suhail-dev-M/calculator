#!/usr/bin/env node
/* run-tests.js - runs the engine / model / persistence tests in Node (no dependencies).
   Usage:  node tests/run-tests.js
   UI tests (keyboard, mode switching, responsive) need a browser: open tests/tests.html. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const store = {};
const sandbox = {
  console,
  setTimeout,
  clearTimeout,
  // minimal localStorage so the persistence tests exercise the real storage path
  localStorage: {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  }
};
vm.createContext(sandbox);

const load = (rel) => vm.runInContext(fs.readFileSync(path.join(root, rel), 'utf8'), sandbox, { filename: rel });
['js/storage.js', 'js/scientific.js', 'js/parser.js', 'js/history.js', 'js/memory.js', 'js/calculator.js',
  'tests/harness.js', 'tests/unit-tests.js'].forEach(load);

const T = sandbox.createHarness();
sandbox.registerUnitTests(T, sandbox.Calc);

// Static safety checks: the engine must never use eval / Function.
T.suite('Static checks');
['js/parser.js', 'js/scientific.js', 'js/calculator.js'].forEach((rel) => {
  T.test(rel + ' contains no eval() or new Function()', () => {
    const code = fs.readFileSync(path.join(root, rel), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    T.ok(!/\beval\s*\(/.test(code), 'eval found');
    T.ok(!/new\s+Function\b|\bFunction\s*\(/.test(code), 'Function constructor found');
  });
});

(async () => {
  let lastSuite = '';
  const results = await T.run((r) => {
    if (r.suite !== lastSuite) { lastSuite = r.suite; console.log('\n' + r.suite); }
    if (r.status === 'fail') console.log('  \u2717 ' + r.name + '\n      ' + r.error);
  });
  const failed = results.filter((r) => r.status === 'fail').length;
  console.log('\n' + (results.length - failed) + ' passed, ' + failed + ' failed (' + results.length + ' total)');
  process.exit(failed ? 1 : 0);
})();
