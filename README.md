# Tidal Orrery — Rust/Wasm Music Visualizer

An interactive kinetic sculpture for the UDIT multimedia studio. Local music opens
twelve metal vanes, expands a suspended core and illuminates its edges. The existing
X1 application remains in [`web-foundations/private/x1-vertical-slice`](web-foundations/private/x1-vertical-slice/).

**Pipeline:** local file → HTMLAudioElement → gain → Web Audio analyser → normalized
low/mid/high features + onset/BPM estimate → pure Rust/Wasm mappings → bounded
values → Three.js / WebGL2. The reference scene keeps its moon attached to the
previously empty orbital wire and colourizes materials from the three bands.

## Run from a fresh checkout

Prerequisites: Node.js 22.12+ and a current Rust toolchain supporting edition 2024,
with the `wasm32-unknown-unknown` target. Commands below run from the repository root.

```sh
rustup target add wasm32-unknown-unknown
cd web-foundations/private/x1-vertical-slice
npm ci
npm run dev -- --host 127.0.0.1
```

`predev` builds Wasm automatically. Open Vite's printed URL. Press **Play** for the
synthetic test signal or choose a local audio file. Files never leave the browser.
Serve over HTTP; opening `index.html` with `file://` does not work.

## Verify and build

Run these commands inside the X1 directory:

```sh
npx playwright install chromium
npm test
npm run build
npm run preview -- --host 127.0.0.1
```

`npm test` runs native Rust, JavaScript feature/lifecycle, compiled Wasm, and real
Chromium integration tests. The browser suite builds the production Pages subpath.
On Linux CI, use `npx playwright install --with-deps chromium`.

## Learn and extend

- [Student guide and module contract](web-foundations/private/x1-vertical-slice/README.md)
- [Build steps, evidence and lessons from Vibrasolids](docs/BUILD-NOTES.md)
- The running application's **See how it works** page explains every Rust function.

Space plays/pauses; L loops; M mutes; left/right seek; up/down change gain; R resets;
? shows help. Focused form controls retain native keys. Reduced motion is initialized
from the OS preference and can be changed in the interface.

## GitHub Pages

The workflow builds, tests and uploads the static `dist/` artifact on pushes to
`main`. Enable **GitHub Actions** as the repository's Pages source. Vite uses
`/rust-wasm-music-visualizer/` during Actions builds; all audio/Wasm/document links
respect that base path. No backend, credentials, microphone or cross-origin
isolation is required. Deployment itself is an owner action; these changes do not
push or change repository settings.

The companion teaching plan remains in the sibling Web Atelier repository under
`frontend-pedagogy/DEV_PLAN/RUST-WASM-MUSIC-VISUALIZER/`.

Author: Rubén Vega Balbás, PhD · ruvebal@crea-comm.net · UDIT
