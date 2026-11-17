import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { PowerupType } from './types';

function createHullPanelTexture(
  baseHex: string,
  seamHex: string,
  anisotropy: number,
): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = baseHex;
  g.fillRect(0, 0, 256, 256);

  g.strokeStyle = seamHex;
  g.lineWidth = 2;
  for (let i = 32; i < 256; i += 64) {
    g.beginPath();
    g.moveTo(0, i);
    g.lineTo(256, i);
    g.stroke();
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i, 256);
    g.stroke();
  }

  // Subtle panel rivets / trim
  g.fillStyle = 'rgba(255,255,255,0.08)';
  g.fillRect(16, 16, 44, 10);
  g.fillRect(144, 80, 56, 12);
  g.fillRect(48, 160, 48, 14);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = anisotropy;
  return tex;
}

function createPlanetTexture(anisotropy: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d')!;

  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, '#182b5c');
  grad.addColorStop(0.18, '#284a8e');
  grad.addColorStop(0.32, '#4379bf');
  grad.addColorStop(0.48, '#233b72');
  grad.addColorStop(0.64, '#568bd4');
  grad.addColorStop(0.82, '#1d3260');
  grad.addColorStop(1.0, '#0e1836');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 256);

  // Cloud bands & storm swirl
  g.fillStyle = 'rgba(170, 220, 255, 0.14)';
  for (let i = 0; i < 14; i++) {
    const y = 20 + i * 16;
    g.fillRect(0, y, 512, 3 + (i % 3) * 2);
  }
  g.fillStyle = 'rgba(130, 200, 255, 0.25)';
  g.beginPath();
  g.ellipse(320, 140, 44, 16, 0.1, 0, Math.PI * 2);
  g.fill();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = anisotropy;
  return tex;
}

function createRingTexture(anisotropy: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 32;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 256, 0);
  grad.addColorStop(0.0, 'rgba(90,170,255,0.0)');
  grad.addColorStop(0.15, 'rgba(130,205,255,0.55)');
  grad.addColorStop(0.4, 'rgba(70,130,220,0.18)');
  grad.addColorStop(0.65, 'rgba(160,225,255,0.75)');
  grad.addColorStop(0.85, 'rgba(100,165,245,0.35)');
  grad.addColorStop(1.0, 'rgba(80,140,220,0.0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 32);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  return tex;
}

