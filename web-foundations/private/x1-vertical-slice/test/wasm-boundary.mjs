import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const bytes = await readFile(new URL('../public/wasm/visualizer_kernel.wasm', import.meta.url));
const { instance } = await WebAssembly.instantiate(bytes);
const { set_gain, set_smoothing, reset, step } = instance.exports;
assert.equal(typeof step, 'function');
set_gain(1.4);
set_smoothing(0.2);
reset();
for (const input of [[0, 0, 0], [0.4, 0.8, 1.2], [1, 1, 2]]) {
  const value = step(...input);
  assert.ok(Number.isFinite(value) && value >= 0.5 && value <= 2.5, `unexpected scale ${value}`);
}
console.log('Wasm boundary exports and bounded mapping: ok');
