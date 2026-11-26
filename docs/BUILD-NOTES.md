# Tidal Orrery build notes

Author: Rubén Vega Balbás, PhD · ruvebal@crea-comm.net · UDIT

## Inspection before editing

X1 routes a local/fixture HTMLAudioElement through an AnalyserNode to the speakers.
JavaScript computes RMS and a rough bass average; Rust's `step` combines these into
one scale; Three.js displays three lit icosahedra. Vite serves the Wasm binary.
The old gain is visual only. `static mut` stores Rust state, smoothing is per frame,
and animation uses page uptime. The dynamic module seam has no disposal lifecycle.
Baseline: `npm ci && npm test` passed (3 Rust tests and the Wasm boundary).

## Direction

Tidal Orrery: twelve hinged vanes, a bass-driven suspended core, and intersecting
gimbal rings over a plinth. RMS opens vanes; bass changes core scale; high-band
energy changes emissive edges. Mint, brushed metal and amber extend X1's existing
dark palette. Perspective orbit camera; no bloom or random motion. Minimum version:
one complete sculpture, local transport, explicit mappings, reduced motion and help.

## Lessons adapted from Vibrasolids

Read the source repository's contract, cascade plan, decisions, latest V2v report,
First Light `web/timing.js`, `web/app.js`, `web/rive-adapter.js`, Rust core and
browser checklist, plus the core geometry tests.

- D33 / First Light timing: derive phase from an absolute audio timeline, never
  accumulated display frames. Here HTMLAudioElement.currentTime is the timeline;
  this is approximate presentation synchronization, not sample-accurate DSP.
- Claims register: label creative ranges Designed and feature readings Computed.
  This is an artistic mapping, not an acoustic model, planetary physics or cymatics.
- Boundary discipline: browser owns resources; dependency-free Rust transforms
  numbers; a visual module consumes them. No engine/table code is copied.
- Verification: test finite outputs, time partition invariance and repeatability;
  distinguish automated evidence from perceptual/hardware verification.
- Cleanup and startup: explicit ownership, user-gesture audio start, local-only
  files, recoverable failure and disposal.

Vibrasolids' synthesis, Ambisonics, modal tables, generated mathematical records,
Rive runtime and services do not belong in this analyser-driven teaching slice.
Some source decisions are proposals; this project does not promote them to facts.

## Step 1 — explicit Rust mapping state

Files: `rust/src/lib.rs`, `test/wasm-boundary.mjs`, temporary host API adaptation in
`src/main.js` (all paths relative to the X1 app directory).

Concept: pure functions, sanitization, seconds versus frames, a small C/Wasm ABI.
`smooth(previous, input, delta_seconds, tau_seconds)` accepts caller-owned state.
`aperture`, `core_scale`, `radiance` map one normalized feature each into a stated
range. Reset now means the host sets its three previous values to zero.

Red: new boundary test failed because `smooth` was not exported. Green: native
and Wasm tests cover NaN/infinities, silence, independence, repeatability and
30/144 Hz constant-input agreement. Test with `npm test` inside X1.
Risk: a browser analyser is sampled at display time, so real audio snapshots can
vary between browsers; deterministic mapping is not bit-identical music replay.
The next step replaces the transport/scene and restores meaningful gain.

## Step 2 — audio ownership and normalized features

Files: `src/audio.js`, `src/features.js`, `test/features.test.mjs`, `package.json`.
The new modules are connected to the host in Step 3. A single media element and
source node survive track replacement; owned Blob URLs are released. Gain is an
attenuator (0..1, default 0.7) before analysis and output. A short gain ramp avoids
clicks. Generation tokens cancel stale asynchronous starts. Seek/reset invalidate
visual history. Disposal closes listeners, graph, context and media resources.

Concept: Web Audio graph ownership; RMS; FFT bins expressed in Hz; dB-to-power
conversion; explicit error states. The analyser uses 2048 samples and no internal
smoothing. RMS is normalized with a Designed factor of 2; bass sums 35–250 Hz power,
high sums 2–10 kHz power. These are relative readings, not calibrated loudness.

Test: `npm run test:unit` passes four tests including silence, corrupt numbers and
band isolation at 44.1/48/96 kHz. `predev` now builds Wasm on a fresh checkout.
Could fail: codec support varies by browser; decoding/autoplay/resource lifecycle
need the real-browser integration checks after the controls are connected.

## Step 3 — one complete 3D instrument

Files: X1 `index.html`, `src/main.js`, `src/style.css`,
`src/visualizers/tidal-orrery.js`, `public/architecture.html`, generated audio fixture,
`scripts/generate-fixture.py`, package/lock files, Playwright configuration,
`test/visualizer.test.mjs`, `test/e2e/instrument.spec.js`, ignore rules.

