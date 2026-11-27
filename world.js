import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const TEX_CDN = 'https://raw.githubusercontent.com/mrdoob/three.js/r160/examples/textures/';
// Batasi anisotropy agar sampling tekstur tidak membebani GPU mobile.
const MAX_TEXTURE_ANISOTROPY = 8;


// Detail map prosedural untuk pori beton, noda hujan, sambungan panel, dan variasi roughness.
function createFacadeDetailTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgb(150,150,150)';
  ctx.fillRect(0, 0, size, size);

  // Noise halus dan pori permukaan beton
  for (let i = 0; i < 16000; i++) {
    const x = Math.random() * size, y = Math.random() * size;
    const v = 95 + Math.floor(Math.random() * 115);
    const a = 0.08 + Math.random() * 0.2;
    ctx.fillStyle = `rgba(${v},${v},${v},${a})`;
    const r = Math.random() * 2.2 + 0.35;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }

  // Panel beton arsitektural dan alur air hujan tipis
  ctx.strokeStyle = 'rgba(45,45,45,0.22)';
  ctx.lineWidth = 2;
  for (let x = 0; x <= size; x += 256) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size); ctx.stroke();
  }
  for (let y = 0; y <= size; y += 256) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke();
  }
  for (let i = 0; i < 95; i++) {
    const x = Math.random() * size, y = Math.random() * size;
    const h = 25 + Math.random() * 180;
    const grad = ctx.createLinearGradient(x, y, x + (Math.random()-0.5)*5, y+h);
    grad.addColorStop(0, 'rgba(35,35,35,0.02)');
    grad.addColorStop(1, 'rgba(35,35,35,0.20)');
    ctx.strokeStyle = grad; ctx.lineWidth = 1 + Math.random() * 2;
    ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+(Math.random()-0.5)*5,y+h); ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1.5, 1.5);
  tex.anisotropy = MAX_TEXTURE_ANISOTROPY;
  return tex;
}

function loadPBRTexture(url, repeatX, repeatY, isColor = true) {
  const loader = new THREE.TextureLoader();
  const tex = loader.load(url);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = MAX_TEXTURE_ANISOTROPY;
  if (isColor) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Tekstur Aspal PBR 1024x1024 yang ringan dengan Normal Map & Roughness Map mendalam
function createUltraAsphaltTextures() {
  const w = 512, h = 512;
  const cDiff = document.createElement('canvas'); cDiff.width = w; cDiff.height = h;
  const ctx = cDiff.getContext('2d');

  const cRough = document.createElement('canvas'); cRough.width = w; cRough.height = h;
  const rtx = cRough.getContext('2d');

  const cBump = document.createElement('canvas'); cBump.width = w; cBump.height = h;
  const btx = cBump.getContext('2d');

  ctx.fillStyle = '#20242b';
  ctx.fillRect(0, 0, w, h);

  rtx.fillStyle = 'rgb(190,190,190)';
  rtx.fillRect(0, 0, w, h);

  btx.fillStyle = 'rgb(128,128,128)';
  btx.fillRect(0, 0, w, h);

  // Agregat batu aspal mikro
  for (let i = 0; i < 18000; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const v = 22 + Math.floor(Math.random() * 34);
    ctx.fillStyle = `rgb(${v},${v + 2},${v + 5})`;
    ctx.fillRect(x, y, 2, 2);

    const bv = 95 + Math.floor(Math.random() * 65);
    btx.fillStyle = `rgb(${bv},${bv},${bv})`;
    btx.fillRect(x, y, 2, 2);
  }

  // Jejak ban kendaraan realistis (tire wear tracks) + variasi kilap
  const lanes = [170, 340, 684, 854];
  for (const lx of lanes) {
    const grad = ctx.createLinearGradient(lx - 84, 0, lx + 84, 0);
    grad.addColorStop(0, 'rgba(10,12,16,0)');
    grad.addColorStop(0.5, 'rgba(10,12,16,0.42)');
    grad.addColorStop(1, 'rgba(10,12,16,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(lx - 84, 0, 168, h);

    rtx.fillStyle = 'rgb(112,112,112)';
    rtx.fillRect(lx - 48, 0, 96, h);
  }

  // Tambalan aspal & retakan halus
  ctx.strokeStyle = 'rgba(12, 14, 18, 0.55)';
  ctx.lineWidth = 3;
  for (let c = 0; c < 18; c++) {
    let cx = Math.random() * w;
    let cy = Math.random() * h;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    for (let s = 0; s < 6; s++) {
      cx += (Math.random() - 0.5) * 60;
      cy += Math.random() * 70;
      ctx.lineTo(cx, cy);
    }
    ctx.stroke();
  }

  // Marka jalan ganda kuning tengah
  ctx.fillStyle = '#eab308';
  ctx.fillRect(502, 0, 7, h);
  ctx.fillRect(515, 0, 7, h);

  // Marka putus-putus putih jalur
  ctx.fillStyle = 'rgba(241, 245, 249, 0.92)';
  for (let y = 24; y < h; y += 128) {
    ctx.fillRect(253, y, 6, 58);
    ctx.fillRect(765, y, 6, 58);
  }

  // Bahu jalan & garis tepi
  ctx.fillStyle = '#15181e';
  ctx.fillRect(0, 0, 40, h);
  ctx.fillRect(w - 20, 0, 20, h);
  ctx.fillStyle = 'rgba(248, 250, 252, 0.92)';
  ctx.fillRect(24, 0, 8, h);
  ctx.fillRect(w - 32, 0, 8, h);

  const map = new THREE.CanvasTexture(cDiff);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(1, 28);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = MAX_TEXTURE_ANISOTROPY;

  const roughnessMap = new THREE.CanvasTexture(cRough);
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(1, 28);
  roughnessMap.anisotropy = MAX_TEXTURE_ANISOTROPY;

  const bumpMap = new THREE.CanvasTexture(cBump);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(1, 28);
  bumpMap.anisotropy = MAX_TEXTURE_ANISOTROPY;

  return { map, roughnessMap, bumpMap };
}

// Tekstur Paving Trotoar PBR 512x512 yang ringan dengan Bevel & Nat Beton
function createUltraSidewalkTextures() {
  const w = 1024, h = 1024;
  const cDiff = document.createElement('canvas'); cDiff.width = w; cDiff.height = h;
  const ctx = cDiff.getContext('2d');

  const cBump = document.createElement('canvas'); cBump.width = w; cBump.height = h;
  const btx = cBump.getContext('2d');

  ctx.fillStyle = '#b4bcc8';
  ctx.fillRect(0, 0, w, h);
  btx.fillStyle = 'rgb(175,175,175)';
  btx.fillRect(0, 0, w, h);

  for (let i = 0; i < 9000; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const shade = 158 + Math.floor(Math.random() * 42);
    ctx.fillStyle = `rgb(${shade},${shade + 2},${shade + 6})`;
    ctx.fillRect(x, y, 2, 2);
    btx.fillStyle = `rgb(${shade},${shade},${shade})`;
    btx.fillRect(x, y, 2, 2);
  }

  const step = 64;
  for (let x = 0; x < w; x += step) {
    for (let y = 0; y < h; y += step) {
      const tone = ((x / step + y / step) % 2 === 0) ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)';
      ctx.fillStyle = tone;
      ctx.fillRect(x + 4, y + 4, step - 8, step - 8);
    }
  }

  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 4;
  btx.strokeStyle = 'rgb(45,45,45)';
  btx.lineWidth = 6;

  for (let x = 0; x <= w; x += step) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    btx.beginPath(); btx.moveTo(x, 0); btx.lineTo(x, h); btx.stroke();
  }
  for (let y = 0; y <= h; y += step) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    btx.beginPath(); btx.moveTo(0, y); btx.lineTo(w, y); btx.stroke();
  }

  const map = new THREE.CanvasTexture(cDiff);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(16, 16);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = MAX_TEXTURE_ANISOTROPY;

  const bumpMap = new THREE.CanvasTexture(cBump);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(16, 16);
  bumpMap.anisotropy = MAX_TEXTURE_ANISOTROPY;

  return { map, bumpMap };
}

