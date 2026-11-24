# Rust/Wasm Music Visualizer Experiment

This repository contains the executable instructor experiment for the UDIT Rust/WebAssembly music-visualizer studio. The teaching plan remains in the companion `web-atelier-udit` repository.

## Current slice

The working prototype is in [`web-foundations/private/x1-vertical-slice`](web-foundations/private/x1-vertical-slice/). It proves:

- local audio → Web Audio analyser → Rust/Wasm mapping kernel → Three.js GPU scene;
- local MP3/file replacement, pause/seek/end/error states and looping;
- gain and smoothing controls;
- a thin student visualizer module seam.

```sh
cd web-foundations/private/x1-vertical-slice
npm install
npm test
npm run dev -- --host 127.0.0.1
```

Open the Vite URL. Do not open the HTML with `file://`.

## GitHub Pages

The repository includes a Pages workflow. After creating the GitHub repository as `ruvebal/rust-wasm-music-visualizer`, push `main`, enable **GitHub Actions** as the Pages source, and the site will be published at:

`https://ruvebal.github.io/rust-wasm-music-visualizer/`

## Teaching companion

The lesson sequence, assignments and challenge brief live in the sibling repository:

`../web-atelier-udit/frontend-pedagogy/DEV_PLAN/RUST-WASM-MUSIC-VISUALIZER/`

The experiment is deliberately versioned separately so classroom prose can refer to tagged runnable milestones without mixing student-facing content with application implementation.
