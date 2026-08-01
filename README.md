# MathSpeak

Math-aware text-to-speech that runs **entirely in your browser**. Paste text —
including math notation — and hear it read aloud. No backend, no API keys, no
cost, no data leaving your machine.

Speech comes from [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) via
[kokoro-js](https://github.com/hexgrad/kokoro), running on WebGPU when available
and WASM otherwise.

Both delimited LaTeX and loose Unicode math work:

```
∫₀^∞ φ(u)du            → the integral from zero to infinity of phi of u, d u
$\frac{\sigma^2}{\mu}$ → sigma squared over mu
Σᵢ₌₁ⁿ (xᵢ − x̄)²        → the sum from i equals one to n of
                          open paren x sub i minus x bar close paren squared
```

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
npm test          # math-normalizer tests
```

## Known limitations

- Math-to-speech is inherently ambiguous. Expect occasional wrong readings on
  exotic notation (matrices, category theory, multi-line derivations with
  implied context) indefinitely.
- First load downloads the model. On a poor connection that is slow, and there
  is no way around it while staying fully serverless.
- WebGPU is not universal. The WASM fallback works but is slower, and GitHub
  Pages cannot send the `COOP`/`COEP` headers that WASM multithreading needs.
- English-only math speech for v1.
- Voice quality is *very good for a free, local 82M-parameter model* — not
  competitive with paid cloud TTS.

## License

MIT (see [LICENSE](LICENSE)). Kokoro-82M and kokoro-js are Apache-2.0; model
weights are fetched by the user's browser and are not redistributed here.
