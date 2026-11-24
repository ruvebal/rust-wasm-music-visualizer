import * as THREE from 'three';
import './style.css';

const $ = (id) => document.getElementById(id);
const status = $('status');
const sceneCanvas = $('scene');
const gain = $('gain');
const smoothing = $('smoothing');
const file = $('file');
const play = $('play');
const seek = $('seek');
const loop = $('loop');
const visualizer = $('visualizer');
const pluginUrl = $('plugin-url');
const loadPlugin = $('load-plugin');

let kernel;
let audioContext;
let analyser;
let source;
let connectedElement;
let audioElement;
let frequencyData;
let timeData;
let started = false;
let lastFrame = performance.now();
let frameCount = 0;
let fpsWindowStart = lastFrame;
let audioState = 'loading';
let activePlugin = null;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#090c14');
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 50);
camera.position.set(0, 0.2, 5.6);
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas: sceneCanvas, antialias: true });
} catch (error) {
  audioState = 'error';
  status.textContent = 'Renderer unavailable — WebGL is required';
  $('status-dot').classList.add('error');
}
if (renderer) {
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
}
const group = new THREE.Group();
scene.add(group);
for (let i = 0; i < 3; i += 1) {
  const mesh = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.66 - i * 0.12, 1),
    new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.43 + i * 0.08, 0.7, 0.68), roughness: 0.28, metalness: 0.3 }),
  );
  mesh.position.x = (i - 1) * 1.25;
  mesh.rotation.y = i * 0.8;
  group.add(mesh);
}
scene.add(new THREE.HemisphereLight('#effff8', '#11182b', 2.2));
const key = new THREE.DirectionalLight('#ffe0b5', 3.2);
key.position.set(3, 4, 5);
scene.add(key);

