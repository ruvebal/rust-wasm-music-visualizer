# Tidal Orrery / X1

A complete audio-driven kinetic sculpture. This continues X1's Vite + JavaScript +
dependency-free Rust architecture. No Rust UI framework or audio synthesis engine
is implied. The browser decodes and measures sound; Rust transforms numbers;
Three.js owns depth-tested, lit 3D geometry.

## Run, test, build

These are complete shell commands from this directory, after installing Node
22.12+ and a current Rust toolchain with edition 2024 support:

```sh
rustup target add wasm32-unknown-unknown
npm ci
npm run dev -- --host 127.0.0.1
```

Open Vite's printed URL. Wasm builds automatically before the dev server starts.
No sound starts until a user gesture. **Play** runs a 12-second original synthetic
fixture: bass, middle, high, blend, silence. It is a test signal, not a music track.
Choose local audio to see the response to your own recording. The included WAV
can be rebuilt with `python3 scripts/generate-fixture.py`.

```sh
npx playwright install chromium
npm test
cargo fmt --manifest-path rust/Cargo.toml --check
cargo clippy --manifest-path rust/Cargo.toml --all-targets -- -D warnings
npm run build
npm run preview -- --host 127.0.0.1
```

`npm test` includes Rust tests, JavaScript unit tests, a compiled Wasm ABI test and
Chromium integration tests against the production GitHub Pages subpath. The
historical `test:browser` script is the Node/Wasm ABI check; actual browser tests
are `test:e2e`. The final standalone build above serves at `/`; set
`GITHUB_ACTIONS=true npm run build` to build the Pages path explicitly.

## Controls and failure states

| Control | Meaning |
| --- | --- |
| Local file | Browser-local Blob URL; replacement pauses and releases the old URL |
| Play / Space | Start or pause; during async startup the same control cancels |
| Seek / left–right | Move through the file; shortcut step is five seconds |
| Gain / up–down | Audible attenuation 0–100%, default 70%; shortcut step is 5% |
| Loop / L | Sets the HTMLAudioElement's actual loop property |
| Mute / M | Ramps graph gain to zero without losing the gain setting |
| Response time | Rust smoothing time constant, 0.08–0.80 seconds |
| Reduce motion | Fixed spatial geometry/camera; slower lighting feedback remains |
| Drag / scroll | Orbit / zoom; deliberately disables automatic camera drift |
| View angle | Keyboard-accessible camera orbit; Center view restores the default |
| Reset / R | Pause, rewind current file, clear history, restore controls and camera |
| ? / How to play | Reveal help, move focus into it, restore focus when closing |

Focused sliders, file inputs, checkboxes and text controls retain native keys.
Space activates a focused button instead of also triggering the global shortcut.
Hold an arrow key to repeat; toggle keys ignore repeats.

Invalid/empty selections preserve the current track and show a message. A file
with an audio MIME type can still fail decoding; choose another file or use the
test tone. Supported codecs depend on the browser. Missing Wasm or unavailable
WebGL2 prevents disconnected playback and shows recovery instructions. Context
loss pauses audio; restoration makes Play available again. Background-tab returns
clear stale feature history and skip missed motion rather than replaying it.

## One frame through the architecture

```text
local file / original fixture
        ↓
HTMLAudioElement (browser decoding, seek, loop)
        ↓
MediaElementAudioSourceNode → GainNode → AnalyserNode → speakers
                                              ↓
                        Float32 waveform + dB spectrum
                                              ↓
                         normalized RMS / bass / highs
                                              ↓
            Rust smooth(previous, input, delta_seconds, tau_seconds)
                                              ↓
                   aperture / core_scale / radiance
                                              ↓
                createVisualizer → Three.js → WebGL2
```

| File | Responsibility |
| --- | --- |
| `src/audio.js` | One media element, one graph, startup cancellation, transport, URL/node disposal |
| `src/features.js` | Pure RMS/band extraction and finite normalized readings |
| `rust/src/lib.rs` | Pure smoothing and bounded visual mappings; native tests |
| `src/main.js` | DOM, keyboard, Wasm loading, camera, renderer, scheduling and teardown |
| `src/visualizers/tidal-orrery.js` | Owned scene subtree: geometry, materials, lighting, motion, disposal |
| `public/architecture.html` | Student-facing explanation available in the deployed build |

The analyser uses a 2048-sample FFT with its internal smoothing set to zero. RMS is
`sqrt(mean(sample²))`, multiplied by a **Designed** factor of 2 and clamped to 0–1.
FFT bin `i` is `i * sampleRate / fftSize` Hz. Bass uses 35–250 Hz; highs use
2–10 kHz (bounded by Nyquist). Each band sums linear power `10^(dB/10)`, takes the
square root, multiplies by a Designed factor of 2, and clamps to 0–1. An RMS gate
below 0.002 suppresses residual FFT history. Values are **Computed relative
features**, not calibrated loudness, pitch detection or tempo.

Gain is before the analyser, so quieter output makes a quieter sculpture. The
slider only attenuates: it does not add clipping by amplifying above unity. The
20 ms gain-node ramp avoids abrupt parameter steps. This is separate from visual
smoothing. The browser analyser mixes its input to mono for analysis; unusual
out-of-phase stereo recordings may under-read relative to perceived loudness.

### Every Rust function in plain language

