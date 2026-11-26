import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractFeatures, formatTime } from '../src/features.js';

test('silence, empty buffers and invalid sample rates stay zero', () => {
  const zero = { rms: 0, bass: 0, high: 0 };
  assert.deepEqual(extractFeatures(new Float32Array(2048), new Float32Array(1024), 48000, 2048), zero);
  assert.deepEqual(extractFeatures([], [], 48000, 2048), zero);
  assert.deepEqual(extractFeatures([NaN, Infinity], [0, 0], 48000, 2048), zero);
  assert.deepEqual(extractFeatures([1], [1], NaN, 2048), zero);
});
test('RMS and bands distinguish low and high frequencies at multiple sample rates', () => {
  for (const rate of [44100, 48000, 96000]) {
    const spectrum = new Float32Array(1024).fill(-Infinity);
    spectrum[Math.round(140 / (rate / 2048))] = -12;
    const low = extractFeatures([0.25, -0.25], spectrum, rate, 2048);
    assert.equal(low.rms, 0.5);
    assert.ok(low.bass > 0.4 && low.high === 0);
    spectrum.fill(-Infinity);
    spectrum[Math.round(5000 / (rate / 2048))] = -12;
    const high = extractFeatures([0.25, -0.25], spectrum, rate, 2048);
    assert.ok(high.high > 0.4 && high.bass === 0);
  }
});
test('non-finite samples and extreme spectrum cannot escape normalized bounds', () => {
  for (const value of Object.values(extractFeatures([NaN, Infinity, -10, 100], [NaN, Infinity, 1e6, -1e6], 48000, 2048))) {
    assert.ok(Number.isFinite(value) && value >= 0 && value <= 1);
  }
});
test('time formatting tolerates unavailable metadata', () => {
  assert.equal(formatTime(Infinity), '0:00');
  assert.equal(formatTime(125.9), '2:05');
});
