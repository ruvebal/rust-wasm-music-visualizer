import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const bytes = await readFile(new URL('../public/wasm/visualizer_kernel.wasm', import.meta.url));
const { instance } = await WebAssembly.instantiate(bytes);
const { smooth, aperture, core_scale, radiance } = instance.exports;
for (const fn of [smooth, aperture, core_scale, radiance]) assert.equal(typeof fn, 'function');
const hostile = [-Infinity, -100, 0, 0.5, 1, 100, Infinity, NaN];
for (const input of hostile) {
  for (const previous of hostile) {
    const value = smooth(previous, input, 1 / 60, 0.22);
    assert.ok(Number.isFinite(value) && value >= 0 && value <= 1);
  }
  for (const [fn, min, max] of [[aperture, 0.12, 1.22], [core_scale, 0.72, 1.3], [radiance, 0.15, 1.25]]) {
    const value = fn(input);
    assert.ok(Number.isFinite(value) && value >= min - 1e-6 && value <= max + 1e-6);
  }
}
const replay = (hz) => {
  let state = 0;
  for (let i = 0; i < hz; i++) state = smooth(state, 0.8, 1 / hz, 0.22);
  return state;
};
assert.ok(Math.abs(replay(30) - replay(144)) < 1e-5, 'smoothing must use seconds, not frames');
assert.equal(replay(60), replay(60), 'same inputs must replay identically');
assert.equal(smooth(0.4, 1, 0, 0.22), Math.fround(0.4));
assert.equal(aperture(0), aperture(NaN));
console.log('Wasm ABI: finite bounds, explicit state, replay and frame-rate invariance passed');
