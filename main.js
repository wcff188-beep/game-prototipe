import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { World } from './world.js';
import { PlayerController, NPCManager } from './characters.js';
import { VehicleManager } from './vehicles.js';

// ---------- Penyimpanan pengaturan (aman jika localStorage diblokir) ----------
const store = {
  get(k, d) {
    try {
      const v = localStorage.getItem('vcrp_' + k);
      return v === null ? d : JSON.parse(v);
    } catch (e) { return d; }
  },
  set(k, v) {
    try { localStorage.setItem('vcrp_' + k, JSON.stringify(v)); } catch (e) {}
  }
};

const canvas = document.getElementById('gameCanvas');
// antialias dimatikan: AA ditangani render target MSAA milik composer
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xb9d0e8, 0.0026);

const pmrem = new THREE.PMREMGenerator(renderer);
let envRT = null;
let isNight = false;

const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.2, 700);
const BASE_FOV = 58;

const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x5a6b50, 0.7);
scene.add(hemiLight);

const sunLight = new THREE.DirectionalLight(0xfff3dc, 3.4);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.bias = -0.0002;
sunLight.shadow.normalBias = 0.04;
const SHADOW_HALF = 80; // bayangan hanya di sekitar pemain -> jauh lebih tajam
sunLight.shadow.camera.near = 1;
sunLight.shadow.camera.far = 460;
sunLight.shadow.camera.left = -SHADOW_HALF;
sunLight.shadow.camera.right = SHADOW_HALF;
sunLight.shadow.camera.top = SHADOW_HALF;
sunLight.shadow.camera.bottom = -SHADOW_HALF;
scene.add(sunLight);
scene.add(sunLight.target);

// ---------- Langit prosedural + bintang ----------
const sky = new Sky();
sky.scale.setScalar(450);
scene.add(sky);

const stars = (() => {
  const n = 1800;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = Math.random() * Math.PI * 2;
    const y = 0.16 + Math.random() * 0.84; // hanya di atas horizon
    const r = Math.sqrt(1 - y * y);
    pos[i * 3] = Math.cos(u) * r * 380;
    pos[i * 3 + 1] = y * 380;
    pos[i * 3 + 2] = Math.sin(u) * r * 380;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({ color: 0xffffff, size: 1.7, sizeAttenuation: false, transparent: true, opacity: 0.85, depthWrite: false, fog: false });
  const pts = new THREE.Points(g, m);
  pts.visible = false;
  pts.frustumCulled = false;
  scene.add(pts);
  return pts;
})();

// ---------- Post-processing: MSAA -> Bloom -> Tone mapping -> Grading ----------
const composerTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, composerTarget);
composer.addPass(new RenderPass(scene, camera));

const bloomPass = new UnrealBloomPass(new THREE.Vector2(960, 540), 0.2, 0.55, 0.92);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

