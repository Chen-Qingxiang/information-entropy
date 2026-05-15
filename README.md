# Information Entropy Explorer

A lightweight static GitHub Pages project for exploring Shannon information, entropy,
probability distributions, randomness, and simple compressibility ideas.

## Core formulas

- Single event information: `I(x) = -log2 p(x)`
- Shannon entropy: `H(X) = - sum_i p_i log2 p_i`

All logarithms use base 2, so values are measured in bits.

## Main features

- Single event information with a probability slider and curve plot.
- Coin entropy explorer showing why a fair coin reaches 1 bit of entropy.
- Multi-symbol entropy for an interactive 4-symbol distribution.
- Random sequence generator driven by the current distribution.
- Entropy and compressibility notes with simple examples and custom string analysis.

## Preview locally

Open `index.html` directly in a browser.

You can also serve the folder locally:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000/
```

The site uses only plain HTML, CSS, JavaScript, and canvas. It does not require internet
access, CDNs, npm, or a build step.

## GitHub Pages

This repo is intended to be served at:

```text
https://chen-qingxiang.github.io/information-entropy/
```
