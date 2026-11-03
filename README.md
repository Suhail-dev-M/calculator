# Calculator

A Standard + Scientific calculator in plain HTML, CSS and JavaScript. No frameworks, no dependencies, no `eval()`.

## Run it

Double-click `index.html` (or serve the folder with any static server). Classic `<script>` tags are used instead of ES modules so it also works from `file://`.

## Features

- **Standard**: + - x / %, square root, square, reciprocal, +/-, decimals, parentheses, C and backspace, Ans, chained calculations with correct operator precedence.
- **Scientific**: sin/cos/tan and inverses, log, ln, log2, 10^x, e^x, x^2, x^3, x^y, sqrt, cube root, nth root `root(x,n)`, 1/x, n!, |x|, floor, ceil, round, mod, EXP (scientific notation), pi, e, phi, Ans.
- **DEG / RAD** switch; inverse trig returns the selected unit. Exact right angles give exact results (`sin(180)` is 0, not 1.2e-16).
- **Mode switch** rebuilds the keypad in place with an animation and keeps Ans, history, memory and the expression.
- **History** with timestamps: reuse result, reuse expression, copy, delete one, clear all.
- **Memory** MC, MR, M+, M-, MS shared by both modes.
- **Keyboard**: 0-9, `+ - * / ^ % ! ( ) . ,`, Enter or `=`, Backspace, Escape/Delete, `p` for pi, `e` for e (or exponent after a digit). Ctrl/Cmd/Alt shortcuts are never intercepted.
- **Themes** dark/light. Theme, mode, angle unit, history, memory and last answer persist in LocalStorage.
- **Responsive**: centered card + history sidebar on desktop, history drawer on tablet/phone, full-bleed touch-sized keys on mobile.

## Behaviour notes

- Function keys wrap the last number: type `30`, press `sin` and you get `sin(30)`. Press `sin` first and you get `sin(`; missing `)` are added when you press `=`.
- `200 + 10 %` gives 220 (percent of the left operand); `50 %` alone gives 0.5.
- Results keep 15 significant digits; floating-point noise is removed (`0.1 + 0.2` is `0.3`).
- `mod` takes the sign of the dividend (`-7 mod 3` is -1).

## Structure

```
index.html
css/styles.css
js/storage.js      LocalStorage wrapper (+ in-memory fallback)
js/scientific.js   constants, domain-checked functions, number formatting, CalcError
js/parser.js       tokenizer, shunting-yard parser, RPN evaluator
js/calculator.js   expression model: typing rules, equals, preview (no DOM)
js/history.js      history list + persistence
js/memory.js       memory register + persistence
js/keyboard.js     key -> action mapping
js/app.js          DOM, rendering, events
js/theme-init.js   applies saved theme before first paint
tests/             see below
```

## Tests

- `node tests/run-tests.js`: engine, model and persistence tests (no install needed).
- Open `tests/tests.html` in a browser: the same tests plus UI tests (keyboard, mode switching, history, theme, and a 360px mobile-layout check). It uses its own storage namespace, so your data is untouched.
