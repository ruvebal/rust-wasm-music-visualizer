// The host supplies measured features and Rust-mapped values. No audio or DOM here.
export function createVisualizer({ scene, THREE, features, options = {} }) {
  const root = new THREE.Group();
  root.name = 'Tidal Orrery';
  scene.add(root);
  const metal = new THREE.MeshStandardMaterial({ color: '#d3ddd4', metalness: 0.65, roughness: 0.32 });
  const dark = new THREE.MeshStandardMaterial({ color: '#243b36', metalness: 0.6, roughness: 0.4 });
  const brass = new THREE.MeshStandardMaterial({ color: '#d7a363', metalness: 0.6, roughness: 0.3 });
  const luminous = new THREE.MeshStandardMaterial({ color: '#8fe9b7', emissive: '#8fe9b7', emissiveIntensity: 0.15, metalness: 0.3, roughness: 0.3 });
  const edgeMaterial = new THREE.LineBasicMaterial({ color: '#8fe9b7', transparent: true, opacity: 0.55 });
  const addMesh = (geometry, material, parent = root) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };

  const plinth = addMesh(new THREE.CylinderGeometry(1.55, 1.7, 0.18, 64), dark);
  plinth.position.y = -1.42;
  const foot = addMesh(new THREE.CylinderGeometry(1.25, 1.45, 0.18, 64), dark);
  foot.position.y = -1.58;
  const rim = addMesh(new THREE.TorusGeometry(1.53, 0.018, 8, 96), brass);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = -1.32;
  const axle = addMesh(new THREE.CylinderGeometry(0.045, 0.07, 1.5, 12), brass);
  axle.position.y = -0.65;

  const assembly = new THREE.Group();
  assembly.position.y = 0.3;
  assembly.rotation.z = 0.16;
  root.add(assembly);
  const core = addMesh(new THREE.IcosahedronGeometry(0.66, 1), luminous, assembly);
  const cage = addMesh(new THREE.IcosahedronGeometry(0.8, 0), new THREE.MeshStandardMaterial({ color: '#d7a363', wireframe: true, metalness: 0.45, roughness: 0.4 }), assembly);
  const innerRing = addMesh(new THREE.TorusGeometry(0.98, 0.035, 8, 64), brass, assembly);
  innerRing.rotation.x = Math.PI / 2;
  innerRing.position.y = -0.5;

  const vaneShape = new THREE.Shape();
  vaneShape.moveTo(-0.09, 0);
  vaneShape.lineTo(0.22, 0.08);
  vaneShape.lineTo(0.34, 0.84);
  vaneShape.lineTo(0.14, 1.25);
  vaneShape.lineTo(-0.15, 1.05);
  vaneShape.closePath();
  const vaneGeometry = new THREE.ExtrudeGeometry(vaneShape, { depth: 0.045, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 1, steps: 1 });
  const vaneEdges = new THREE.EdgesGeometry(vaneGeometry, 35);
  const hingeGeometry = new THREE.SphereGeometry(0.07, 12, 8);
  const hinges = [];
  for (let i = 0; i < 12; i++) {
    const spoke = new THREE.Group();
    spoke.rotation.y = i * Math.PI * 2 / 12;
    assembly.add(spoke);
    const hinge = new THREE.Group();
    hinge.position.set(0.98, -0.5, 0);
    spoke.add(hinge);
    addMesh(vaneGeometry, i % 3 === 0 ? brass : metal, hinge);
    hinge.add(new THREE.LineSegments(vaneEdges, edgeMaterial));
    addMesh(hingeGeometry, brass, hinge);
    hinges.push(hinge);
  }

  const gimbals = new THREE.Group();
  gimbals.position.y = 0.3;
  root.add(gimbals);
  const ringGeometry = new THREE.TorusGeometry(2.18, 0.023, 8, 128);
  const ringA = addMesh(ringGeometry, brass, gimbals);
  ringA.rotation.set(0.65, 0.3, 0);
  const ringB = addMesh(ringGeometry, dark, gimbals);
  ringB.rotation.set(-0.45, 1.05, 0.2);
  ringB.scale.setScalar(1.08);
  const marker = addMesh(new THREE.SphereGeometry(0.09, 16, 12), luminous, ringA);
  marker.position.x = 2.18;
  const moonOrbit = new THREE.Group();
  moonOrbit.name = 'Moon orbit';
  root.add(moonOrbit);
  const moon = addMesh(new THREE.SphereGeometry(0.16, 24, 16), new THREE.MeshStandardMaterial({ color: '#b7c8ff', emissive: '#344a88', emissiveIntensity: 0.35, metalness: 0.2, roughness: 0.55 }), moonOrbit);
  moon.position.set(2.65, 0.55, 0);

  const floor = addMesh(new THREE.CircleGeometry(12, 96), new THREE.MeshStandardMaterial({ color: '#0e1918', roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.69;
  floor.castShadow = false;
  root.add(new THREE.HemisphereLight('#e4fff1', '#182729', 2));
  const key = new THREE.DirectionalLight('#fff1d6', 4);
  key.position.set(3, 6, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = key.shadow.camera.bottom = -4;
  key.shadow.camera.right = key.shadow.camera.top = 4;
  key.shadow.normalBias = 0.025;
  root.add(key);
  const fill = new THREE.DirectionalLight('#8fe9b7', 2);
  fill.position.set(-4, 2, -3);
  root.add(fill);

  let disposed = false;
  return {
    update({ values, time, motionTime = time, reducedMotion }) {
      if (disposed) return;
      const still = reducedMotion || options.reducedMotion;
      // Media time shapes the audio relationship; motionTime keeps the sculpture alive when paused.
      const phase = motionTime * 0.35;
      const audioPhase = time * 0.18;
      const opening = still ? 0.32 : values.aperture;
      hinges.forEach((hinge) => { hinge.rotation.z = -opening; });
      const idleBreath = still ? 1 : 1 + Math.sin(phase * 0.7) * 0.025;
      core.scale.setScalar((still ? 0.82 : values.coreScale) * idleBreath);
      cage.scale.setScalar(still ? 1 : 0.96 + features.bass * 0.12);
      assembly.rotation.y = still ? 0 : phase + Math.sin(audioPhase) * (features.mid || 0) * 0.55;
      core.rotation.set(0.2, still ? 0 : Math.sin(audioPhase * 0.7) * features.bass, 0.1);
      gimbals.rotation.y = still ? 0 : -phase * 0.42 + Math.sin(audioPhase * 0.4) * features.rms * 0.22;
      marker.scale.setScalar(still ? 1 : 1 + (features.beatPulse || 0) * 1.8);
      brass.color.setHSL(0.08 - features.bass * 0.035, 0.52, 0.52 + features.bass * 0.12);
      luminous.color.setHSL(0.42 - (features.mid || 0) * 0.12, 0.72, 0.62);
      luminous.emissive.setHSL(0.42 + features.high * 0.08, 0.78, 0.62);
      moonOrbit.rotation.y = still ? 0 : phase * 0.8 + (features.bpm || 0) * 0.0008;
      moon.position.y = 0.55 + (still ? 0 : Math.sin(phase * 1.7) * 0.12 + (features.beatPulse || 0) * 0.08);
      moon.material.color.setHSL(0.62 - features.high * 0.16, 0.68, 0.62 + features.mid * 0.12);
      moon.material.emissiveIntensity = 0.25 + features.high * 0.65 + (features.beatPulse || 0) * 0.6;
      // Reduced motion keeps shape fixed; slowly smoothed lighting still explains audio.
      luminous.emissiveIntensity = values.radiance;
      edgeMaterial.opacity = 0.28 + features.high * 0.65;
      edgeMaterial.color.setHSL(0.42 + features.high * 0.08, 0.78, 0.62);
    },
    resize({ width, height, pixelRatio }) {
      // Layout belongs to the host camera. A student shader could update resolution here.
      root.userData.viewport = { width, height, pixelRatio };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      scene.remove(root);
      const geometries = new Set();
      const materials = new Set();
      root.traverse((object) => {
        if (object.geometry) geometries.add(object.geometry);
        if (object.material) (Array.isArray(object.material) ? object.material : [object.material]).forEach((m) => materials.add(m));
        object.shadow?.map?.dispose();
      });
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      root.clear();
    },
  };
}
