import * as THREE from 'three';
import { AudioEngine } from './audio';
import {
  createBossMesh,
  createCruiserMesh,
  createInterceptorMesh,
  createPlayerShipMesh,
  createPowerupMesh,
  createScoutMesh,
  createSpaceEnvironment,
  type PlayerMeshRefs,
  type SpaceEnvironmentHandles,
} from './models';
import {
  applyDamageRule,
  applyPowerupRule,
  buildWaveQueue,
  calculateWaveClearBonus,
  circleHitXZ,
  clamp,
  clampPlayerPos,
  computeBossMaxHp,
  stepWeaponTimer,
} from './rules';
import {
  ARENA_HALF_W,
  BULLET_DESPAWN_MAX_Z,
  BULLET_DESPAWN_MIN_Z,
  ENEMY_DESPAWN_Z,
  ENEMY_SPAWN_Z,
  type EnemyType,
  type GamePhase,
  type HudSnapshot,
  type PowerupType,
  type SpawnItem,
} from './types';

interface BulletEntity {
  active: boolean;
  x: number;
  z: number;
  vx: number;
  vz: number;
  r: number;
  enemy: boolean;
  dmg: number;
  life: number;
  mesh: THREE.Mesh;
}

interface EnemyEntity {
  type: EnemyType;
  x: number;
  z: number;
  vx: number;
  vz: number;
  r: number;
  hp: number;
  maxHp: number;
  score: number;
  t: number;
  phase: number;
  fireT: number;
  fireRate: number;
  spiralAngle: number;
  spiralT: number;
  bossState: 'entering' | 'fighting' | 'dying';
  deathT: number;
  dead: boolean;
  hitFlash: number;
  mesh: THREE.Group;
  materials: THREE.MeshStandardMaterial[];
  hpBarFill?: THREE.Mesh;
  ringGroup?: THREE.Group;
  coreEye?: THREE.Mesh;
}

interface PowerupEntity {
  x: number;
  z: number;
  vz: number;
  r: number;
  type: PowerupType;
  t: number;
  life: number;
  mesh: THREE.Group;
}

interface ParticleSlot {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
  color: THREE.Color;
}

interface ShockwaveSlot {
  active: boolean;
  r: number;
  maxR: number;
  life: number;
  maxLife: number;
  mesh: THREE.Mesh;
}

const _vec3 = new THREE.Vector3();
const _raycaster = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _combatPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _dummy = new THREE.Object3D();
const _colorTmp = new THREE.Color();

export class GalacticEngine {
  private container: HTMLElement;
  private onHud: (snap: HudSnapshot) => void;
  private audio = new AudioEngine();

  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private env: SpaceEnvironmentHandles;
  private playerMeshes: PlayerMeshRefs;
  private isSoftwareGl: boolean;

  private frameId = 0;
  private lastTime = 0;
  private disposed = false;

  // Game state
  private phase: GamePhase = 'title';
  private score = 0;
  private highScore = Number(localStorage.getItem('gd_highscore') || 0);
  private bestWave = Number(localStorage.getItem('gd_bestwave') || 0);
  private wave = 0;
  private waveTimer = 0;
  private waveActive = false;
  private spawnTimer = 0;
  private spawnQueue: SpawnItem[] = [];
  private bossActive = false;
  private newRecord = false;
  private time = 0;
  private deathDelay = 0;
  private hitstop = 0;
  private trauma = 0;
  private bannerTimer = 0;
  private bannerTitle = '';
  private bannerSub = '';
  private bannerType: 'wave' | 'boss' | null = null;

  // Player state
  private playerX = 0;
  private playerZ = 5.5;
  private playerVx = 0;
  private playerVz = 0;
  private playerSpeed = 23;
  private lives = 3;
  private maxLives = 5;
  private invuln = 0;
  private shield = 0;
  private weaponLevel = 1;
  private weaponTimer = 0;
  private fireCooldown = 0;
  private baseFireDelay = 0.145;
  private alive = true;

  // Entities & pools
  private playerBulletPool: BulletEntity[] = [];
  private enemyBulletPool: BulletEntity[] = [];
  private enemies: EnemyEntity[] = [];
  private powerups: PowerupEntity[] = [];
  private particles: ParticleSlot[] = [];
  private particleMesh: THREE.InstancedMesh;
  private shockwaves: ShockwaveSlot[] = [];

  // Input state
  private keys = new Set<string>();
  private pointerActive = false;
  private pointerId: number | null = null;
  private pointerTargetX = 0;
  private pointerTargetZ = 6.5;
  private lastHudPush = 0;
  private lastDiscreteKey = '';

