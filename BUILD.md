# Building & architecture

## Running it

```bash
npm install
npm run dev       # dev server
npm run build     # static output in dist/
npm run preview   # serve the built output
npm test          # math-normalizer test suite
```

No backend, no build-time server code — just Vite producing a static site.

## How it fits together

```
/index.html
/src
  /tts
    kokoro-loader.js       # model load, device detection, caching
    speak.js                # generate() wrapper, chunking/streaming
  /math-normalize
    detect.js                # finds LaTeX spans vs loose-unicode math vs plain prose
    latex-to-speech.js       # LaTeX/MathML -> spoken text
    unicode-math-rules.js    # heuristic rules for loose unicode math (∫ Σ Π φ θ ⁻¹ etc.)
    normalize.js             # orchestrates detect -> route -> merge back into full text
    normalize.test.js
  /ui
    slider.js                # playbackRate control, wired to <audio>
    app.js                   # wires textarea -> normalize -> speak -> player
  styles.css
/tests
  /fixtures                  # sample math snippets
```

`normalize()` takes raw pasted text and returns spoken-English text; `speak()`
and `speakStream()` know nothing about math, they just synthesize whatever
string they're given. That split is what lets the normalizer be unit-tested
without loading the TTS model.

## Key decisions

- **TTS engine is Kokoro-82M via `kokoro-js`** (Apache-2.0, runs through
  Transformers.js — WebGPU when available, WASM otherwise). Swapping to a
  server-based API would break the "free forever, no backend" premise.
- **Speed slider drives `audio.playbackRate`**, not re-synthesis. Kokoro's own
  `speed` param only affects the initial generation pace; live speed changes
  during/after playback go through `playbackRate` so they're instant.
- **WebGPU uses fp32, WASM uses q8.** q8 on WebGPU produces garbled audio due
  to a quantization bug in onnxruntime-web's int8 kernels, so WebGPU pays for
  the larger fp32 download (~330MB vs ~90MB) to get correct output.
- **Long text streams in sentence-sized chunks** (see `STREAM_THRESHOLD` in
  `speak.js`) so playback of the first chunk overlaps synthesis of the next,
  instead of blocking on the whole document before any sound plays.

## Known limitations

- Math-to-speech is inherently ambiguous for some notation — expect
  occasional wrong readings on exotic constructs (matrices, category theory,
  multi-line derivations with implied context).
- Model download is tens of MB depending on quantization; first load is slow
  on a poor connection, and there's no way around that while staying
  serverless.
- WebGPU isn't universal; the WASM fallback works but is slower.
- English-only math speech for now.
- Voice quality is good for a free, local 82M-parameter model, not
  competitive with paid cloud TTS.