function createBadgeTexture(label: string, color: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#070b18';
  g.beginPath();
  g.arc(64, 64, 56, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = color;
  g.lineWidth = 8;
  g.stroke();

  g.fillStyle = '#ffffff';
  g.font = 'bold 68px "Courier New", monospace';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(label, 64, 68);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export interface PlayerMeshRefs {
  root: THREE.Group;
  hullGroup: THREE.Group;
  leftFlame: THREE.Mesh;
  rightFlame: THREE.Mesh;
  shieldMesh: THREE.Mesh;
  wingAccentMat: THREE.MeshStandardMaterial;
  hullMaterials: THREE.MeshStandardMaterial[];
}

export function createPlayerShipMesh(anisotropy: number): PlayerMeshRefs {
  const root = new THREE.Group();
  const hullGroup = new THREE.Group();
  root.add(hullGroup);

  const hullTex = createHullPanelTexture('#cde8ff', '#5f87b8', anisotropy);
  const hullMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: hullTex,
    roughness: 0.35,
    metalness: 0.72,
  });
  const wingMat = new THREE.MeshStandardMaterial({
    color: 0x3b679e,
    roughness: 0.55,
    metalness: 0.65,
  });
  const canopyMat = new THREE.MeshPhysicalMaterial({
    color: 0x7ef2ff,
    emissive: 0x114466,
    emissiveIntensity: 0.5,
    roughness: 0.1,
    metalness: 0.15,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
  });
  const darkMetalMat = new THREE.MeshStandardMaterial({
    color: 0x1a263a,
    roughness: 0.7,
    metalness: 0.85,
  });
  const wingAccentMat = new THREE.MeshStandardMaterial({
    color: 0x7df9ff,
    emissive: 0x38d9ff,
    emissiveIntensity: 2.2,
    roughness: 0.2,
    metalness: 0.2,
  });
  const flameMat = new THREE.MeshBasicMaterial({
    color: 0x72e6ff,
    transparent: true,
    opacity: 0.9,
  });

  // 1. Central beveled fuselage (ExtrudeGeometry)
  const bodyShape = new THREE.Shape();
  bodyShape.moveTo(0, -1.65);
  bodyShape.lineTo(0.45, -0.3);
  bodyShape.lineTo(0.38, 1.25);
  bodyShape.lineTo(-0.38, 1.25);
  bodyShape.lineTo(-0.45, -0.3);
  bodyShape.closePath();

  const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, {
    depth: 0.36,
    bevelEnabled: true,
    bevelThickness: 0.1,
    bevelSize: 0.08,
    bevelSegments: 2,
  });
  bodyGeo.rotateX(Math.PI / 2);
  bodyGeo.translate(0, 0.18, 0);
  const bodyMesh = new THREE.Mesh(bodyGeo, hullMat);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  hullGroup.add(bodyMesh);

  // 2. Swept main wings (left + right extruded delta wings)
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0.32, -0.2);
  wingShape.lineTo(1.72, 0.85);
  wingShape.lineTo(1.52, 1.15);
  wingShape.lineTo(0.32, 0.92);
  wingShape.closePath();

  const rightWingGeo = new THREE.ExtrudeGeometry(wingShape, {
    depth: 0.1,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.03,
    bevelSegments: 1,
  });
  rightWingGeo.rotateX(Math.PI / 2);
  rightWingGeo.translate(0, 0.03, 0);
  const rightWing = new THREE.Mesh(rightWingGeo, wingMat);
  rightWing.castShadow = true;
  hullGroup.add(rightWing);

  const leftWing = rightWing.clone();
  leftWing.scale.x = -1;
  hullGroup.add(leftWing);

  // 3. Forward nose needle
  const noseGeo = new THREE.ConeGeometry(0.22, 0.85, 6);
  noseGeo.rotateX(-Math.PI / 2);
  const nose = new THREE.Mesh(noseGeo, hullMat);
  nose.position.set(0, 0.04, -1.75);
  hullGroup.add(nose);

  // 4. Glossy cockpit canopy
  const canopyGeo = new THREE.CapsuleGeometry(0.22, 0.65, 6, 12);
  canopyGeo.rotateX(Math.PI / 2);
  const canopy = new THREE.Mesh(canopyGeo, canopyMat);
  canopy.scale.set(1, 0.72, 1.15);
  canopy.position.set(0, 0.25, -0.35);
  hullGroup.add(canopy);

  // 5-6. Wingtip laser cannons & emissive strips
  const cannonGeo = new THREE.CylinderGeometry(0.06, 0.08, 0.95, 8);
  cannonGeo.rotateX(Math.PI / 2);
  const tipGeo = new THREE.BoxGeometry(0.1, 0.08, 0.45);
  for (const side of [-1, 1]) {
    const cannon = new THREE.Mesh(cannonGeo, darkMetalMat);
    cannon.position.set(side * 1.62, 0.02, 0.65);
    hullGroup.add(cannon);

    const accent = new THREE.Mesh(tipGeo, wingAccentMat);
    accent.position.set(side * 1.62, 0.08, 0.35);
    hullGroup.add(accent);
  }

  // 7-8. Twin engine nozzles & glowing plasma cones
  const nozzleGeo = new THREE.CylinderGeometry(0.16, 0.22, 0.32, 10);
  nozzleGeo.rotateX(Math.PI / 2);
  const flameGeo = new THREE.ConeGeometry(0.16, 0.95, 10);
  flameGeo.rotateX(Math.PI / 2);
  flameGeo.translate(0, 0, 0.48);

  const leftNozzle = new THREE.Mesh(nozzleGeo, darkMetalMat);
  leftNozzle.position.set(-0.24, 0.02, 1.3);
  hullGroup.add(leftNozzle);

  const rightNozzle = new THREE.Mesh(nozzleGeo, darkMetalMat);
  rightNozzle.position.set(0.24, 0.02, 1.3);
  hullGroup.add(rightNozzle);

  const leftFlame = new THREE.Mesh(flameGeo, flameMat);
  leftFlame.position.set(-0.24, 0.02, 1.35);
  hullGroup.add(leftFlame);

  const rightFlame = new THREE.Mesh(flameGeo, flameMat);
  rightFlame.position.set(0.24, 0.02, 1.35);
  hullGroup.add(rightFlame);

  // 9. Energy shield dome
  const shieldGeo = new THREE.SphereGeometry(2.1, 20, 14);
  const shieldMat = new THREE.MeshBasicMaterial({
    color: 0x4dff88,
    transparent: true,
    opacity: 0.24,
    wireframe: true,
    depthWrite: false,
  });
  const shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
  shieldMesh.visible = false;
  root.add(shieldMesh);

  return {
    root,
    hullGroup,
    leftFlame,
    rightFlame,
    shieldMesh,
    wingAccentMat,
    hullMaterials: [hullMat, wingMat],
  };
}

