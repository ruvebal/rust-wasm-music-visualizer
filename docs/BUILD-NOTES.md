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
