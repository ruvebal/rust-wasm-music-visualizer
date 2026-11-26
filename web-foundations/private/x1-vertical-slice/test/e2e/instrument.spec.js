import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

async function capture(page, name) {
  if (!process.env.CAPTURE_REVIEW) return;
  const directory = resolve('../../../.impeccable/review');
  await mkdir(directory, { recursive: true });
  await page.screenshot({ path: resolve(directory, name), fullPage: true });
}

// Synthetic, deterministic local file: bass, high tone, then silence.
function waveFile() {
  const rate = 48000, seconds = 14, count = rate * seconds;
  const buffer = Buffer.alloc(44 + count * 2);
  buffer.write('RIFF', 0); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(rate, 24); buffer.writeUInt32LE(rate * 2, 28); buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36); buffer.writeUInt32LE(count * 2, 40);
  for (let i = 0; i < count; i++) {
    const time = i / rate;
    const hz = time < 6 ? 100 : 4500;
    const value = time < 12 ? Math.sin(2 * Math.PI * hz * time) * 0.45 : 0;
    buffer.writeInt16LE(Math.round(value * 32767), 44 + i * 2);
  }
  return { name: 'bass-high-silence.wav', mimeType: 'audio/wav', buffer };
}
const diagnostic = (page) => page.evaluate(() => window.orreryTest());
async function ready(page) {
  await page.goto('?test');
  await expect(page.locator('#play')).toBeEnabled();
  await expect.poll(async () => (await diagnostic(page)).duration).toBeGreaterThan(0);
}
async function setRange(page, id, value) {
  await page.locator(`#${id}`).fill(String(value));
  await page.locator(`#${id}`).dispatchEvent('input');
}

test('fresh load, local audio, mapped response, gain, mute, seek, loop and all shortcuts', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  await ready(page);
  expect((await diagnostic(page)).playing).toBe(false);
  await page.locator('#file').setInputFiles(waveFile());
  await expect.poll(async () => (await diagnostic(page)).duration).toBe(14);
  await page.locator('#scene').focus();
  await page.keyboard.press('Space');
  await expect.poll(async () => (await diagnostic(page)).features.bass).toBeGreaterThan(0.12);
  const loud = (await diagnostic(page)).features.rms;
  await capture(page, 'desktop-playing.png');
  expect((await diagnostic(page)).values.aperture).toBeGreaterThan(0.25);
  await setRange(page, 'gain', 0.2);
  await expect.poll(async () => (await diagnostic(page)).features.rms).toBeLessThan(loud * 0.6);
  await page.locator('#scene').focus();
  await page.keyboard.press('ArrowUp');
  expect((await diagnostic(page)).gain).toBeCloseTo(0.25);
  await page.keyboard.press('ArrowDown');
  expect((await diagnostic(page)).gain).toBeCloseTo(0.2);
  await page.keyboard.press('m');
  await expect(page.locator('#mute')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => (await diagnostic(page)).features.rms).toBeLessThan(0.005);
  await expect.poll(async () => (await diagnostic(page)).graphGain).toBeLessThan(0.001);
  await page.keyboard.press('m');
  await setRange(page, 'gain', 0.7);
  await setRange(page, 'seek', 7);
  await expect.poll(async () => (await diagnostic(page)).features.high).toBeGreaterThan(0.1);
  expect((await diagnostic(page)).features.bass).toBeLessThan(0.02);
  await page.locator('#scene').focus();
  await page.keyboard.press('Space');
  expect((await diagnostic(page)).playing).toBe(false);
  const pausedTime = (await diagnostic(page)).time;
  await page.keyboard.press('ArrowLeft');
  expect((await diagnostic(page)).time).toBeCloseTo(Math.max(0, pausedTime - 5), 1);
  await page.keyboard.press('ArrowRight');
  expect((await diagnostic(page)).time).toBeCloseTo(pausedTime, 1);
  await page.keyboard.press('l');
  expect((await diagnostic(page)).loop).toBe(true);
  await setRange(page, 'seek', 13.6);
  await page.locator('#play').click();
  await expect.poll(async () => (await diagnostic(page)).time).toBeLessThan(3);
  expect((await diagnostic(page)).playing).toBe(true);
  await page.locator('#scene').focus();
  await page.keyboard.press('?');
  await expect(page.locator('#help')).toBeVisible();
  await expect(page.locator('#help-heading')).toBeFocused();
  await expect(page.locator('#help-heading')).toBeInViewport();
  await page.keyboard.press('?');
  await expect(page.locator('#help')).toBeHidden();
  await expect(page.locator('#scene')).toBeFocused();
  await page.keyboard.press('r');
  const reset = await diagnostic(page);
  expect(reset.playing).toBe(false); expect(reset.time).toBe(0);
  expect(reset.gain).toBe(0.7); expect(reset.loop).toBe(false); expect(reset.muted).toBe(false);
  await expect.poll(async () => (await diagnostic(page)).features.rms).toBeLessThan(0.001);
  await expect.poll(async () => (await diagnostic(page)).fps).toBeGreaterThan(0);
  expect(reset.drawCalls).toBeLessThan(150);
  expect(errors).toEqual([]);
});