| Function | What it does and teaches |
| --- | --- |
| `unit(value)` (internal) | Reject NaN/infinity as zero; clamp finite values to 0–1. Protect every public boundary. |
| `smooth(previous, input, delta_seconds, tau_seconds)` | Move toward the input by `1 - exp(-delta / tau)`. After one tau, approximately 63% of a constant step has arrived. Supplying previous state avoids hidden globals. Cap delta at 0.1 s to skip long stalls; clamp tau to 0.08–0.80 s. |
| `aperture(rms)` | Linear mapping to hinge opening, 0.12–1.22 radians. |
| `core_scale(bass)` | Linear mapping to dimensionless core scale, 0.72–1.30. |
| `radiance(high)` | Linear mapping to Three.js emissive intensity, 0.15–1.25. |

These output ranges are **Designed**, not physical laws. The `#[unsafe(no_mangle)]`
attribute keeps each C ABI export's name stable so JavaScript can call it through
`instance.exports`. It does not introduce mutable global state or unsafe memory
operations. Arguments and results are scalar `f32`s: no pointers or allocator
protocol is needed. The test-only `replay(hz)` helper runs one second of a constant
input at a chosen refresh rate so 30/144 Hz responses can be compared.

JavaScript stores three previous values. Reset and seek clear them. A new track
cannot inherit the old one's energy. The sculpture uses media time in closed-form
angles (`sin(time * rate)`), not cumulative `rotation += step`. Silence settles to
rest. Identical time and feature sequences reproduce the mappings; live analyser
snapshots vary with browser scheduling, decoding and FFT windows. We do not claim
bit-identical audiovisual replay or sample-accurate speaker/display alignment.

## Implemented student module contract

**Excerpt** — this shows the API shape; replace the imported module in `src/main.js`
with a complete module that constructs and disposes its own geometry:

```js
export function createVisualizer({ scene, THREE, features, options }) {
  const root = new THREE.Group();
  scene.add(root);
  return {
    update({ values, time, delta, reducedMotion }) {
      // features: stable, read-only object with smoothed rms/bass/high in 0..1.
      // values: aperture (radians), coreScale (multiplier), radiance (intensity).
      // time: media seconds. delta: bounded animation seconds.
      // Modify only your owned root and its resources.
    },
    resize({ width, height, pixelRatio }) {
      // CSS-pixel viewport and bounded drawing-buffer ratio.
      // Update module-specific resolution; host owns camera/renderer sizing.
    },
    dispose() {
      scene.remove(root);
      // Dispose every owned geometry, material, texture and listener once.
    },
  };
}
```

`features` is refreshed before `update`; do not mutate it or keep assumptions about
its previous contents. `options` holds construction-time configuration; no hidden
host handles are required. `scene` is shared; create and remove only your own
subtree. Do not change its background, remove other modules, replace the camera,
start a second animation loop or create another audio graph.

The shipped module reuses vane and ring geometry. Its disposer collects shared
resources in Sets so they are freed once; it releases shadow maps and removes its
root. It is safe to call `dispose()` twice. If a student adds textures, render
targets, custom listeners or controls, those must also be explicitly freed. The
host cancels its frame loop, disconnects ResizeObserver, aborts event listeners,
disposes controls/renderer and closes the audio graph on teardown/HMR.

This static import is a working extension seam. Runtime URL loading, sandboxing,
permissions, manifests, and plugin hot-swapping are **future extensions**, not
complete features. The old unrestricted module URL field has been removed.

## Performance, accessibility and evidence

Pixel ratio is capped at 1.5; geometry and materials are created once; no bloom or
postprocessing hides the mappings. DOM telemetry updates at 10 Hz and has live
announcements disabled; meaningful state/error messages use a separate status
region. Geometry is lit, depth-tested and cast into real shadow maps. Reduced
motion freezes spatial changes and clamps lighting smoothing to at least 0.6 s.

The browser suite checks local-file playback, gain, mute, seek, loop wraparound,
all shortcuts, invalid/decode failures, file replacement, rapid start/reset,
ended/restart, reduced motion, native range keys, mobile resizing, Wasm failure,
WebGL context recovery, and Pages asset/document links. The module test checks
repeatability, reduced-motion transforms and one-time resource disposal. Timing
measurements are recorded as test attachments, not universal hardware promises.

Before a public classroom release, also listen on the intended speaker path and
try a physical phone, target codecs and screen reader. Browser automation verifies
state and signal values; it cannot certify listening comfort or every device.

## Isolated optional extension — future beat events

Only after the base remains stable, add a pure `events.js` detector receiving RMS,
bass and media timestamps. Give it explicit previous state, a threshold and a
minimum event interval. Test synthetic onset sequences, silence, repeated events,
seek/reset and reduced-motion suppression. Deliver an optional `events` field to
the visualizer; the current feature pipeline continues working without it. There
is currently no beat/tempo detection.

## References and provenance

- [Web Audio specification: AnalyserNode](https://www.w3.org/TR/webaudio/#AnalyserNode)
- [Three.js OrbitControls](https://threejs.org/docs/pages/OrbitControls.html)
- [Three.js resource disposal](https://threejs.org/manual/pages/how-to-dispose-of-objects.html)
- Author's Vibrasolids / First Light: audio-timeline discipline, explicit boundaries,
  source-vs-design labels, resource cleanup and invariant testing. No engine,
  private research data or formula tables were copied. See the root build notes.

Only added package: `@playwright/test` 1.65.1, Apache-2.0, **development only**, for
real browser acceptance tests. No new Rust crate or production package.

Author: Rubén Vega Balbás, PhD · ruvebal@crea-comm.net · UDIT
