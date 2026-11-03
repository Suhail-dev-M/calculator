/* theme-init.js - applies the saved theme before first paint to avoid a flash. */
(function () {
  var theme = 'dark';
  try {
    var saved = JSON.parse(localStorage.getItem('calc.v1.theme'));
    if (saved === 'light' || saved === 'dark') {
      theme = saved;
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      theme = 'light';
    }
  } catch (e) { /* storage unavailable: keep default */ }
  document.documentElement.setAttribute('data-theme', theme);
})();
