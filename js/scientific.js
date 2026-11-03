/* scientific.js - math core: constants, domain-checked functions, number formatting.
   No parsing happens here; parser.js calls into this module. */
(function (g) {
  'use strict';
  const Calc = (g.Calc = g.Calc || {});

  class CalcError extends Error {
    constructor(message, code) {
      super(message);
      this.name = 'CalcError';
      this.code = code || 'math';
    }
  }
  const fail = (message, code) => new CalcError(message, code);

  const PI = Math.PI;
  const DIGITS = 15; // significant digits kept in results
  const CONSTANTS = Object.freeze({ pi: PI, e: Math.E, phi: (1 + Math.sqrt(5)) / 2 });

  /* ---------- validation and rounding ---------- */

  /** Throws on NaN / overflow / underflow; normalises -0. Does not round. */
  function check(v) {
    if (Number.isNaN(v)) throw fail('Invalid result', 'domain');
    if (!Number.isFinite(v)) throw fail('Result too large (overflow)', 'overflow');
    if (v === 0) return 0;
    if (Math.abs(v) < 1e-300) throw fail('Result too small (underflow)', 'underflow');
    return v;
  }

  /** check() plus rounding to 15 significant digits, which removes binary noise (0.1+0.2 -> 0.3). */
  function clean(v) {
    v = check(v);
    const r = Number(v.toPrecision(DIGITS));
    return Number.isFinite(r) ? r : v;
  }

  /* ---------- formatting ---------- */

  function format(v) {
    if (v === 0) return '0';
    const abs = Math.abs(v);
    if (abs >= 1e15 || abs < 1e-6) {
      const parts = v.toExponential(DIGITS - 1).split('e');
      let mantissa = parts[0];
      if (mantissa.indexOf('.') >= 0) mantissa = mantissa.replace(/\.?0+$/, '');
      const exp = parts[1];
      return mantissa + 'E' + (exp[0] === '-' ? '-' : '+') + exp.replace(/^[+-]/, '');
    }
    return String(Number(v.toPrecision(DIGITS)));
  }

  /** Format using the typographic minus so the string can go straight back into the expression. */
  function toExpression(v) {
    return format(v).replace(/-/g, '\u2212');
  }

  /* ---------- angles and trigonometry ---------- */

  const toRad = (x, angle) => (angle === 'DEG' ? (x * PI) / 180 : x);
  const fromRad = (x, angle) => (angle === 'DEG' ? (x * 180) / PI : x);

  /** If x is an exact non-zero multiple of a right angle return that multiple, else null. */
  function quadrant(x, angle) {
    if (angle === 'DEG') {
      const k = x / 90;
      return Number.isInteger(k) && k !== 0 ? k : null;
    }
    const k = x / (PI / 2);
    const n = Math.round(k);
    return n !== 0 && Math.abs(k - n) < 1e-12 * Math.max(1, Math.abs(n)) ? n : null;
  }
  const mod4 = (n) => ((n % 4) + 4) % 4;

  function sin(x, angle) {
    const n = quadrant(x, angle);
    return n !== null ? [0, 1, 0, -1][mod4(n)] : Math.sin(toRad(x, angle));
  }
  function cos(x, angle) {
    const n = quadrant(x, angle);
    return n !== null ? [1, 0, -1, 0][mod4(n)] : Math.cos(toRad(x, angle));
  }
  function tan(x, angle) {
    const n = quadrant(x, angle);
    if (n !== null) {
      if (mod4(n) % 2 === 1) throw fail('Tangent is undefined at this angle', 'domain');
      return 0;
    }
    return Math.tan(toRad(x, angle));
  }

  /* ---------- other math ---------- */

  function pow(a, b) {
    if (a === 0 && b < 0) throw fail('Cannot divide by zero', 'div0');
    if (a < 0 && !Number.isInteger(b)) throw fail('Invalid power: the result is not a real number', 'domain');
    const r = Math.pow(a, b);
    if (!Number.isFinite(r)) throw fail('Result too large (overflow)', 'overflow');
    if (r === 0 && a !== 0) throw fail('Result too small (underflow)', 'underflow');
    return r;
  }

  function fact(n) {
    if (!Number.isInteger(n) || n < 0) throw fail('Factorial needs a non-negative integer', 'domain');
    if (n > 170) throw fail('Result too large (overflow)', 'overflow');
    let r = 1;
    for (let i = 2; i <= n; i++) r *= i;
    return r;
  }

  function root(x, n) {
    if (n === 0) throw fail('The root index cannot be 0', 'domain');
    if (x === 0 && n < 0) throw fail('Cannot divide by zero', 'div0');
    if (x < 0) {
      if (Number.isInteger(n) && Math.abs(n) % 2 === 1) return -Math.pow(-x, 1 / n);
      throw fail('Even root of a negative number is not real', 'domain');
    }
    return Math.pow(x, 1 / n);
  }

  function logOf(x, fn) {
    if (x <= 0) throw fail('Logarithm needs a value greater than 0', 'domain');
    return fn(x);
  }

  function roundTo(x, digits) {
    if (digits === undefined) return Math.sign(x) * Math.round(Math.abs(x)); // half away from zero
    if (!Number.isInteger(digits) || digits < 0 || digits > 15) {
      throw fail('Round digits must be an integer from 0 to 15', 'domain');
    }
    const f = Math.pow(10, digits);
    return (Math.sign(x) * Math.round(Number((Math.abs(x) * f).toPrecision(15)))) / f;
  }

  function inverseTrig(fn, name) {
    return (a, c) => {
      if (Math.abs(a[0]) > 1) throw fail(name + ' needs a value between -1 and 1', 'domain');
      return fromRad(fn(a[0]), c.angle);
    };
  }

  const def = (min, max, fn) => ({ min, max, fn });

  /** Function table used by the parser. Each fn(args, ctx) receives numbers and { angle }. */
  const FUNCTIONS = {
    sin: def(1, 1, (a, c) => sin(a[0], c.angle)),
    cos: def(1, 1, (a, c) => cos(a[0], c.angle)),
    tan: def(1, 1, (a, c) => tan(a[0], c.angle)),
    asin: def(1, 1, inverseTrig(Math.asin, 'asin')),
    acos: def(1, 1, inverseTrig(Math.acos, 'acos')),
    atan: def(1, 1, (a, c) => fromRad(Math.atan(a[0]), c.angle)),
    log: def(1, 1, (a) => logOf(a[0], Math.log10)),
    ln: def(1, 1, (a) => logOf(a[0], Math.log)),
    log2: def(1, 1, (a) => logOf(a[0], Math.log2)),
    exp: def(1, 1, (a) => {
      const r = Math.exp(a[0]);
      if (r === 0) throw fail('Result too small (underflow)', 'underflow');
      return r;
    }),
    exp10: def(1, 1, (a) => pow(10, a[0])),
    sqrt: def(1, 1, (a) => {
      if (a[0] < 0) throw fail('Cannot take the square root of a negative number', 'domain');
      return Math.sqrt(a[0]);
    }),
    cbrt: def(1, 1, (a) => Math.cbrt(a[0])),
    abs: def(1, 1, (a) => Math.abs(a[0])),
    floor: def(1, 1, (a) => Math.floor(a[0])),
    ceil: def(1, 1, (a) => Math.ceil(a[0])),
    round: def(1, 2, (a) => roundTo(a[0], a[1])),
    fact: def(1, 1, (a) => fact(a[0])),
    root: def(2, 2, (a) => root(a[0], a[1]))
  };

  Calc.Scientific = { CalcError, CONSTANTS, FUNCTIONS, check, clean, format, toExpression, pow, fact };
})(typeof globalThis !== 'undefined' ? globalThis : window);