export function createScoutMesh(): {
  root: THREE.Group;
  materials: THREE.MeshStandardMaterial[];
} {
  const root = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xffd166,
    roughness: 0.35,
    metalness: 0.65,
  });
  const bladeMat = new THREE.MeshStandardMaterial({
    color: 0xb56500,
    roughness: 0.6,
    metalness: 0.55,
  });
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0xff3b3b,
    emissive: 0xff2222,
    emissiveIntensity: 2.0,
    roughness: 0.2,
  });
  eyeMat.userData.keepEmissive = true;

  // 1. Dart hull
  const shape = new THREE.Shape();
  shape.moveTo(0, 1.1);
  shape.lineTo(0.85, -0.55);
  shape.lineTo(0, -0.22);
  shape.lineTo(-0.85, -0.55);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.24,
    bevelEnabled: true,
    bevelThickness: 0.06,
    bevelSize: 0.05,
    bevelSegments: 1,
  });
  geo.rotateX(Math.PI / 2);
  geo.translate(0, 0.12, 0);
  const hull = new THREE.Mesh(geo, bodyMat);
  hull.castShadow = true;
  root.add(hull);

  // 2-3. Flanking wing blades
  const bladeGeo = new THREE.BoxGeometry(0.18, 0.08, 1.0);
  for (const s of [-1, 1]) {
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.position.set(s * 0.78, 0, -0.1);
    blade.rotation.y = s * 0.35;
    root.add(blade);
  }

  // 4. Sensor eye
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), eyeMat);
  eye.position.set(0, 0.14, 0.25);
  root.add(eye);

  // 5. Rear thruster glow
  const thruster = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.18, 0.28, 8),
    eyeMat,
  );
  thruster.rotation.x = Math.PI / 2;
  thruster.position.set(0, 0, -0.55);
  root.add(thruster);

  return { root, materials: [bodyMat, bladeMat, eyeMat] };
}

export function createInterceptorMesh(): {
  root: THREE.Group;
  materials: THREE.MeshStandardMaterial[];
} {
  const root = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xff8f4d,
    roughness: 0.38,
    metalness: 0.65,
  });
  const armorMat = new THREE.MeshStandardMaterial({
    color: 0x732600,
    roughness: 0.72,
    metalness: 0.55,
  });
  const visorMat = new THREE.MeshStandardMaterial({
    color: 0xfff0d0,
    emissive: 0xffa640,
    emissiveIntensity: 1.4,
    roughness: 0.15,
  });
  visorMat.userData.keepEmissive = true;

  // 1. Swept interceptor frame
  const shape = new THREE.Shape();
  shape.moveTo(0, 1.35);
  shape.lineTo(1.25, 0.15);
  shape.lineTo(0.85, -0.95);
  shape.lineTo(0, -0.45);
  shape.lineTo(-0.85, -0.95);
  shape.lineTo(-1.25, 0.15);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.28,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.06,
    bevelSegments: 1,
  });
  geo.rotateX(Math.PI / 2);
  geo.translate(0, 0.14, 0);
  const hull = new THREE.Mesh(geo, bodyMat);
  hull.castShadow = true;
  root.add(hull);

  // 2. Dorsal spine
  const spine = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.3, 1.45),
    armorMat,
  );
  spine.position.set(0, 0.18, 0.05);
  root.add(spine);

  // 3. Visor cockpit
  const visor = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 12, 8),
    visorMat,
  );
  visor.scale.set(0.9, 0.65, 1.5);
  visor.position.set(0, 0.25, 0.35);
  root.add(visor);

  // 4-5. Wingtip weapon pods
  const podGeo = new THREE.CylinderGeometry(0.11, 0.14, 0.95, 8);
  podGeo.rotateX(Math.PI / 2);
  for (const s of [-1, 1]) {
    const pod = new THREE.Mesh(podGeo, armorMat);
    pod.position.set(s * 1.12, 0.02, 0.35);
    root.add(pod);
  }

  return { root, materials: [bodyMat, armorMat, visorMat] };
}

