/* browser-runner.js - runs every suite on tests/tests.html and prints the report. */
(async function () {
  'use strict';
  const summary = document.getElementById('summary');
  const report = document.getElementById('report');

  // Never touch the real app data: the tests use their own storage namespace.
  Calc.Storage.setNamespace('calc.test.unit.');

  const T = createHarness();
  registerUnitTests(T, Calc);
  registerIntegrationTests(T, Calc, document.getElementById('sandbox'));

  let currentSuite = null;
  let list = null;
  const results = await T.run((r) => {
    if (r.suite !== currentSuite) {
      currentSuite = r.suite;
      const h = document.createElement('h2');
      h.textContent = r.suite;
      report.appendChild(h);
      list = document.createElement('ul');
      report.appendChild(list);
    }
    const li = document.createElement('li');
    li.className = r.status;
    li.textContent = (r.status === 'pass' ? '\u2713 ' : r.status === 'skip' ? '\u2013 ' : '\u2717 ') + r.name + (r.error ? ' \u2014 ' + r.error : '');
    list.appendChild(li);
  });

  const failed = results.filter((r) => r.status === 'fail').length;
  const skipped = results.filter((r) => r.status === 'skip').length;
  summary.textContent = results.length - failed - skipped + ' passed, ' + failed + ' failed, ' + skipped + ' skipped (' + results.length + ' total)';
  summary.className = failed ? 'bad' : 'good';
  document.title = (failed ? 'FAIL' : 'PASS') + ' - Calculator tests';
})();