function resize() {
  if (!renderer) return;
  const width = sceneCanvas.clientWidth;
  const height = sceneCanvas.clientHeight;
  if (!width || !height) return;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(sceneCanvas);

async function loadKernel() {
  if (window.location.protocol === 'file:') {
    throw new Error('This prototype must be served over HTTP; run `npm run dev -- --host 127.0.0.1` and open the Vite URL');
  }
  const response = await fetch(`${import.meta.env.BASE_URL}wasm/visualizer_kernel.wasm`);
  if (!response.ok) throw new Error(`kernel request failed: ${response.status}`);
  const result = await WebAssembly.instantiateStreaming(response);
  kernel = result.instance.exports;
  status.textContent = 'Rust/Wasm kernel ready';
}

function featureValues() {
  if (!analyser) return { rms: 0, bass: 0 };
  analyser.getByteTimeDomainData(timeData);
  analyser.getByteFrequencyData(frequencyData);
  let square = 0;
  for (const value of timeData) { const normalized = (value - 128) / 128; square += normalized * normalized; }
  const rms = Math.min(1, Math.sqrt(square / timeData.length) * 2.4);
  const limit = Math.max(1, Math.floor(frequencyData.length * 0.12));
  let bass = 0;
  for (let i = 0; i < limit; i += 1) bass += frequencyData[i] / 255;
  return { rms, bass: Math.min(1, (bass / limit) * 1.6) };
}

async function startAudio() {
  audioState = 'loading';
  status.textContent = 'Loading audio…';
  audioContext ??= new AudioContext();
  await audioContext.resume();
  if (!audioElement) { audioElement = new Audio(`${import.meta.env.BASE_URL}audio/fixture-tone.wav`); wireAudioEvents(); }
  if (!analyser) {
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    frequencyData = new Uint8Array(analyser.frequencyBinCount);
    timeData = new Uint8Array(analyser.fftSize);
  }
  connectAudioElement();
  audioElement.loop = loop.checked;
  await audioElement.play();
  started = true;
  audioState = 'playing';
  play.textContent = 'Pause audio';
  status.textContent = 'Playing local fixture';
}

function connectAudioElement() {
  if (connectedElement === audioElement) return;
  if (source) source.disconnect();
  source = audioContext.createMediaElementSource(audioElement);
  if (analyser) source.connect(analyser).connect(audioContext.destination);
  else source.connect(audioContext.destination);
  connectedElement = audioElement;
}

function wireAudioEvents() {
  audioElement.addEventListener('loadedmetadata', () => { seek.max = String(audioElement.duration || 1); seek.disabled = false; });
  audioElement.addEventListener('timeupdate', () => { if (!seek.matches(':active')) seek.value = String(audioElement.currentTime); $('seek-output').textContent = formatTime(audioElement.currentTime); });
  audioElement.addEventListener('ended', () => { started = false; audioState = 'ended'; play.textContent = 'Start audio'; status.textContent = 'Track ended'; });
  audioElement.addEventListener('error', () => { started = false; audioState = 'error'; play.textContent = 'Start audio'; status.textContent = 'Unsupported or unreadable audio'; $('status-dot').classList.add('error'); });
}

function formatTime(seconds) { const value = Math.max(0, Math.floor(seconds || 0)); return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`; }

play.addEventListener('click', async () => {
  if (started && audioElement) { audioElement.pause(); started = false; play.textContent = 'Start audio'; status.textContent = 'Paused'; return; }
  try { await startAudio(); } catch (error) { status.textContent = `Audio unavailable: ${error.message}`; }
});

file.addEventListener('change', () => {
  const selected = file.files?.[0];
  if (!selected) return;
  if (audioElement) audioElement.pause();
  audioElement = new Audio(URL.createObjectURL(selected));
  audioElement.loop = loop.checked;
  wireAudioEvents();
  if (audioContext) connectAudioElement();
  started = false;
  play.textContent = 'Start audio';
  audioState = 'paused';
  status.textContent = `Ready: ${selected.name}`;
});

seek.addEventListener('input', () => { if (audioElement) audioElement.currentTime = Number(seek.value); });
loop.addEventListener('change', () => { if (audioElement) audioElement.loop = loop.checked; });

gain.addEventListener('input', () => { $('gain-output').textContent = `${Number(gain.value).toFixed(1)}×`; kernel?.set_gain(Number(gain.value)); });
smoothing.addEventListener('input', () => { $('smoothing-output').textContent = Number(smoothing.value).toFixed(2); kernel?.set_smoothing(Number(smoothing.value)); });

visualizer.addEventListener('change', () => { activePlugin = null; status.textContent = visualizer.value === 'rings' ? 'Pulse rings visualizer' : 'Signal / Form visualizer'; });
loadPlugin.addEventListener('click', async () => {
  const url = pluginUrl.value.trim();
  if (!url) return;
  try {
    const module = await import(/* @vite-ignore */ url);
    if (typeof module.createVisualizer !== 'function') throw new Error('module must export createVisualizer(context)');
    activePlugin = await module.createVisualizer({ THREE, scene, group, canvas: sceneCanvas });
    visualizer.value = 'student';
    status.textContent = `Loaded student visualizer: ${module.name || url}`;
  } catch (error) { status.textContent = `Plugin unavailable: ${error.message}`; $('status-dot').classList.add('error'); }
});

function animate(now = performance.now()) {
  requestAnimationFrame(animate);
  const delta = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;
  frameCount += 1;
  if (now - fpsWindowStart > 500) { $('fps-readout').textContent = `${Math.round(frameCount * 1000 / (now - fpsWindowStart))} FPS`; frameCount = 0; fpsWindowStart = now; }
  const features = featureValues();
  const scale = kernel ? kernel.step(features.rms, features.bass, now / 1000) : 1;
  group.scale.lerp(new THREE.Vector3(scale, scale, scale), Math.min(1, delta * 9));
  group.rotation.y += delta * (0.22 + features.bass * 0.8);
  group.rotation.x = Math.sin(now / 2400) * 0.16;
  group.children.forEach((mesh, index) => { mesh.rotation.x += delta * (0.14 + index * 0.06); mesh.rotation.z -= delta * 0.12; });
  if (visualizer.value === 'rings') group.rotation.z = Math.sin(now / 900) * features.rms * 0.5;
  if (activePlugin?.update) activePlugin.update({ THREE, group, scene, features, delta, now, scale });
  $('feature-readout').textContent = `RMS ${(features.rms * 100).toFixed(0)}% · Bass ${(features.bass * 100).toFixed(0)}%`;
  if (renderer) renderer.render(scene, camera);
}

loadKernel().catch((error) => { status.textContent = `Kernel unavailable: ${error.message}`; $('status-dot').classList.add('error'); });
resize();
animate();