export function createCruiserMesh(): {
  root: THREE.Group;
  hpBarFill: THREE.Mesh;
  materials: THREE.MeshStandardMaterial[];
} {
  const root = new THREE.Group();

  const hullMat = new THREE.MeshStandardMaterial({
    color: 0xc77dff,
    roughness: 0.36,
    metalness: 0.72,
  });
  const podMat = new THREE.MeshStandardMaterial({
    color: 0x3b1260,
    roughness: 0.75,
    metalness: 0.5,
  });
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0xff66f4,
    emissive: 0xff2de6,
    emissiveIntensity: 2.2,
    roughness: 0.15,
  });
  coreMat.userData.keepEmissive = true;

  // 1. Heavy hexagonal hull
  const shape = new THREE.Shape();
  shape.moveTo(0, 1.9);
  shape.lineTo(1.25, 1.15);
  shape.lineTo(1.85, -0.35);
  shape.lineTo(1.05, -1.65);
  shape.lineTo(-1.05, -1.65);
  shape.lineTo(-1.85, -0.35);
  shape.lineTo(-1.25, 1.15);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.55,
    bevelEnabled: true,
    bevelThickness: 0.14,
    bevelSize: 0.1,
    bevelSegments: 2,
  });
  geo.rotateX(Math.PI / 2);
  geo.translate(0, 0.27, 0);
  const hull = new THREE.Mesh(geo, hullMat);
  hull.castShadow = true;
  root.add(hull);

  // 2. Dorsal bridge
  const bridge = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 0.45, 1.35),
    podMat,
  );
  bridge.position.set(0, 0.42, -0.2);
  root.add(bridge);

  // 3-4. Side weapon sponsons
  const sponsonGeo = new THREE.BoxGeometry(0.55, 0.42, 1.55);
  for (const s of [-1, 1]) {
    const sp = new THREE.Mesh(sponsonGeo, podMat);
    sp.position.set(s * 1.72, 0.08, 0.15);
    root.add(sp);
  }

  // 5-6. Glowing reactor core & protective collar
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.44, 14, 10), coreMat);
  core.position.set(0, 0.35, 0.55);
  root.add(core);

  const collar = new THREE.Mesh(
    new THREE.TorusGeometry(0.54, 0.08, 8, 18),
    podMat,
  );
  collar.rotation.x = Math.PI / 2;
  collar.position.set(0, 0.35, 0.55);
  root.add(collar);

  // Overhead 3D HP Bar
  const hpBg = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 0.22),
    new THREE.MeshBasicMaterial({ color: 0x0a0d18 }),
  );
  hpBg.position.set(0, 1.4, -1.3);
  hpBg.rotation.x = -Math.PI / 4;
  root.add(hpBg);

  const hpBarFill = new THREE.Mesh(
    new THREE.PlaneGeometry(2.5, 0.15),
    new THREE.MeshBasicMaterial({ color: 0x5dff9b }),
  );
  hpBarFill.position.set(0, 1.41, -1.28);
  hpBarFill.rotation.x = -Math.PI / 4;
  root.add(hpBarFill);

  return { root, hpBarFill, materials: [hullMat, podMat, coreMat] };
}

