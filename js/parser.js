/* parser.js - tokenizer + shunting-yard expression parser + RPN evaluator.
   No eval(), no Function(): the input string is only ever turned into tokens and walked by hand. */
(function (g) {
  'use strict';
  const Calc = g.Calc;
  const S = Calc.Scientific;
  const CalcError = S.CalcError;
  const syntax = (message) => new CalcError(message, 'syntax');

  const MAX_LENGTH = 500;
  const EPS = 4.5e-16; // ~2 ulp, used to discard cancellation noise (0.1+0.2-0.3)

  /* ---------- tokenizer ---------- */

  const WORDS = {
    asin: 'func', acos: 'func', atan: 'func', sin: 'func', cos: 'func', tan: 'func',
    log2: 'func', log: 'func', ln: 'func', exp10: 'func', exp: 'func', sqrt: 'func',
    cbrt: 'func', abs: 'func', floor: 'func', ceil: 'func', round: 'func', fact: 'func', root: 'func',
    mod: 'op', pi: 'const', phi: 'const', e: 'const', Ans: 'const', ans: 'const'
  };
  const WORD_LIST = Object.keys(WORDS).sort((a, b) => b.length - a.length); // longest match first
  const CONST_NAME = { pi: 'pi', phi: 'phi', e: 'e', Ans: 'ans', ans: 'ans' };

  const OPS = { '+': '+', '-': '-', '\u2212': '-', '*': '*', '\u00d7': '*', '/': '/', '\u00f7': '/', '^': '^' };
  const POSTFIX = { '!': '!', '%': '%', '\u00b2': '\u00b2', '\u00b3': '\u00b3' };
  const GLYPH_FUNCS = { '\u221a': 'sqrt', '\u221b': 'cbrt' };
  const GLYPH_CONSTS = { '\u03c0': 'pi', '\u03c6': 'phi' };
  const NUMBER_RE = /^(?:\d+\.?\d*|\.\d+)(?:E[+\-\u2212]?\d+)?/;

  /** Pure lexical pass. Tokens keep { start, end } so the UI can locate operands. */
  function tokenize(input) {
    const s = String(input);
    if (s.length > MAX_LENGTH) throw syntax('Expression is too long');
    const tokens = [];
    let i = 0;
    let sawSpace = false;

    while (i < s.length) {
      const c = s[i];
      if (/\s/.test(c)) { sawSpace = true; i++; continue; }
      const prev = tokens[tokens.length - 1];
      if (sawSpace && prev && prev.type === 'num' && /[0-9.]/.test(c)) throw syntax('Missing operator between numbers');
      sawSpace = false;

      if (/[0-9.]/.test(c)) {
        const m = NUMBER_RE.exec(s.slice(i));
        if (!m) throw syntax('Invalid number');
        const end = i + m[0].length;
        if (/[0-9.]/.test(s[end] || '')) throw syntax('Invalid number');
        const value = parseFloat(m[0].replace('\u2212', '-'));
        if (!Number.isFinite(value)) throw new CalcError('Number is too large (overflow)', 'overflow');
        tokens.push({ type: 'num', value, start: i, end });
        i = end;
        continue;
      }

      let matched = false;
      for (const w of WORD_LIST) {
        if (s.startsWith(w, i)) {
          const end = i + w.length;
          const kind = WORDS[w];
          if (kind === 'func') tokens.push({ type: 'func', name: w, start: i, end });
          else if (kind === 'op') tokens.push({ type: 'op', value: 'mod', start: i, end });
          else tokens.push({ type: 'const', name: CONST_NAME[w], start: i, end });
          i = end;
          matched = true;
          break;
        }
      }
      if (matched) continue;

      if (OPS[c]) tokens.push({ type: 'op', value: OPS[c], start: i, end: i + 1 });
      else if (c === '(') tokens.push({ type: 'lp', start: i, end: i + 1 });
      else if (c === ')') tokens.push({ type: 'rp', start: i, end: i + 1 });
      else if (c === ',') tokens.push({ type: 'comma', start: i, end: i + 1 });
      else if (POSTFIX[c]) tokens.push({ type: 'post', value: POSTFIX[c], start: i, end: i + 1 });
      else if (GLYPH_FUNCS[c]) tokens.push({ type: 'func', name: GLYPH_FUNCS[c], start: i, end: i + 1 });
      else if (GLYPH_CONSTS[c]) tokens.push({ type: 'const', name: GLYPH_CONSTS[c], start: i, end: i + 1 });
      else if (c === '\u207b' && s[i + 1] === '\u00b9') {
        tokens.push({ type: 'post', value: '\u207b\u00b9', start: i, end: i + 2 });
        i += 2;
        continue;
      } else throw syntax('Unexpected character "' + c + '"');
      i++;
    }
    return tokens;
  }

  /* ---------- shunting-yard ---------- */

  const PREC = { '+': 1, '-': 1, '*': 2, '/': 2, mod: 2, neg: 3, pos: 3, '^': 4 };
  const RIGHT = { '^': true, neg: true, pos: true };

  const endsValue = (t) => t && (t.type === 'num' || t.type === 'const' || t.type === 'rp' || t.type === 'post');
  const startsValue = (t) => t && (t.type === 'num' || t.type === 'const' || t.type === 'func' || t.type === 'lp');

  /** 2(3), 3pi, (1)(2), 2sin(30) ... get an explicit multiplication. */
  function insertImplicit(tokens) {
    const out = [];
    tokens.forEach((t) => {
      if (endsValue(out[out.length - 1]) && startsValue(t)) out.push({ type: 'op', value: '*', implicit: true });
      out.push(t);
    });
    return out;
  }

  function toRPN(rawTokens) {
    if (!rawTokens.length) throw syntax('Empty expression');
    const tokens = insertImplicit(rawTokens);
    const out = [];
    const stack = [];
    const frames = []; // one per open parenthesis: is it a function call, and how many arguments so far
    let expectOperand = true;

    for (let idx = 0; idx < tokens.length; idx++) {
      const t = tokens[idx];
      switch (t.type) {
        case 'num':
        case 'const':
          out.push(t);
          expectOperand = false;
          break;

        case 'func': {
          const next = tokens[idx + 1];
          if (!next || next.type !== 'lp') throw syntax('"' + t.name + '" must be followed by parentheses');
          stack.push(t);
          break;
        }

        case 'lp': {
          const top = stack[stack.length - 1];
          frames.push({ isFunc: !!(top && top.type === 'func'), argc: 1 });
          stack.push(t);
          expectOperand = true;
          break;
        }

        case 'comma': {
          if (expectOperand) throw syntax('Unexpected comma');
          while (stack.length && stack[stack.length - 1].type !== 'lp') out.push(stack.pop());
          const frame = frames[frames.length - 1];
          if (!stack.length || !frame || !frame.isFunc) throw syntax('Unexpected comma');
          frame.argc++;
          expectOperand = true;
          break;
        }

        case 'rp': {
          if (expectOperand) {
            const before = tokens[idx - 1];
            throw syntax(before && before.type === 'lp' ? 'Empty parentheses' : 'Incomplete expression');
          }
          while (stack.length && stack[stack.length - 1].type !== 'lp') out.push(stack.pop());
          if (!stack.length) throw syntax('Mismatched parentheses');
          stack.pop();
          const frame = frames.pop();
          if (frame.isFunc) out.push({ type: 'func', name: stack.pop().name, argc: frame.argc });
          expectOperand = false;
          break;
        }

        case 'op': {
          if (expectOperand) {
            // prefix (unary) operator
            if (t.value === '-') stack.push({ type: 'op', value: 'neg' });
            else if (t.value === '+') stack.push({ type: 'op', value: 'pos' });
            else throw syntax('Unexpected operator');
            break;
          }
          while (stack.length) {
            const top = stack[stack.length - 1];
            if (top.type !== 'op') break;
            const pTop = PREC[top.value];
            const pCur = PREC[t.value];
            if (pTop > pCur || (pTop === pCur && !RIGHT[t.value])) out.push(stack.pop());
            else break;
          }
          stack.push({ type: 'op', value: t.value });
          expectOperand = true;
          break;
        }

        case 'post':
          if (expectOperand) throw syntax('Unexpected operator');
          out.push(t); // postfix operators bind tightest, so they go straight to the output
          break;

        default:
          throw syntax('Invalid expression');
      }
    }

    if (expectOperand) throw syntax('Incomplete expression');
    while (stack.length) {
      const top = stack.pop();
      if (top.type === 'lp') throw syntax('Mismatched parentheses');
      out.push(top);
    }
    return out;
  }

  /* ---------- evaluation ---------- */

  function binary(op, a, b) {
    const x = a.v;
    let y = b.v;
    switch (op) {
      case '+':
      case '-': {
        if (b.pct) y = x * b.v; // 200 + 10%  ->  200 + (10% of 200)
        const r = op === '+' ? x + y : x - y;
        // cancellation noise: a result within ~2 ulp of the operands is really zero
        if (r !== 0 && Math.abs(r) <= EPS * Math.max(Math.abs(x), Math.abs(y))) return 0;
        return S.check(r);
      }
      case '*': {
        const r = x * y;
        if (r === 0 && x !== 0 && y !== 0) throw new CalcError('Result too small (underflow)', 'underflow');
        return S.check(r);
      }
      case '/':
        if (y === 0) {
          throw new CalcError(x === 0 ? 'Result is undefined' : 'Cannot divide by zero', 'div0');
        }
        return S.check(x / y);
      case 'mod': {
        if (y === 0) throw new CalcError('Modulo by zero is undefined', 'div0');
        let r = x % y;
        if (r !== 0 && Math.abs(Math.abs(r) - Math.abs(y)) <= 1e-12 * Math.abs(y)) r = 0; // 0.3 mod 0.1
        return S.check(r);
      }
      case '^':
        return S.check(S.pow(x, y));
      default:
        throw syntax('Invalid expression');
    }
  }

  function postfix(op, a) {
    switch (op) {
      case '%': return { v: S.check(a.v / 100), pct: true };
      case '!': return { v: S.check(S.fact(a.v)) };
      case '\u00b2': return { v: S.check(S.pow(a.v, 2)) };
      case '\u00b3': return { v: S.check(S.pow(a.v, 3)) };
      case '\u207b\u00b9':
        if (a.v === 0) throw new CalcError('Cannot divide by zero', 'div0');
        return { v: S.check(1 / a.v) };
      default:
        throw syntax('Invalid expression');
    }
  }

  function evalRPN(rpn, ctx) {
    const st = [];
    const pop = () => {
      if (!st.length) throw syntax('Invalid expression');
      return st.pop();
    };

    for (const t of rpn) {
      if (t.type === 'num') {
        st.push({ v: t.value });
      } else if (t.type === 'const') {
        st.push({ v: t.name === 'ans' ? ctx.ans : S.CONSTANTS[t.name] });
      } else if (t.type === 'post') {
        st.push(postfix(t.value, pop()));
      } else if (t.type === 'func') {
        const def = S.FUNCTIONS[t.name];
        if (t.argc < def.min || t.argc > def.max) {
          const want = def.min === def.max ? String(def.min) : def.min + ' or ' + def.max;
          throw syntax(t.name + ' needs ' + want + ' argument' + (def.max === 1 ? '' : 's'));
        }
        if (st.length < t.argc) throw syntax('Invalid expression');
        const args = st.splice(st.length - t.argc, t.argc).map((x) => x.v);
        st.push({ v: S.check(def.fn(args, ctx)) });
      } else if (t.value === 'neg') {
        st.push({ v: -pop().v });
      } else if (t.value === 'pos') {
        st.push({ v: pop().v });
      } else {
        const b = pop();
        const a = pop();
        st.push({ v: binary(t.value, a, b) });
      }
    }
    if (st.length !== 1) throw syntax('Invalid expression');
    return st[0].v;
  }

  /** Evaluate an expression string. ctx = { angle: 'DEG' | 'RAD', ans: number }. Throws CalcError. */
  function evaluate(expression, ctx) {
    const context = Object.assign({ angle: 'DEG', ans: 0 }, ctx);
    return S.clean(evalRPN(toRPN(tokenize(expression)), context));
  }

  Calc.Parser = { tokenize, toRPN, evaluate };
})(typeof globalThis !== 'undefined' ? globalThis : window);
