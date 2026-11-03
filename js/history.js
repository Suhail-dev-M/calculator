/* history.js - completed calculations, newest first, persisted through storage.js. */
(function (g) {
  'use strict';
  const Calc = g.Calc;
  const KEY = 'history';
  const MAX_ENTRIES = 200;

  let items = [];
  const listeners = new Set();

  const emit = () => listeners.forEach((fn) => fn(items.slice()));
  const save = () => Calc.Storage.set(KEY, items);
  const isValid = (x) =>
    !!x && typeof x.id === 'string' && typeof x.expression === 'string' &&
    typeof x.result === 'string' && typeof x.timestamp === 'number';

  const History = {
    /** (Re)load from storage. Corrupt or foreign data is discarded instead of crashing the app. */
    init() {
      const data = Calc.Storage.get(KEY, []);
      items = Array.isArray(data) ? data.filter(isValid).slice(0, MAX_ENTRIES) : [];
      emit();
      return items.slice();
    },

    getAll() { return items.slice(); },

    get(id) { return items.find((i) => i.id === id) || null; },

    add(expression, result, value) {
      const entry = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        expression: String(expression),
        result: String(result),
        value: typeof value === 'number' ? value : null,
        timestamp: Date.now()
      };
      items.unshift(entry);
      if (items.length > MAX_ENTRIES) items.length = MAX_ENTRIES;
      save();
      emit();
      return entry;
    },

    remove(id) {
      const before = items.length;
      items = items.filter((i) => i.id !== id);
      if (items.length !== before) { save(); emit(); }
    },

    clear() {
      items = [];
      save();
      emit();
    },

    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    }
  };

  Calc.History = History;
})(typeof globalThis !== 'undefined' ? globalThis : window);