const gradePass = new ShaderPass({
  uniforms: {
    tDiffuse: { value: null },
    uRes: { value: new THREE.Vector2(1920, 1080) },
    uTime: { value: 0 },
    uVignette: { value: 0.38 },
    uGrain: { value: 0.028 },
    uSharp: { value: 0.32 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 uRes;
    uniform float uTime;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uSharp;
    varying vec2 vUv;
    void main() {
      vec2 px = 1.0 / uRes;
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      vec3 blur = (
        texture2D(tDiffuse, vUv + vec2(px.x, 0.0)).rgb +
        texture2D(tDiffuse, vUv - vec2(px.x, 0.0)).rgb +
        texture2D(tDiffuse, vUv + vec2(0.0, px.y)).rgb +
        texture2D(tDiffuse, vUv - vec2(0.0, px.y)).rgb) * 0.25;
      c += (c - blur) * uSharp;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, 1.10);
      c = (c - 0.5) * 1.07 + 0.5;
      vec2 d = (vUv - 0.5) * vec2(1.0, 0.92);
      c *= mix(1.0, smoothstep(0.86, 0.22, length(d)), uVignette);
      float g = fract(sin(dot(vUv * uRes + uTime, vec2(12.9898, 78.233))) * 43758.5453);
      c += (g - 0.5) * uGrain;
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`
});
composer.addPass(gradePass);

// ---------- Kualitas render: HD / QHD / 4K + Auto adaptif ----------
const isTouch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
const QUALITY_LEVELS = {
  // Preset grafis dioptimalkan: Ultra 4K tetap tajam dengan efisiensi VRAM & fill-rate tinggi
  hd:  { label: 'Balanced 900p', long: 1600, shadow: 1024, msaa: 0, bloomScale: 0.35 },
  qhd: { label: 'High 1440p',    long: 2560, shadow: 1536, msaa: 0, bloomScale: 0.40 },
  uhd: { label: 'Ultra 4K Lite', long: 3840, shadow: 2048, msaa: 0, bloomScale: 0.35 }
};
const QUALITY_ORDER = ['hd', 'qhd', 'uhd'];
let qualityPref = store.get('quality', isTouch ? 'hd' : 'uhd');
if (qualityPref !== 'auto' && !QUALITY_LEVELS[qualityPref]) qualityPref = 'auto';
let qualityLevel = qualityPref === 'auto' ? 'hd' : qualityPref;
let autoMax = 1; // Auto hanya boleh naik sampai High; Ultra/4K harus dipilih manual

function setShadowSize(size) {
  if (sunLight.shadow.mapSize.x === size) return;
  if (sunLight.shadow.map) {
    sunLight.shadow.map.dispose();
    sunLight.shadow.map = null;
  }
  sunLight.shadow.mapSize.set(size, size);
}

function applyQuality() {
  const q = QUALITY_LEVELS[qualityLevel];
  const w = window.innerWidth;
  const h = window.innerHeight;
  const longSide = Math.max(w, h);
  let pr = THREE.MathUtils.clamp(q.long / longSide, 0.5, 2);
  pr = Math.min(pr, renderer.capabilities.maxTextureSize / longSide);

  for (const rt of [composer.renderTarget1, composer.renderTarget2]) {
    if (rt.samples !== q.msaa) {
      rt.samples = q.msaa;
      rt.dispose();
    }
  }

  renderer.setPixelRatio(pr);
  renderer.setSize(w, h);
  composer.setPixelRatio(pr);
  composer.setSize(w, h);
  bloomPass.setSize(Math.floor(w * pr * (q.bloomScale || 0.35)), Math.floor(h * pr * (q.bloomScale || 0.35)));
  gradePass.uniforms.uRes.value.set(w * pr, h * pr);

  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  setShadowSize(q.shadow);

  const info = document.getElementById('gfxInfo');
  if (info) {
    info.textContent = `Render ${canvas.width}×${canvas.height} • ${q.label}${qualityPref === 'auto' ? ' (Auto)' : ''}`;
  }
}

// ---------- Preset waktu: Siang / Sore / Malam / Pagi ----------
const PRESETS = {
  day:     { label: '☀️ Siang',  elev: 55, az: 150, turbidity: 3.2, rayleigh: 1.1, mie: 0.004, g: 0.80, sunColor: 0xfff3dc, sun: 3.4, hemiSky: 0xdbeafe, hemiGround: 0x5a6b50, hemi: 0.70, exposure: 0.95, fog: 0xb9d0e8, fogD: 0.0026, bloom: 0.16, night: false },
  golden:  { label: '🌇 Sore',   elev: 7,  az: 238, turbidity: 9.0, rayleigh: 2.6, mie: 0.012, g: 0.92, sunColor: 0xffb06a, sun: 3.6, hemiSky: 0xffcfa0, hemiGround: 0x4a3a30, hemi: 0.55, exposure: 0.90, fog: 0xe3ad84, fogD: 0.0038, bloom: 0.30, night: false },
  night:   { label: '🌙 Malam',  elev: -6, az: 200, turbidity: 2.0, rayleigh: 0.6, mie: 0.002, g: 0.70, sunColor: 0x9db4ff, sun: 0.55, hemiSky: 0x40527a, hemiGround: 0x10141c, hemi: 0.50, exposure: 1.15, fog: 0x0f1a30, fogD: 0.0042, bloom: 0.60, night: true },
  morning: { label: '🌄 Pagi',   elev: 14, az: 105, turbidity: 5.0, rayleigh: 1.8, mie: 0.008, g: 0.85, sunColor: 0xffe2bd, sun: 3.0, hemiSky: 0xcfe0f2, hemiGround: 0x55604a, hemi: 0.65, exposure: 0.95, fog: 0xc6d6e6, fogD: 0.0032, bloom: 0.22, night: false }
};
const PRESET_ORDER = ['day', 'golden', 'night', 'morning'];
let presetKey = store.get('preset', 'day');
if (!PRESETS[presetKey]) presetKey = 'day';

const sunDir = new THREE.Vector3();
const lightDir = new THREE.Vector3(0, 1, 0);
let bloomBase = 0.2;
let bloomOn = store.get('bloom', true);
const envScene = new THREE.Scene();

function applyPreset(key) {
  const p = PRESETS[key];
  presetKey = key;
  store.set('preset', key);
  isNight = p.night;

  const u = sky.material.uniforms;
  u.turbidity.value = p.turbidity;
  u.rayleigh.value = p.rayleigh;
  u.mieCoefficient.value = p.mie;
  u.mieDirectionalG.value = p.g;
  sunDir.setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - p.elev), THREE.MathUtils.degToRad(p.az));
  u.sunPosition.value.copy(sunDir);

  // Malam: cahaya bulan datang dari atas horizon, bukan dari bawah tanah
  if (p.night) lightDir.setFromSphericalCoords(1, THREE.MathUtils.degToRad(52), THREE.MathUtils.degToRad(215));
  else lightDir.copy(sunDir);

  sunLight.color.setHex(p.sunColor);
  sunLight.intensity = p.sun;
  hemiLight.color.setHex(p.hemiSky);
  hemiLight.groundColor.setHex(p.hemiGround);
  hemiLight.intensity = p.hemi;
  renderer.toneMappingExposure = p.exposure;
  scene.fog.color.setHex(p.fog);
  scene.fog.density = p.fogD;
  bloomBase = p.bloom;
  bloomPass.strength = bloomBase;
  stars.visible = p.night;

  // Refleksi lingkungan dari langit yang sama
  envScene.add(sky);
  if (envRT) envRT.dispose();
  envRT = pmrem.fromScene(envScene);
  scene.add(sky);
  scene.environment = envRT.texture;

  if (typeof world !== 'undefined') world.setNightMode(p.night);
  if (typeof vehicleMgr !== 'undefined') vehicleMgr.setNight(p.night);
}

// Lampu depan mobil yang sedang dikendarai (jumlah cahaya tetap -> tanpa recompile shader)
const headLights = [0, 1].map(() => {
  const s = new THREE.SpotLight(0xfff1cf, 0, 75, 0.55, 0.7, 1.4);
  scene.add(s);
  scene.add(s.target);
  return s;
});
const _hv1 = new THREE.Vector3();
const _hv2 = new THREE.Vector3();

let loadedAssets = 0;
function onAssetLoaded() {
  loadedAssets++;
  const pct = Math.min(100, 35 + loadedAssets * 35);
  document.getElementById('progressFill').style.width = pct + '%';
  if (loadedAssets >= 2) hideLoadingScreen();
}

function hideLoadingScreen() {
  const ls = document.getElementById('loadingScreen');
  if (ls && ls.style.display !== 'none') {
    document.getElementById('progressFill').style.width = '100%';
    ls.style.opacity = '0';
    setTimeout(() => (ls.style.display = 'none'), 350);
  }
}
setTimeout(hideLoadingScreen, 4500);

const world = new World(scene);
const player = new PlayerController(scene, onAssetLoaded);
const npcMgr = new NPCManager(scene, world);
const vehicleMgr = new VehicleManager(scene, onAssetLoaded);

let activeVehicle = null;
let camYaw = 0;
let camPitch = 0.22;
let camMode = 0; // 0 = Normal, 1 = Jauh, 2 = Dekat
let autoFollowCam = true; // Kamera otomatis mengikuti arah mobil saat melaju (khas OneState)
let cash = 120640;

// State Kontrol OneState
let joyX = 0;
let joyY = 0;
let isSprinting = false;
let steerLeftHeld = false;
let steerRightHeld = false;
let gasHeld = false;
let brakeHeld = false;
let handbrakeHeld = false;

let waypoint = null;
let selectedPoi = world.pois[0];
const keys = {};

const toastEl = document.getElementById('toast');
let toastTimeout;
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.style.opacity = '1';
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => (toastEl.style.opacity = '0'), 2000);
}

// Helper tombol tekan-tahan multi-touch
function bindHoldButton(el, onStateChange) {
  if (!el) return;
  const start = (e) => {
    if (e.cancelable) e.preventDefault();
    el.classList.add('active');
    onStateChange(true);
  };
  const end = (e) => {
    if (e && e.cancelable) e.preventDefault();
    el.classList.remove('active');
    onStateChange(false);
  };
  el.addEventListener('touchstart', start, { passive: false });
  el.addEventListener('touchend', end);
  el.addEventListener('touchcancel', end);
  el.addEventListener('mousedown', start);
  el.addEventListener('mouseup', end);
  el.addEventListener('mouseleave', end);
}

// 1. Joystick Analog Kiri (Mode Jalan Kaki OneState - otomatis sprint jika ditarik mentok > 85%)
const joyZone = document.getElementById('joystickZone');
const joyStick = document.getElementById('joystickStick');
let joyTouchId = null;

joyZone.addEventListener('touchstart', (e) => {
  if (e.cancelable) e.preventDefault();
  const t = e.changedTouches[0];
  joyTouchId = t.identifier;
  updateJoystick(t.clientX, t.clientY);
}, { passive: false });

joyZone.addEventListener('touchmove', (e) => {
  if (e.cancelable) e.preventDefault();
  for (const t of e.changedTouches) {
    if (t.identifier === joyTouchId) updateJoystick(t.clientX, t.clientY);
  }
}, { passive: false });

const resetJoystick = () => {
  joyTouchId = null;
  joyX = 0;
  joyY = 0;
  joyStick.style.transform = 'translate(0px, 0px)';
};
joyZone.addEventListener('touchend', resetJoystick);
joyZone.addEventListener('touchcancel', resetJoystick);

function updateJoystick(clientX, clientY) {
  const rect = joyZone.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const maxR = 42;
  let dx = clientX - cx;
  let dy = clientY - cy;
  const dist = Math.hypot(dx, dy);
  if (dist > maxR) {
    dx = (dx / dist) * maxR;
    dy = (dy / dist) * maxR;
  }
  joyStick.style.transform = `translate(${dx}px, ${dy}px)`;
  joyX = dx / maxR;
  joyY = dy / maxR;
}

// 2. Kontrol Sentuh Kamera Bebas (Area Layar Bebas Multi-Touch)
let camTouchId = null;
let lastCamX = 0;
let lastCamY = 0;
let manualCamTimer = 0;

canvas.addEventListener('touchstart', (e) => {
  for (const t of e.changedTouches) {
    if (camTouchId === null) {
      camTouchId = t.identifier;
      lastCamX = t.clientX;
      lastCamY = t.clientY;
      manualCamTimer = 2.2;
    }
  }
});

canvas.addEventListener('touchmove', (e) => {
  for (const t of e.changedTouches) {
    if (t.identifier === camTouchId) {
      camYaw -= (t.clientX - lastCamX) * 0.0072;
      camPitch = THREE.MathUtils.clamp(camPitch + (t.clientY - lastCamY) * 0.005, 0.06, 0.85);
      lastCamX = t.clientX;
      lastCamY = t.clientY;
      manualCamTimer = 2.2;
    }
  }
});

canvas.addEventListener('touchend', (e) => {
  for (const t of e.changedTouches) {
    if (t.identifier === camTouchId) camTouchId = null;
  }
});

let mouseDown = false;
canvas.addEventListener('mousedown', (e) => {
  mouseDown = true;
  lastCamX = e.clientX;
  lastCamY = e.clientY;
  manualCamTimer = 2.2;
});
window.addEventListener('mouseup', () => (mouseDown = false));
window.addEventListener('mousemove', (e) => {
  if (!mouseDown) return;
  camYaw -= (e.clientX - lastCamX) * 0.006;
  camPitch = THREE.MathUtils.clamp(camPitch + (e.clientY - lastCamY) * 0.004, 0.06, 0.85);
  lastCamX = e.clientX;
  lastCamY = e.clientY;
  manualCamTimer = 2.2;
});

// 3. Tombol Kontrol Jalan Kaki OneState
bindHoldButton(document.getElementById('btnSprint'), (held) => {
  isSprinting = held;
});

document.getElementById('btnJump').addEventListener('click', () => {
  if (!activeVehicle && player.jump()) {
    showToast('⬆️ Lompat');
  }
});

document.getElementById('btnCrouch').addEventListener('click', () => {
  if (!activeVehicle) {
    const crouched = player.toggleCrouch();
    document.getElementById('btnCrouch').classList.toggle('active', crouched);
    showToast(crouched ? '🧎 Mode Jongkok' : '🧍 Berdiri');
  }
});

document.getElementById('btnPunch').addEventListener('click', () => {
  if (!activeVehicle) {
    showToast('✊ Serangan jarak dekat!');
  }
});

// 4. Tombol Kontrol Mengemudi OneState (Steer Kiri/Kanan + Pedal Gas/Rem + Rem Tangan + Nitro + Klakson)
bindHoldButton(document.getElementById('btnSteerLeft'), (held) => (steerLeftHeld = held));
bindHoldButton(document.getElementById('btnSteerRight'), (held) => (steerRightHeld = held));
bindHoldButton(document.getElementById('btnGas'), (held) => (gasHeld = held));
bindHoldButton(document.getElementById('btnBrake'), (held) => (brakeHeld = held));
bindHoldButton(document.getElementById('btnHandbrake'), (held) => (handbrakeHeld = held));

document.getElementById('btnHorn').addEventListener('click', () => {
  showToast('📯 Klakson mobil!');
});

document.getElementById('btnNitro').addEventListener('click', () => {
  if (activeVehicle) {
    activeVehicle.speed = Math.min(activeVehicle.speed + 11, 38);
    showToast('🔥 Nitro Boost aktif!');
  }
});

// 5. Tombol Masuk / Keluar Mobil & Switch HUD OneState
const btnDoor = document.getElementById('btnDoor');
const footLeftControl = document.getElementById('footLeftControl');
const driveLeftControl = document.getElementById('driveLeftControl');
const footRightControl = document.getElementById('footRightControl');
const driveRightControl = document.getElementById('driveRightControl');

function syncControlModeUI() {
  const driving = Boolean(activeVehicle);
  footLeftControl.classList.toggle('hidden', driving);
  footRightControl.classList.toggle('hidden', driving);
  driveLeftControl.classList.toggle('hidden', !driving);
  driveRightControl.classList.toggle('hidden', !driving);
  document.getElementById('speedoBox').classList.toggle('hidden', !driving);

  // Reset state hold saat ganti mode
  steerLeftHeld = false;
  steerRightHeld = false;
  gasHeld = false;
  brakeHeld = false;
  handbrakeHeld = false;
  isSprinting = false;
}

function toggleVehicle() {
  if (activeVehicle) {
    player.group.visible = true;
    const exitOffset = new THREE.Vector3(-2.1, 0, 0).applyAxisAngle(
      new THREE.Vector3(0, 1, 0),
      activeVehicle.group.rotation.y
    );
    player.group.position.copy(activeVehicle.group.position).add(exitOffset);
    player.group.position.y = player.groundY;
    activeVehicle = null;
    syncControlModeUI();
    showToast('Keluar dari kendaraan');
    return;
  }

  let nearest = null;
  let minDist = 4.8;
  for (const v of vehicleMgr.vehicles) {
    const dist = player.group.position.distanceTo(v.group.position);
    if (dist < minDist) {
      minDist = dist;
      nearest = v;
    }
  }

  if (nearest) {
    activeVehicle = nearest;
    player.group.visible = false;
    camYaw = nearest.group.rotation.y;
    syncControlModeUI();
    showToast(`🚘 Mengendarai ${nearest.name}`);
  } else {
    showToast('Dekati mobil untuk masuk');
  }
}

btnDoor.addEventListener('click', toggleVehicle);

// Keyboard Shortcut PC
window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  keys[k] = true;
  if (k === 'f' || k === 'e') toggleVehicle();
  if (k === 'c' && !activeVehicle) {
    const crouched = player.toggleCrouch();
    document.getElementById('btnCrouch').classList.toggle('active', crouched);
  }
  if (k === ' ' && !activeVehicle) player.jump();
  if (k === 'm') openMapModal();
  if (e.key === 'Escape') { closeMapModal(); document.getElementById('settingsModal').classList.add('hidden'); }
});
window.addEventListener('keyup', (e) => (keys[e.key.toLowerCase()] = false));

// Tombol Utilitas HUD
document.getElementById('btnCam').addEventListener('click', () => {
  camMode = (camMode + 1) % 3;
  const labels = ['Kamera Normal', 'Kamera Jauh', 'Kamera Dekat'];
  showToast(`🎥 ${labels[camMode]}`);
});

document.getElementById('btnWanted').addEventListener('click', () => {
  const nearestCar = vehicleMgr.vehicles[0];
  if (nearestCar && !activeVehicle) {
    player.group.position.set(nearestCar.group.position.x - 2.2, player.groundY, nearestCar.group.position.z);
    showToast('★ Kendaraan dipanggil ke dekatmu');
  }
});

document.getElementById('btnWeather').addEventListener('click', () => {
  const next = PRESET_ORDER[(PRESET_ORDER.indexOf(presetKey) + 1) % PRESET_ORDER.length];
  applyPreset(next);
  showToast(PRESETS[next].label);
});

document.getElementById('btnSpawnCar').addEventListener('click', () => {
  const px = player.group.position.x + 3.5;
  const pz = player.group.position.z + 2;
  vehicleMgr.createVehicle({
    name: 'Custom Supercar',
    x: px,
    z: pz,
    color: Math.random() * 0xffffff
  });
  showToast('🚗 Supercar baru dipanggil!');
});

document.getElementById('btnAddMoney').addEventListener('click', () => {
  cash += 25000;
  document.getElementById('moneyVal').textContent = cash.toLocaleString('id-ID').replace(/,/g, ' ');
  showToast('💵 +$25.000 ditambahkan!');
});

// Peta Interaktif Ala OneState
const mapModal = document.getElementById('mapModal');
const fullMapCanvas = document.getElementById('fullMapCanvas');
const fullMapCtx = fullMapCanvas.getContext('2d');
const poiListEl = document.getElementById('poiList');
const selectedPoiInfoEl = document.getElementById('selectedPoiInfo');

function worldToMap(wx, wz) {
  const ext = world.worldHalfExtent;
  const pad = 28;
  const u = (wx + ext) / (ext * 2);
  const v = (wz + ext) / (ext * 2);
  return {
    x: pad + u * (fullMapCanvas.width - pad * 2),
    y: pad + v * (fullMapCanvas.height - pad * 2)
  };
}

function mapToWorld(mx, my) {
  const ext = world.worldHalfExtent;
  const pad = 28;
  const u = (mx - pad) / (fullMapCanvas.width - pad * 2);
  const v = (my - pad) / (fullMapCanvas.height - pad * 2);
  return {
    x: THREE.MathUtils.clamp(u * (ext * 2) - ext, -ext + 20, ext - 20),
    z: THREE.MathUtils.clamp(v * (ext * 2) - ext, -ext + 20, ext - 20)
  };
}

function renderPoiSidebar() {
  poiListEl.innerHTML = '';
  world.pois.forEach((p) => {
    const div = document.createElement('div');
    div.className = 'poi-item' + (selectedPoi && selectedPoi.id === p.id ? ' active' : '');
    div.innerHTML = `<span>${p.icon} <b>${p.name}</b></span><span>GPS</span>`;
    div.addEventListener('click', () => {
      selectedPoi = p;
      selectedPoiInfoEl.innerHTML = `<strong>${p.icon} ${p.name}</strong><p>${p.desc}</p>`;
      renderPoiSidebar();
      drawFullMap();
    });
    poiListEl.appendChild(div);
  });
}

function drawFullMap() {
  const w = fullMapCanvas.width;
  const h = fullMapCanvas.height;
  fullMapCtx.fillStyle = '#1b2432';
  fullMapCtx.fillRect(0, 0, w, h);

  fullMapCtx.strokeStyle = '#475569';
  fullMapCtx.lineWidth = 5;
  for (let i = -world.gridCount; i <= world.gridCount; i++) {
    const pos = i * world.span;
    const p1 = worldToMap(pos, -world.worldHalfExtent);
    const p2 = worldToMap(pos, world.worldHalfExtent);
    fullMapCtx.beginPath(); fullMapCtx.moveTo(p1.x, p1.y); fullMapCtx.lineTo(p2.x, p2.y); fullMapCtx.stroke();

    const p3 = worldToMap(-world.worldHalfExtent, pos);
    const p4 = worldToMap(world.worldHalfExtent, pos);
    fullMapCtx.beginPath(); fullMapCtx.moveTo(p3.x, p3.y); fullMapCtx.lineTo(p4.x, p4.y); fullMapCtx.stroke();
  }

  world.pois.forEach((p) => {
    const pt = worldToMap(p.x, p.z);
    const active = selectedPoi && selectedPoi.id === p.id;
    fullMapCtx.fillStyle = active ? '#f6c945' : p.color;
    fullMapCtx.beginPath();
    fullMapCtx.arc(pt.x, pt.y, active ? 9 : 6.5, 0, Math.PI * 2);
    fullMapCtx.fill();

    fullMapCtx.fillStyle = '#f8fafc';
    fullMapCtx.font = 'bold 11px sans-serif';
    fullMapCtx.fillText(p.name, pt.x + 10, pt.y + 4);
  });

  if (waypoint) {
    const wpt = worldToMap(waypoint.x, waypoint.z);
    fullMapCtx.strokeStyle = '#38bdf8';
    fullMapCtx.lineWidth = 2.5;
    fullMapCtx.beginPath();
    fullMapCtx.arc(wpt.x, wpt.y, 12, 0, Math.PI * 2);
    fullMapCtx.stroke();
  }

  const targetObj = activeVehicle ? activeVehicle.group : player.group;
  const cur = worldToMap(targetObj.position.x, targetObj.position.z);
  fullMapCtx.fillStyle = '#22c55e';
  fullMapCtx.beginPath();
  fullMapCtx.arc(cur.x, cur.y, 7, 0, Math.PI * 2);
  fullMapCtx.fill();
}

fullMapCanvas.addEventListener('click', (e) => {
  const rect = fullMapCanvas.getBoundingClientRect();
  const scaleX = fullMapCanvas.width / rect.width;
  const scaleY = fullMapCanvas.height / rect.height;
  const mx = (e.clientX - rect.left) * scaleX;
  const my = (e.clientY - rect.top) * scaleY;
  const wPos = mapToWorld(mx, my);

  selectedPoi = {
    id: 'custom_pin',
    name: 'Titik Peta Dipilih',
    desc: `Koordinat X: ${Math.round(wPos.x)}, Z: ${Math.round(wPos.z)}`,
    x: wPos.x,
    z: wPos.z,
    icon: '📌',
    color: '#38bdf8'
  };
  selectedPoiInfoEl.innerHTML = `<strong>📌 ${selectedPoi.name}</strong><p>${selectedPoi.desc}</p>`;
  renderPoiSidebar();
  drawFullMap();
});

function openMapModal() {
  mapModal.classList.remove('hidden');
  renderPoiSidebar();
  drawFullMap();
}

function closeMapModal() {
  mapModal.classList.add('hidden');
}

document.getElementById('minimapWrapper').addEventListener('click', openMapModal);
document.getElementById('btnMapModal').addEventListener('click', openMapModal);
document.getElementById('btnMenu').addEventListener('click', openMapModal);
document.getElementById('btnCloseMap').addEventListener('click', closeMapModal);

document.getElementById('btnSetWaypoint').addEventListener('click', () => {
  if (!selectedPoi) return;
  waypoint = { x: selectedPoi.x, z: selectedPoi.z, name: selectedPoi.name };
  world.setWaypoint(waypoint.x, waypoint.z);
  showToast(`📍 GPS dipasang ke ${selectedPoi.name}`);
  drawFullMap();
});

document.getElementById('btnTeleportPoi').addEventListener('click', () => {
  if (!selectedPoi) return;
  const targetObj = activeVehicle ? activeVehicle.group : player.group;
  targetObj.position.set(selectedPoi.x, player.groundY, selectedPoi.z);
  if (activeVehicle) {
    activeVehicle.speed = 0;
    player.group.position.copy(activeVehicle.group.position);
  }
  closeMapModal();
  showToast(`⚡ Berpindah ke ${selectedPoi.name}`);
});

const mapCanvas = document.getElementById('minimapCanvas');
const mapCtx = mapCanvas.getContext('2d');

function drawMinimap(targetPos) {
  mapCtx.fillStyle = '#25303d';
  mapCtx.fillRect(0, 0, 160, 160);

  const scale = 0.72;
  mapCtx.strokeStyle = '#526071';
  mapCtx.lineWidth = 7;

  for (let i = -world.gridCount; i <= world.gridCount; i++) {
    const offset = i * world.span;
    const gx = 80 + (offset - targetPos.x) * scale;
    const gz = 80 + (offset - targetPos.z) * scale;

    mapCtx.beginPath();
    mapCtx.moveTo(gx, 0);
    mapCtx.lineTo(gx, 160);
    mapCtx.stroke();

    mapCtx.beginPath();
    mapCtx.moveTo(0, gz);
    mapCtx.lineTo(160, gz);
    mapCtx.stroke();
  }

  const mx = 80 + (world.missionMarker.position.x - targetPos.x) * scale;
  const mz = 80 + (world.missionMarker.position.z - targetPos.z) * scale;
  mapCtx.fillStyle = '#f6c945';
  mapCtx.beginPath();
  mapCtx.arc(THREE.MathUtils.clamp(mx, 8, 152), THREE.MathUtils.clamp(mz, 8, 152), 5, 0, Math.PI * 2);
  mapCtx.fill();

  if (waypoint) {
    const wx = 80 + (waypoint.x - targetPos.x) * scale;
    const wz = 80 + (waypoint.z - targetPos.z) * scale;
    mapCtx.fillStyle = '#38bdf8';
    mapCtx.beginPath();
    mapCtx.arc(THREE.MathUtils.clamp(wx, 8, 152), THREE.MathUtils.clamp(wz, 8, 152), 5, 0, Math.PI * 2);
    mapCtx.fill();
  }

  mapCtx.save();
  mapCtx.translate(80, 80);
  mapCtx.rotate(-camYaw);
  mapCtx.fillStyle = '#ffffff';
  mapCtx.beginPath();
  mapCtx.moveTo(0, -7);
  mapCtx.lineTo(5, 6);
  mapCtx.lineTo(0, 3);
  mapCtx.lineTo(-5, 6);
  mapCtx.closePath();
  mapCtx.fill();
  mapCtx.restore();
}

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  if (document.hidden) { clock.getDelta(); return; }
  const rawDt = clock.getDelta();
  const dt = Math.min(rawDt, 0.05);
  trackFps(rawDt);
  vehicleMgr.updateTraffic(dt, activeVehicle);
  if (manualCamTimer > 0) manualCamTimer -= dt;

  // Sorot tombol pintu mobil jika pemain berada di dekat kendaraan
  let nearCar = false;
  if (!activeVehicle) {
    for (const v of vehicleMgr.vehicles) {
      if (player.group.position.distanceTo(v.group.position) < 4.8) {
        nearCar = true;
        break;
      }
    }
  }
  btnDoor.classList.toggle('near-car', nearCar || Boolean(activeVehicle));

  if (!activeVehicle) {
    // Mode Jalan Kaki OneState
    let inputX = joyX;
    let inputY = joyY;
    if (keys['a'] || keys['arrowleft']) inputX -= 1;
    if (keys['d'] || keys['arrowright']) inputX += 1;
    if (keys['w'] || keys['arrowup']) inputY -= 1;
    if (keys['s'] || keys['arrowdown']) inputY += 1;

    const joyMag = Math.hypot(joyX, joyY);
    const autoSprintFromJoy = joyMag > 0.88;
    const sprintActive = isSprinting || autoSprintFromJoy || keys['shift'];

    const forward = new THREE.Vector3(-Math.sin(camYaw), 0, -Math.cos(camYaw));
    const right = new THREE.Vector3(Math.cos(camYaw), 0, -Math.sin(camYaw));
    const moveDir = new THREE.Vector3()
      .addScaledVector(forward, -inputY)
      .addScaledVector(right, inputX);

    if (moveDir.length() > 1) moveDir.normalize();
    player.update(dt, moveDir, sprintActive, world.colliders);
  } else {
    // Mode Mengemudi OneState (Pedal Gas/Rem + Tombol Steer Kiri/Kanan)
    let throttle = 0;
    if (gasHeld || keys['w'] || keys['arrowup']) throttle += 1;
    if (brakeHeld || keys['s'] || keys['arrowdown']) throttle -= 1;

    let steer = 0;
    if (steerLeftHeld || keys['a'] || keys['arrowleft']) steer += 1;
    if (steerRightHeld || keys['d'] || keys['arrowright']) steer -= 1;

    const brakeActive = handbrakeHeld || keys[' '];
    vehicleMgr.updateVehicle(activeVehicle, dt, throttle, steer, brakeActive, world.colliders);
    player.group.position.copy(activeVehicle.group.position);

    // Auto-follow kamera saat mengemudi maju ala OneState jika layar tidak sedang digeser manual
    if (autoFollowCam && manualCamTimer <= 0 && Math.abs(activeVehicle.speed) > 1.5) {
      let diff = activeVehicle.group.rotation.y - camYaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      camYaw += diff * Math.min(1, 3.2 * dt);
    }

    const kmh = Math.abs(Math.round(activeVehicle.speed * 4.2));
    document.getElementById('speedVal').textContent = kmh;
    document.getElementById('gearVal').textContent = activeVehicle.speed < -0.5 ? 'R' : 'D';
  }

  const targetObj = activeVehicle ? activeVehicle.group : player.group;
  const distMult = camMode === 1 ? 1.45 : camMode === 2 ? 0.72 : 1.0;
  const camDist = (activeVehicle ? 7.2 : 3.8) * distMult;
  const camHeight = (activeVehicle ? 2.2 : 1.65) * distMult;

  const desiredCamPos = new THREE.Vector3(
    targetObj.position.x + Math.sin(camYaw) * camDist * Math.cos(camPitch),
    targetObj.position.y + camHeight + Math.sin(camPitch) * camDist,
    targetObj.position.z + Math.cos(camYaw) * camDist * Math.cos(camPitch)
  );

  camera.position.lerp(desiredCamPos, 1 - Math.exp(-10 * dt));
  const lookTarget = targetObj.position.clone().add(new THREE.Vector3(0, activeVehicle ? 1.05 : 1.3, 0));
  camera.lookAt(lookTarget);

  if (targetObj.position.distanceTo(world.missionMarker.position) < 4) {
    document.getElementById('targetDesc').textContent = 'Selesai! Tuning interior terpasang (+ $5.000)';
    world.missionMarker.position.set(-world.span, 0.12, -world.span);
    cash += 5000;
    document.getElementById('moneyVal').textContent = cash.toLocaleString('id-ID').replace(/,/g, ' ');
    showToast('🎉 Misi Target Selesai! +$5.000');
  }

  if (waypoint && Math.hypot(targetObj.position.x - waypoint.x, targetObj.position.z - waypoint.z) < 6) {
    showToast(`✅ Tiba di ${waypoint.name}`);
    waypoint = null;
    world.clearWaypoint();
  }

  drawMinimap(targetObj.position);

  // FOV melebar saat ngebut -> sensasi kecepatan
  const speedRatio = activeVehicle ? Math.min(Math.abs(activeVehicle.speed) / 36, 1) : 0;
  const wantFov = BASE_FOV + speedRatio * 12;
  if (Math.abs(camera.fov - wantFov) > 0.01) {
    camera.fov = THREE.MathUtils.lerp(camera.fov, wantFov, 1 - Math.exp(-4 * dt));
    camera.updateProjectionMatrix();
  }

  _frameTick = (_frameTick + 1) & 1;
  if (_frameTick === 0) updateShadowFocus(targetObj.position);
  updateHeadlights();
  sky.position.copy(camera.position);
  stars.position.copy(camera.position);
  gradePass.uniforms.uTime.value = (gradePass.uniforms.uTime.value + dt * 60) % 1000;
  composer.render(dt);
}

// Bayangan mengikuti pemain, di-snap ke grid texel supaya tidak berkedip saat bergerak
const _lx = new THREE.Vector3();
const _ly = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
let _frameTick = 0;
function updateShadowFocus(focus) {
  const texel = (SHADOW_HALF * 2) / sunLight.shadow.mapSize.x;
  _lx.crossVectors(_up, lightDir).normalize();
  _ly.crossVectors(lightDir, _lx).normalize();
  const a = Math.round(focus.dot(_lx) / texel) * texel;
  const b = Math.round(focus.dot(_ly) / texel) * texel;
  const c = focus.dot(lightDir);
  sunLight.target.position.set(0, 0, 0).addScaledVector(_lx, a).addScaledVector(_ly, b).addScaledVector(lightDir, c);
  sunLight.position.copy(sunLight.target.position).addScaledVector(lightDir, 220);
  sunLight.target.updateMatrixWorld();
}

function updateHeadlights() {
  const on = isNight && activeVehicle;
  headLights.forEach((spot, i) => {
    spot.intensity = on ? 260 : 0;
    if (!on) return;
    const g = activeVehicle.group;
    g.updateMatrixWorld();
    const side = i === 0 ? -0.66 : 0.66;
    spot.position.copy(_hv1.set(side, 0.7, -2.0).applyMatrix4(g.matrixWorld));
    spot.target.position.copy(_hv2.set(side * 0.6, 0.2, -24).applyMatrix4(g.matrixWorld));
    spot.target.updateMatrixWorld();
  });
}

// FPS + resolusi adaptif (hanya turun otomatis bila performa jelek)
const fpsBadge = document.getElementById('fpsBadge');
let fpsFrames = 0;
let fpsTime = 0;
let lowCount = 0;
let highCount = 0;
let sinceStart = 0;
function trackFps(rawDt) {
  sinceStart += rawDt;
  fpsFrames++;
  fpsTime += rawDt;
  if (fpsTime < 1) return;
  const fps = fpsFrames / fpsTime;
  fpsFrames = 0;
  fpsTime = 0;
  if (fpsBadge) fpsBadge.textContent = `${Math.round(fps)} FPS • ${canvas.width}×${canvas.height}`;
  if (qualityPref !== 'auto' || sinceStart < 6) return; // beri waktu kompilasi shader

  const i = QUALITY_ORDER.indexOf(qualityLevel);
  if (fps < 42) { lowCount++; highCount = 0; }
  else if (fps > 56) { highCount++; lowCount = 0; }
  else { lowCount = 0; highCount = 0; }

  if (lowCount >= 2 && i > 0) {
    qualityLevel = QUALITY_ORDER[i - 1];
    autoMax = i - 1;
    lowCount = 0;
    applyQuality();
    showToast(`⚙️ Auto: turun ke ${QUALITY_LEVELS[qualityLevel].label}`);
  } else if (highCount >= 12 && i < autoMax) {
    qualityLevel = QUALITY_ORDER[i + 1];
    highCount = 0;
    applyQuality();
    showToast(`⚙️ Auto: naik ke ${QUALITY_LEVELS[qualityLevel].label}`);
  }
}

// ---------- Panel Pengaturan Grafis ----------
const settingsModal = document.getElementById('settingsModal');
const selQuality = document.getElementById('selQuality');
const chkBloom = document.getElementById('chkBloom');
const chkGrade = document.getElementById('chkGrade');
const chkWet = document.getElementById('chkWet');
const chkFps = document.getElementById('chkFps');

selQuality.value = qualityPref;
chkBloom.checked = bloomOn;
chkGrade.checked = store.get('grade', true);
chkWet.checked = store.get('wet', false);
chkFps.checked = store.get('fps', true);

function applyToggles() {
  bloomPass.enabled = chkBloom.checked;
  gradePass.enabled = chkGrade.checked;
  world.setWet(chkWet.checked);
  fpsBadge.classList.toggle('hidden', !chkFps.checked);
}

selQuality.addEventListener('change', () => {
  qualityPref = selQuality.value;
  store.set('quality', qualityPref);
  if (qualityPref === 'auto') {
    qualityLevel = 'hd';
    autoMax = 1;
  } else {
    qualityLevel = qualityPref;
  }
  applyQuality();
  showToast(`🖥️ ${QUALITY_LEVELS[qualityLevel].label}`);
});
chkBloom.addEventListener('change', () => { store.set('bloom', chkBloom.checked); applyToggles(); });
chkGrade.addEventListener('change', () => { store.set('grade', chkGrade.checked); applyToggles(); });
chkWet.addEventListener('change', () => { store.set('wet', chkWet.checked); applyToggles(); });
chkFps.addEventListener('change', () => { store.set('fps', chkFps.checked); applyToggles(); });
document.getElementById('btnSettings').addEventListener('click', () => settingsModal.classList.remove('hidden'));
document.getElementById('btnCloseSettings').addEventListener('click', () => settingsModal.classList.add('hidden'));

applyPreset(presetKey);
applyToggles();
applyQuality();
animate();

window.addEventListener('resize', applyQuality);
