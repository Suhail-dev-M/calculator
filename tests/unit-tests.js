/* unit-tests.js - engine, model and persistence tests. Runs in Node (tests/run-tests.js) and in tests/tests.html. */
(function (g) {
  'use strict';

  g.registerUnitTests = function (T, Calc) {
    const P = Calc.Parser;
    const S = Calc.Scientific;
    const DEG = { angle: 'DEG', ans: 0 };
    const RAD = { angle: 'RAD', ans: 0 };
    const ev = (s, ctx) => P.evaluate(s, ctx || DEG);

    function table(title, rows, ctx) {
      rows.forEach(([expr, want]) => T.test(title + ': ' + expr + ' = ' + want, () => T.near(ev(expr, ctx), want)));
    }
    function exact(title, rows, ctx) {
      rows.forEach(([expr, want]) => T.test(title + ': ' + expr + ' = ' + want, () => T.eq(ev(expr, ctx), want)));
    }
    function errors(title, rows) {
      rows.forEach(([expr, part]) => T.test(title + ': "' + expr + '" -> ' + part, () => T.throws(() => ev(expr), part)));
    }

    /* ================= parser ================= */
    T.suite('Operator precedence');
    table('precedence', [
      ['2+3*4', 14], ['(2+3)*4', 20], ['2^3^2', 512], ['-2^2', -4], ['2^-2', 0.25], ['10-4-3', 3],
      ['100/10/5', 2], ['2*3+4*5', 26], ['8/2*4', 16], ['2+3*4^2/8-1', 7], ['-7mod3', -1],
      ['7mod3', 1], ['2*3mod4', 2], ['2^3*2', 16], ['-3^2', -9]
    ]);

    T.suite('Nested parentheses');
    table('nesting', [
      ['((2+3)*(4-1))/5', 3], ['2*(3+(4*(5-2)))', 30], ['(((((1)))))', 1], ['((1+2)*(3+4))*((5-1)/2)', 42]
    ]);

    T.suite('Negative numbers and unary operators');
    table('unary', [
      ['-5+3', -2], ['5*-3', -15], ['--5', 5], ['-(2+3)', -5], ['(-2)^2', 4], ['2-(-3)', 5],
      ['+5', 5], ['3*-(-2)', 6], ['-2*-3', 6], ['-5!', -120]
    ]);

    T.suite('Decimal precision');
    exact('precision', [
      ['0.1+0.2', 0.3], ['0.3-0.1', 0.2], ['1.1*1.1', 1.21], ['4.35*100', 435], ['0.1*3', 0.3],
      ['1/3*3', 1], ['0.1+0.2-0.3', 0], ['.5+.5', 1], ['5.+1', 6], ['0.7+0.1', 0.8],
      ['1/3', 0.333333333333333], ['2/3', 0.666666666666667], ['4.35*100-435', 0], ['0.3mod0.1', 0]
    ]);

    T.suite('Degrees and radians');
    table('DEG', [
      ['sin(30)', 0.5], ['sin(90)', 1], ['sin(0)', 0], ['sin(180)', 0], ['sin(270)', -1], ['sin(360)', 0],
      ['cos(0)', 1], ['cos(60)', 0.5], ['cos(90)', 0], ['cos(180)', -1], ['tan(45)', 1], ['tan(0)', 0],
      ['tan(135)', -1], ['sin(-30)', -0.5], ['sin(45)', 0.707106781186548],
      ['asin(1)', 90], ['asin(0.5)', 30], ['asin(-1)', -90], ['acos(0.5)', 60], ['acos(-1)', 180],
      ['atan(1)', 45], ['atan(0)', 0]
    ]);
    table('RAD', [
      ['sin(pi/2)', 1], ['cos(pi)', -1], ['sin(pi)', 0], ['tan(pi/4)', 1], ['cos(pi/2)', 0],
      ['sin(3*pi/2)', -1], ['sin(2*pi)', 0], ['asin(1)', Math.PI / 2], ['atan(1)', Math.PI / 4],
      ['acos(0)', Math.PI / 2], ['sin(1)', 0.841470984807897]
    ], RAD);
    T.test('same input, different unit: sin(90) is 1 in DEG but not in RAD', () => {
      T.eq(ev('sin(90)', DEG), 1);
      T.near(ev('sin(90)', RAD), 0.893996663600558);
    });
    T.test('exact zero for sin(pi) (no 1.22e-16 noise)', () => T.eq(ev('sin(pi)', RAD), 0));

    T.suite('Scientific functions');
    table('logs', [
      ['log(1000)', 3], ['log(0.001)', -3], ['ln(e)', 1], ['ln(1)', 0], ['log2(8)', 3], ['log2(1024)', 10],
      ['exp10(2)', 100], ['exp(0)', 1], ['exp(1)', Math.E]
    ]);
    table('powers and roots', [
      ['5!', 120], ['0!', 1], ['1!', 1], ['10!', 3628800], ['20!', 2432902008176640000],
      ['3\u00b2', 9], ['2\u00b3', 8], ['5\u207b\u00b9', 0.2], ['4^0.5', 2], ['2^10', 1024],
      ['sqrt(16)', 4], ['\u221a(16)', 4], ['\u221b(27)', 3], ['\u221b(-8)', -2], ['cbrt(1000)', 10],
      ['root(16,4)', 2], ['root(-27,3)', -3], ['root(32,5)', 2]
    ]);
    table('rounding and friends', [
      ['abs(-5)', 5], ['abs(5)', 5], ['floor(2.7)', 2], ['floor(-2.1)', -3], ['ceil(2.1)', 3], ['ceil(-2.9)', -2],
      ['round(2.5)', 3], ['round(-2.5)', -3], ['round(2.4)', 2], ['round(3.14159,2)', 3.14], ['round(1.005,2)', 1.01],
      ['10mod3', 1], ['5.5mod2', 1.5]
    ]);
    table('scientific notation', [
      ['1E3', 1000], ['1.5E-3', 0.0015], ['2E2*3', 600], ['1E+2', 100], ['5E0', 5], ['1E-2', 0.01], ['1.5E3\u00f73', 500]
    ]);
    table('constants', [
      ['pi', Math.PI], ['\u03c0', Math.PI], ['e', Math.E], ['\u03c6', 1.618033988749895],
      ['phi*phi-phi', 1], ['2*pi', 2 * Math.PI]
    ]);
    table('implicit multiplication', [
      ['3(4)', 12], ['(2)(3)', 6], ['2sin(30)', 1], ['2pi', 2 * Math.PI], ['sin(30)cos(60)', 0.25], ['2\u03c0', 2 * Math.PI]
    ]);
    table('percent', [
      ['50%', 0.5], ['200+10%', 220], ['200-10%', 180], ['200*10%', 20], ['10%+5', 5.1], ['50%*50%', 0.25], ['(10)%', 0.1]
    ]);
    T.test('Ans uses the previous answer', () => {
      const ctx = { angle: 'DEG', ans: 42 };
      T.eq(ev('Ans*2', ctx), 84);
      T.eq(ev('Ans+Ans', ctx), 84);
      T.eq(ev('2Ans', ctx), 84);
    });
    T.test('function with the typographic glyphs and spaces', () => T.eq(ev(' 6 \u00d7 7 \u2212 2 \u00f7 2 '), 41));

    T.suite('Invalid inputs and error messages');
    errors('math errors', [
      ['1/0', 'divide by zero'], ['0/0', 'undefined'], ['5/(3-3)', 'divide by zero'], ['sqrt(-1)', 'negative'],
      ['log(0)', 'greater than 0'], ['log(-5)', 'greater than 0'], ['ln(0)', 'greater than 0'], ['log2(-1)', 'greater than 0'],
      ['asin(2)', 'between'], ['acos(-2)', 'between'], ['tan(90)', 'undefined'], ['(-8)^0.5', 'not a real'],
      ['0^-1', 'divide by zero'], ['5mod0', 'modulo'], ['root(4,0)', 'index'], ['root(-4,2)', 'even root'],
      ['0\u207b\u00b9', 'divide by zero']
    ]);
    errors('factorial', [['2.5!', 'non-negative integer'], ['(-3)!', 'non-negative integer'], ['171!', 'overflow']]);
    errors('overflow/underflow', [
      ['10^400', 'overflow'], ['10^-400', 'underflow'], ['exp(1000)', 'overflow'], ['exp(-1000)', 'underflow'],
      ['1E999', 'overflow'], ['1E300*1E300', 'overflow']
    ]);
    errors('malformed input', [
      ['(2+3', 'mismatched'], ['2+3)', 'mismatched'], ['()', 'empty'], ['sin()', 'empty'], ['2+', 'incomplete'],
      ['2^', 'incomplete'], ['*3', 'unexpected'], ['2**3', 'unexpected'], ['sin', 'parentheses'], ['sin 30', 'parentheses'],
      ['5 5', 'missing operator'], ['1.2.3', 'invalid number'], ['abc', 'unexpected'], ['foo(2)', 'unexpected'],
      ['root(4)', 'argument'], ['sqrt(1,2)', 'argument'], ['1,2', 'comma'], ['', 'empty'], ['   ', 'empty'],
      ['1E', 'unexpected'], ['!5', 'unexpected'], ['(*)', 'unexpected']
    ]);
    errors('code injection is just an invalid expression', [
      ['alert(1)', 'unexpected'], ['__proto__', 'unexpected'], ['constructor', 'unexpected'],
      ['1;process.exit()', 'unexpected'], ['this', 'unexpected'], ['`1`', 'unexpected']
    ]);
    T.test('errors are CalcError instances, not raw JavaScript exceptions', () => {
      ['1/0', '(', 'sqrt(-1)', 'abc', '10^400'].forEach((s) => {
        try { ev(s); } catch (e) { T.ok(e instanceof S.CalcError, s + ' threw ' + e.name); return; }
        throw new Error(s + ' did not throw');
      });
    });

    /* ================= calculator model ================= */
    T.suite('Calculator model (what the keypad does)');
    const make = () => {
      const log = [];
      const calc = new Calc.Calculator({ onResult: (r) => log.push(r) });
      return { calc, log };
    };
    const type = (calc, seq) => {
      for (const ch of seq) {
        if (/[0-9]/.test(ch)) calc.typeDigit(ch);
        else if (ch === '.') calc.typeDecimal();
        else if (ch === '+') calc.typeOperator('+');
        else if (ch === '-') calc.typeOperator('\u2212');
        else if (ch === '*') calc.typeOperator('\u00d7');
        else if (ch === '/') calc.typeOperator('\u00f7');
        else if (ch === '(' || ch === ')') calc.typeParen(ch);
        else throw new Error('bad test key ' + ch);
      }
    };

    T.test('2+3*4 = 14 and is logged to history', () => {
      const { calc, log } = make();
      type(calc, '2+3*4');
      T.eq(calc.expr, '2+3\u00d74');
      calc.equals();
      T.eq(calc.expr, '14');
      T.eq(calc.prev, '2+3\u00d74 =');
      T.eq(log.length, 1);
      T.eq(log[0].expression, '2+3\u00d74');
      T.eq(log[0].result, '14');
    });
    T.test('chained calculation continues from the result', () => {
      const { calc } = make();
      type(calc, '2+3*4');
      calc.equals();
      type(calc, '+5');
      T.eq(calc.expr, '14+5');
      calc.equals();
      T.eq(calc.expr, '19');
    });
    T.test('typing a digit after = starts a new calculation', () => {
      const { calc } = make();
      type(calc, '2+2');
      calc.equals();
      type(calc, '7');
      T.eq(calc.expr, '7');
    });
    T.test('a bare number is not logged to history', () => {
      const { calc, log } = make();
      type(calc, '5');
      calc.equals();
      T.eq(log.filter((l) => !l.trivial).length, 0);
    });
    T.test('percent: 200 + 10 % = 220', () => {
      const { calc } = make();
      type(calc, '200+10');
      calc.typePostfix('%');
      T.eq(calc.expr, '200+10%');
      calc.equals();
      T.eq(calc.expr, '220');
    });
    T.test('square root wraps the last number: 9 then sqrt', () => {
      const { calc } = make();
      type(calc, '9');
      calc.typeFunction('\u221a');
      T.eq(calc.expr, '\u221a(9)');
      calc.equals();
      T.eq(calc.expr, '3');
    });
    T.test('sin wraps the last number, and "sin first" auto-closes', () => {
      const a = make();
      type(a.calc, '5+30');
      a.calc.typeFunction('sin');
      T.eq(a.calc.expr, '5+sin(30)');
      a.calc.equals();
      T.eq(a.calc.expr, '5.5');
      const b = make();
      b.calc.typeFunction('sin');
      type(b.calc, '30');
      T.eq(b.calc.expr, 'sin(30');
      b.calc.equals();
      T.eq(b.calc.expr, '0.5');
      T.eq(b.log[0].expression, 'sin(30)');
    });
    T.test('nth root with two arguments: root(27,3)', () => {
      const { calc } = make();
      type(calc, '27');
      calc.typeFunction('root', true);
      calc.typeComma();
      type(calc, '3');
      T.eq(calc.expr, 'root(27,3');
      calc.equals();
      T.eq(calc.expr, '3');
    });
    T.test('sign toggle', () => {
      const { calc } = make();
      type(calc, '5');
      calc.toggleSign();
      T.eq(calc.expr, '\u22125');
      calc.toggleSign();
      T.eq(calc.expr, '5');
      calc.clear();
      type(calc, '5+3');
      calc.toggleSign();
      T.eq(calc.expr, '5+(\u22123)');
      calc.toggleSign();
      T.eq(calc.expr, '5+3');
    });
    T.test('(-5) squared is 25, not -25', () => {
      const { calc } = make();
      type(calc, '5');
      calc.toggleSign();
      calc.typePostfix('\u00b2');
      T.eq(calc.expr, '(\u22125)\u00b2');
      calc.equals();
      T.eq(calc.expr, '25');
    });
    T.test('x squared on a result keeps the sign: result -5 then square', () => {
      const { calc } = make();
      type(calc, '0-5');
      calc.equals();
      calc.typePostfix('\u00b2');
      calc.equals();
      T.eq(calc.expr, '25');
    });
    T.test('reciprocal and cube', () => {
      const { calc } = make();
      type(calc, '4');
      calc.typePostfix('\u207b\u00b9');
      calc.equals();
      T.eq(calc.expr, '0.25');
      calc.clear();
      type(calc, '3');
      calc.typePostfix('\u00b3');
      calc.equals();
      T.eq(calc.expr, '27');
    });
    T.test('backspace removes whole tokens (sin( and Ans)', () => {
      const { calc } = make();
      calc.typeFunction('sin');
      calc.backspace();
      T.eq(calc.expr, '');
      calc.typeConstant('Ans');
      calc.backspace();
      T.eq(calc.expr, '');
      type(calc, '123');
      calc.backspace();
      T.eq(calc.expr, '12');
    });
    T.test('no leading zeros, one decimal point per number', () => {
      const { calc } = make();
      type(calc, '05');
      T.eq(calc.expr, '5');
      calc.clear();
      calc.typeDecimal();
      T.eq(calc.expr, '0.');
      type(calc, '2');
      calc.typeDecimal();
      T.eq(calc.expr, '0.2');
      calc.clear();
      type(calc, '1.5+2.5');
      T.eq(calc.expr, '1.5+2.5');
    });
    T.test('operators replace each other; minus can follow an operator', () => {
      const { calc } = make();
      type(calc, '5+');
      calc.typeOperator('\u00d7');
      T.eq(calc.expr, '5\u00d7');
      calc.typeOperator('\u2212');
      T.eq(calc.expr, '5\u00d7\u2212');
      calc.typeOperator('+');
      T.eq(calc.expr, '5+');
    });
    T.test('number length is limited', () => {
      const { calc } = make();
      type(calc, '1'.repeat(30));
      T.eq(calc.expr.length, 16);
    });
    T.test('parentheses rules: no stray ) and no empty ()', () => {
      const { calc } = make();
      calc.typeParen(')');
      T.eq(calc.expr, '');
      calc.typeParen('(');
      calc.typeParen(')');
      T.eq(calc.expr, '(');
      calc.clear();
      type(calc, '2');
      calc.typeParen('(');
      T.eq(calc.expr, '2\u00d7(');
    });
    T.test('implicit multiplication is made explicit: 2 then pi', () => {
      const { calc } = make();
      type(calc, '2');
      calc.typeConstant('\u03c0');
      T.eq(calc.expr, '2\u00d7\u03c0');
      calc.equals();
      T.eq(calc.expr, '6.28318530717959');
    });
    T.test('Ans keeps the previous answer after clearing', () => {
      const { calc } = make();
      type(calc, '2+2');
      calc.equals();
      T.eq(calc.ans, 4);
      calc.clear();
      calc.typeConstant('Ans');
      calc.typeOperator('\u00d7');
      type(calc, '3');
      calc.equals();
      T.eq(calc.expr, '12');
    });
    T.test('scientific notation entry: 1E5 and 1E-3', () => {
      const { calc } = make();
      type(calc, '1');
      calc.typeExponent();
      type(calc, '5');
      T.eq(calc.expr, '1E5');
      calc.equals();
      T.eq(calc.expr, '100000');
      calc.clear();
      type(calc, '1');
      calc.typeExponent();
      calc.typeOperator('\u2212');
      type(calc, '3');
      T.eq(calc.expr, '1E\u22123');
      calc.equals();
      T.eq(calc.expr, '0.001');
    });
    T.test('RAD mode is honoured by the model', () => {
      const { calc } = make();
      calc.angle = 'RAD';
      calc.typeFunction('sin');
      calc.typeConstant('\u03c0');
      calc.typeOperator('\u00f7');
      type(calc, '2');
      calc.equals();
      T.eq(calc.expr, '1');
    });
    T.test('errors show a message, keep the expression and do not reach history', () => {
      const { calc, log } = make();
      type(calc, '5/0');
      const r = calc.equals();
      T.eq(r.ok, false);
      T.eq(calc.error, 'Cannot divide by zero');
      T.eq(calc.expr, '5\u00f70');
      T.eq(log.length, 0);
      calc.backspace();
      T.eq(calc.error, null);
      type(calc, '5');
      calc.equals();
      T.eq(calc.expr, '1');
    });
    T.test('malformed expression gives a friendly error', () => {
      const { calc } = make();
      type(calc, '5+');
      calc.equals();
      T.eq(calc.error, 'Incomplete expression');
    });
    T.test('live preview', () => {
      const { calc } = make();
      type(calc, '2+3');
      T.eq(calc.preview(), '5');
      type(calc, '*');
      T.eq(calc.preview(), '');
    });
    T.test('insertValue (history / memory recall)', () => {
      const { calc } = make();
      type(calc, '5+');
      calc.insertValue('3');
      T.eq(calc.expr, '5+3');
      calc.equals();
      calc.insertValue('9');
      T.eq(calc.expr, '9');
    });
    T.test('currentValue for memory operations', () => {
      const { calc } = make();
      T.eq(calc.currentValue(), null);
      type(calc, '6*7');
      T.eq(calc.currentValue(), 42);
    });

    T.suite('Number formatting');
    [
      [1 / 3, '0.333333333333333'], [0, '0'], [100, '100'], [-0.5, '-0.5'], [1e21, '1E+21'],
      [1.5e-7, '1.5E-7'], [123456789012345678, '1.23456789012346E+17'], [1e15, '1E+15'], [123456789012345, '123456789012345']
    ].forEach(([v, want]) => T.test('format(' + v + ') = ' + want, () => T.eq(S.format(v), want)));

    /* ================= persistence ================= */
    T.suite('Persistence (storage, history, memory, preferences)');
    T.test('preferences round-trip through storage', () => {
      Calc.Storage.set('mode', 'scientific');
      Calc.Storage.set('angle', 'RAD');
      Calc.Storage.set('theme', 'light');
      T.eq(Calc.Storage.get('mode'), 'scientific');
      T.eq(Calc.Storage.get('angle'), 'RAD');
      T.eq(Calc.Storage.get('theme'), 'light');
      T.eq(Calc.Storage.get('does-not-exist', 'fallback'), 'fallback');
    });
    T.test('history survives a reload, newest first', () => {
      const H = Calc.History;
      H.clear();
      H.add('1+1', '2', 2);
      H.add('2+2', '4', 4);
      T.eq(Calc.Storage.get('history').length, 2);
      const reloaded = H.init(); // re-reads from storage
      T.eq(reloaded.length, 2);
      T.eq(reloaded[0].expression, '2+2');
      T.eq(reloaded[1].result, '2');
      T.ok(typeof reloaded[0].timestamp === 'number' && reloaded[0].timestamp > 0, 'timestamp');
    });
    T.test('history: delete one entry, then clear all', () => {
      const H = Calc.History;
      H.clear();
      const a = H.add('1+1', '2', 2);
      H.add('2+2', '4', 4);
      H.remove(a.id);
      T.eq(H.init().length, 1);
      H.clear();
      T.eq(H.init().length, 0);
    });
    T.test('history ignores corrupt stored data', () => {
      Calc.Storage.set('history', 'garbage');
      T.eq(Calc.History.init().length, 0);
      Calc.Storage.set('history', [{ bad: true }, null, 5]);
      T.eq(Calc.History.init().length, 0);
      Calc.History.clear();
    });
    T.test('memory MS / M+ / M- / MR / MC and persistence', () => {
      const M = Calc.Memory;
      M.clear();
      T.eq(M.has(), false);
      M.store(5);
      T.eq(M.init(), 5);
      M.add(2.5);
      T.eq(M.value, 7.5);
      M.subtract(0.5);
      T.eq(M.recall(), 7);
      M.clear();
      T.eq(M.init(), null);
      M.add(0.1);
      M.add(0.2);
      T.eq(M.value, 0.3);
      M.clear();
    });
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
