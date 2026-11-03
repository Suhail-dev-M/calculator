/* calculator.js - the calculator model: an editable expression plus the rules for typing into it.
   It knows nothing about the DOM. Display glyphs (x, /, -, pi) live in the expression string and
   parser.js understands them directly. */
(function (g) {
  'use strict';
  const Calc = g.Calc;
  const S = Calc.Scientific;
  const P = Calc.Parser;

  const MINUS = '\u2212';
  const OP_END = /(?:[+\u2212\u00d7\u00f7^]|mod)$/;                        // ends with an operator
  const VALUE_END = /(?:[0-9.)\u03c0\u03c6!%\u00b2\u00b3]|e|Ans|\u207b\u00b9)$/; // ends with a finished value
  const EXP_OPEN = /E[+\u2212]?$/;                                          // "1E" or "1E-" (waiting for digits)
  const IN_EXP = /E[+\u2212]?\d*$/;                                         // typing an exponent
  const TOKEN_TAIL = /(?:(?:asin|acos|atan|sin|cos|tan|log2|log|ln|exp10|exp|abs|floor|ceil|round|fact|root|sqrt|cbrt)\(|[\u221a\u221b]\(|Ans|mod|\u207b\u00b9)$/;
  const PLAIN_NUMBER = /^[\u2212-]?(?:\d+\.?\d*|\.\d+)(?:E[+\u2212-]?\d+)?$/;
  const MAX_NUMBER_CHARS = 16;

  const count = (s, ch) => s.split(ch).length - 1;

  /** Add missing closing parentheses so "sin(30" works like "sin(30)". */
  function autoClose(expr) {
    const missing = count(expr, '(') - count(expr, ')');
    return missing > 0 ? expr + ')'.repeat(missing) : expr;
  }

  const messageOf = (e) => (e instanceof S.CalcError ? e.message : 'Invalid expression');

  class Calculator {
    /** hooks.onResult({ expression, result, value, trivial }) fires after every successful "=". */
    constructor(hooks) {
      this.hooks = hooks || {};
      this.angle = 'DEG';
      this.ans = 0;
      this.clear();
    }

    clear() {
      this.expr = '';
      this.prev = '';
      this.error = null;
      this.justEvaluated = false;
    }

    setExpression(str) {
      this.error = null;
      this.justEvaluated = false;
      this.expr = String(str);
    }

    /* ---------- helpers ---------- */

    /** Span of the last operand (number, constant, group or function call, plus postfix ops and a unary minus). */
    lastOperand() {
      let toks;
      try { toks = P.tokenize(this.expr); } catch (e) { return null; }
      let i = toks.length - 1;
      while (i >= 0 && toks[i].type === 'post') i--;
      if (i < 0) return null;

      let start = i;
      const t = toks[i];
      if (t.type === 'rp') {
        let depth = 0;
        let j = i;
        for (; j >= 0; j--) {
          if (toks[j].type === 'rp') depth++;
          else if (toks[j].type === 'lp') {
            depth--;
            if (depth === 0) break;
          }
        }
        if (j < 0) return null;
        start = j;
        if (j > 0 && toks[j - 1].type === 'func') start = j - 1;
      } else if (t.type !== 'num' && t.type !== 'const') {
        return null;
      }

      const before = toks[start - 1];
      if (before && before.type === 'op' && before.value === '-') {
        const pp = toks[start - 2];
        if (!pp || pp.type === 'op' || pp.type === 'lp' || pp.type === 'comma') start--; // unary minus
      }
      return { start: toks[start].start, end: toks[toks.length - 1].end };
    }

    /* ---------- typing ---------- */

    typeDigit(d) {
      this.error = null;
      if (this.justEvaluated) { this.expr = d; this.justEvaluated = false; return; }
      let e = this.expr;
      if (IN_EXP.test(e)) {
        if (/E[+\u2212]?\d{3}$/.test(e)) return;
      } else if (/[0-9.]$/.test(e)) {
        if (/[0-9.]+$/.exec(e)[0].length >= MAX_NUMBER_CHARS) return;
        if (/(^|[^0-9.])0$/.test(e)) e = e.slice(0, -1); // no leading zeros
      } else if (VALUE_END.test(e)) {
        e += '\u00d7';
      }
      this.expr = e + d;
    }

    typeDecimal() {
      this.error = null;
      if (this.justEvaluated) { this.expr = '0.'; this.justEvaluated = false; return; }
      const e = this.expr;
      if (IN_EXP.test(e)) return;
      const m = /[0-9.]+$/.exec(e);
      if (m) {
        if (m[0].indexOf('.') >= 0) return;
        this.expr = e + '.';
        return;
      }
      this.expr = e + (VALUE_END.test(e) ? '\u00d70.' : '0.');
    }

    typeExponent() {
      this.error = null;
      const e = this.expr;
      if (!/[0-9]$/.test(e) || IN_EXP.test(e)) return;
      this.justEvaluated = false;
      this.expr = e + 'E';
    }

    typeOperator(op) {
      this.error = null;
      this.justEvaluated = false; // continue from the displayed result
      const e = this.expr;

      if (e === '') {
        if (op === MINUS) this.expr = MINUS;
        else if (op !== '+') this.expr = '0' + op;
        return;
      }
      if (/E$/.test(e)) { // exponent sign: 1E+5 / 1E-5
        if (op === '+' || op === MINUS) this.expr = e + op;
        return;
      }
      if (EXP_OPEN.test(e)) return;
      if (/[(,]$/.test(e)) {
        if (op === MINUS) this.expr = e + MINUS;
        return;
      }
      if (OP_END.test(e)) {
        if (op === MINUS) {
          if (/(?:[\u00d7\u00f7^]|mod)$/.test(e)) { this.expr = e + MINUS; return; }
          if (/\+$/.test(e)) { this.expr = e.slice(0, -1) + MINUS; return; }
          return; // already a minus
        }
        let base = e.replace(OP_END, '');
        if (OP_END.test(base)) base = base.replace(OP_END, ''); // "x-" typed after an operator
        if (base === '' || /[(,]$/.test(base)) return;
        this.expr = base + op;
        return;
      }
      this.expr = e + op;
    }

    /** Insert name( - wrapping the last operand when there is one (30 then sin -> sin(30)). */
    typeFunction(name, keepOpen) {
      this.error = null;
      const open = name + '(';
      const close = keepOpen ? '' : ')';
      if (this.justEvaluated) {
        this.expr = open + this.expr + close;
        this.justEvaluated = false;
        return;
      }
      const e = this.expr;
      const span = this.lastOperand();
      if (span) {
        this.expr = e.slice(0, span.start) + open + e.slice(span.start, span.end) + close + e.slice(span.end);
        return;
      }
      if (EXP_OPEN.test(e)) return;
      this.expr = e + (VALUE_END.test(e) ? '\u00d7' : '') + open;
    }

    typeConstant(sym) {
      this.error = null;
      if (this.justEvaluated) { this.expr = sym; this.justEvaluated = false; return; }
      const e = this.expr;
      if (EXP_OPEN.test(e)) return;
      this.expr = e + (VALUE_END.test(e) ? '\u00d7' : '') + sym;
    }

    typeParen(ch) {
      this.error = null;
      if (ch === '(') {
        if (this.justEvaluated) { this.expr = ''; this.justEvaluated = false; }
        const e = this.expr;
        if (EXP_OPEN.test(e)) return;
        this.expr = e + (VALUE_END.test(e) ? '\u00d7(' : '(');
        return;
      }
      if (this.justEvaluated) return;
      const e = this.expr;
      if (count(e, '(') <= count(e, ')') || !VALUE_END.test(e)) return; // no "()" and no unmatched ")"
      this.expr = e + ')';
    }

    typeComma() {
      this.error = null;
      const e = this.expr;
      if (this.justEvaluated || count(e, '(') <= count(e, ')') || !VALUE_END.test(e)) return;
      this.expr = e + ',';
    }

    /** Postfix operators: ! % squared cubed reciprocal. They apply to the last operand. */
    typePostfix(sym) {
      this.error = null;
      if (!this.expr) return;
      if (this.justEvaluated) {
        if (this.expr[0] === MINUS) this.expr = '(' + this.expr + ')';
        this.expr += sym;
        this.justEvaluated = false;
        return;
      }
      const span = this.lastOperand();
      if (!span) return;
      const e = this.expr;
      const first = e[span.start];
      if (first === MINUS || first === '-') {
        this.expr = e.slice(0, span.start) + '(' + e.slice(span.start, span.end) + ')' + sym; // (-5)^2, not -(5^2)
      } else {
        this.expr = e + sym;
      }
    }

    /** +/- : negate the last operand. */
    toggleSign() {
      this.error = null;
      const e = this.expr;
      if (e === '') { this.expr = MINUS; return; }
      if (e === MINUS) { this.expr = ''; return; }
      const span = this.lastOperand();
      if (!span) {
        if (/(?:[\u00d7\u00f7^(,]|mod)$/.test(e)) this.expr = e + MINUS;
        else if (/(?:[\u00d7\u00f7^(,]|mod)\u2212$/.test(e)) this.expr = e.slice(0, -1);
        return;
      }
      const operand = e.slice(span.start, span.end);
      const before = e.slice(0, span.start);
      const wrappedSimple = /^\(\u2212(?:(?:\d+\.?\d*|\.\d+)(?:E[+\u2212]?\d+)?|\u03c0|\u03c6|e|Ans)\)$/;

      if (operand[0] === MINUS || operand[0] === '-') {
        this.expr = before + operand.slice(1);
      } else if (wrappedSimple.test(operand)) {
        this.expr = before + operand.slice(2, -1);
      } else if (before === '' || /(?:[(,\u00d7\u00f7^]|mod)$/.test(before)) {
        this.expr = before + MINUS + operand;
      } else {
        this.expr = before + '(' + MINUS + operand + ')';
      }
    }

    /** Insert a number (history result, memory recall) as if it had been typed. */
    insertValue(str) {
      this.error = null;
      if (this.justEvaluated || !this.expr) { this.expr = str; this.justEvaluated = false; return; }
      let e = this.expr;
      if (EXP_OPEN.test(e)) return;
      if (VALUE_END.test(e)) e += '\u00d7';
      this.expr = e + str;
    }

    backspace() {
      this.error = null;
      if (this.justEvaluated) { this.expr = ''; this.justEvaluated = false; return; }
      const m = TOKEN_TAIL.exec(this.expr);
      this.expr = m ? this.expr.slice(0, m.index) : this.expr.slice(0, -1); // "sin(" and "Ans" go in one press
    }

    /* ---------- evaluating ---------- */

    equals() {
      this.error = null;
      if (this.justEvaluated || !this.expr) return { ok: true, noop: true };
      const expression = autoClose(this.expr);
      try {
        const value = P.evaluate(expression, { angle: this.angle, ans: this.ans });
        const result = S.toExpression(value);
        const trivial = expression === result;
        this.prev = trivial ? '' : expression + ' =';
        this.expr = result;
        this.justEvaluated = true;
        this.ans = value;
        if (this.hooks.onResult) this.hooks.onResult({ expression, result, value, trivial });
        return { ok: true, value };
      } catch (e) {
        this.error = messageOf(e);
        return { ok: false, error: this.error };
      }
    }

    /** Numeric value of what is on screen, or null (used by M+, M-, MS). */
    currentValue() {
      if (this.justEvaluated) return this.ans;
      if (!this.expr) return null;
      try {
        return P.evaluate(autoClose(this.expr), { angle: this.angle, ans: this.ans });
      } catch (e) {
        return null;
      }
    }

    /** Live "= result" hint shown under the display while typing. */
    preview() {
      if (this.error || this.justEvaluated || !this.expr || PLAIN_NUMBER.test(this.expr)) return '';
      try {
        return S.toExpression(P.evaluate(autoClose(this.expr), { angle: this.angle, ans: this.ans }));
      } catch (e) {
        return '';
      }
    }
  }

  Calc.Calculator = Calculator;
  Calc.autoClose = autoClose;
})(typeof globalThis !== 'undefined' ? globalThis : window);
