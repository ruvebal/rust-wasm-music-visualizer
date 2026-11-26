import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createVisualizer } from '../src/visualizers/tidal-orrery.js';

test('module replays transforms, honors reduced motion and releases each shared resource once', () => {
  const scene = new THREE.Scene();
  const features = { rms: 0.8, bass: 0.5, high: 0.9 };
  const visualizer = createVisualizer({ scene, THREE, features, options: {} });
  const root = scene.children[0];
  const transforms = () => {
    root.updateMatrixWorld(true);
    const result = [];
    root.traverse((object) => result.push([...object.matrixWorld.elements]));
    return result;
  };
  const update = (time, reducedMotion = false) => visualizer.update({ values: { aperture: 1, coreScale: 1.1, radiance: 0.9 }, time, reducedMotion });
  update(10);
  const first = transforms();
  update(90);
  assert.notDeepEqual(transforms(), first);
  update(10);
  assert.deepEqual(transforms(), first);
  update(10, true);
  const still = transforms();
  Object.assign(features, { rms: 1, bass: 1, high: 1 });
  update(100, true);
  assert.deepEqual(transforms(), still);
  visualizer.resize({ width: 390, height: 500, pixelRatio: 1.5 });
  assert.equal(root.userData.viewport.width, 390);
  const resources = new Set();
  root.traverse((object) => { if (object.geometry) resources.add(object.geometry); if (object.material) resources.add(object.material); });
  const counts = new Map([...resources].map((resource) => [resource, 0]));
  for (const resource of resources) resource.addEventListener('dispose', () => counts.set(resource, counts.get(resource) + 1));
  visualizer.dispose();
  visualizer.dispose();
  assert.equal(scene.children.length, 0);
  assert.ok([...counts.values()].every((count) => count === 1));
});