  constructor(container: HTMLElement, onHud: (snap: HudSnapshot) => void) {
    this.container = container;
    this.onHud = onHud;

    this.isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: this.isSoftwareGl,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2),
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.dataset.testid = 'game-canvas';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, w / Math.max(1, h), 0.1, 240);
    this.camera.position.set(0, 14, 21);
    this.camera.lookAt(0, -1, -12);

    this.env = createSpaceEnvironment(
      this.scene,
      this.renderer,
      this.isSoftwareGl,
    );

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.playerMeshes = createPlayerShipMesh(maxAniso);
    this.playerMeshes.root.position.set(this.playerX, 0, this.playerZ);
    this.scene.add(this.playerMeshes.root);

    // Pre-allocate bullet pools
    const pBulletGeo = new THREE.CapsuleGeometry(0.11, 0.95, 4, 8);
    pBulletGeo.rotateX(Math.PI / 2);
    const pBulletMat = new THREE.MeshBasicMaterial({ color: 0x7df9ff });
    for (let i = 0; i < 64; i++) {
      const mesh = new THREE.Mesh(pBulletGeo, pBulletMat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.playerBulletPool.push({
        active: false,
        x: 0,
        z: 0,
        vx: 0,
        vz: 0,
        r: 0.48,
        enemy: false,
        dmg: 1,
        life: 0,
        mesh,
      });
    }

    const eBulletGeo = new THREE.SphereGeometry(0.32, 10, 8);
    const eBulletMat = new THREE.MeshBasicMaterial({ color: 0xff4b68 });
    for (let i = 0; i < 96; i++) {
      const mesh = new THREE.Mesh(eBulletGeo, eBulletMat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.enemyBulletPool.push({
        active: false,
        x: 0,
        z: 0,
        vx: 0,
        vz: 0,
        r: 0.42,
        enemy: true,
        dmg: 1,
        life: 0,
        mesh,
      });
    }

    // Pre-allocate instanced particle pool
    const pCount = 260;
    const partGeo = new THREE.OctahedronGeometry(0.22, 0);
    const partMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.particleMesh = new THREE.InstancedMesh(partGeo, partMat, pCount);
    this.particleMesh.frustumCulled = false;
    this.scene.add(this.particleMesh);
    for (let i = 0; i < pCount; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: -100,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 1,
        size: 1,
        color: new THREE.Color(0xffffff),
      });
      _dummy.position.set(0, -100, 0);
      _dummy.scale.setScalar(0.001);
      _dummy.updateMatrix();
      this.particleMesh.setMatrixAt(i, _dummy.matrix);
      this.particleMesh.setColorAt(i, _colorTmp);
    }

    // Pre-allocate shockwaves
    const swGeo = new THREE.RingGeometry(0.75, 1.0, 28);
    swGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 10; i++) {
      const swMat = new THREE.MeshBasicMaterial({
        color: 0xffd9a0,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(swGeo, swMat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.shockwaves.push({
        active: false,
        r: 0.5,
        maxR: 5,
        life: 0,
        maxLife: 0.45,
        mesh,
      });
    }

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.bindEvents();
    this.syncBodyState();

    // Check ?autostart=1
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      this.startGame();
    } else {
      this.emitHud(true);
    }

    this.lastTime = performance.now();
    this.scheduleLoop();
  }

  private bindEvents(): void {
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKeyDown, { passive: false });
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('visibilitychange', this.onVisibilityChange);

    const dom = this.renderer.domElement;
    dom.addEventListener('pointerdown', this.onPointerDown);
    dom.addEventListener('pointermove', this.onPointerMove);
    dom.addEventListener('pointerup', this.onPointerUp);
    dom.addEventListener('pointercancel', this.onPointerUp);
  }

  private unbindEvents(): void {
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);

    const dom = this.renderer.domElement;
    dom.removeEventListener('pointerdown', this.onPointerDown);
    dom.removeEventListener('pointermove', this.onPointerMove);
    dom.removeEventListener('pointerup', this.onPointerUp);
    dom.removeEventListener('pointercancel', this.onPointerUp);
  }

  private onResize = (): void => {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (
      ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(
        e.code,
      )
    ) {
      e.preventDefault();
    }
    const firstPress = !this.keys.has(e.code);
    this.keys.add(e.code);
    this.audio.resume();

    if (!firstPress) return;

    if (e.code === 'Space' || e.code === 'Enter') {
      if (this.phase === 'title' || this.phase === 'gameover') {
        this.startGame();
      } else if (this.phase === 'paused') {
        this.resumeGame();
      }
    } else if (e.code === 'KeyP' || e.code === 'Escape') {
      if (this.phase === 'playing') this.pauseGame();
      else if (this.phase === 'paused') this.resumeGame();
    } else if (e.code === 'KeyM') {
      this.toggleMute();
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private onBlur = (): void => {
    this.keys.clear();
    this.pointerActive = false;
    this.pointerId = null;
  };

  private onVisibilityChange = (): void => {
    this.keys.clear();
    this.pointerActive = false;
    this.pointerId = null;
    this.lastTime = performance.now();
  };

  private screenToCombatPlane(clientX: number, clientY: number): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    _ndc.x = ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    _ndc.y = -((clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
    _raycaster.setFromCamera(_ndc, this.camera);
    if (_raycaster.ray.intersectPlane(_combatPlane, _vec3)) {
      const clamped = clampPlayerPos(_vec3.x, _vec3.z);
      this.pointerTargetX = clamped.x;
      this.pointerTargetZ = clamped.z;
    }
  }

  private onPointerDown = (e: PointerEvent): void => {
    this.audio.resume();
    if (this.phase !== 'playing') return;
    this.pointerActive = true;
    this.pointerId = e.pointerId;
    this.renderer.domElement.setPointerCapture(e.pointerId);
    this.screenToCombatPlane(e.clientX, e.clientY);
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.pointerActive || e.pointerId !== this.pointerId) return;
    this.screenToCombatPlane(e.clientX, e.clientY);
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (e.pointerId === this.pointerId) {
      this.pointerActive = false;
      this.pointerId = null;
    }
  };

  private syncBodyState(): void {
    document.body.dataset.state = this.phase;
  }

  public startGame(): void {
    this.audio.resume();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    this.keys.clear();
    this.pointerActive = false;

    this.phase = 'playing';
    this.score = 0;
    this.wave = 0;
    this.waveActive = false;
    this.waveTimer = 0;
    this.spawnTimer = 0;
    this.spawnQueue = [];
    this.bossActive = false;
    this.newRecord = false;
    this.deathDelay = 0;
    this.hitstop = 0;
    this.trauma = 0;

    this.playerX = 0;
    this.playerZ = 5.5;
    this.playerVx = 0;
    this.playerVz = 0;
    this.lives = 3;
    this.invuln = 0;
    this.shield = 0;
    this.weaponLevel = 1;
    this.weaponTimer = 0;
    this.fireCooldown = 0;
    this.alive = true;

    this.playerMeshes.root.visible = true;
    this.playerMeshes.root.position.set(this.playerX, 0, this.playerZ);
    this.playerMeshes.root.rotation.set(0, 0, 0);
    this.playerMeshes.shieldMesh.visible = false;
    this.updateWeaponVisual();

    this.clearEntities();
    this.syncBodyState();
    this.startWave(1);
    this.emitHud(true);
  }

  public pauseGame(): void {
    if (this.phase !== 'playing') return;
    this.phase = 'paused';
    this.keys.clear();
    this.pointerActive = false;
    this.audio.suspend();
    this.syncBodyState();
    this.emitHud(true);
  }

  public resumeGame(): void {
    if (this.phase !== 'paused') return;
    this.phase = 'playing';
    this.keys.clear();
    this.audio.resume();
    this.lastTime = performance.now();
    this.syncBodyState();
    this.emitHud(true);
  }

  public returnToTitle(): void {
    this.phase = 'title';
    this.keys.clear();
    this.pointerActive = false;
    this.clearEntities();
    this.playerX = 0;
    this.playerZ = 0;
    this.alive = true;
    this.playerMeshes.root.visible = true;
    this.playerMeshes.root.position.set(0, 0, 0);
    this.playerMeshes.root.rotation.set(0, 0, 0);
    this.playerMeshes.shieldMesh.visible = false;
    this.syncBodyState();
    this.emitHud(true);
  }

  public toggleMute(): boolean {
    const m = this.audio.toggleMute();
    this.emitHud(true);
    return m;
  }

  // Test helper hook for automated wave/gameover checks without modifying normal flow
  public debugTriggerBossWave(): void {
    if (this.phase !== 'playing') return;
    for (const e of this.enemies) {
      this.scene.remove(e.mesh);
    }
    this.enemies = [];
    this.startWave(5);
    this.updateWave(0.1);
    this.emitHud(true);
  }

  public debugDefeatBoss(): void {
    const boss = this.enemies.find((e) => e.type === 'boss');
    if (boss && !boss.dead) {
      boss.hp = 0;
      boss.dead = true;
      boss.bossState = 'dying';
      boss.deathT = 0.5;
    }
  }

  private clearEntities(): void {
    for (const b of this.playerBulletPool) {
      b.active = false;
      b.mesh.visible = false;
    }
    for (const b of this.enemyBulletPool) {
      b.active = false;
      b.mesh.visible = false;
    }
    for (const e of this.enemies) {
      this.scene.remove(e.mesh);
    }
    this.enemies = [];
    for (const p of this.powerups) {
      this.scene.remove(p.mesh);
    }
    this.powerups = [];
    for (const pt of this.particles) {
      pt.active = false;
    }
    for (const sw of this.shockwaves) {
      sw.active = false;
      sw.mesh.visible = false;
    }
  }

  private startWave(n: number): void {
    this.wave = n;
    this.waveTimer = 0;
    this.waveActive = true;
    this.spawnTimer = 0;
    const built = buildWaveQueue(n);
    this.spawnQueue = built.queue;
    this.bossActive = built.isBossWave;

    this.bannerTimer = 2.1;
    this.bannerTitle = built.isBossWave ? 'WARNING' : `WAVE ${n}`;
    this.bannerSub = built.isBossWave ? 'BOSS DREADNOUGHT INCOMING' : 'GET READY';
    this.bannerType = built.isBossWave ? 'boss' : 'wave';
    this.audio.waveStart();
  }

  private spawnBullet(
    x: number,
    z: number,
    vx: number,
    vz: number,
    enemy: boolean,
    dmg = 1,
  ): void {
    const pool = enemy ? this.enemyBulletPool : this.playerBulletPool;
    for (const b of pool) {
      if (!b.active) {
        b.active = true;
        b.x = x;
        b.z = z;
        b.vx = vx;
        b.vz = vz;
        b.dmg = dmg;
        b.life = 5;
        b.mesh.position.set(x, 0, z);
        b.mesh.rotation.y = Math.atan2(-vx, -vz);
        b.mesh.visible = true;
        return;
      }
    }
  }

  private spawnEnemy(type: EnemyType, x: number, z: number): void {
    if (type === 'scout') {
      const { root, materials } = createScoutMesh();
      root.position.set(x, 0, z);
      this.scene.add(root);
      this.enemies.push({
        type,
        x,
        z,
        vx: (Math.random() - 0.5) * 6,
        vz: 11 + Math.random() * 4.5,
        r: 1.1,
        hp: 1,
        maxHp: 1,
        score: 100,
        t: 0,
        phase: Math.random() * Math.PI * 2,
        fireT: 0,
        fireRate: 0,
        spiralAngle: 0,
        spiralT: 0,
        bossState: 'entering',
        deathT: 0,
        dead: false,
        hitFlash: 0,
        mesh: root,
        materials,
      });
    } else if (type === 'interceptor') {
      const { root, materials } = createInterceptorMesh();
      root.position.set(x, 0, z);
      this.scene.add(root);
      this.enemies.push({
        type,
        x,
        z,
        vx: 0,
        vz: 6.2 + Math.random() * 2.2,
        r: 1.45,
        hp: 3,
        maxHp: 3,
        score: 250,
        t: 0,
        phase: Math.random() * Math.PI * 2,
        fireT: 0.7 + Math.random() * 0.9,
        fireRate: 1.55,
        spiralAngle: 0,
        spiralT: 0,
        bossState: 'entering',
        deathT: 0,
        dead: false,
        hitFlash: 0,
        mesh: root,
        materials,
      });
    } else if (type === 'cruiser') {
      const { root, hpBarFill, materials } = createCruiserMesh();
      root.position.set(x, 0, z);
      this.scene.add(root);
      this.enemies.push({
        type,
        x,
        z,
        vx: (Math.random() - 0.5) * 3.5,
        vz: 3.8 + Math.random() * 1.4,
        r: 2.1,
        hp: 8,
        maxHp: 8,
        score: 500,
        t: 0,
        phase: Math.random() * Math.PI * 2,
        fireT: 1.1 + Math.random() * 0.8,
        fireRate: 1.85,
        spiralAngle: 0,
        spiralT: 0,
        bossState: 'entering',
        deathT: 0,
        dead: false,
        hitFlash: 0,
        mesh: root,
        materials,
        hpBarFill,
      });
    } else {
      const { root, ringGroup, coreEye, materials } = createBossMesh();
      const maxHp = computeBossMaxHp(this.wave);
      root.position.set(0, 0, ENEMY_SPAWN_Z - 8);
      this.scene.add(root);
      this.enemies.push({
        type: 'boss',
        x: 0,
        z: ENEMY_SPAWN_Z - 8,
        vx: 0,
        vz: 0,
        r: 4.5,
        hp: maxHp,
        maxHp,
        score: 3000 + this.wave * 500,
        t: 0,
        phase: 0,
        fireT: 2.0,
        fireRate: 1.5,
        spiralAngle: 0,
        spiralT: 0,
        bossState: 'entering',
        deathT: 0,
        dead: false,
        hitFlash: 0,
        mesh: root,
        materials,
        ringGroup,
        coreEye,
      });
    }
  }

  private spawnPowerup(x: number, z: number, forced?: PowerupType): void {
    const r = Math.random();
    const type: PowerupType =
      forced ?? (r < 0.45 ? 'weapon' : r < 0.78 ? 'shield' : 'health');
    const mesh = createPowerupMesh(type);
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    this.powerups.push({
      x,
      z,
      vz: 5.5,
      r: 1.0,
      type,
      t: 0,
      life: 13,
      mesh,
    });
  }

  private spawnExplosion(
    x: number,
    z: number,
    count: number,
    colors: number[],
    speed = 16,
    shockMax = 5.5,
  ): void {
    let spawned = 0;
    for (const pt of this.particles) {
      if (!pt.active) {
        const a = Math.random() * Math.PI * 2;
        const elev = (Math.random() - 0.3) * 0.8;
        const s = speed * (0.35 + Math.random() * 0.75);
        pt.active = true;
        pt.x = x;
        pt.y = 0;
        pt.z = z;
        pt.vx = Math.cos(a) * s;
        pt.vy = Math.sin(elev) * s * 0.75;
        pt.vz = Math.sin(a) * s;
        pt.life = 0.5 + Math.random() * 0.55;
        pt.maxLife = pt.life;
        pt.size = 0.7 + Math.random() * 1.1;
        pt.color.setHex(colors[Math.floor(Math.random() * colors.length)]);
        spawned++;
        if (spawned >= count) break;
      }
    }

    for (const sw of this.shockwaves) {
      if (!sw.active) {
        sw.active = true;
        sw.r = 0.6;
        sw.maxR = shockMax;
        sw.life = 0.42;
        sw.maxLife = 0.42;
        sw.mesh.position.set(x, 0.05, z);
        sw.mesh.scale.setScalar(0.6);
        sw.mesh.visible = true;
        break;
      }
    }
  }

  private addTrauma(amount: number): void {
    this.trauma = Math.min(1.0, this.trauma + amount);
  }

  private updateWeaponVisual(): void {
    const hex =
      this.weaponLevel === 3
        ? 0xff6ad5
        : this.weaponLevel === 2
          ? 0x22e5ff
          : 0x7df9ff;
    this.playerMeshes.wingAccentMat.color.setHex(hex);
    this.playerMeshes.wingAccentMat.emissive.setHex(hex);
  }

  private updatePlayer(dt: number): void {
    if (!this.alive) return;

    let dx = 0;
    let dz = 0;
    if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) dx -= 1;
    if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) dx += 1;
    if (this.keys.has('ArrowUp') || this.keys.has('KeyW')) dz -= 1;
    if (this.keys.has('ArrowDown') || this.keys.has('KeyS')) dz += 1;

    const prevX = this.playerX;
    const prevZ = this.playerZ;

    if (dx !== 0 || dz !== 0) {
      const len = Math.hypot(dx, dz) || 1;
      this.playerX += (dx / len) * this.playerSpeed * dt;
      this.playerZ += (dz / len) * (this.playerSpeed * 0.72) * dt;
      this.pointerActive = false;
    } else if (this.pointerActive) {
      const alpha = 1 - Math.exp(-14 * dt);
      this.playerX = THREE.MathUtils.lerp(
        this.playerX,
        this.pointerTargetX,
        alpha,
      );
      this.playerZ = THREE.MathUtils.lerp(
        this.playerZ,
        this.pointerTargetZ,
        alpha,
      );
    }

    const clamped = clampPlayerPos(this.playerX, this.playerZ);
    this.playerX = clamped.x;
    this.playerZ = clamped.z;

    this.playerVx = (this.playerX - prevX) / Math.max(0.001, dt);
    this.playerVz = (this.playerZ - prevZ) / Math.max(0.001, dt);

    if (this.invuln > 0) this.invuln = Math.max(0, this.invuln - dt);

    const wStep = stepWeaponTimer(this.weaponLevel, this.weaponTimer, dt);
    if (wStep.weaponLevel !== this.weaponLevel) {
      this.weaponLevel = wStep.weaponLevel;
      this.updateWeaponVisual();
    }
    this.weaponTimer = wStep.weaponTimer;

    if (this.fireCooldown > 0) this.fireCooldown -= dt;
    if (this.fireCooldown <= 0) {
      const speed = 56;
      const ox = this.playerX;
      const oz = this.playerZ - 1.75;
      if (this.weaponLevel === 1) {
        this.spawnBullet(ox, oz, 0, -speed, false, 1);
      } else if (this.weaponLevel === 2) {
        this.spawnBullet(ox - 0.7, oz + 0.2, 0, -speed, false, 1);
        this.spawnBullet(ox + 0.7, oz + 0.2, 0, -speed, false, 1);
      } else {
        this.spawnBullet(ox, oz, 0, -speed * 1.05, false, 1);
        this.spawnBullet(ox - 0.9, oz + 0.35, -13, -speed, false, 1);
        this.spawnBullet(ox + 0.9, oz + 0.35, 13, -speed, false, 1);
      }
      this.fireCooldown =
        this.baseFireDelay * (this.weaponLevel === 3 ? 0.82 : 1);
      this.audio.laser();
    }

    // Visual position, roll bank, pitch, thruster pulse, blink on invuln
    this.playerMeshes.root.position.set(
      this.playerX,
      Math.sin(this.time * 4.2) * 0.12,
      this.playerZ,
    );
    const targetRoll = clamp(-this.playerVx * 0.032, -0.58, 0.58);
    const targetPitch = clamp(-this.playerVz * 0.018, -0.28, 0.28);
    this.playerMeshes.hullGroup.rotation.z = THREE.MathUtils.damp(
      this.playerMeshes.hullGroup.rotation.z,
      targetRoll,
      10,
      dt,
    );
    this.playerMeshes.hullGroup.rotation.x = THREE.MathUtils.damp(
      this.playerMeshes.hullGroup.rotation.x,
      targetPitch,
      10,
      dt,
    );

    const flameScale = 0.85 + Math.sin(this.time * 36) * 0.28;
    this.playerMeshes.leftFlame.scale.set(1, 1, flameScale);
    this.playerMeshes.rightFlame.scale.set(1, 1, flameScale);

    this.playerMeshes.shieldMesh.visible = this.shield > 0;
    if (this.shield > 0) {
      this.playerMeshes.shieldMesh.rotation.y += dt * 1.8;
    }

    const blinkHide =
      this.invuln > 0 && Math.floor(this.invuln * 14) % 2 === 0;
    this.playerMeshes.root.visible = !blinkHide;
  }

  private updateBullets(dt: number): void {
    const updatePool = (pool: BulletEntity[]) => {
      for (const b of pool) {
        if (!b.active) continue;
        b.x += b.vx * dt;
        b.z += b.vz * dt;
        b.life -= dt;
        b.mesh.position.set(b.x, 0, b.z);
        if (
          b.life <= 0 ||
          b.z < BULLET_DESPAWN_MIN_Z ||
          b.z > BULLET_DESPAWN_MAX_Z ||
          Math.abs(b.x) > ARENA_HALF_W + 14
        ) {
          b.active = false;
          b.mesh.visible = false;
        }
      }
    };
    updatePool(this.playerBulletPool);
    updatePool(this.enemyBulletPool);
  }

  private updateEnemies(dt: number): void {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.t += dt;

      if (e.hitFlash > 0) {
        e.hitFlash = Math.max(0, e.hitFlash - dt);
        const active = e.hitFlash > 0;
        for (const m of e.materials) {
          if (!m.userData.keepEmissive) {
            m.emissive.setHex(active ? 0xffffff : 0x000000);
            m.emissiveIntensity = active ? 0.9 : 0;
          }
        }
      }

      if (e.type === 'scout') {
        e.x += e.vx * dt;
        e.z += e.vz * dt;
        if (e.x < -ARENA_HALF_W + 1.5 || e.x > ARENA_HALF_W - 1.5) e.vx *= -1;
        e.mesh.position.set(e.x, Math.sin(e.t * 4 + e.phase) * 0.18, e.z);
        e.mesh.rotation.z = Math.sin(e.t * 3 + e.phase) * 0.25;
        if (e.z > ENEMY_DESPAWN_Z) {
          this.scene.remove(e.mesh);
          this.enemies.splice(i, 1);
          continue;
        }
      } else if (e.type === 'interceptor') {
        e.phase += dt * 2.2;
        const chase = this.playerX - e.x;
        e.vx = Math.sin(e.phase) * 8.5 + clamp(chase * 0.85, -6, 6);
        e.x = clamp(
          e.x + e.vx * dt,
          -ARENA_HALF_W + 1.6,
          ARENA_HALF_W - 1.6,
        );
        e.z += e.vz * dt;
        e.mesh.position.set(e.x, 0, e.z);
        e.mesh.rotation.z = clamp(-e.vx * 0.05, -0.5, 0.5);
        if (e.z > ENEMY_DESPAWN_Z) {
          this.scene.remove(e.mesh);
          this.enemies.splice(i, 1);
          continue;
        }
      } else if (e.type === 'cruiser') {
        e.x += e.vx * dt;
        e.z += e.vz * dt;
        if (e.x < -ARENA_HALF_W + 3 || e.x > ARENA_HALF_W - 3) e.vx *= -1;
        e.mesh.position.set(e.x, 0, e.z);
        e.mesh.rotation.z = Math.sin(e.t * 1.4) * 0.08;
        if (e.hpBarFill) {
          const ratio = clamp(e.hp / e.maxHp, 0, 1);
          e.hpBarFill.scale.x = Math.max(0.01, ratio);
          e.hpBarFill.position.x = -(1 - ratio) * 1.25;
          (e.hpBarFill.material as THREE.MeshBasicMaterial).color.setHex(
            ratio > 0.5 ? 0x5dff9b : ratio > 0.25 ? 0xffd166 : 0xff5a6e,
          );
        }
        if (e.z > ENEMY_DESPAWN_Z + 2) {
          this.scene.remove(e.mesh);
          this.enemies.splice(i, 1);
          continue;
        }
      } else if (e.type === 'boss') {
        this.updateBoss(e, i, dt);
        continue;
      }

      if (e.type === 'interceptor' || e.type === 'cruiser') {
        e.fireT -= dt;
        if (e.fireT <= 0 && e.z > -42 && e.z < 2) {
          e.fireT = e.fireRate;
          const spd = 19;
          const aim = Math.atan2(this.playerX - e.x, this.playerZ - e.z);
          if (e.type === 'interceptor') {
            this.spawnBullet(
              e.x,
              e.z + e.r,
              Math.sin(aim) * spd,
              Math.cos(aim) * spd,
              true,
              1,
            );
          } else {
            for (let k = -1; k <= 1; k++) {
              const a = aim + k * 0.24;
              this.spawnBullet(
                e.x,
                e.z + e.r,
                Math.sin(a) * spd * 0.9,
                Math.cos(a) * spd * 0.9,
                true,
                1,
              );
            }
          }
        }
      }
    }
  }

  private updateBoss(b: EnemyEntity, index: number, dt: number): void {
    if (b.ringGroup) {
      b.ringGroup.rotation.y += dt * 0.85;
    }
    if (b.coreEye) {
      const p = 1 + Math.sin(b.t * 6) * 0.1;
      b.coreEye.scale.setScalar(p);
    }

    if (b.bossState === 'entering') {
      b.z += 16 * dt;
      if (b.z >= -22) {
        b.z = -22;
        b.bossState = 'fighting';
      }
      b.mesh.position.set(b.x, 0, b.z);
      return;
    }

    if (b.bossState === 'dying') {
      b.deathT -= dt;
      if (Math.random() < dt * 16) {
        this.spawnExplosion(
          b.x + (Math.random() - 0.5) * b.r * 1.4,
          b.z + (Math.random() - 0.5) * b.r,
          8,
          [0xffd166, 0xff5a6e, 0xffffff],
          11,
          3.2,
        );
      }
      b.mesh.rotation.z = Math.sin(b.t * 28) * 0.14;
      if (b.deathT <= 0) {
        this.spawnExplosion(
          b.x,
          b.z,
          65,
          [0xffd166, 0xff5a6e, 0xff9f43, 0xffffff],
          24,
          12,
        );
        this.audio.explosion(true);
        this.addTrauma(0.85);
        this.hitstop = 0.06;
        this.score += b.score;
        this.bossActive = false;
        for (let k = 0; k < 3; k++) {
          this.spawnPowerup(
            b.x + (k - 1) * 3.2,
            b.z + (Math.random() - 0.5) * 2,
          );
        }
        this.scene.remove(b.mesh);
        this.enemies.splice(index, 1);
      }
      return;
    }

    // Fighting
    b.x = Math.sin(b.t * 0.72) * (ARENA_HALF_W * 0.65);
    b.z = -22 + Math.sin(b.t * 1.4) * 2.5;
    b.mesh.position.set(b.x, 0, b.z);
    b.mesh.rotation.z = -Math.cos(b.t * 0.72) * 0.16;

    b.fireT -= dt;
    b.spiralT -= dt;

    if (b.spiralT <= 0) {
      b.spiralT = 0.13;
      b.spiralAngle += 0.52;
      for (let k = 0; k < 3; k++) {
        const a = b.spiralAngle + (k * Math.PI * 2) / 3;
        this.spawnBullet(
          b.x + Math.cos(a) * 2.5,
          b.z + Math.sin(a) * 1.8,
          Math.cos(a) * 14,
          Math.sin(a) * 14 + 7,
          true,
          1,
        );
      }
    }

    if (b.fireT <= 0) {
      b.fireT = b.fireRate;
      const aim = Math.atan2(this.playerX - b.x, this.playerZ - b.z);
      for (let k = -2; k <= 2; k++) {
        const a = aim + k * 0.18;
        this.spawnBullet(
          b.x,
          b.z + 2.5,
          Math.sin(a) * 21,
          Math.cos(a) * 21,
          true,
          1,
        );
      }
    }
  }

  private updatePowerups(dt: number): void {
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const p = this.powerups[i];
      p.t += dt;
      p.life -= dt;
      p.z += p.vz * dt;

      if (this.alive) {
        const d = Math.hypot(this.playerX - p.x, this.playerZ - p.z);
        if (d < 8.5) {
          p.x = THREE.MathUtils.lerp(p.x, this.playerX, dt * 3.5);
          p.z = THREE.MathUtils.lerp(p.z, this.playerZ, dt * 3.5);
        }
      }

      p.mesh.position.set(p.x, Math.sin(p.t * 4) * 0.25, p.z);
      p.mesh.rotation.y += dt * 2.2;

      if (p.z > ENEMY_DESPAWN_Z || p.life <= 0) {
        this.scene.remove(p.mesh);
        this.powerups.splice(i, 1);
        continue;
      }

      if (
        this.alive &&
        circleHitXZ(p.x, p.z, p.r, this.playerX, this.playerZ, 1.45)
      ) {
        const next = applyPowerupRule(p.type, {
          weaponLevel: this.weaponLevel,
          weaponTimer: this.weaponTimer,
          shield: this.shield,
          lives: this.lives,
          maxLives: this.maxLives,
        });
        this.weaponLevel = next.weaponLevel;
        this.weaponTimer = next.weaponTimer;
        this.shield = next.shield;
        this.lives = next.lives;
        this.updateWeaponVisual();
        this.audio.powerup();
        this.spawnExplosion(
          p.x,
          p.z,
          14,
          [0xffffff, 0x7df9ff, 0x4dff88],
          12,
          3.5,
        );
        this.scene.remove(p.mesh);
        this.powerups.splice(i, 1);
      }
    }
  }

  private updateParticles(dt: number): void {
    for (let i = 0; i < this.particles.length; i++) {
      const pt = this.particles[i];
      if (!pt.active) continue;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.z += pt.vz * dt;
      pt.vx *= 1 - 1.5 * dt;
      pt.vy *= 1 - 1.5 * dt;
      pt.vz *= 1 - 1.5 * dt;
      pt.life -= dt;
      if (pt.life <= 0) {
        pt.active = false;
        _dummy.position.set(0, -100, 0);
        _dummy.scale.setScalar(0.001);
        _dummy.updateMatrix();
        this.particleMesh.setMatrixAt(i, _dummy.matrix);
      } else {
        const a = clamp(pt.life / pt.maxLife, 0, 1);
        _dummy.position.set(pt.x, pt.y, pt.z);
        _dummy.rotation.set(pt.life * 6, pt.life * 4, 0);
        _dummy.scale.setScalar(pt.size * (0.3 + a * 0.9));
        _dummy.updateMatrix();
        this.particleMesh.setMatrixAt(i, _dummy.matrix);
        this.particleMesh.setColorAt(i, pt.color);
      }
    }
    this.particleMesh.instanceMatrix.needsUpdate = true;
    if (this.particleMesh.instanceColor) {
      this.particleMesh.instanceColor.needsUpdate = true;
    }

    for (const sw of this.shockwaves) {
      if (!sw.active) continue;
      sw.life -= dt;
      sw.r += (sw.maxR - sw.r) * dt * 8;
      sw.mesh.scale.setScalar(sw.r);
      (sw.mesh.material as THREE.MeshBasicMaterial).opacity = clamp(
        (sw.life / sw.maxLife) * 0.75,
        0,
        0.75,
      );
      if (sw.life <= 0) {
        sw.active = false;
        sw.mesh.visible = false;
      }
    }
  }

  private updateWave(dt: number): void {
    if (!this.waveActive) {
      if (this.enemies.length === 0 && this.spawnQueue.length === 0) {
        this.waveTimer += dt;
        if (this.waveTimer > 1.3) {
          this.startWave(this.wave + 1);
        }
      }
      return;
    }

    this.spawnTimer += dt;
    while (
      this.spawnQueue.length > 0 &&
      this.spawnTimer >= this.spawnQueue[0].delay
    ) {
      const item = this.spawnQueue.shift()!;
      if (item.type === 'boss') {
        this.spawnEnemy('boss', 0, ENEMY_SPAWN_Z - 8);
      } else {
        const margin = item.type === 'cruiser' ? 4 : 2;
        const x =
          -ARENA_HALF_W +
          margin +
          Math.random() * (ARENA_HALF_W * 2 - margin * 2);
        this.spawnEnemy(item.type, x, ENEMY_SPAWN_Z);
      }
    }

    if (this.spawnQueue.length === 0 && this.enemies.length === 0) {
      this.waveActive = false;
      this.waveTimer = 0;
      this.score += calculateWaveClearBonus(this.wave);
    }
  }

  private handleCollisions(): void {
    if (!this.alive) return;

    // Player bullets vs enemies
    for (const b of this.playerBulletPool) {
      if (!b.active) continue;
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const e = this.enemies[j];
        if (e.dead) continue;
        if (circleHitXZ(b.x, b.z, b.r, e.x, e.z, e.r)) {
          e.hp -= b.dmg;
          e.hitFlash = 0.06;
          b.active = false;
          b.mesh.visible = false;
          this.spawnExplosion(
            b.x,
            b.z,
            5,
            [0xffffff, 0x9ff4ff, 0xffe066],
            9,
            1.4,
          );

          if (e.hp <= 0) {
            if (e.type === 'boss') {
              e.dead = true;
              e.bossState = 'dying';
              e.deathT = 1.4;
              this.hitstop = 0.04;
            } else {
              e.dead = true;
              const big = e.type === 'cruiser';
              this.spawnExplosion(
                e.x,
                e.z,
                big ? 28 : 16,
                big
                  ? [0xc77dff, 0xff6ad5, 0xffffff, 0xffd166]
                  : [0xffd166, 0xff8f4d, 0xffffff],
                big ? 19 : 14,
                big ? 6.5 : 3.5,
              );
              this.audio.explosion(big);
              this.addTrauma(big ? 0.35 : 0.16);
              if (big) this.hitstop = 0.035;
              this.score += e.score;
              if (Math.random() < 0.22) {
                this.spawnPowerup(e.x, e.z);
              }
              this.scene.remove(e.mesh);
              this.enemies.splice(j, 1);
            }
          }
          break;
        }
      }
    }

    // Enemy bullets vs player
    for (const b of this.enemyBulletPool) {
      if (!b.active) continue;
      if (circleHitXZ(b.x, b.z, b.r, this.playerX, this.playerZ, 1.05)) {
        b.active = false;
        b.mesh.visible = false;
        this.damagePlayer();
        if (!this.alive) return;
      }
    }

    // Enemy body vs player
    for (let j = this.enemies.length - 1; j >= 0; j--) {
      const e = this.enemies[j];
      if (e.type === 'boss') continue;
      if (circleHitXZ(e.x, e.z, e.r * 0.85, this.playerX, this.playerZ, 1.05)) {
        this.spawnExplosion(
          e.x,
          e.z,
          16,
          [0xffd166, 0xff8f4d, 0xffffff],
          14,
          3.5,
        );
        this.audio.explosion(false);
        this.scene.remove(e.mesh);
        this.enemies.splice(j, 1);
        this.damagePlayer();
        if (!this.alive) return;
      }
    }
  }

  private damagePlayer(): void {
    const res = applyDamageRule({
      lives: this.lives,
      shield: this.shield,
      invuln: this.invuln,
      alive: this.alive,
    });
    if (res.outcome === 'ignored') return;

    this.lives = res.next.lives;
    this.shield = res.next.shield;
    this.invuln = res.next.invuln;
    this.alive = res.next.alive;

    if (res.outcome === 'shield_break') {
      this.spawnExplosion(
        this.playerX,
        this.playerZ,
        20,
        [0x4dff88, 0xffffff, 0xaaffcc],
        15,
        4.5,
      );
      this.audio.hurt();
      this.addTrauma(0.32);
    } else if (res.outcome === 'damaged') {
      this.spawnExplosion(
        this.playerX,
        this.playerZ,
        22,
        [0x7df9ff, 0xffffff, 0xff5a6e],
        15,
        4.5,
      );
      this.audio.hurt();
      this.addTrauma(0.5);
      this.hitstop = 0.04;
    } else if (res.outcome === 'killed') {
      this.playerMeshes.root.visible = false;
      this.spawnExplosion(
        this.playerX,
        this.playerZ,
        60,
        [0x7df9ff, 0xffffff, 0xff9f43, 0xff5a6e],
        22,
        9.5,
      );
      this.audio.explosion(true);
      this.addTrauma(0.95);
      this.deathDelay = 0.95;
    }
    this.emitHud(true);
  }

  private triggerGameOver(): void {
    this.phase = 'gameover';
    this.keys.clear();
    this.pointerActive = false;

    this.newRecord = this.score > this.highScore;
    if (this.newRecord) {
      this.highScore = this.score;
      localStorage.setItem('gd_highscore', String(this.highScore));
    }
    if (this.wave > this.bestWave) {
      this.bestWave = this.wave;
      localStorage.setItem('gd_bestwave', String(this.bestWave));
    }

    this.audio.gameOver();
    this.syncBodyState();
    this.emitHud(true);
  }

  private updateCamera(dt: number): void {
    if (this.phase === 'title') {
      // Live world camera tour orbiting around the hero starfighter
      const a = this.time * 0.35;
      const targetCamX = Math.sin(a) * 6.5;
      const targetCamY = 3.2 + Math.sin(this.time * 0.6) * 0.7;
      const targetCamZ = 6.8 + Math.cos(a) * 2.2;
      this.camera.position.x = THREE.MathUtils.damp(
        this.camera.position.x,
        targetCamX,
        4,
        dt,
      );
      this.camera.position.y = THREE.MathUtils.damp(
        this.camera.position.y,
        targetCamY,
        4,
        dt,
      );
      this.camera.position.z = THREE.MathUtils.damp(
        this.camera.position.z,
        targetCamZ,
        4,
        dt,
      );
      this.camera.lookAt(0, 0.2, -3.5);

      this.playerMeshes.root.position.set(
        0,
        Math.sin(this.time * 2.4) * 0.22,
        0,
      );
      this.playerMeshes.hullGroup.rotation.z = Math.sin(this.time * 1.1) * 0.14;
      this.playerMeshes.hullGroup.rotation.x = Math.cos(this.time * 0.9) * 0.06;
      const flameScale = 0.85 + Math.sin(this.time * 32) * 0.22;
      this.playerMeshes.leftFlame.scale.set(1, 1, flameScale);
      this.playerMeshes.rightFlame.scale.set(1, 1, flameScale);
      return;
    }

    // Elevated wide landscape chase perspective
    const desiredX = this.playerX * 0.32;
    const desiredY = 14.5;
    const desiredZ = 20.5 + (this.playerZ - 5.5) * 0.32;

    this.camera.position.x = THREE.MathUtils.damp(
      this.camera.position.x,
      desiredX,
      7,
      dt,
    );
    this.camera.position.y = THREE.MathUtils.damp(
      this.camera.position.y,
      desiredY,
      7,
      dt,
    );
    this.camera.position.z = THREE.MathUtils.damp(
      this.camera.position.z,
      desiredZ,
      7,
      dt,
    );

    const lookX = this.playerX * 0.14;
    const lookZ = -13;

    if (this.trauma > 0) {
      const shake = this.trauma * this.trauma;
      this.camera.position.x += (Math.random() - 0.5) * 2.2 * shake;
      this.camera.position.y += (Math.random() - 0.5) * 1.8 * shake;
      this.trauma = Math.max(0, this.trauma - dt * 1.7);
    }

    this.camera.lookAt(lookX, -1.2, lookZ);
  }

  private emitHud(force = false): void {
    const boss = this.enemies.find((e) => e.type === 'boss');
    const discreteKey = `${this.phase}|${this.score}|${this.wave}|${this.lives}|${this.weaponLevel}|${this.shield}|${this.audio.muted}|${this.bannerTimer > 0 ? this.bannerTitle : ''}|${boss ? Math.ceil(boss.hp) : -1}`;
    const now = performance.now();
    if (!force && discreteKey === this.lastDiscreteKey && now - this.lastHudPush < 110) {
      return;
    }
    this.lastDiscreteKey = discreteKey;
    this.lastHudPush = now;

    this.onHud({
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      bestWave: this.bestWave,
      wave: this.wave,
      lives: this.lives,
      maxLives: this.maxLives,
      weaponLevel: this.weaponLevel,
      weaponTimer: this.weaponTimer,
      shield: this.shield,
      muted: this.audio.muted,
      newRecord: this.newRecord,
      bossActive: Boolean(boss && !boss.dead),
      bossHp: boss ? Math.max(0, Math.ceil(boss.hp)) : 0,
      bossMaxHp: boss ? boss.maxHp : 1,
      bannerTitle: this.bannerTimer > 0 ? this.bannerTitle : '',
      bannerSub: this.bannerTimer > 0 ? this.bannerSub : '',
      bannerType: this.bannerTimer > 0 ? this.bannerType : null,
    });
  }

  private tick = (): void => {
    if (this.disposed) return;

    const now = performance.now();
    const rawDt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    const dt = clamp(rawDt, 0, 0.05);

    if (this.phase !== 'paused') {
      this.time += dt;
      this.env.update(dt);
    }

    if (this.phase === 'playing') {
      if (this.bannerTimer > 0) {
        this.bannerTimer = Math.max(0, this.bannerTimer - dt);
      }

      if (this.hitstop > 0) {
        this.hitstop = Math.max(0, this.hitstop - dt);
      } else {
        this.updatePlayer(dt);
        this.updateBullets(dt);
        this.updateEnemies(dt);
        this.updatePowerups(dt);
        this.updateParticles(dt);
        this.updateWave(dt);
        this.handleCollisions();

        if (!this.alive) {
          this.deathDelay -= dt;
          if (this.deathDelay <= 0) {
            this.triggerGameOver();
          }
        }
      }
    } else if (this.phase === 'gameover') {
      this.updateParticles(dt);
    }

    this.updateCamera(dt);
    this.emitHud(false);
    this.renderer.render(this.scene, this.camera);

    this.scheduleLoop();
  };

  private scheduleLoop(): void {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.unbindEvents();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