export function createBossMesh(): {
  root: THREE.Group;
  ringGroup: THREE.Group;
  coreEye: THREE.Mesh;
  materials: THREE.MeshStandardMaterial[];
} {
  const root = new THREE.Group();

  const hullMat = new THREE.MeshStandardMaterial({
    color: 0xff4268,
    roughness: 0.35,
    metalness: 0.78,
  });
  const armorMat = new THREE.MeshStandardMaterial({
    color: 0x3b0014,
    roughness: 0.7,
    metalness: 0.65,
  });
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0xffe066,
    emissive: 0xff5a22,
    emissiveIntensity: 2.6,
    roughness: 0.15,
  });
  eyeMat.userData.keepEmissive = true;

  // 1. Massive beveled dreadnought hull
  const shape = new THREE.Shape();
  shape.moveTo(0, 3.6);
  shape.lineTo(2.4, 2.2);
  shape.lineTo(4.6, 0.3);
  shape.lineTo(3.3, -2.5);
  shape.lineTo(0, -3.4);
  shape.lineTo(-3.3, -2.5);
  shape.lineTo(-4.6, 0.3);
  shape.lineTo(-2.4, 2.2);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 1.15,
    bevelEnabled: true,
    bevelThickness: 0.3,
    bevelSize: 0.25,
    bevelSegments: 2,
  });
  geo.rotateX(Math.PI / 2);
  geo.translate(0, 0.55, 0);
  const hull = new THREE.Mesh(geo, hullMat);
  hull.castShadow = true;
  root.add(hull);

  // 2. Dark armored prow & citadel superstructure
  const citadel = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 0.9, 2.6),
    armorMat,
  );
  citadel.position.set(0, 0.75, -0.5);
  root.add(citadel);

  // 3. Central core socket & pulsing reactor eye
  const socket = new THREE.Mesh(
    new THREE.CylinderGeometry(1.25, 1.4, 0.45, 20),
    armorMat,
  );
  socket.position.set(0, 1.05, 0.55);
  root.add(socket);

  const coreEye = new THREE.Mesh(new THREE.SphereGeometry(0.92, 18, 14), eyeMat);
  coreEye.position.set(0, 1.15, 0.55);
  root.add(coreEye);

  // 4-7. 4 heavy plasma cannon barrels
  const barrelGeo = new THREE.CylinderGeometry(0.18, 0.24, 1.85, 10);
  barrelGeo.rotateX(Math.PI / 2);
  for (const xOff of [-2.8, -1.6, 1.6, 2.8]) {
    const barrel = new THREE.Mesh(barrelGeo, armorMat);
    barrel.position.set(xOff, 0.15, 2.2);
    root.add(barrel);
  }

  // 8. Rotating 6-blade orbital ring
  const ringGroup = new THREE.Group();
  ringGroup.position.set(0, 0.2, 0);
  const bladeGeo = new THREE.ConeGeometry(0.55, 1.5, 4);
  bladeGeo.rotateX(Math.PI / 2);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const blade = new THREE.Mesh(bladeGeo, hullMat);
    blade.position.set(Math.cos(a) * 5.2, 0, Math.sin(a) * 5.2);
    blade.rotation.y = -a + Math.PI / 2;
    ringGroup.add(blade);
  }
  root.add(ringGroup);

  return { root, ringGroup, coreEye, materials: [hullMat, armorMat, eyeMat] };
}

export function createPowerupMesh(type: PowerupType): THREE.Group {
  const root = new THREE.Group();

  const style =
    type === 'weapon'
      ? { color: 0x4da6ff, emissive: 0x1a75ff, hex: '#4da6ff', label: 'W' }
      : type === 'shield'
        ? { color: 0x4dff88, emissive: 0x18cc55, hex: '#4dff88', label: 'S' }
        : { color: 0xff4d5e, emissive: 0xe61c34, hex: '#ff4d5e', label: 'H' };

  const coreMat = new THREE.MeshStandardMaterial({
    color: style.color,
    emissive: style.emissive,
    emissiveIntensity: 1.5,
    roughness: 0.2,
    metalness: 0.4,
  });
  const collarMat = new THREE.MeshStandardMaterial({
    color: 0xd8ebff,
    roughness: 0.25,
    metalness: 0.85,
  });

  // 1. Hexagonal core crystal
  const core = new THREE.Mesh(
    new THREE.CylinderGeometry(0.68, 0.68, 0.46, 6),
    coreMat,
  );
  root.add(core);

  // 2. Top emblem disc
  const badge = new THREE.Mesh(
    new THREE.CircleGeometry(0.52, 20),
    new THREE.MeshBasicMaterial({
      map: createBadgeTexture(style.label, style.hex),
    }),
  );
  badge.rotation.x = -Math.PI / 2;
  badge.position.y = 0.25;
  root.add(badge);

  // 3. Outer orbital ring
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.95, 0.08, 8, 24),
    collarMat,
  );
  ring.rotation.x = Math.PI / 2.4;
  root.add(ring);

  return root;
}