test('file replacement, invalid files, decode failure, rapid start/reset and ended state recover', async ({ page }) => {
  await ready(page);
  await page.locator('#file').setInputFiles(waveFile());
  await page.locator('#play').click();
  await expect.poll(async () => (await diagnostic(page)).playing).toBe(true);
  const geometryCount = (await diagnostic(page)).geometries;
  await page.locator('#file').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('not audio') });
  await expect(page.locator('#status')).toContainText('non-empty audio');
  expect((await diagnostic(page)).playing).toBe(true);
  await page.locator('#file').setInputFiles({ name: 'broken.wav', mimeType: 'audio/wav', buffer: Buffer.from('broken header') });
  await expect(page.locator('#status')).toContainText('Cannot decode');
  await page.locator('#fixture').click();
  await page.locator('#play').click();
  await expect.poll(async () => (await diagnostic(page)).playing).toBe(true);
  for (let i = 0; i < 4; i++) {
    await page.locator('#file').setInputFiles(waveFile());
    await page.locator('#play').click();
    await page.locator('#reset').click();
  }
  await page.waitForTimeout(250);
  expect((await diagnostic(page)).playing).toBe(false);
  expect((await diagnostic(page)).geometries).toBe(geometryCount);
  await setRange(page, 'seek', 13.5);
  await page.locator('#play').click();
  await expect.poll(async () => (await diagnostic(page)).state).toBe('ended');
  expect((await diagnostic(page)).playing).toBe(false);
  await page.locator('#play').click();
  await expect.poll(async () => (await diagnostic(page)).time).toBeLessThan(3);
});

test('reduced motion, native range keys and mobile resizing preserve a usable interface', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  await expect(page.locator('#motion')).toBeChecked();
  await page.locator('#file').setInputFiles(waveFile());
  await page.locator('#play').click();
  await expect.poll(async () => (await diagnostic(page)).features.rms).toBeGreaterThan(0.1);
  const camera = (await diagnostic(page)).camera;
  await page.waitForTimeout(350);
  expect((await diagnostic(page)).camera).toEqual(camera);
  await page.locator('#gain').focus();
  await page.keyboard.press('ArrowRight');
  expect((await diagnostic(page)).gain).toBeCloseTo(0.75);
  await page.getByText('Camera controls', { exact: true }).click();
  await setRange(page, 'angle', -45);
  expect((await diagnostic(page)).camera).not.toEqual(camera);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#stage-play').scrollIntoViewIfNeeded();
  await expect(page.locator('#stage-play')).toBeInViewport();
  await capture(page, 'mobile-playing.png');
  await page.locator('#help-toggle').click();
  await expect(page.locator('#help-heading')).toBeFocused();
  await expect(page.locator('#help-heading')).toBeInViewport();
  await capture(page, 'mobile-help.png');
  await page.keyboard.press('?');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.locator('#scene').evaluate((node) => node.width > 0 && node.height > 0)).toBe(true);
  await page.locator('#play').click();
  await expect.poll(async () => (await diagnostic(page)).features.rms).toBeLessThan(0.01);
});

test('missing Wasm has an actionable message and prevents disconnected playback', async ({ page }) => {
  await page.route('**/wasm/*.wasm', (route) => route.fulfill({ status: 404, body: '' }));
  await page.goto('?test');
  await expect(page.locator('#status')).toContainText('Rust/Wasm could not load');
  await expect(page.locator('#play')).toBeDisabled();
});

test('production Pages subpath includes architecture and local assets', async ({ page }) => {
  await ready(page);
  await page.getByRole('link', { name: 'See how it works' }).click();
  await expect(page.getByRole('heading', { name: 'From sound to sculpture' })).toBeVisible();
  await page.getByRole('link', { name: 'Return to the instrument' }).click();
  await expect(page.getByRole('heading', { name: 'Tidal Orrery', exact: true })).toBeVisible();
});


test('WebGL context loss pauses audio and recovers without a new graph', async ({ page }) => {
  await ready(page);
  await page.locator('#play').click();
  await expect.poll(async () => (await diagnostic(page)).playing).toBe(true);
  await page.locator('#scene').evaluate((canvas) => {
    const extension = canvas.getContext('webgl2').getExtension('WEBGL_lose_context');
    if (!extension) throw Error('Context-loss test extension unavailable');
    extension.loseContext();
    setTimeout(() => extension.restoreContext(), 500);
  });
  await expect(page.locator('#render-error')).toBeVisible();
  expect((await diagnostic(page)).playing).toBe(false);
  await expect(page.locator('#render-error')).toBeHidden();
  await expect(page.locator('#play')).toBeEnabled();
  await page.locator('#play').click();
  await expect.poll(async () => (await diagnostic(page)).features.rms).toBeGreaterThan(0.05);
});

test('record local playback frame timing without a hardware-independent performance claim', async ({ page }, testInfo) => {
  await ready(page);
  await page.locator('#loop').check();
  await page.locator('#play').click();
  const measurement = await page.evaluate(async () => {
    const intervals = [];
    let previous;
    await new Promise((resolve) => {
      function tick(now) {
        if (previous !== undefined) intervals.push(now - previous);
        previous = now;
        if (intervals.length < 120) requestAnimationFrame(tick); else resolve();
      }
      requestAnimationFrame(tick);
    });
    const sorted = [...intervals].sort((a, b) => a - b);
    return { averageFps: 1000 / (intervals.reduce((a, b) => a + b, 0) / intervals.length), p95FrameMs: sorted[Math.floor(sorted.length * .95)], renderer: window.orreryTest() };
  });
  await testInfo.attach('frame-timing', { body: JSON.stringify(measurement, null, 2), contentType: 'application/json' });
  console.log('Local Chromium frame timing:', JSON.stringify(measurement));
  expect(measurement.renderer.drawCalls).toBeLessThan(150);
});
