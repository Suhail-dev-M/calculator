/* storage.js - tiny JSON wrapper around localStorage with an in-memory fallback. */
(function (g) {
  'use strict';
  const Calc = (g.Calc = g.Calc || {});

  let namespace = 'calc.v1.';
  const fallback = {};
  let usable = true;
  try {
    const probe = '__calc_probe__';
    g.localStorage.setItem(probe, '1');
    g.localStorage.removeItem(probe);
  } catch (e) {
    usable = false;
  }

  const Storage = {
    get available() { return usable; },

    /** Change the key prefix (the test page uses this so it never touches real data). */
    setNamespace(ns) { namespace = String(ns); },

    get(key, defaultValue) {
      try {
        const raw = usable ? g.localStorage.getItem(namespace + key) : fallback[namespace + key];
        if (raw === null || raw === undefined) return defaultValue;
        return JSON.parse(raw);
      } catch (e) {
        return defaultValue;
      }
    },

    set(key, value) {
      const raw = JSON.stringify(value);
      try {
        if (usable) g.localStorage.setItem(namespace + key, raw);
        else fallback[namespace + key] = raw;
        return true;
      } catch (e) {
        fallback[namespace + key] = raw; // quota exceeded etc.
        return false;
      }
    },

    remove(key) {
      try {
        if (usable) g.localStorage.removeItem(namespace + key);
      } catch (e) { /* ignore */ }
      delete fallback[namespace + key];
    }
  };

  Calc.Storage = Storage;
})(typeof globalThis !== 'undefined' ? globalThis : window);
