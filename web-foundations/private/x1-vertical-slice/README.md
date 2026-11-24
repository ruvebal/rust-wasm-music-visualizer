# X1 vertical slice

This is the first instructor prototype for the Rust/Wasm music visualizer cascade.

The browser owns the Web Audio graph and Three.js renderer. The dependency-free Rust kernel owns smoothing and the feature-to-scale mapping. This deliberately proves the data boundary before introducing Leptos, plugins or WebSockets.

## Run

```sh
npm install
npm test
npm run build
npm run dev -- --host 127.0.0.1
```

Open the Vite URL, press **Start audio**, and observe the RMS/Bass readout and the three depth-tested icosahedra. A local fixture is included for the prototype; the file picker accepts a local audio file without uploading it.

Do not open `index.html` directly with a `file://` URL: browsers block the Wasm fetch and module graph in that mode. Use the Vite URL printed by the dev command.

## Current boundary

- `rust/src/lib.rs`: exported `set_gain`, `set_smoothing`, `reset` and `step` functions plus native Rust tests.
- `src/main.js`: Web Audio analyser, Wasm loader and Three.js scene.
- `src/style.css`: responsive, keyboard-reachable host controls and reduced-motion-safe shell.

The HTML controls are host controls in this first slice. A Rust-rendered UI layer is a deliberate X2 decision after the kernel/browser boundary is stable; this prototype must not be described as a completed Leptos implementation.

## Student visualizer slot

The **Student visualizer module URL** field is the first X2-compatible loading seam. A student module served from the same Vite origin can export:

```js
export const name = 'My visualizer';
export function createVisualizer({ THREE, scene, group, canvas }) {
  return {
    update({ features, delta, now, scale }) {
      // mutate the supplied Three.js scene or group
    },
  };
}
```

For example, place a module at `public/visualizers/student-a.js` and load `/visualizers/student-a.js`. This is intentionally a thin seam for classroom experiments; X2 will formalize manifests, cleanup/dispose, permissions, and WebSocket input.

`package-lock.json` and `rust/Cargo.lock` are checked in so a clean checkout can reproduce the dependency graph. `public/audio/fixture-tone.wav` is a generated studio fixture (a short sine-tone WAV, created for this prototype and not sourced from a third-party recording).