export interface SpaceEnvironmentHandles {
  starInstances: THREE.InstancedMesh;
  starData: { x: number; y: number; z: number; sp: number; scale: number }[];
  asteroidInstances: THREE.InstancedMesh;
  asteroidData: {
    x: number;
    y: number;
    z: number;
    rx: number;
    ry: number;
    vx: number;
    vy: number;
    sp: number;
    scale: number;
  }[];
  gridGroup: THREE.Group;
  planetMesh: THREE.Mesh;
  update: (dt: number) => void;
}

export function createSpaceEnvironment(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  isSoftwareGl: boolean,
): SpaceEnvironmentHandles {
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  // Studio environment reflections for metallic starfighter & enemy hulls
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  const bgColor = new THREE.Color(0x040714);
  scene.background = bgColor;
  scene.fog = new THREE.FogExp2(0x040714, 0.0075);

  // Balanced 3-point lighting with warm/cool contrast
  const hemiLight = new THREE.HemisphereLight(0x6aa8ff, 0x160a2e, 0.95);
  scene.add(hemiLight);

  const keyLight = new THREE.DirectionalLight(0xfff0d6, 2.2);
  keyLight.position.set(18, 32, 16);
  keyLight.castShadow = !isSoftwareGl;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.left = -24;
  keyLight.shadow.camera.right = 24;
  keyLight.shadow.camera.top = 24;
  keyLight.shadow.camera.bottom = -24;
  keyLight.shadow.camera.near = 2;
  keyLight.shadow.camera.far = 85;
  keyLight.shadow.bias = -0.0005;
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0xa84dff, 0.95);
  rimLight.position.set(-22, 10, -34);
  scene.add(rimLight);

  // Distant ringed gas-giant landmark positioned in upper-right showcase
  const planetGroup = new THREE.Group();
  planetGroup.position.set(22, -6, -104);
  const planetMesh = new THREE.Mesh(
    new THREE.SphereGeometry(21, 32, 24),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: createPlanetTexture(maxAniso),
      roughness: 0.78,
      metalness: 0.08,
    }),
  );
  planetGroup.add(planetMesh);

  const ringGeo = new THREE.RingGeometry(26, 40, 48);
  const posAttr = ringGeo.attributes.position;
  const uvAttr = ringGeo.attributes.uv;
  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const r = Math.hypot(x, y);
    uvAttr.setXY(i, (r - 26) / 14, 0.5);
  }
  const planetRing = new THREE.Mesh(
    ringGeo,
    new THREE.MeshBasicMaterial({
      map: createRingTexture(maxAniso),
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  planetRing.rotation.x = Math.PI / 2.4;
  planetRing.rotation.y = -0.22;
  planetGroup.add(planetRing);
  scene.add(planetGroup);

  // Distant secondary moon ahead-left
  const moonMesh = new THREE.Mesh(
    new THREE.SphereGeometry(5.5, 20, 16),
    new THREE.MeshStandardMaterial({
      color: 0x5c76a3,
      roughness: 0.88,
      metalness: 0.05,
    }),
  );
  moonMesh.position.set(-44, 11, -96);
  scene.add(moonMesh);

  // Subtle orbital defense grid below the combat plane (y = -8.5)
  const gridGroup = new THREE.Group();
  gridGroup.position.y = -8.5;
  const gridHelper = new THREE.GridHelper(160, 32, 0x1e4d8c, 0x0d2247);
  const gridMats = Array.isArray(gridHelper.material)
    ? gridHelper.material
    : [gridHelper.material];
  for (const m of gridMats) {
    m.transparent = true;
    m.opacity = 0.28;
  }
  gridHelper.position.z = -35;
  gridGroup.add(gridHelper);
  scene.add(gridGroup);

  // Subtle corridor boundary rails at x = +/- 19.5 on y = -0.4
  const railGeo = new THREE.BoxGeometry(0.12, 0.08, 76);
  const railMat = new THREE.MeshBasicMaterial({
    color: 0x2a7fff,
    transparent: true,
    opacity: 0.22,
  });
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(railGeo, railMat);
    rail.position.set(side * 19.5, -0.4, -22);
    scene.add(rail);
  }

  // Instanced 3D asteroid belt flanking the flight corridor and deep below
  const asteroidCount = 42;
  const asteroidGeo = new THREE.DodecahedronGeometry(1, 0);
  const asteroidMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.92,
    metalness: 0.1,
    flatShading: true,
  });
  const asteroidInstances = new THREE.InstancedMesh(
    asteroidGeo,
    asteroidMat,
    asteroidCount,
  );
  asteroidInstances.frustumCulled = false;

  const asteroidData: SpaceEnvironmentHandles['asteroidData'] = [];
  const dummy = new THREE.Object3D();
  const rockColor = new THREE.Color();

  for (let i = 0; i < asteroidCount; i++) {
    const flank = i % 2 === 0 ? 1 : -1;
    const isDeepFloor = i % 4 === 0;
    const x = isDeepFloor
      ? (Math.random() - 0.5) * 46
      : flank * (21 + Math.random() * 24);
    const y = isDeepFloor ? -18 - Math.random() * 10 : -4 - Math.random() * 14;
    const z = -95 + Math.random() * 120;
    const scale = 0.75 + Math.random() * 1.75;
    asteroidData.push({
      x,
      y,
      z,
      rx: Math.random() * Math.PI,
      ry: Math.random() * Math.PI,
      vx: (Math.random() - 0.5) * 0.8,
      vy: (Math.random() - 0.5) * 0.8,
      sp: 9 + Math.random() * 11,
      scale,
    });
    rockColor.setHSL(0.62 + Math.random() * 0.06, 0.25, 0.14 + Math.random() * 0.09);
    asteroidInstances.setColorAt(i, rockColor);
  }
  if (asteroidInstances.instanceColor) {
    asteroidInstances.instanceColor.needsUpdate = true;
  }
  scene.add(asteroidInstances);

  // Instanced 3D starfield (220 streaks)
  const starCount = 220;
  const starGeo = new THREE.BoxGeometry(0.08, 0.08, 0.75);
  const starMat = new THREE.MeshBasicMaterial({
    color: 0xdff2ff,
    transparent: true,
    opacity: 0.85,
  });
  const starInstances = new THREE.InstancedMesh(starGeo, starMat, starCount);
  starInstances.frustumCulled = false;

  const starData: SpaceEnvironmentHandles['starData'] = [];
  for (let i = 0; i < starCount; i++) {
    starData.push({
      x: (Math.random() - 0.5) * 110,
      y: -14 + Math.random() * 34,
      z: -110 + Math.random() * 135,
      sp: 22 + Math.random() * 38,
      scale: 0.6 + Math.random() * 1.4,
    });
  }
  scene.add(starInstances);

  const update = (dt: number) => {
    planetMesh.rotation.y += dt * 0.025;
    gridHelper.position.z = -35 + ((gridHelper.position.z + 35 + dt * 14) % 5);

    for (let i = 0; i < starCount; i++) {
      const st = starData[i];
      st.z += st.sp * dt;
      if (st.z > 28) {
        st.z = -110;
        st.x = (Math.random() - 0.5) * 110;
        st.y = -14 + Math.random() * 34;
      }
      dummy.position.set(st.x, st.y, st.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(st.scale, st.scale, st.scale * 1.6);
      dummy.updateMatrix();
      starInstances.setMatrixAt(i, dummy.matrix);
    }
    starInstances.instanceMatrix.needsUpdate = true;

    for (let i = 0; i < asteroidCount; i++) {
      const a = asteroidData[i];
      a.z += a.sp * dt;
      a.rx += a.vx * dt;
      a.ry += a.vy * dt;
      if (a.z > 26) {
        a.z = -95;
      }
      dummy.position.set(a.x, a.y, a.z);
      dummy.rotation.set(a.rx, a.ry, 0);
      dummy.scale.setScalar(a.scale);
      dummy.updateMatrix();
      asteroidInstances.setMatrixAt(i, dummy.matrix);
    }
    asteroidInstances.instanceMatrix.needsUpdate = true;
  };

  // Run one initial tick so instanced matrices are populated before first frame
  update(0.016);

  return {
    starInstances,
    starData,
    asteroidInstances,
    asteroidData,
    gridGroup,
    planetMesh,
    update,
  };
}
