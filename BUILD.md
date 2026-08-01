# MathSpeak — Open Source Math-Aware TTS

> **Read me first.** This file is the single source of truth for this project.
> If you're a fresh Claude Code session picking this up: read this whole file
> before writing any code. It tells you what we're building, how it's
> architected, what order to build it in, and which Claude model to switch to
> for which phase.

## 1. What this is

A free, open-source, client-side web app. User pastes arbitrary text —
including math notation (LaTeX-style or loose Unicode like `∫₀^∞ φ(u)du`) —
and hits play. The app:

1. Normalizes math into spoken English ("integral from zero to infinity of
   phi of u, d u")
2. Synthesizes speech from the normalized text, 100% in the browser
3. Lets the user drag a speed slider at any time, including mid-playback,
   with instant response (no re-synthesis lag)

**Zero backend. Zero API cost. Hosted free on GitHub Pages.** Everything —
model inference included — runs in the user's browser.

## 2. Non-negotiable architecture decisions

- **TTS engine: Kokoro-82M via `kokoro-js`** (Apache-2.0, runs via
  Transformers.js, WASM with WebGPU acceleration when available). Do not
  swap this for a server-based API — that breaks the "totally free forever"
  requirement.
- **No backend, no build-time server code.** Static site only (plain
  HTML/JS or a lightweight bundler like Vite — Vite is fine since it just
  produces static output).
- **Speed slider = `audio.playbackRate` with `preservesPitch = true`**, not
  re-running inference. Kokoro's own `speed` param (used at generation time)
  is a secondary option for the *initial* synthesis pace, but the live
  slider the user drags during/after playback must be instant —
  `playbackRate` is the only thing that gives that without lag or re-TTS.
- **Math normalization is a separate, testable module**, decoupled from the
  TTS call. It takes raw pasted text → returns clean spoken-English text.
  This module has its own test file with a growing corpus of tricky inputs
  (that dispersion-index example is the canonical first test case).

## 3. File structure to build toward

```
/index.html
/src
  /tts
    kokoro-loader.js       # model load, device detection, caching
    speak.js               # generate() wrapper, chunking/streaming
  /math-normalize
    detect.js              # finds LaTeX spans vs loose-unicode math vs plain prose
    latex-to-speech.js      # LaTeX/MathML -> spoken text (leans on SRE/MathCAT-style rules)
    unicode-math-rules.js   # heuristic rules for loose unicode math (∫ Σ Π φ θ ⁻¹ etc.)
    normalize.js            # orchestrates detect -> route -> merge back into full text
    normalize.test.js
  /ui
    slider.js               # playbackRate control, wired to <audio>
    app.js                  # wires textarea -> normalize -> speak -> player
  styles.css
/tests
  /fixtures                 # sample math snippets, including the dispersion-index example
README.md
LICENSE (MIT or Apache-2.0 to match Kokoro's license)
```

## 4. Build phases (in order)

### Phase 0 — Skeleton
Static page: textarea, "Speak" button, `<audio>` element, speed slider
(0.5x–2x). Wire Kokoro to speak raw text with no math handling yet. Confirm
GitHub Pages deploy works end to end before anything fancier.

### Phase 1 — LaTeX-delimited math
Detect `$...$`, `$$...$$`, `\(...\)`, `\[...\]` spans. Convert to MathML
(a LaTeX→MathML lib), then to spoken text using ClearSpeak-style rules
(fractions, integrals, sub/superscripts, Greek letters, standard operators,
named functions). Everything outside the delimiters passes through as
normal prose.

### Phase 2 — Loose Unicode math (the harder, more interesting part)
Handle math typed without LaTeX delimiters — Greek letters, `∫`, `Σ`, `Π`,
superscript/subscript Unicode, arrows, common inequality/set symbols mixed
directly into prose (this is what the dispersion-index example looks like).
This is heuristic and will never be perfect — build it as a rules engine
you can keep extending, with a growing test fixture file, not a one-shot
parser.

### Phase 3 — Polish
- Streaming synthesis for long pasted text (don't block on the whole
  document before audio starts)
- Graceful fallback: unrecognized symbol → read its name rather than
  silently dropping or mispronouncing
- Voice picker (Kokoro ships multiple voices)
- Mobile/WebGPU-unavailable fallback path tested on a real low-end device

## 5. Model-switching guide for Claude Code

You have Opus, Sonnet, and Haiku available (`/model` to switch). Rough
allocation — switch deliberately, don't just leave one model on for
everything:

| Phase / task | Model | Why |
|---|---|---|
| Architecture decisions, designing the normalize.js orchestration logic, resolving ambiguous math-notation edge cases, debugging tricky WASM/WebGPU device-detection issues | **Opus** | These need careful reasoning about tradeoffs and edge cases, not just pattern-matched code |
| Phase 0 skeleton, Phase 1 LaTeX pipeline, most of Phase 2 rules engine, wiring the slider/player UI | **Sonnet** | This is the bulk of the work — solid, fast, default day-to-day implementation |
| Writing individual test fixtures once the pattern is established, repetitive boilerplate (adding one more Greek-letter mapping, one more operator rule), README/comment cleanup, small style/lint fixes | **Haiku** | Cheap, fast, doesn't need deep reasoning — good for volume work once the pattern is set |

Practical rule of thumb: **start each new *type* of problem on Opus long
enough to get the approach right, then drop to Sonnet to implement it, then
drop to Haiku for repetitive extensions of the same pattern.**

## 6. Known limitations (keep these in the README, don't hide them)

- Math-to-speech is inherently ambiguous for some notation — expect
  occasional wrong readings on exotic constructs (matrices, category
  theory, multi-line derivations with implied context) indefinitely.
- Client-side model download (tens of MB depending on quantization) means
  a slow first load on poor connections; no way around this while staying
  fully free/serverless.
- WebGPU isn't universal — WASM fallback is slower; test both paths.
- English-only math speech for v1. Multilingual math conventions are a
  separate, much harder project — explicitly out of scope for now.
- Voice quality is "very good for a free, local 82M-param model," not
  competitive with paid cloud TTS. Set that expectation in the README.

## 7. First thing to actually do

Scaffold Phase 0 (skeleton) end-to-end, deploy to GitHub Pages, confirm a
plain sentence plays back and the slider changes speed instantly. Don't
touch math normalization until that loop works.