Concept: hierarchy and ownership. Twelve hinged vanes surround a faceted suspended
core; intersecting gimbals and a plinth make depth visible. Rust-mapped RMS, bass
and high energy independently affect hinges, core scale and emission. Closed-form
media-time angles avoid accumulated frame drift. The browser owns one camera,
renderer and animation loop; the module owns one disposable subtree.

Implemented controls: local files, play/pause/cancel, seek, audible gain, mute,
loop, response time, camera orbit/zoom/angle, reset, all requested shortcuts and
focus-preserving help. Reduced motion follows OS preference, fixes spatial motion
and slows lighting. A mobile stage Play/Pause control mirrors the main transport.
A 12-second deterministic studio fixture cycles bass/middle/high/blend/silence;
its generator is included. Runtime URL plugin loading is explicitly future work.

Test evidence (2026-11-26): `CAPTURE_REVIEW=1 npm test` passed 4 native Rust tests,
5 JavaScript tests, the compiled Wasm boundary test, and 7 real Chromium tests.
Browser tests run the production build at `/rust-wasm-music-visualizer/` and cover
transport, all keys, gain and mute graph values, bands, loop wraparound, invalid
and undecodable files, repeated replacement, rapid start/reset, end/restart,
reduced motion, mobile layout, native range keys, missing Wasm, architecture
links and WebGL context loss/restoration. Normal playback produced no console
errors. The geometry test verifies repeatable transforms, fixed reduced-motion
transforms, and exactly-once disposal of every shared resource.

One first browser run failed because its mobile assertion assumed the offscreen
main Play button would be in view after a viewport resize. The test now scrolls
to and checks the dedicated stage transport; the button can launch from the first
mobile viewport. All corrected checks passed. No implementation failures were
hidden by retries (the suite uses zero retries).

Independent Impeccable finish review: first verdict `fix` for help outside the
viewport and live-output telemetry. Fixed help focus/scroll/return focus and set
continuous readouts to `aria-live="off"`. Final verdict: **ship within the reviewed
scope**, both findings resolved; mobile launch affordance passes. Screenshots
inspected at desktop 1440×1000 and mobile 390×844, including playing and help
states. Detector's only warning was flat type hierarchy from failing to resolve
linked CSS; actual h1 is 2.2–3.5rem and body 1rem. No manual screen-reader session.

Computed local browser timing: headless Chromium 159, 1440×1000 viewport, 120 frame
intervals during fixture playback: mean 40.45 FPS, p95 33.4 ms; 47 draw calls and
13 geometries. These are local automated measurements, not a target-device
performance guarantee. Test attachment retains the measurements. Captures in
`.impeccable/review/` are local ignored verification artifacts.

Could fail: GPU/browser/codec/device differences remain; real speaker latency,
listening comfort and physical-phone/screen-reader behavior require those devices.
The large Three.js bundle produces Vite's advisory chunk-size warning (~192 kB
gzip overall JS). No runtime warning is suppressed. No new production dependency;
`@playwright/test` 1.65.1 (Apache-2.0) is development-only.

Test this step: install Chromium once (`npx playwright install chromium`), then
`npm test`. Use the test-tone bands to inspect each visual response separately;
upload your music to test it perceptually. `?test` enables read-only local
`window.orreryTest()` diagnostics, never file content or telemetry upload.

## Step 4 — teach and hand off a deployable artifact

Files: root `README.md`, X1 `README.md`, `.github/workflows/pages.yml`, Rust scale
comment, and these notes. The guides explain every Rust function, normalized
feature units, timing limits, complete setup commands and the working module
contract. The built architecture page is linked from the instrument. One isolated
optional extension, beat/event detection, is proposed and explicitly not shipped.

The Pages workflow installs Chromium and its Linux dependencies, checks Rust
formatting and Clippy, runs the full suite (which produces the tested production
build), then uploads that same dist artifact. No second architecture or backend.
The owner still selects GitHub Actions as the Pages source and pushes the commits.

Verification: Rust formatting and Clippy passed with warnings denied. The full
suite and production Pages build passed in Step 3; this step changes documentation
and CI commands only. Confirm the dist contains HTML, JS/CSS, the architecture
page, audio and Wasm, and that each HTML bundle URL resolves under the Pages base.
Could fail: GitHub Pages configuration or unavailable CI package/browser downloads.
No remote deployment or repository settings change was attempted.

## Local semantic commits

- `56a7276`: explicit, time-based pure Rust API and boundary proof.
- `31fc59c`: owned audio transport and normalized features.
- `f9c9e46`: complete sculpture/controls, cleanup and browser acceptance tests.
- Documentation/CI handoff: the next commit containing this entry.

Rollback: each milestone is an ordinary local Git commit; revert the relevant
commit in reverse order to unwind its behavior. No history rewrite or remote
operation is needed. Rebuild Wasm after changing the Rust boundary.
