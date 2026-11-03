/* memory.js - the calculator memory register (MC, MR, M+, M-, MS). Shared by both modes. */
(function (g) {
  'use strict';
  const Calc = g.Calc;
  const KEY = 'memory';

  let value = null; // null = empty
  const listeners = new Set();

  const emit = () => listeners.forEach((fn) => fn(value));
  const save = () => Calc.Storage.set(KEY, value);
  const tidy = (v) => Number(v.toPrecision(15)); // 0.1 + 0.2 -> 0.3

  function apply(next) {
    if (!Number.isFinite(next)) return false;
    value = tidy(next);
    save();
    emit();
    return true;
  }

  const Memory = {
    init() {
      const saved = Calc.Storage.get(KEY, null);
      value = typeof saved === 'number' && Number.isFinite(saved) ? saved : null;
      emit();
      return value;
    },
    has() { return value !== null; },
    get value() { return value; },
    recall() { return value; },
    clear() { value = null; save(); emit(); },
    store(x) { return apply(x); },
    add(x) { return apply((value || 0) + x); },
    subtract(x) { return apply((value || 0) - x); },
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    }
  };

  Calc.Memory = Memory;
})(typeof globalThis !== 'undefined' ? globalThis : window);
