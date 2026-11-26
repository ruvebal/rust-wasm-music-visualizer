import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractFeatures, formatTime } from '../src/features.js';
import { BeatTracker } from '../src/rhythm.js';

test('silence, empty buffers and invalid sample rates stay zero', () => {
  const zero = { rms: 0, bass: 0, mid: 0, high: 0 };
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
    spectrum.fill(-Infinity);
    spectrum[Math.round(800 / (rate / 2048))] = -12;
    const mid = extractFeatures([0.25, -0.25], spectrum, rate, 2048);
    assert.ok(mid.mid > 0.4 && mid.bass === 0 && mid.high === 0);
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
test('beat tracker estimates a bounded tempo from repeated bass onsets', () => {
  const tracker = new BeatTracker();
  for (let time = 0; time < 0.2; time += 0.04) tracker.update({ bass: 0.05, rms: 0.1, time, delta: 0.04 });
  tracker.update({ bass: 0.8, rms: 0.8, time: 0.2, delta: 0.04 });
  tracker.update({ bass: 0.02, rms: 0.1, time: 0.25, delta: 0.25 });
  const result = tracker.update({ bass: 0.8, rms: 0.8, time: 0.7, delta: 0.25 });
  assert.equal(result.bpm, 120);
  assert.equal(result.beatPulse, 1);
  assert.ok(tracker.update({ bass: 0, rms: 0, time: 0.7, delta: 0.2 }).beatPulse < 1);
});
