import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { AudioTransport } from './audio.js';
import { clamp, formatTime, silence } from './features.js';
import { createVisualizer } from './visualizers/tidal-orrery.js';
import './style.css';

const $ = (id) => document.getElementById(id);
const canvas = $('scene');
const events = new AbortController();
const listen = (target, type, callback) => target.addEventListener(type, callback, { signal: events.signal });
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
$('motion').checked = motionPreference.matches;
let kernel, renderer, orbit, visualizer, fatalError;
let disposed = false;
let contextLost = false;
let smoothed = silence();
const features = silence();
let values = { aperture: 0.12, coreScale: 0.72, radiance: 0.15 };
let lastFrame = performance.now();
let motionTime = 0;
let frameCount = 0, fpsStart = lastFrame, lastReadout = 0, fps = 0, frameId;
let cameraAngle = 24 * Math.PI / 180;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#090f10');
scene.fog = new THREE.Fog('#090f10', 12, 28);
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 40);

function clearHistory() { smoothed = silence(); Object.assign(features, silence()); }
const transport = new AudioTransport({
  fixtureUrl: `${import.meta.env.BASE_URL}audio/fixture-tone.wav`,
  onChange: renderTransport,
  onDiscontinuity: clearHistory,
});

function renderTransport() {
  $('track-name').textContent = transport.name;
  $('status').textContent = fatalError || (!kernel ? 'Loading Rust/Wasm…' : transport.message);
  $('status').classList.toggle('error', Boolean(fatalError) || transport.state === 'error');
  $('play').disabled = !kernel || !renderer || contextLost || Boolean(fatalError);
  $('play').textContent = transport.pending ? 'Cancel' : transport.playing ? 'Pause' : 'Play';
  $('stage-play').textContent = $('play').textContent;
  $('stage-play').disabled = $('play').disabled;
  $('mute').setAttribute('aria-pressed', String(transport.muted));
  $('mute').textContent = transport.muted ? 'Unmute' : 'Mute';
  $('gain').value = String(transport.gain);
  $('gain-output').textContent = `${Math.round(transport.gain * 100)}%`;
  $('loop').checked = transport.audio.loop;
  $('seek').max = String(transport.duration || 1);
  $('seek').disabled = !transport.duration;
  $('seek').value = String(transport.audio.currentTime);
  $('seek-output').textContent = `${formatTime(transport.audio.currentTime)} / ${formatTime(transport.duration)}`;
  $('seek').setAttribute('aria-valuetext', `${formatTime(transport.audio.currentTime)} of ${formatTime(transport.duration)}`);
}

function centerCamera() {
  cameraAngle = 24 * Math.PI / 180;
  $('angle').value = '24';
  $('angle-output').textContent = '24°';
  if (orbit) orbit.target.set(0, 0.1, 0);
  placeCamera(0);
  orbit?.update();
}
function placeCamera(offset) {
  const distance = camera.aspect < 0.9 ? 10.5 : 8.3;
  const angle = cameraAngle + offset;
  camera.position.set(Math.sin(angle) * distance, 3.25, Math.cos(angle) * distance);
  camera.lookAt(0, 0.1, 0);
}
function resize() {
  if (!renderer || disposed) return;
  const { width, height } = canvas.getBoundingClientRect();
  if (!width || !height) return;
  const pixelRatio = Math.min(devicePixelRatio, 1.5);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  if ($('drift').checked) placeCamera(0);
  visualizer?.resize({ width, height, pixelRatio });
}

