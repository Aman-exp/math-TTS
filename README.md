# MathSpeak

Math-aware text-to-speech that runs **entirely in your browser**. Paste text —
including math notation — and hear it read aloud. No backend, no API keys, no
cost, no data leaving your machine.

Speech comes from [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) via
[kokoro-js](https://github.com/hexgrad/kokoro), running on WebGPU when available
and WASM otherwise.

## Status

| Phase | What it covers | State |
|---|---|---|
| 0 | Skeleton: textarea → Kokoro → `<audio>`, live speed slider, Pages deploy | **done** |
| 1 | LaTeX-delimited math (`$…$`, `$$…$$`, `\(…\)`, `\[…\]`) → spoken English | **done** |
| 2 | Loose Unicode math (`∫ Σ Π φ θ ⁻¹` mixed into prose) | **done** |
| 3 | Streaming synthesis, symbol fallbacks, voice picker polish, low-end mobile | **done**, except real-device testing |

Both delimited LaTeX and loose Unicode math work:

```
∫₀^∞ φ(u)du            → the integral from zero to infinity of phi of u, d u
$\frac{\sigma^2}{\mu}$ → sigma squared over mu
Σᵢ₌₁ⁿ (xᵢ − x̄)²        → the sum from i equals one to n of
                          open paren x sub i minus x bar close paren squared
```

## How math becomes speech

```
raw text → detect.js → ┬→ prose → unicode-math-rules.js ─┐
                       │            (transliterates to LaTeX)
                       └→ LaTeX span ──────────────────┬─┘
                                                       ↓
                          latex-parser.js → AST → latex-to-speech.js → English
                                                       ↓
                                          normalize.js merges it back
```

Phase 2 does **not** have its own renderer. A loose-Unicode run is transliterated
into LaTeX (`∫₀^∞ φ(u)du` → `\int_{0}^\infty \phi(u)du`) and then goes through the
Phase 1 pipeline. Big-operator scope, differential handling, function
application and fraction bracketing all come along for free, and there is one
set of reading rules to maintain rather than two that drift apart.

We write our own parser and speech rules rather than using
`speech-rule-engine`. SRE is the better ClearSpeak implementation, but it needs
a separate LaTeX→MathML library in front of it, ships several megabytes, and
fetches locale JSON at runtime — awkward for a static host. The deciding factor
is Phase 2: loose-Unicode math needs its own symbol tables regardless, so owning
[symbols.js](src/math-normalize/symbols.js) means both phases share one
vocabulary instead of maintaining two. `latex-to-speech.js` is a module boundary,
so swapping SRE in later stays possible.

Two rules drive the readings:

- **Say the least that is still unambiguous.** `x^2` is "x squared", not "x to
  the power of two". `\frac{a}{b}` is "a over b", but a fraction with compound
  parts becomes "the fraction … over …, end fraction" so the listener can hear
  where it ends. Same for roots.
- **Never drop anything.** An unrecognized command is read as its own name.
  Silence would tell the listener nothing was there, which is a lie.

### Documented heuristics (they will sometimes be wrong)

- **`f(x)` vs `a(b+c)`.** A parenthesized argument reads "of" after a known
  function name, an `f`/`g`/`h`-family letter, or a Greek letter conventionally
  used for functions; anything else reads as a parenthesized product. `a(b+c)`
  being a product is the more common case, but `a(x)` as a function does happen.
- **`|` is "given", `|x|` is absolute value.** A bar pairs with a later bar to
  form absolute value; an unpaired bar reads "given", since `P(A|B)` is the
  dominant use.
- **`$5 and $10` is currency, not math.** Detection uses the KaTeX
  auto-render rule — no whitespace just inside the delimiters, and no digit
  immediately after the closer. Testing the *contents* for math-like characters
  fails here, because the text captured between the two dollars is `5 and `,
  which contains letters and so looks like math to any content-based check.
- **Loose-Unicode runs need a strong anchor.** Only a Greek letter, a math
  symbol, or a Unicode super/subscript can *start* a math run. Digits, single
  letters and ASCII operators may only *join* a run that is already anchored.
  This is the property that keeps `well-known` from becoming "well minus known"
  and `(see below)` from becoming "open paren see below close paren" — with no
  strong trigger anywhere in the text, it is not touched at all. Multi-letter
  words never join a run except known function names (`sin θ`) and
  differentials glued to an expression (`φ(u)du`).
- **`Σ` is both a Greek letter and a summation sign.** Limits decide: `Σᵢ₌₁ⁿ`
  is "the sum from i equals one to n", a bare `Σ` is "capital sigma". Same for
  `Π`.
- **`√` binds to one atom.** `√2 + 1` is "the square root of two, plus one",
  not the root of 3. Use `√(x + y)` for a group.

Every one of these is pinned by a case in
[tests/fixtures/latex-cases.js](tests/fixtures/latex-cases.js) or
[tests/fixtures/unicode-cases.js](tests/fixtures/unicode-cases.js). When a
reading is wrong, add the case there first — `expected` values are decisions, not
implementation details, so changing one is a deliberate act.

The `UNTOUCHED_CASES` block in the Unicode fixtures is the important half: it
pins prose that must survive verbatim. A regression there is worse than a missed
math reading, because mangling ordinary prose breaks the app's main job while a
missed reading only leaves it incomplete.

## Run it locally

```bash
npm install
npm run dev
```

Then open the printed URL. The first synthesis downloads the model (tens of MB,
once) and the browser caches it from then on.

```bash
npm run build     # static output in dist/
npm run preview   # serve the built output
npm test          # math-normalizer tests (Phase 1+)
```

## Deploying

`.github/workflows/deploy.yml` builds and publishes `dist/` to GitHub Pages on
every push to `main`. Enable it once per repo: **Settings → Pages → Source →
GitHub Actions**. `vite.config.js` uses a relative `base`, so the site works at
any Pages path without hardcoding the repository name.

## Long text: streaming synthesis

Text at or above 280 characters is synthesized in sentence-sized chunks and
played as each one arrives, so time-to-first-audio stops depending on document
length. On the WASM path a long paste would otherwise sit silent for tens of
seconds, which reads as a hang.

The chunks play as separate clips through one `<audio>` element rather than being
appended into a single stream. Decoding into `AudioBuffer`s and scheduling via
Web Audio would be gapless, but it also means writing our own transport — and
`playbackRate` on an `<audio>` element is precisely what makes the speed slider
instant. Kokoro splits on sentence boundaries, so the seam lands where a reader
would pause anyway.

## Pasting from a PDF

Text copied out of a PDF or Word equation does not contain ASCII. `𝑥` is
MATHEMATICAL ITALIC SMALL X (U+1D465), and `𝜎` is U+1D70E — so none of the symbol
tables match, and the text would be spelled out letter-by-letter or dropped.
[unicode-fold.js](src/math-normalize/unicode-fold.js) folds the whole U+1D400
block (bold, italic, script, fraktur, double-struck, sans, monospace, and math
Greek) down to base letters before anything else runs.

Folding is lossy on purpose: style carries meaning in some papers, but saying
"bold italic script x" aloud for every variable is far worse than losing the
distinction. `𝔼` is the one exception kept unfolded, because "the expectation"
is a better reading than "E".

## Design decisions worth knowing

- **The speed slider is `audio.playbackRate`, not re-synthesis.** Dragging it
  mid-playback takes effect instantly; re-running the model per pointermove
  never could. `preservesPitch` is set so the voice does not change pitch.
- **Math normalization is a separate, testable module** that turns raw text into
  spoken English before any model call. It is unit-tested without loading the
  model.
- **Device detection asks for a real WebGPU adapter** rather than trusting
  `navigator.gpu` to exist, and falls back to WASM if the model load itself
  fails — adapters can be present but unusable.

## Known limitations

- Math-to-speech is inherently ambiguous. Expect occasional wrong readings on
  exotic notation (matrices, category theory, multi-line derivations with
  implied context) indefinitely — not a bug that gets "fixed", a property of
  reading math aloud.
- First load downloads the model. On a poor connection that is slow, and there
  is no way around it while staying fully serverless.
- WebGPU is not universal. The WASM fallback works but is slower. GitHub Pages
  cannot send the `COOP`/`COEP` headers that WASM multithreading needs, so the
  hosted build runs single-threaded.
- **Not yet tested on a real low-end mobile device.** The WASM fallback path is
  implemented and exercised in a desktop browser, but BUILD.md asks for a real
  device and that has not happened. Treat mobile as unverified.
- An unrecognized symbol from a Unicode math block is read as the word
  "symbol". That is deliberate — Kokoro renders an unmapped codepoint as
  silence, and silence tells the listener nothing was written there — but it is
  a placeholder, not a name. Add real entries to `NAMED_SYMBOLS` as they come up.
- English-only math speech for v1. Multilingual math conventions are a separate,
  much harder project and are explicitly out of scope.
- Voice quality is *very good for a free, local 82M-parameter model* — not
  competitive with paid cloud TTS.

## License

MIT (see [LICENSE](LICENSE)). Kokoro-82M and kokoro-js are Apache-2.0; model
weights are fetched by the user's browser and are not redistributed here.