function createSignTexture(title, subtitle, bgColor, textColor, borderColor) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, 1024, 256);

  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 14;
  ctx.strokeRect(12, 12, 1000, 232);

  ctx.fillStyle = textColor;
  ctx.font = '900 84px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, 512, subtitle ? 102 : 128);

  if (subtitle) {
    ctx.font = '700 34px sans-serif';
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(subtitle, 512, 186);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = MAX_TEXTURE_ANISOTROPY;
  return tex;
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.colliders = [];
    this.streetLights = [];
    this.streetPointLights = [];
    this.windowMaterials = [];
    this.buildingGroups = [];
    this.span = 76;
    this.gridCount = 5;
    this.worldHalfExtent = this.gridCount * this.span + 45;

    this.pois = [
      { id: 'tuning', name: 'Bengkel Tuning', desc: 'Pasang tuning interior & modifikasi kendaraan', x: 76, z: 76, icon: '🔧', color: '#f6c945' },
      { id: 'xero1', name: 'SPBU Xero Gas Utara', desc: 'Pengisian bahan bakar & minimarket 24 jam', x: 38, z: 114, icon: '⛽', color: '#38bdf8' },
      { id: 'police', name: 'Kantor Polisi VCPD', desc: 'Markas kepolisian & pelayanan hukum kota', x: -114, z: -114, icon: '🚔', color: '#60a5fa' },
      { id: 'hospital', name: 'RS Ocean View', desc: 'Pusat medis 24 jam & landasan helikopter', x: 114, z: -114, icon: '🏥', color: '#f87171' },
      { id: 'plaza', name: 'Vice Point Plaza', desc: 'Pusat perbelanjaan & kafe bulevar', x: -114, z: 114, icon: '🛍️', color: '#e879f9' },
      { id: 'tower', name: 'Vice City Tower', desc: 'Distrik bisnis & menara utama pusat kota', x: 228, z: 152, icon: '🏙️', color: '#34d399' }
    ];

    this.sharedBarkMat = this.createBarkMaterial();
    this.sharedPalmLeafMat = this.createPalmFrondMaterial();
    this.sharedCanopyMats = [0x2c6e32, 0x38823c, 0x225728, 0x469143].map(
      (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.68, metalness: 0.03 })
    );

    this.buildEnvironment();
    this.tryLoadCustomCityGLB('models/city.glb');
  }

  createBarkMaterial() {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#5c4738';
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 1200; i++) {
      const bx = Math.random() * 512;
      const by = Math.random() * 512;
      const shade = 40 + Math.floor(Math.random() * 55);
      ctx.fillStyle = `rgb(${shade + 26},${shade + 12},${shade})`;
      ctx.fillRect(bx, by, 4, 28);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 6);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = MAX_TEXTURE_ANISOTROPY;

    return new THREE.MeshStandardMaterial({
      map: tex,
      bumpMap: tex,
      bumpScale: 0.08,
      roughness: 0.9,
      metalness: 0.02
    });
  }

  createPalmFrondMaterial() {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 256, 256);
    grad.addColorStop(0, '#236328');
    grad.addColorStop(0.5, '#348638');
    grad.addColorStop(1, '#4ca348');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);

    ctx.strokeStyle = 'rgba(20, 55, 24, 0.35)';
    ctx.lineWidth = 2;
    for (let y = 0; y < 256; y += 8) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(256, y + 12);
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.58,
      metalness: 0.04,
      side: THREE.DoubleSide
    });
  }

  tryLoadCustomCityGLB(url) {
    const draco = new DRACOLoader();
    draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    const loader = new GLTFLoader();
    loader.setDRACOLoader(draco);

    loader.load(
      url,
      (gltf) => {
        const cityModel = gltf.scene;
        cityModel.traverse((c) => {
          if (c.isMesh) {
            c.castShadow = true;
            c.receiveShadow = true;
          }
        });
        this.scene.add(cityModel);
      },
      undefined,
      () => {}
    );
  }

  _geo(key, factory) {
    if (!this._geoCache) this._geoCache = new Map();
    if (!this._geoCache.has(key)) this._geoCache.set(key, factory());
    return this._geoCache.get(key);
  }
  _mat(key, factory) {
    if (!this._matCache) this._matCache = new Map();
    if (!this._matCache.has(key)) this._matCache.set(key, factory());
    return this._matCache.get(key);
  }

  buildEnvironment() {
    const grassColor = loadPBRTexture(TEX_CDN + 'terrain/grasslight-big.jpg', 75, 75, true);
    const grassNormal = loadPBRTexture(TEX_CDN + 'terrain/grasslight-big-nm.jpg', 75, 75, false);

    const plasterColor = loadPBRTexture(TEX_CDN + 'plaster.jpg', 3, 3, true);
    const plasterNormal = loadPBRTexture(TEX_CDN + 'plaster_normal.jpg', 3, 3, false);

    const brickColor = loadPBRTexture(TEX_CDN + 'brick_diffuse.jpg', 4, 3, true);
    const brickBump = loadPBRTexture(TEX_CDN + 'brick_bump.jpg', 4, 3, false);
    const brickRough = loadPBRTexture(TEX_CDN + 'brick_roughness.jpg', 4, 3, false);

    const waterNormal = loadPBRTexture(TEX_CDN + 'waternormals.jpg', 10, 220, false);

    // Tanah dasar peta
    const groundMat = new THREE.MeshStandardMaterial({
      map: grassColor,
      normalMap: grassNormal,
      normalScale: new THREE.Vector2(0.9, 0.9),
      roughness: 0.92
    });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Jalan raya Ultra-HD 2K
    const asphalt = createUltraAsphaltTextures();
    const roadMat = new THREE.MeshStandardMaterial({
      map: asphalt.map,
      roughnessMap: asphalt.roughnessMap,
      bumpMap: asphalt.bumpMap,
      bumpScale: 0.03,
      normalMap: waterNormal,
      normalScale: new THREE.Vector2(0.05, 0.05),
      roughness: 0.65,
      metalness: 0.16,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1
    });

    this.roadMat = roadMat;
    const roadWidth = 22;
    const roadLength = this.gridCount * this.span * 2 + 60;
    for (let i = -this.gridCount; i <= this.gridCount; i++) {
      const pos = i * this.span;

      const roadZ = new THREE.Mesh(new THREE.BoxGeometry(roadWidth, 0.08, roadLength), roadMat);
      roadZ.position.set(pos, 0.04, 0);
      roadZ.receiveShadow = true;
      this.scene.add(roadZ);

      const roadX = new THREE.Mesh(new THREE.BoxGeometry(roadWidth, 0.08, roadLength), roadMat);
      roadX.rotation.y = Math.PI / 2;
      roadX.position.set(0, 0.045, pos);
      roadX.receiveShadow = true;
      this.scene.add(roadX);

      for (let j = -this.gridCount; j <= this.gridCount; j++) {
        this.createCrosswalk(pos, j * this.span);
        if ((Math.abs(i) + Math.abs(j)) % 2 === 0 && Math.abs(i) <= 3 && Math.abs(j) <= 3) {
          this.createTrafficLightSet(pos, j * this.span);
        }
      }
    }

    const paving = createUltraSidewalkTextures();
    const sidewalkMat = new THREE.MeshStandardMaterial({
      map: paving.map,
      bumpMap: paving.bumpMap,
      bumpScale: 0.06,
      roughness: 0.8,
      metalness: 0.05,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1
    });

    const curbMat = new THREE.MeshStandardMaterial({
      map: plasterColor,
      normalMap: plasterNormal,
      color: 0xcbd5e1,
      roughness: 0.74,
      polygonOffset: true,
      polygonOffsetFactor: 2,
      polygonOffsetUnits: 2
    });

    const materials = {
      brickMat: new THREE.MeshStandardMaterial({
        map: brickColor,
        bumpMap: brickBump,
        bumpScale: 0.12,
        roughnessMap: brickRough,
        roughness: 0.84
      }),
      concreteWarmMat: new THREE.MeshStandardMaterial({
        map: plasterColor,
        normalMap: plasterNormal,
        normalScale: new THREE.Vector2(0.85, 0.85),
        color: 0xeae2d7,
        roughness: 0.7
      }),
      concretePinkMat: new THREE.MeshStandardMaterial({
        map: plasterColor,
        normalMap: plasterNormal,
        normalScale: new THREE.Vector2(0.85, 0.85),
        color: 0xeab8c0,
        roughness: 0.66
      }),
      concreteBlueMat: new THREE.MeshStandardMaterial({
        map: plasterColor,
        normalMap: plasterNormal,
        normalScale: new THREE.Vector2(0.85, 0.85),
        color: 0xd2dce8,
        roughness: 0.64
      }),
      darkSteelMat: new THREE.MeshStandardMaterial({
        color: 0x334155,
        metalness: 0.72,
        roughness: 0.28
      }),
      whiteTrimMat: new THREE.MeshStandardMaterial({
        map: plasterColor,
        normalMap: plasterNormal,
        color: 0xf8fafc,
        roughness: 0.5
      }),
      curtainGlassMat: new THREE.MeshStandardMaterial({
        color: 0x225782,
        metalness: 0.78,
        roughness: 0.1,
        clearcoat: 1.0,
        clearcoatRoughness: 0.06,
        reflectivity: 0.95,
        emissive: 0x000000,
        emissiveIntensity: 0
      }),
      warmGlassMat: new THREE.MeshStandardMaterial({
        color: 0x384b61,
        metalness: 0.72,
        roughness: 0.14,
        clearcoat: 0.9,
        reflectivity: 0.88,
        emissive: 0x000000,
        emissiveIntensity: 0
      })
    };

    // Fasad PBR 4K lokal dengan albedo, normal, roughness, dan micro-bump.
    const facadeDetail = createFacadeDetailTexture();
    // Paket PBR lokal 2K: normal + roughness + albedo mikro beton.
    // Tetap memakai warna dasar tiap bangunan agar identitas arsitekturnya terjaga.
    const concreteNormal = loadPBRTexture('./assets/textures/concrete_normal_2k.jpg', 3, 3, false);
    const concreteRoughness = loadPBRTexture('./assets/textures/concrete_roughness_2k.jpg', 3, 3, false);
    for (const mat of [materials.concreteWarmMat, materials.concretePinkMat,
                       materials.concreteBlueMat, materials.whiteTrimMat]) {
      mat.bumpMap = facadeDetail;
      mat.bumpScale = 0.018;
      mat.normalMap = concreteNormal;
      mat.normalScale = new THREE.Vector2(0.42, 0.42);
      mat.roughnessMap = concreteRoughness;
      mat.roughness = Math.max(mat.roughness || 0.65, 0.68);
      mat.needsUpdate = true;
    }

    this.windowMaterials.push(materials.curtainGlassMat, materials.warmGlassMat);

    const archetypes = ['skyscraper_glass', 'police_hq', 'hospital_center', 'artdeco_hotel', 'brick_lofts', 'shopping_plaza'];
    let idx = 0;

    for (let ix = -this.gridCount; ix < this.gridCount; ix++) {
      for (let iz = -this.gridCount; iz < this.gridCount; iz++) {
        const cx = ix * this.span + this.span / 2;
        const cz = iz * this.span + this.span / 2;
        const blockSize = 52;

        // Trotoar & curb anti-flicker (Z-fighting free)
        const sidewalk = new THREE.Mesh(this._geo('sidewalk', () => new THREE.BoxGeometry(blockSize, 0.32, blockSize)), sidewalkMat);
        sidewalk.position.set(cx, 0.16, cz);
        sidewalk.receiveShadow = true;
        this.scene.add(sidewalk);

        const curb = new THREE.Mesh(this._geo('curb', () => new THREE.BoxGeometry(blockSize + 0.44, 0.30, blockSize + 0.44)), curbMat);
        curb.position.set(cx, 0.15, cz);
        curb.receiveShadow = true;
        this.scene.add(curb);

        if ((ix === 0 && iz === 1) || (ix === -2 && iz === 1)) {
          this.create3DXeroGasStation(cx, cz, materials);
          this.colliders.push({
            minX: cx - 12,
            maxX: cx + 12,
            minZ: cz - 11,
            maxZ: cz + 3
          });
        } else {
          const kind = archetypes[idx % archetypes.length];
          idx++;
          this.buildModularBuilding(cx, cz, kind, materials);
          this.colliders.push({
            minX: cx - 14,
            maxX: cx + 14,
            minZ: cz - 13,
            maxZ: cz + 13
          });
        }

        this.populateBlockStreetProps(cx, cz, blockSize, grassColor, grassNormal, materials, idx);
      }
    }
    this.flushInstancedProps(materials);

    // Penanda Bengkel Tuning (Target Misi)
    const markerGeo = new THREE.CylinderGeometry(2.8, 2.8, 0.15, 32);
    const markerMat = new THREE.MeshBasicMaterial({ color: 0xf6c945, transparent: true, opacity: 0.85 });
    this.missionMarker = new THREE.Mesh(markerGeo, markerMat);
    this.missionMarker.position.set(this.span, 0.12, this.span);
    this.scene.add(this.missionMarker);

    // Pin Waypoint GPS
    const wpGeo = new THREE.CylinderGeometry(2.2, 2.2, 18, 24);
    const wpMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.28 });
    this.waypointBeam = new THREE.Mesh(wpGeo, wpMat);
    this.waypointBeam.visible = false;
    this.scene.add(this.waypointBeam);
  }

  createTrafficLightSet(ix, iz) {
    const poleMat = this._mat('tlPole', () => new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.75, roughness: 0.3 }));
    const postGeo = this._geo('tlPost', () => new THREE.CylinderGeometry(0.11, 0.16, 6.2, 8));
    const armGeo = this._geo('tlArm', () => new THREE.BoxGeometry(4.2, 0.12, 0.12));
    const boxGeo = this._geo('tlBox', () => new THREE.BoxGeometry(0.38, 1.05, 0.32));
    const bulbGeo = this._geo('tlBulb', () => new THREE.SphereGeometry(0.1, 6, 6));
    const redMat = this._mat('tlRed', () => new THREE.MeshBasicMaterial({ color: 0xef4444 }));
    const yelMat = this._mat('tlYel', () => new THREE.MeshBasicMaterial({ color: 0xfacc15 }));
    const grnMat = this._mat('tlGrn', () => new THREE.MeshBasicMaterial({ color: 0x22c55e }));
    const corners = [
      [ix + 11.8, iz + 11.8, 0],
      [ix - 11.8, iz - 11.8, Math.PI]
    ];

    for (const [px, pz, rot] of corners) {
      const g = new THREE.Group();
      const post = new THREE.Mesh(postGeo, poleMat);
      post.position.y = 3.1;
      post.castShadow = true;
      g.add(post);

      const arm = new THREE.Mesh(armGeo, poleMat);
      arm.position.set(-1.9, 6.0, 0);
      g.add(arm);

      const box = new THREE.Mesh(boxGeo, poleMat);
      box.position.set(-3.4, 5.65, 0);
      g.add(box);

      const red = new THREE.Mesh(bulbGeo, redMat);
      red.position.set(-3.4, 5.95, 0.16);
      const yel = new THREE.Mesh(bulbGeo, yelMat);
      yel.position.set(-3.4, 5.65, 0.16);
      const grn = new THREE.Mesh(bulbGeo, grnMat);
      grn.position.set(-3.4, 5.35, 0.16);
      g.add(red, yel, grn);

      g.position.set(px, 0.3, pz);
      g.rotation.y = rot;
      this.scene.add(g);
    }
  }

  setWaypoint(x, z) {
    if (!this.waypointBeam) return;
    this.waypointBeam.position.set(x, 9, z);
    this.waypointBeam.visible = true;
  }

  clearWaypoint() {
    if (this.waypointBeam) this.waypointBeam.visible = false;
  }

  createCrosswalk(ix, iz) {
    const stripeMat = this._mat('cwStripe', () => new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.68 }));
    const geoZ = this._geo('cwZ', () => new THREE.BoxGeometry(1.05, 0.02, 3.4));
    const geoX = this._geo('cwX', () => new THREE.BoxGeometry(3.4, 0.02, 1.05));
    for (let s = -7; s <= 7; s += 2.3) {
      const s1 = new THREE.Mesh(geoZ, stripeMat);
      s1.position.set(ix + s, 0.095, iz + 13.2);
      this.scene.add(s1);

      const s2 = new THREE.Mesh(geoZ, stripeMat);
      s2.position.set(ix + s, 0.095, iz - 13.2);
      this.scene.add(s2);

      const s3 = new THREE.Mesh(geoX, stripeMat);
      s3.position.set(ix + 13.2, 0.095, iz + s);
      this.scene.add(s3);

      const s4 = new THREE.Mesh(geoX, stripeMat);
      s4.position.set(ix - 13.2, 0.095, iz + s);
      this.scene.add(s4);
    }
  }

  buildModularBuilding(cx, cz, kind, m) {
    const g = new THREE.Group();

    const configs = {
      skyscraper_glass: {
        podiumW: 25, podiumD: 23, podiumH: 7.5,
        towerW: 19, towerD: 17, towerH: 34,
        wallMat: m.concreteBlueMat, trimMat: m.whiteTrimMat, accentColor: 0x0ea5e9,
        sign: ['VICE CITY TOWER', 'FINANCIAL & PENTHOUSE', '#0c4a6e', '#ffffff', '#38bdf8'],
        hasCrown: true
      },
      police_hq: {
        podiumW: 26, podiumD: 22, podiumH: 6.5,
        towerW: 22, towerD: 18, towerH: 13.5,
        wallMat: m.concreteBlueMat, trimMat: m.whiteTrimMat, accentColor: 0x1d4ed8,
        sign: ['VCPD POLICE HQ', 'LAW ENFORCEMENT PRECINCT', '#1e3a8a', '#ffffff', '#60a5fa'],
        hasCrown: false
      },
      hospital_center: {
        podiumW: 27, podiumD: 23, podiumH: 7.0,
        towerW: 21, towerD: 18, towerH: 18.5,
        wallMat: m.whiteTrimMat, trimMat: m.concreteBlueMat, accentColor: 0xdc2626,
        sign: ['+ OCEAN VIEW HOSPITAL', '24H TRAUMA & MEDICAL CENTER', '#f8fafc', '#dc2626', '#ef4444'],
        hasHelipad: true
      },
      artdeco_hotel: {
        podiumW: 24, podiumD: 22, podiumH: 6.5,
        towerW: 19, towerD: 17, towerH: 23,
        wallMat: m.concretePinkMat, trimMat: m.whiteTrimMat, accentColor: 0x14b8a6,
        sign: ['OCEAN DRIVE HOTEL', 'LUXURY SUITES & SPA', '#134e4a', '#fbcfe8', '#2dd4bf'],
        hasCrown: true
      },
      brick_lofts: {
        podiumW: 25, podiumD: 21, podiumH: 6.0,
        towerW: 22, towerD: 18, towerH: 15.5,
        wallMat: m.brickMat, trimMat: m.concreteWarmMat, accentColor: 0xd97706,
        sign: ['DOWNTOWN LOFTS', 'RESIDENTIAL APARTMENTS', '#292524', '#fef3c7', '#f59e0b'],
        hasCrown: false
      },
      shopping_plaza: {
        podiumW: 27, podiumD: 23, podiumH: 8.0,
        towerW: 20, towerD: 17, towerH: 14.5,
        wallMat: m.concreteWarmMat, trimMat: m.whiteTrimMat, accentColor: 0xdb2777,
        sign: ['VICE POINT PLAZA', 'DESIGNER BOUTIQUES & CAFE', '#4a044e', '#f9a8d4', '#e879f9'],
        hasCrown: false
      }
    };

    const cfg = configs[kind];
    const accentMat = new THREE.MeshStandardMaterial({ color: cfg.accentColor, roughness: 0.35, metalness: 0.25 });

    const podiumCore = new THREE.Mesh(
      new THREE.BoxGeometry(cfg.podiumW - 1.2, cfg.podiumH, cfg.podiumD - 1.2),
      m.curtainGlassMat
    );
    podiumCore.position.y = 0.32 + cfg.podiumH / 2;
    podiumCore.castShadow = true;
    podiumCore.receiveShadow = true;
    g.add(podiumCore);

    const podiumRoof = new THREE.Mesh(
      new THREE.BoxGeometry(cfg.podiumW + 0.8, 0.65, cfg.podiumD + 0.8),
      cfg.trimMat
    );
    podiumRoof.position.y = 0.32 + cfg.podiumH;
    podiumRoof.castShadow = true;
    podiumRoof.receiveShadow = true;
    g.add(podiumRoof);

    const colsX = 5;
    for (let i = 0; i <= colsX; i++) {
      const px = -cfg.podiumW / 2 + (i * cfg.podiumW) / colsX;
      for (const pz of [-cfg.podiumD / 2, cfg.podiumD / 2]) {
        const colMesh = new THREE.Mesh(new THREE.BoxGeometry(0.85, cfg.podiumH, 0.85), cfg.wallMat);
        colMesh.position.set(px, 0.32 + cfg.podiumH / 2, pz);
        colMesh.castShadow = true;
        colMesh.receiveShadow = true;
        g.add(colMesh);
      }
    }
    for (let j = 1; j < 4; j++) {
      const pz = -cfg.podiumD / 2 + (j * cfg.podiumD) / 4;
      for (const px of [-cfg.podiumW / 2, cfg.podiumW / 2]) {
        const colMesh = new THREE.Mesh(new THREE.BoxGeometry(0.85, cfg.podiumH, 0.85), cfg.wallMat);
        colMesh.position.set(px, 0.32 + cfg.podiumH / 2, pz);
        colMesh.castShadow = true;
        colMesh.receiveShadow = true;
        g.add(colMesh);
      }
    }

    for (const side of [-1, 1]) {
      const canopy = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.4, 2.8), accentMat);
      canopy.position.set(0, 4.1, side * (cfg.podiumD / 2 + 1.2));
      canopy.castShadow = true;
      g.add(canopy);
    }

    const towerBaseY = 0.32 + cfg.podiumH;
    const glassCore = new THREE.Mesh(
      new THREE.BoxGeometry(cfg.towerW - 0.9, cfg.towerH, cfg.towerD - 0.9),
      kind === 'brick_lofts' ? m.warmGlassMat : m.curtainGlassMat
    );
    glassCore.position.y = towerBaseY + cfg.towerH / 2;
    glassCore.castShadow = true;
    glassCore.receiveShadow = true;
    g.add(glassCore);

    const wingW = cfg.towerW * 0.24;
    const wingD = cfg.towerD * 0.24;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const cornerWing = new THREE.Mesh(
          new THREE.BoxGeometry(wingW, cfg.towerH + 0.4, wingD),
          cfg.wallMat
        );
        cornerWing.position.set(
          sx * (cfg.towerW / 2 - wingW / 2 + 0.15),
          towerBaseY + cfg.towerH / 2,
          sz * (cfg.towerD / 2 - wingD / 2 + 0.15)
        );
        cornerWing.castShadow = true;
        cornerWing.receiveShadow = true;
        g.add(cornerWing);
      }
    }

    const floorStep = 3.5;
    const numFloors = Math.floor(cfg.towerH / floorStep);
    for (let f = 1; f <= numFloors; f++) {
      const fy = towerBaseY + f * floorStep;
      const slab = new THREE.Mesh(
        new THREE.BoxGeometry(cfg.towerW + 0.35, 0.28, cfg.towerD + 0.35),
        cfg.trimMat
      );
      slab.position.y = fy;
      slab.castShadow = true;
      slab.receiveShadow = true;
      g.add(slab);

      if ((kind === 'artdeco_hotel' || kind === 'brick_lofts' || kind === 'skyscraper_glass') && f < numFloors) {
        for (const side of [-1, 1]) {
          const balc = new THREE.Mesh(new THREE.BoxGeometry(cfg.towerW * 0.42, 0.2, 1.4), cfg.trimMat);
          balc.position.set(0, fy - floorStep + 0.15, side * (cfg.towerD / 2 + 0.55));
          balc.castShadow = true;
          g.add(balc);

          const rail = new THREE.Mesh(new THREE.BoxGeometry(cfg.towerW * 0.42, 0.9, 0.1), m.curtainGlassMat);
          rail.position.set(0, fy - floorStep + 0.65, side * (cfg.towerD / 2 + 1.18));
          g.add(rail);
        }
      }
    }

    for (const mx of [-3.2, 0, 3.2]) {
      for (const side of [-1, 1]) {
        const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.24, cfg.towerH, 0.35), m.darkSteelMat);
        mullion.position.set(mx, towerBaseY + cfg.towerH / 2, side * (cfg.towerD / 2 - 0.35));
        g.add(mullion);
      }
    }

    const signTex = createSignTexture(cfg.sign[0], cfg.sign[1], cfg.sign[2], cfg.sign[3], cfg.sign[4]);
    const signMat = new THREE.MeshStandardMaterial({
      map: signTex,
      emissiveMap: signTex,
      emissive: 0xffffff,
      emissiveIntensity: 0.3,
      roughness: 0.25
    });
    for (const side of [-1, 1]) {
      const signBox = new THREE.Mesh(new THREE.BoxGeometry(11.5, 1.9, 0.45), signMat);
      signBox.position.set(0, towerBaseY + 1.2, side * (cfg.podiumD / 2 + 0.35));
      signBox.castShadow = true;
      g.add(signBox);
    }

    const roofTopY = towerBaseY + cfg.towerH;
    const parapet = new THREE.Mesh(new THREE.BoxGeometry(cfg.towerW + 0.7, 0.9, cfg.towerD + 0.7), cfg.trimMat);
    parapet.position.y = roofTopY + 0.45;
    parapet.castShadow = true;
    g.add(parapet);

    if (cfg.hasCrown) {
      const crownH = 5.2;
      const crown = new THREE.Mesh(new THREE.BoxGeometry(cfg.towerW * 0.58, crownH, cfg.towerD * 0.58), m.curtainGlassMat);
      crown.position.y = roofTopY + crownH / 2;
      crown.castShadow = true;
      g.add(crown);

      const crownCap = new THREE.Mesh(new THREE.BoxGeometry(cfg.towerW * 0.62, 0.4, cfg.towerD * 0.62), accentMat);
      crownCap.position.y = roofTopY + crownH;
      g.add(crownCap);

      const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.32, 8.0, 8), m.darkSteelMat);
      spire.position.y = roofTopY + crownH + 4.0;
      g.add(spire);
    } else if (cfg.hasHelipad) {
      const pad = new THREE.Mesh(
        new THREE.CylinderGeometry(5.6, 5.9, 0.35, 24),
        new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.75 })
      );
      pad.position.y = roofTopY + 0.95;
      g.add(pad);

      const yellowMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
      const h1 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.38, 3.6), yellowMat);
      h1.position.set(-1.1, roofTopY + 0.97, 0);
      const h2 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.38, 3.6), yellowMat);
      h2.position.set(1.1, roofTopY + 0.97, 0);
      const h3 = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.38, 0.7), yellowMat);
      h3.position.set(0, roofTopY + 0.97, 0);
      g.add(h1, h2, h3);
    } else {
      const hvac = new THREE.Mesh(new THREE.BoxGeometry(3.8, 1.6, 2.8), cfg.trimMat);
      hvac.position.set(-3.2, roofTopY + 1.2, 2.2);
      hvac.castShadow = true;
      g.add(hvac);
    }

    g.position.set(cx, 0, cz);
    this.scene.add(g);
    this.buildingGroups.push(g);
  }

  create3DXeroGasStation(cx, cz, m) {
    const group = new THREE.Group();
    const blueMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.35, metalness: 0.25 });
    const redMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.35, metalness: 0.25 });

    const store = new THREE.Mesh(new THREE.BoxGeometry(18, 6.2, 8.8), m.whiteTrimMat);
    store.position.set(0, 3.42, -6.2);
    store.castShadow = true;
    store.receiveShadow = true;
    group.add(store);

    const glass = new THREE.Mesh(new THREE.BoxGeometry(13.5, 3.5, 0.3), m.curtainGlassMat);
    glass.position.set(0, 2.3, -1.68);
    group.add(glass);

    const stripBlue = new THREE.Mesh(new THREE.BoxGeometry(18.4, 0.55, 9.2), blueMat);
    stripBlue.position.set(0, 5.8, -6.2);
    const stripRed = new THREE.Mesh(new THREE.BoxGeometry(18.4, 0.45, 9.2), redMat);
    stripRed.position.set(0, 6.3, -6.2);
    group.add(stripBlue, stripRed);

    const signTex = createSignTexture('XERO GAS', '24H FUEL & CONVENIENCE', '#f8fafc', '#0284c7', '#ef4444');
    const signMesh = new THREE.Mesh(
      new THREE.BoxGeometry(9.0, 1.8, 0.45),
      new THREE.MeshStandardMaterial({ map: signTex, emissiveMap: signTex, emissive: 0xffffff, emissiveIntensity: 0.3 })
    );
    signMesh.position.set(0, 5.5, -1.55);
    group.add(signMesh);

    const canopy = new THREE.Mesh(new THREE.BoxGeometry(18.5, 0.75, 11.0), m.whiteTrimMat);
    canopy.position.set(0, 6.5, 5.8);
    canopy.castShadow = true;
    const cRed = new THREE.Mesh(new THREE.BoxGeometry(18.8, 0.48, 11.3), redMat);
    cRed.position.set(0, 6.95, 5.8);
    const cBlue = new THREE.Mesh(new THREE.BoxGeometry(18.8, 0.42, 11.3), blueMat);
    cBlue.position.set(0, 7.4, 5.8);
    group.add(canopy, cRed, cBlue);

    const bollardMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 });
    for (const px of [-6.5, 6.5]) {
      for (const pz of [2.4, 9.2]) {
        const pil = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 6.2, 12), m.darkSteelMat);
        pil.position.set(px, 3.4, pz);
        pil.castShadow = true;
        const guard = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.48, 1.1, 12), bollardMat);
        guard.position.set(px, 0.85, pz);
        group.add(pil, guard);
      }
    }

    const screenMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    for (const dx of [-3.5, 3.5]) {
      const island = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.25, 7.0), m.brickMat);
      island.position.set(dx, 0.44, 5.8);
      group.add(island);

      for (const dz of [4.0, 7.6]) {
        const pump = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.3, 0.85), m.darkSteelMat);
        pump.position.set(dx, 1.65, dz);
        pump.castShadow = true;
        const top = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.45, 0.9), redMat);
        top.position.set(dx, 2.95, dz);
        const scr = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.45, 0.92), screenMat);
        scr.position.set(dx, 2.1, dz);
        group.add(pump, top, scr);
      }
    }

    group.position.set(cx, 0, cz);
    this.scene.add(group);
  }

  populateBlockStreetProps(cx, cz, blockSize, grassColor, grassNormal, m, blockSeed = 0) {
    if (!this._propInstances) {
      this._propInstances = {
        borders: [],
        turfs: [],
        hydrants: [],
        benchSeats: [],
        benchBacks: [],
        poles: [],
        arms: [],
        bulbs: [],
        palmTrunks: [],
        palmFronds: [],
        treeTrunks: [],
        treeBranches: [],
        treeCanopies: [[], [], [], []]
      };
      this._planterMat = new THREE.MeshStandardMaterial({
        map: grassColor,
        normalMap: grassNormal,
        roughness: 0.9
      });
    }

    const half = blockSize / 2;
    const corners = [
      [cx - half + 4.5, cz - half + 4.5],
      [cx + half - 4.5, cz - half + 4.5],
      [cx - half + 4.5, cz + half - 4.5],
      [cx + half - 4.5, cz + half - 4.5]
    ];

    for (const [px, pz] of corners) {
      this._propInstances.borders.push({ x: px, y: 0.43, z: pz });
      this._propInstances.turfs.push({ x: px, y: 0.45, z: pz });
      this.createRealisticTree(px, pz, blockSeed + Math.round(Math.abs(px + pz)));
    }

    this.createStreetLight(cx + half - 1.2, cz + half - 8.5);
    this.createStreetLight(cx - half + 1.2, cz - half + 8.5);

    this._propInstances.hydrants.push({ x: cx + half - 1.5, y: 0.75, z: cz + half - 2.2 });
    this._propInstances.benchSeats.push({ x: cx - 7.5, y: 0.76, z: cz + half - 2.4 });
    this._propInstances.benchBacks.push({ x: cx - 7.5, y: 1.06, z: cz + half - 2.7 });
  }

  createRealisticTree(x, z, seed = 0) {
    const isPalm = (seed % 2 === 0);
    const rotY = (seed * 1.13) % (Math.PI * 2);
    const scale = 0.92 + (seed % 5) * 0.05;

    if (isPalm) {
      this._propInstances.palmTrunks.push({ x, y: 0.55, z, rotY, scale });
      this._propInstances.palmFronds.push({ x, y: 0.55, z, rotY, scale });
    } else {
      this._propInstances.treeTrunks.push({ x, y: 0.55, z, rotY, scale });
      this._propInstances.treeBranches.push({ x, y: 0.55, z, rotY, scale });
      this._propInstances.treeCanopies[seed % 4].push({ x, y: 0.55, z, rotY, scale });
    }
  }

  createStreetLight(x, z) {
    const dir = x > 0 ? -1 : 1;
    this._propInstances.poles.push({ x, y: 3.8, z });
    this._propInstances.arms.push({ x: x + dir * 0.95, y: 7.5, z });
    this._propInstances.bulbs.push({ x: x + dir * 1.85, y: 7.42, z });
  }

  flushInstancedProps(materials) {
    const inst = this._propInstances;
    if (!inst) return;

    const dummy = new THREE.Object3D();
    const buildInst = (geo, mat, list, castShadow = false, receiveShadow = false, setupFn = null) => {
      if (!list || list.length === 0) return null;
      const mesh = new THREE.InstancedMesh(geo, mat, list.length);
      mesh.castShadow = castShadow;
      mesh.receiveShadow = receiveShadow;
      for (let i = 0; i < list.length; i++) {
        const item = list[i];
        dummy.position.set(item.x, item.y, item.z);
        dummy.rotation.set(0, item.rotY || 0, 0);
        const s = item.scale || 1;
        dummy.scale.set(s, s, s);
        if (setupFn) setupFn(dummy, item, i);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      this.scene.add(mesh);
      return mesh;
    };

    // Planters, hydrants, benches (1 draw call per type!)
    buildInst(new THREE.BoxGeometry(4.3, 0.22, 4.3), materials.whiteTrimMat, inst.borders, false, true);
    buildInst(new THREE.BoxGeometry(3.7, 0.26, 3.7), this._planterMat, inst.turfs, false, true);

    const hydrantMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, metalness: 0.45, roughness: 0.32 });
    buildInst(new THREE.CylinderGeometry(0.18, 0.22, 0.85, 8), hydrantMat, inst.hydrants, false, false);

    const woodMat = new THREE.MeshStandardMaterial({ color: 0x854d0e, roughness: 0.72 });
    buildInst(new THREE.BoxGeometry(2.2, 0.12, 0.65), woodMat, inst.benchSeats, false, false);
    buildInst(new THREE.BoxGeometry(2.2, 0.55, 0.1), woodMat, inst.benchBacks, false, false);

    // Street lights (all ~200 street lights rendered in just 3 draw calls!)
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.75, roughness: 0.25 });
    buildInst(new THREE.CylinderGeometry(0.08, 0.14, 7.6, 8), poleMat, inst.poles, true, false);
    buildInst(new THREE.BoxGeometry(2.1, 0.1, 0.1), poleMat, inst.arms, false, false);

    this.streetLightBulbMat = new THREE.MeshBasicMaterial({ color: 0xffedd5 });
    this.streetLightInstanced = buildInst(new THREE.BoxGeometry(0.55, 0.12, 0.25), this.streetLightBulbMat, inst.bulbs, false, false);

    // Merged Palm Trunk + Merged Palm Crown (all ~200 palms in just 2 draw calls!)
    const palmCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.12, 3.3, 0.08),
      new THREE.Vector3(0.25, 6.8, 0.16),
      new THREE.Vector3(0.32, 9.8, 0.22)
    ]);
    const palmTrunkGeo = new THREE.TubeGeometry(palmCurve, 12, 0.24, 8, false);
    buildInst(palmTrunkGeo, this.sharedBarkMat, inst.palmTrunks, true, true);

    // Build single merged BufferGeometry for all fronds of one palm crown
    const tipPos = palmCurve.getPoint(1);
    const frondGeos = [];
    const frondCount = 12;
    for (let i = 0; i < frondCount; i++) {
      const angle = (i * Math.PI * 2) / frondCount;
      const droop = i % 2 === 0 ? 0.68 : 0.42;
      const fCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0.88, 1.4),
        new THREE.Vector3(0, 0.32 - droop, 2.85),
        new THREE.Vector3(0, -0.72 - droop, 4.0)
      ]);
      const mRot = new THREE.Matrix4().makeRotationY(angle);
      const mTrans = new THREE.Matrix4().makeTranslation(tipPos.x, tipPos.y, tipPos.z);
      const mBase = new THREE.Matrix4().multiplyMatrices(mTrans, mRot);

      const rachis = new THREE.TubeGeometry(fCurve, 8, 0.045, 5, false);
      rachis.applyMatrix4(mBase);
      frondGeos.push(rachis);

      for (let s = 1; s <= 8; s++) {
        const t = s / 9;
        const pt = fCurve.getPoint(t);
        const leafletLen = Math.sin(t * Math.PI) * 1.12;
        for (const side of [-1, 1]) {
          const leaf = new THREE.BoxGeometry(leafletLen, 0.02, 0.24);
          const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, side * 0.22, side * -0.3));
          const lm = new THREE.Matrix4().compose(
            new THREE.Vector3(side * (leafletLen * 0.45), pt.y - 0.04, pt.z),
            q,
            new THREE.Vector3(1, 1, 1)
          );
          leaf.applyMatrix4(lm);
          leaf.applyMatrix4(mBase);
          frondGeos.push(leaf);
        }
      }
    }
    const mergedPalmCrownGeo = this._mergeSimpleGeos(frondGeos);
    buildInst(mergedPalmCrownGeo, this.sharedPalmLeafMat, inst.palmFronds, true, false);

    // Merged Oak/Shade Tree Trunks + Canopies (all ~200 shade trees in 5 draw calls!)
    const treeTrunkGeo = new THREE.CylinderGeometry(0.22, 0.4, 4.3, 8);
    treeTrunkGeo.translate(0, 2.15, 0);
    buildInst(treeTrunkGeo, this.sharedBarkMat, inst.treeTrunks, true, true);

    const canopyGeos = [];
    const clusters = [
      { x: 0.0, y: 6.5, z: 0.0, r: 2.2 },
      { x: 1.5, y: 5.55, z: 0.75, r: 1.6 },
      { x: -1.5, y: 5.65, z: -0.65, r: 1.65 },
      { x: 0.35, y: 5.85, z: -1.5, r: 1.55 },
      { x: -0.45, y: 7.4, z: 0.45, r: 1.4 }
    ];
    for (const cl of clusters) {
      const g = new THREE.IcosahedronGeometry(cl.r, 1);
      g.scale(1.15, 0.85, 1.15);
      g.translate(cl.x, cl.y, cl.z);
      canopyGeos.push(g);
    }
    const mergedCanopyGeo = this._mergeSimpleGeos(canopyGeos);
    for (let c = 0; c < 4; c++) {
      buildInst(mergedCanopyGeo, this.sharedCanopyMats[c], inst.treeCanopies[c], true, true);
    }
  }

  _mergeSimpleGeos(geos) {
    // Lightweight non-indexed geometry merger so no extra addon import is needed
    const nonIndexed = geos.map((g) => (g.index ? g.toNonIndexed() : g));
    let totalVerts = 0;
    for (const g of nonIndexed) totalVerts += g.attributes.position.count;
    const pos = new Float32Array(totalVerts * 3);
    const norm = new Float32Array(totalVerts * 3);
    const uv = new Float32Array(totalVerts * 2);
    let offset = 0;
    for (const g of nonIndexed) {
      const p = g.attributes.position.array;
      const n = g.attributes.normal ? g.attributes.normal.array : null;
      const u = g.attributes.uv ? g.attributes.uv.array : null;
      pos.set(p, offset * 3);
      if (n) norm.set(n, offset * 3);
      if (u) uv.set(u, offset * 2);
      offset += g.attributes.position.count;
      g.dispose();
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(norm, 3));
    out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    return out;
  }

  updateStreaming(playerPos) {
    if (!this.buildingGroups) return;
    const maxDistSq = 310 * 310;
    for (let i = 0; i < this.buildingGroups.length; i++) {
      const g = this.buildingGroups[i];
      const dx = g.position.x - playerPos.x;
      const dz = g.position.z - playerPos.z;
      g.visible = (dx * dx + dz * dz) <= maxDistSq;
    }
  }

  setNightMode(isNight) {
    // Nilai warna > 1 (HDR) supaya lampu jalan benar-benar menyala dan memicu bloom
    if (this.streetLightBulbMat) {
      this.streetLightBulbMat.color.setHex(isNight ? 0xfef08a : 0x94a3b8);
      if (isNight) this.streetLightBulbMat.color.multiplyScalar(5);
    }
    this.windowMaterials.forEach((m) => {
      m.emissive.setHex(isNight ? 0xfde68a : 0x000000);
      m.emissiveIntensity = isNight ? 0.85 : 0;
    });
  }

  // Aspal basah: lebih mengilap, memantulkan langit dan lampu
  setWet(wet) {
    if (!this.roadMat) return;
    this.roadMat.roughness = wet ? 0.3 : 0.65;
    this.roadMat.metalness = wet ? 0.35 : 0.16;
    this.roadMat.envMapIntensity = wet ? 1.7 : 1.0;
    this.roadMat.normalScale.set(wet ? 0.12 : 0.05, wet ? 0.12 : 0.05);
  }
}