try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  $('fps-readout').textContent = 'WebGL2 ready';
  orbit = new OrbitControls(camera, canvas);
  orbit.enablePan = false;
  orbit.enableDamping = false; // Deliberate input stops immediately; no frame-based inertia.
  orbit.minDistance = 5.5;
  orbit.maxDistance = 13;
  orbit.minPolarAngle = 0.35;
  orbit.maxPolarAngle = Math.PI / 2 - 0.02;
  orbit.addEventListener('start', () => { $('drift').checked = false; });
  visualizer = createVisualizer({ scene, THREE, features, options: {} });
  centerCamera();
} catch {
  fatalError = 'WebGL2 is unavailable. Try a browser with hardware acceleration, then reload.';
  $('render-error').hidden = false;
  $('render-error').textContent = fatalError;
}
const observer = new ResizeObserver(resize);
observer.observe(canvas);
listen(canvas, 'webglcontextlost', (event) => {
  event.preventDefault();
  contextLost = true;
  if (transport.playing || transport.pending) void transport.toggle();
  $('render-error').hidden = false;
  $('render-error').textContent = 'Graphics were interrupted. Waiting for WebGL2 to recover…';
  renderTransport();
});
listen(canvas, 'webglcontextrestored', () => {
  contextLost = false;
  $('render-error').hidden = true;
  lastFrame = performance.now();
  resize();
  renderTransport();
});

listen($('play'), 'click', () => void transport.toggle());
listen($('stage-play'), 'click', () => void transport.toggle());
listen($('file'), 'change', () => { transport.loadFile($('file').files?.[0]); $('file').value = ''; });
listen($('fixture'), 'click', () => transport.useFixture());
listen($('thais'), 'click', () => transport.useThaisTheme(`${import.meta.env.BASE_URL}audio/thais_theme_owls_v2.mp3`));
listen($('seek'), 'input', () => transport.seek(Number($('seek').value)));
listen($('gain'), 'input', () => transport.setGain(Number($('gain').value)));
listen($('loop'), 'change', () => transport.setLoop($('loop').checked));
listen($('mute'), 'click', () => transport.setMuted(!transport.muted));
listen($('smoothing'), 'input', () => { $('smoothing-output').textContent = `${Number($('smoothing').value).toFixed(2)} s`; });
listen($('view-reset'), 'click', centerCamera);
listen($('angle'), 'input', () => {
  cameraAngle = Number($('angle').value) * Math.PI / 180;
  $('angle-output').textContent = `${$('angle').value}°`;
  $('drift').checked = false;
  placeCamera(0);
  orbit?.update();
});
function motionChanged() {
  $('motion-note').textContent = $('motion').checked ? 'Still form. Sound changes the light.' : 'Drag to orbit. Scroll to explore.';
  if ($('motion').checked) centerCamera();
}
listen($('motion'), 'change', motionChanged);
listen(motionPreference, 'change', () => { $('motion').checked = motionPreference.matches; motionChanged(); });
function reset() {
  transport.reset();
  $('smoothing').value = '0.22';
  $('smoothing-output').textContent = '0.22 s';
  $('motion').checked = motionPreference.matches;
  $('drift').checked = true;
  clearHistory();
  motionChanged();
  centerCamera();
}
listen($('reset'), 'click', reset);
let helpReturnFocus;
function toggleHelp() {
  const opening = $('help').hidden;
  if (opening) helpReturnFocus = document.activeElement;
  $('help').hidden = !opening;
  $('help-toggle').setAttribute('aria-expanded', String(opening));
  if (opening) {
    $('help-heading').focus({ preventScroll: true });
    $('help-heading').scrollIntoView({ block: 'start', behavior: 'instant' });
  } else {
    helpReturnFocus?.focus();
  }
}
listen($('help-toggle'), 'click', toggleHelp);
listen(document, 'keydown', (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
  const element = event.target;
  if (element.closest('input, select, textarea, [contenteditable="true"]')) return;
  if ((event.code === 'Space' || event.key === ' ') && element.closest('button, summary, a')) return;
  const key = event.key.toLowerCase();
  const actions = {
    ' ': () => { if (!$('play').disabled) void transport.toggle(); },
    l: () => transport.setLoop(!transport.audio.loop),
    m: () => transport.setMuted(!transport.muted),
    arrowleft: () => transport.seek(transport.audio.currentTime - 5),
    arrowright: () => transport.seek(transport.audio.currentTime + 5),
    arrowup: () => transport.setGain(transport.gain + 0.05),
    arrowdown: () => transport.setGain(transport.gain - 0.05),
    r: reset,
    '?': toggleHelp,
  };
  if (!actions[key]) return;
  event.preventDefault();
  if (event.repeat && !key.startsWith('arrow')) return;
  actions[key]();
});
listen(document, 'visibilitychange', () => { lastFrame = performance.now(); clearHistory(); });

async function loadKernel() {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}wasm/visualizer_kernel.wasm`);
    if (!response.ok) throw Error(`HTTP ${response.status}`);
    // ArrayBuffer also works on simple static hosts with an incorrect Wasm MIME type.
    const { instance } = await WebAssembly.instantiate(await response.arrayBuffer());
    if (disposed) return;
    for (const name of ['smooth', 'aperture', 'core_scale', 'radiance']) {
      if (typeof instance.exports[name] !== 'function') throw Error(`Missing kernel export: ${name}`);
    }
    kernel = instance.exports;
  } catch (error) {
    fatalError = `Rust/Wasm could not load (${error.message}). Run npm run build, serve over HTTP, and reload.`;
  }
  renderTransport();
}

function animate(now) {
  if (disposed) return;
  frameId = requestAnimationFrame(animate);
  const delta = clamp((now - lastFrame) / 1000, 0, 0.1);
  lastFrame = now;
  motionTime += delta;
  if (document.hidden || contextLost) return;
  Object.assign(features, transport.features());
  if (kernel) {
    const tau = Math.max(Number($('smoothing').value), $('motion').checked ? 0.6 : 0.08);
    for (const name of ['rms', 'bass', 'high']) smoothed[name] = kernel.smooth(smoothed[name], features[name], delta, tau);
    // The module receives only smoothed normalized features and bounded visual values.
    Object.assign(features, smoothed);
    values = { aperture: kernel.aperture(features.rms), coreScale: kernel.core_scale(features.bass), radiance: kernel.radiance(features.high) };
  }
  const time = transport.audio.currentTime || 0;
  visualizer?.update({ values, time, motionTime, delta, reducedMotion: $('motion').checked });
  if ($('drift').checked && !$('motion').checked) {
    placeCamera(Math.sin(time * 0.07) * features.rms * 0.12);
    orbit?.update();
  }
  if (renderer) renderer.render(scene, camera);
  frameCount++;
  if (now - fpsStart >= 1000) {
    fps = Math.round(frameCount * 1000 / (now - fpsStart));
    $('fps-readout').textContent = `${fps} FPS · WebGL2`;
    frameCount = 0; fpsStart = now;
  }
  if (now - lastReadout > 100) {
    for (const name of ['rms', 'bass', 'high']) {
      $(`${name}-meter`).value = features[name];
      $(`${name}-output`).textContent = `${Math.round(features[name] * 100)}%`;
    }
    lastReadout = now;
  }
}
function dispose() {
  if (disposed) return;
  disposed = true;
  cancelAnimationFrame(frameId);
  events.abort();
  observer.disconnect();
  orbit?.dispose();
  visualizer?.dispose();
  renderer?.dispose();
  transport.dispose();
  delete window.orreryTest;
}
listen(window, 'pagehide', (event) => { if (!event.persisted) dispose(); });
if (import.meta.hot) import.meta.hot.dispose(dispose);
// Opt-in read-only diagnostics. No file contents or recording, inspired by First Light.
if (new URLSearchParams(location.search).has('test')) {
  window.orreryTest = () => ({
    ready: Boolean(kernel && renderer), state: transport.state, playing: transport.playing,
    time: transport.audio.currentTime, motionTime, duration: transport.duration, gain: transport.gain,
    loop: transport.audio.loop, muted: transport.muted, features: { ...features }, values: { ...values },
    reducedMotion: $('motion').checked, camera: camera.position.toArray(),
    drawCalls: renderer?.info.render.calls, geometries: renderer?.info.memory.geometries, fps,
    contextState: transport.context?.state, graphGain: transport.volume?.gain.value,
  });
}
resize();
motionChanged();
renderTransport();
void loadKernel();
frameId = requestAnimationFrame(animate);
