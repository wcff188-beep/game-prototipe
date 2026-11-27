import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const REMOTE_HUMAN_GLB = 'https://raw.githubusercontent.com/mrdoob/three.js/r160/examples/models/gltf/Soldier.glb';

export class PlayerController {
  constructor(scene, onAssetLoaded) {
    this.scene = scene;
    this.onAssetLoaded = onAssetLoaded;
    this.group = new THREE.Group();
    this.modelRoot = null;
    this.mixer = null;
    this.actions = {};
    this.activeAction = null;
    this.speed = 0;

    // Fisika vertikal (lompat & jongkok ala OneState)
    this.groundY = 0.08;
    this.velY = 0;
    this.isGrounded = true;
    this.isCrouching = false;

    this.buildFallbackCapsule();
    this.loadReal3DCharacter();

    this.group.position.set(0, this.groundY, 4);
    this.scene.add(this.group);
  }

  buildFallbackCapsule() {
    this.fallbackMesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.28, 1.1, 8, 16),
      new THREE.MeshStandardMaterial({ color: 0x2b4c3b, roughness: 0.7 })
    );
    this.fallbackMesh.position.y = 0.85;
    this.fallbackMesh.castShadow = true;
    this.group.add(this.fallbackMesh);
  }

  loadReal3DCharacter() {
    const loader = new GLTFLoader();

    const applyCharacterModel = (gltf) => {
      if (this.fallbackMesh) {
        this.group.remove(this.fallbackMesh);
        this.fallbackMesh = null;
      }

      const model = gltf.scene;
      model.scale.set(1.05, 1.05, 1.05);
      model.rotation.y = Math.PI;
      this.modelRoot = model;

      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      this.group.add(model);

      if (gltf.animations && gltf.animations.length > 0) {
        this.mixer = new THREE.AnimationMixer(model);
        gltf.animations.forEach((clip) => {
          const name = clip.name.toLowerCase();
          this.actions[name] = this.mixer.clipAction(clip);
        });

        const idleClip = this.actions['idle'] || Object.values(this.actions)[0];
        if (idleClip) {
          idleClip.play();
          this.activeAction = idleClip;
        }
      }

      if (this.onAssetLoaded) this.onAssetLoaded('character');
    };

    loader.load(
      'models/player.glb',
      applyCharacterModel,
      undefined,
      () => {
        loader.load(
          REMOTE_HUMAN_GLB,
          applyCharacterModel,
          undefined,
          () => {
            if (this.onAssetLoaded) this.onAssetLoaded('character');
          }
        );
      }
    );
  }

  jump() {
    if (this.isGrounded) {
      this.velY = 6.8;
      this.isGrounded = false;
      this.isCrouching = false;
      return true;
    }
    return false;
  }

  toggleCrouch() {
    this.isCrouching = !this.isCrouching;
    return this.isCrouching;
  }

  fadeToAction(name, duration = 0.2) {
    const next = this.actions[name];
    if (!next || next === this.activeAction) return;
    if (this.activeAction) this.activeAction.fadeOut(duration);
    next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(duration).play();
    this.activeAction = next;
  }

  update(dt, moveDir, isSprinting, colliders) {
    if (!this.isGrounded || this.group.position.y > this.groundY) {
      this.velY -= 19.5 * dt;
      this.group.position.y += this.velY * dt;
      if (this.group.position.y <= this.groundY) {
        this.group.position.y = this.groundY;
        this.velY = 0;
        this.isGrounded = true;
      }
    }

    const targetScaleY = this.isCrouching ? 0.72 : 1.05;
    if (this.modelRoot) {
      this.modelRoot.scale.y = THREE.MathUtils.lerp(this.modelRoot.scale.y, targetScaleY, 12 * dt);
    } else if (this.fallbackMesh) {
      this.fallbackMesh.scale.y = THREE.MathUtils.lerp(this.fallbackMesh.scale.y, this.isCrouching ? 0.68 : 1.0, 12 * dt);
    }

    const baseMoveSpeed = this.isCrouching ? 2.5 : (isSprinting ? 10.8 : 4.8);
    const targetSpeed = moveDir.length() > 0.05 ? baseMoveSpeed : 0;
    this.speed = THREE.MathUtils.lerp(this.speed, targetSpeed, 11 * dt);

    if (this.speed > 0.25 && moveDir.length() > 0.05) {
      const targetAngle = Math.atan2(moveDir.x, moveDir.z);
      let diff = targetAngle - this.group.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.group.rotation.y += diff * Math.min(1, 14 * dt);

      const nextX = this.group.position.x + Math.sin(targetAngle) * this.speed * dt;
      const nextZ = this.group.position.z + Math.cos(targetAngle) * this.speed * dt;

      if (!this.checkCollision(nextX, this.group.position.z, colliders)) {
        this.group.position.x = nextX;
      }
      if (!this.checkCollision(this.group.position.x, nextZ, colliders)) {
        this.group.position.z = nextZ;
      }

      if (isSprinting && !this.isCrouching && this.actions['run']) {
        this.fadeToAction('run', 0.18);
      } else if (this.actions['walk']) {
        this.fadeToAction('walk', 0.18);
      }
    } else if (this.actions['idle']) {
      this.fadeToAction('idle', 0.22);
    }

    if (this.mixer) this.mixer.update(dt);
  }

  checkCollision(x, z, colliders) {
    const r = 0.45;
    for (const c of colliders) {
      if (x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ) return true;
    }
    return false;
  }
}

// ---------- Sistem NPC Realistis (Rigged 3D Human GLTF) Dengan Tekstur Pakaian Dari Sheet ----------
const NPC_DIALOGUES = [
  ['Proyek gedung di blok ini lancar!', 'Pastikan pakai helm keselamatan ya.'],
  ['Halo bro, apa kabar?', 'Baik! Lagi santai di trotoar Vice City.'],
  ['Mobil sport tadi keren banget!', 'Iya, baru keluar dari bengkel.'],
  ['Hati-hati di persimpangan depan.', 'Siap, lalu lintas lagi ramai.'],
  ['Mau ke Vice Point Plaza?', 'Nanti sore ketemu di sana ya!'],
  ['Cuaca Vice City cerah hari ini.', 'Pas banget buat keliling kota.'],
  ['Shift kerja konstruksi baru selesai.', 'Mantap, saatnya istirahat sebentar.'],
  ['Gaya baju Vice City kamu keren!', 'Thanks! Baru beli di pusat kota.']
];

const WORKER_OUTFITS = [
  {
    name: 'Mandor Konstruksi (Helm Kuning)',
    topUV: [0.295, 0.235, 0.388, 0.398], // Rompi hi-vis oranye
    tint: 0xffedd5,
    hatType: 'hardhat',
    hatCol: 0xfacc15,
    hasVest: true,
    vestCol: 0xf97316,
    hasToolbelt: true
  },
  {
    name: 'Insinyur Lapangan (Helm Putih)',
    topUV: [0.865, 0.235, 0.978, 0.398], // Kemeja navy RCON
    tint: 0xdbeafe,
    hatType: 'hardhat',
    hatCol: 0xf8fafc,
    hasVest: false,
    hasToolbelt: false
  },
  {
    name: 'Operator Alat Berat (Helm Merah)',
    topUV: [0.155, 0.235, 0.252, 0.398], // Kaos hitam CONSTRUCTION excavator
    tint: 0xe4e4e7,
    hatType: 'hardhat',
    hatCol: 0xdc2626,
    hasVest: false,
    hasToolbelt: true
  },
  {
    name: 'Teknisi Jalan Raya (Rompi Neon)',
    topUV: [0.420, 0.235, 0.520, 0.398], // Rompi hi-vis neon yellow
    tint: 0xecfccb,
    hatType: 'hardhat',
    hatCol: 0xfacc15,
    hasVest: true,
    vestCol: 0xbef264,
    hasToolbelt: false
  },
  {
    name: 'Pekerja Bangunan (Hoodie Build More)',
    topUV: [0.562, 0.235, 0.672, 0.398], // Hoodie abu BUILD MORE
    tint: 0xf3f4f6,
    hatType: 'hardhat',
    hatCol: 0xfacc15,
    hasVest: false,
    hasToolbelt: true
  },
  {
    name: 'Supervisor Keselamatan (Jaket Oranye)',
    topUV: [0.710, 0.235, 0.830, 0.398], // Jaket oranye hi-vis
    tint: 0xffedd5,
    hatType: 'hardhat',
    hatCol: 0xf8fafc,
    hasVest: true,
    vestCol: 0xf97316,
    hasToolbelt: false
  }
];

const CITIZEN_OUTFITS = [
  {
    name: 'Warga Vice City (Kemeja Hawaii)',
    topUV: [0.298, 0.215, 0.398, 0.348], // Kemeja Hawaii biru palem
    tint: 0xe0f2fe,
    hatType: 'none',
    hasChain: false,
    hasGlasses: false
  },
  {
    name: 'Warga Vice City (Kaos Neon VC)',
    topUV: [0.145, 0.215, 0.262, 0.348], // Kaos hitam Vice City neon
    tint: 0xfce7f3,
    hatType: 'none',
    hasChain: true,
    hasGlasses: true
  },
  {
    name: 'Warga Streetwear (Topi VC & Jersey 23)',
    topUV: [0.022, 0.375, 0.114, 0.512], // Jersey merah BULLS 23
    tint: 0xfee2e2,
    hatType: 'cap',
    hatCol: 0x111827,
    hasChain: true,
    hasGlasses: false
  },
  {
    name: 'Warga Vice City (Denim & Jeans)',
    topUV: [0.554, 0.372, 0.634, 0.495], // Atasan denim biru
    tint: 0xdbeafe,
    hatType: 'none',
    hasChain: false,
    hasGlasses: true
  },
  {
    name: 'Warga Vice City (Kaos Putih & Kargo)',
    topUV: [0.148, 0.378, 0.265, 0.515], // Kaos putih logo
    tint: 0xffffff,
    hatType: 'cap',
    hatCol: 0xd6c7b2,
    hasChain: true,
    hasGlasses: false
  },
  {
    name: 'Warga Santai (Hoodie Los Santos)',
    topUV: [0.755, 0.215, 0.858, 0.368], // Hoodie abu Los Santos
    tint: 0xf3f4f6,
    hatType: 'cap',
    hatCol: 0x1e293b,
    hasChain: false,
    hasGlasses: false
  },
  {
    name: 'Warga Kasual (Kemeja Krem)',
    topUV: [0.298, 0.378, 0.422, 0.518], // Kemeja krem
    tint: 0xfef3c7,
    hatType: 'none',
    hasChain: false,
    hasGlasses: true
  },
  {
    name: 'Warga Malam (Jaket Hitam)',
    topUV: [0.450, 0.375, 0.526, 0.512], // Pakaian hitam sabuk emas
    tint: 0xe5e7eb,
    hatType: 'none',
    hasChain: true,
    hasGlasses: true
  }
];

function createChatBubbleSprite(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
  ctx.strokeStyle = 'rgba(246, 201, 69, 0.92)';
  ctx.lineWidth = 4;
  const r = 24, x = 16, y = 14, w = 480, h = 82;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + w / 2 + 14, y + h);
  ctx.lineTo(x + w / 2, y + h + 18);
  ctx.lineTo(x + w / 2 - 14, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 25px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, y + h / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(2.4, 0.6, 1);
  sprite.position.y = 2.15;
  return sprite;
}

export class NPCManager {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.walkers = [];
    this.chatters = [];
    this.chatPairs = [];
    this.baseGltf = null;
    this._materialCache = new Map();

    this._texLoader = new THREE.TextureLoader();
    this.workerTex = this._texLoader.load('assets/textures/npc_worker_atlas.jpg');
    this.workerTex.colorSpace = THREE.SRGBColorSpace;
    this.workerTex.anisotropy = 4;

    this.citizenTex = this._texLoader.load('assets/textures/npc_citizen_atlas.jpg');
    this.citizenTex.colorSpace = THREE.SRGBColorSpace;
    this.citizenTex.anisotropy = 4;

    this._gearGeos = {
      hardhatDome: new THREE.SphereGeometry(0.145, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
      hardhatBrim: new THREE.CylinderGeometry(0.175, 0.175, 0.02, 16),
      capCrown: new THREE.SphereGeometry(0.138, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.54),
      capVisor: new THREE.BoxGeometry(0.14, 0.015, 0.12),
      glasses: new THREE.BoxGeometry(0.18, 0.04, 0.05),
      vestShell: new THREE.CylinderGeometry(0.20, 0.175, 0.44, 14),
      hiVisStripe: new THREE.CylinderGeometry(0.204, 0.179, 0.045, 14),
      toolbelt: new THREE.CylinderGeometry(0.19, 0.19, 0.08, 12),
      chain: new THREE.TorusGeometry(0.10, 0.012, 6, 14, Math.PI)
    };

    // Buat placeholder dulu lalu ganti otomatis dengan model manusia 3D realistis (Soldier.glb / player.glb) saat GLTF selesai dimuat
    this.spawnSidewalkWalkers();
    this.spawnSidewalkChatters();
    this.loadRealisticHumanBase();
  }

  loadRealisticHumanBase() {
    const loader = new GLTFLoader();
    const onLoaded = (gltf) => {
      this.baseGltf = gltf;
      // Upgrade seluruh NPC yang sudah di-spawn ke model manusia 3D realistis + pakaian dari tekstur sheet
      for (const w of this.walkers) {
        this._upgradeNPCToRealisticGLTF(w, 'walk');
      }
      for (const c of this.chatters) {
        this._upgradeNPCToRealisticGLTF(c, 'idle');
      }
    };

    loader.load(
      'models/player.glb',
      onLoaded,
      undefined,
      () => {
        loader.load(REMOTE_HUMAN_GLB, onLoaded);
      }
    );
  }

  // Membuat material pakaian realistis berbasis tekstur crop dari sheet yang dikirim
  _getOutfitMaterial(sheetType, outfitIdx) {
    const key = `${sheetType}_outfit_${outfitIdx}`;
    if (this._materialCache.has(key)) return this._materialCache.get(key);

    const isWorker = sheetType === 'worker';
    const list = isWorker ? WORKER_OUTFITS : CITIZEN_OUTFITS;
    const outfit = list[outfitIdx % list.length];
    const baseTex = isWorker ? this.workerTex : this.citizenTex;
    const [u0, v0, u1, v1] = outfit.topUV;

    const clonedTex = baseTex.clone();
    clonedTex.needsUpdate = true;
    // Tile pola tekstur kain/motif baju dari sheet secara halus ke mesh 3D karakter realistis
    clonedTex.wrapS = THREE.MirroredRepeatWrapping;
    clonedTex.wrapT = THREE.MirroredRepeatWrapping;
    clonedTex.repeat.set(u1 - u0, v1 - v0);
    clonedTex.offset.set(u0, 1.0 - v1);

    const mat = new THREE.MeshStandardMaterial({
      map: clonedTex,
      color: outfit.tint || 0xffffff,
      roughness: 0.68,
      metalness: 0.06
    });
    this._materialCache.set(key, mat);
    return mat;
  }

  // Tempelkan helm konstruksi, topi VC, kacamata, rompi hi-vis, rantai, dll ke tulang karakter 3D realistis
  _attach3DOutfitAccessories(model, outfit) {
    let headBone = null;
    let spineBone = null;
    model.traverse((obj) => {
      if (obj.isBone) {
        const bn = obj.name.toLowerCase();
        if (!headBone && bn.includes('head')) headBone = obj;
        if (!spineBone && (bn.includes('spine2') || bn.includes('spine1') || bn.includes('chest'))) spineBone = obj;
      }
    });

    if (headBone) {
      if (outfit.hatType === 'hardhat') {
        const hatMat = new THREE.MeshStandardMaterial({ color: outfit.hatCol, roughness: 0.3, metalness: 0.1 });
        const dome = new THREE.Mesh(this._gearGeos.hardhatDome, hatMat);
        dome.position.set(0, 0.11, 0);
        dome.castShadow = true;
        const brim = new THREE.Mesh(this._gearGeos.hardhatBrim, hatMat);
        brim.position.set(0, 0.105, -0.02);
        headBone.add(dome, brim);
      } else if (outfit.hatType === 'cap') {
        const capMat = new THREE.MeshStandardMaterial({ color: outfit.hatCol, roughness: 0.78 });
        const crown = new THREE.Mesh(this._gearGeos.capCrown, capMat);
        crown.position.set(0, 0.11, 0);
        const visor = new THREE.Mesh(this._gearGeos.capVisor, capMat);
        visor.position.set(0, 0.10, -0.13);
        visor.rotation.x = -0.15;
        headBone.add(crown, visor);
      }

      if (outfit.hasGlasses) {
        const glassMat = new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.15, metalness: 0.7 });
        const glasses = new THREE.Mesh(this._gearGeos.glasses, glassMat);
        glasses.position.set(0, 0.055, -0.12);
        headBone.add(glasses);
      }
    }

    if (spineBone) {
      if (outfit.hasVest) {
        const vestMat = new THREE.MeshStandardMaterial({ color: outfit.vestCol, roughness: 0.55 });
        const vest = new THREE.Mesh(this._gearGeos.vestShell, vestMat);
        vest.position.set(0, 0.06, 0);
        const stripeMat = new THREE.MeshStandardMaterial({
          color: 0xf1f5f9,
          roughness: 0.25,
          metalness: 0.45,
          emissive: 0x334155,
          emissiveIntensity: 0.3
        });
        const s1 = new THREE.Mesh(this._gearGeos.hiVisStripe, stripeMat);
        s1.position.set(0, -0.04, 0);
        const s2 = new THREE.Mesh(this._gearGeos.hiVisStripe, stripeMat);
        s2.position.set(0, 0.12, 0);
        spineBone.add(vest, s1, s2);
      }

      if (outfit.hasToolbelt) {
        const beltMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.7 });
        const belt = new THREE.Mesh(this._gearGeos.toolbelt, beltMat);
        belt.position.set(0, -0.16, 0);
        spineBone.add(belt);
      }

      if (outfit.hasChain) {
        const chainMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.88, roughness: 0.2 });
        const chain = new THREE.Mesh(this._gearGeos.chain, chainMat);
        chain.position.set(0, 0.22, -0.13);
        chain.rotation.x = -Math.PI * 0.85;
        spineBone.add(chain);
      }
    }
  }

  _upgradeNPCToRealisticGLTF(npcObj, defaultAnim = 'walk') {
    if (!this.baseGltf) return;

    if (npcObj.placeholder) {
      npcObj.root.remove(npcObj.placeholder);
      npcObj.placeholder = null;
    }

    const clonedModel = SkeletonUtils.clone(this.baseGltf.scene);
    clonedModel.scale.set(1.03, 1.03, 1.03);
    clonedModel.rotation.y = Math.PI; // Arah hadap depan (+Z)

    const isWorker = npcObj.sheetType === 'worker';
    const outfits = isWorker ? WORKER_OUTFITS : CITIZEN_OUTFITS;
    const outfit = outfits[npcObj.outfitIdx % outfits.length];
    const outfitMat = this._getOutfitMaterial(npcObj.sheetType, npcObj.outfitIdx);

    clonedModel.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        // Terapkan material baju bertekstur dari sheet ke mesh pakaian karakter 3D realistis
        child.material = outfitMat;
      }
    });

    this._attach3DOutfitAccessories(clonedModel, outfit);
    npcObj.root.add(clonedModel);
    npcObj.modelRoot = clonedModel;

    if (this.baseGltf.animations && this.baseGltf.animations.length > 0) {
      const mixer = new THREE.AnimationMixer(clonedModel);
      const actions = {};
      this.baseGltf.animations.forEach((clip) => {
        actions[clip.name.toLowerCase()] = mixer.clipAction(clip);
      });
      npcObj.mixer = mixer;
      npcObj.actions = actions;

      const startClip = actions[defaultAnim] || actions['walk'] || actions['idle'] || Object.values(actions)[0];
      if (startClip) {
        startClip.time = (npcObj.phase || 0) % Math.max(0.5, startClip.getClip().duration);
        startClip.play();
        npcObj.activeAction = startClip;
      }
    }
  }

  _createNPCHolder(sheetType, outfitIdx, defaultAnim) {
    const root = new THREE.Group();
    const isWorker = sheetType === 'worker';
    const placeholder = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.26, 1.08, 6, 12),
      new THREE.MeshStandardMaterial({ color: isWorker ? 0xf97316 : 0x0284c7, roughness: 0.7 })
    );
    placeholder.position.y = 0.85;
    placeholder.castShadow = true;
    root.add(placeholder);

    const obj = {
      root,
      placeholder,
      modelRoot: null,
      mixer: null,
      actions: {},
      activeAction: null,
      sheetType,
      outfitIdx
    };

    if (this.baseGltf) {
      this._upgradeNPCToRealisticGLTF(obj, defaultAnim);
    }
    return obj;
  }

  // NPC berjalan mengelilingi jalur trotoar (tinggi trotoar y = 0.32)
  spawnSidewalkWalkers() {
    const span = this.world.span; // 76
    const sidewalkOffset = 22.8;
    const sidewalkY = 0.32;

    const blocks = [
      [0, 0], [-1, 0], [0, -1], [-1, -1],
      [1, 0], [0, 1], [-2, 0], [0, -2],
      [1, -1], [-1, 1], [1, 1], [-2, -1],
      [2, 0], [0, 2]
    ];

    blocks.forEach(([ix, iz], idx) => {
      const cx = ix * span + span / 2;
      const cz = iz * span + span / 2;

      for (let k = 0; k < 2; k++) {
        const sheetType = (idx + k) % 3 === 0 ? 'worker' : 'citizen';
        const outfitIdx = idx * 2 + k;
        const npc = this._createNPCHolder(sheetType, outfitIdx, 'walk');

        const waypoints = k === 0
          ? [
              { x: cx - sidewalkOffset, z: cz - sidewalkOffset },
              { x: cx + sidewalkOffset, z: cz - sidewalkOffset },
              { x: cx + sidewalkOffset, z: cz + sidewalkOffset },
              { x: cx - sidewalkOffset, z: cz + sidewalkOffset }
            ]
          : [
              { x: cx + sidewalkOffset, z: cz + sidewalkOffset },
              { x: cx + sidewalkOffset, z: cz - sidewalkOffset },
              { x: cx - sidewalkOffset, z: cz - sidewalkOffset },
              { x: cx - sidewalkOffset, z: cz + sidewalkOffset }
            ];

        const startWp = (idx + k) % 4;
        npc.root.position.set(waypoints[startWp].x, sidewalkY, waypoints[startWp].z);
        this.scene.add(npc.root);

        this.walkers.push({
          ...npc,
          waypoints,
          wpIndex: (startWp + 1) % 4,
          speed: 1.55 + ((idx + k) % 4) * 0.22,
          phase: (idx + k) * 1.3
        });
      }
    });
  }

  // Pasangan NPC realistis berdiri mengobrol di trotoar dengan animasi idle & balon percakapan
  spawnSidewalkChatters() {
    const sidewalkY = 0.32;
    const spots = [
      { x: 15.5, z: 16.0, rot: 0.4, dialIdx: 0, typeA: 'worker', idxA: 0, typeB: 'worker', idxB: 1 },
      { x: -16.5, z: 16.0, rot: -0.5, dialIdx: 1, typeA: 'citizen', idxA: 0, typeB: 'citizen', idxB: 3 },
      { x: 16.0, z: -15.5, rot: 1.1, dialIdx: 2, typeA: 'citizen', idxA: 1, typeB: 'citizen', idxB: 2 },
      { x: -16.0, z: -16.0, rot: 2.2, dialIdx: 3, typeA: 'worker', idxA: 2, typeB: 'citizen', idxB: 4 },
      { x: 54.0, z: 16.2, rot: 0.2, dialIdx: 4, typeA: 'citizen', idxA: 5, typeB: 'citizen', idxB: 6 },
      { x: -54.0, z: -16.2, rot: 1.8, dialIdx: 5, typeA: 'worker', idxA: 3, typeB: 'worker', idxB: 4 },
      { x: 16.2, z: 54.5, rot: 0.8, dialIdx: 6, typeA: 'worker', idxA: 5, typeB: 'citizen', idxB: 7 },
      { x: -16.2, z: -54.5, rot: 2.6, dialIdx: 7, typeA: 'citizen', idxA: 0, typeB: 'citizen', idxB: 3 }
    ];

    spots.forEach((sp, i) => {
      const dist = 0.68;
      const dx = Math.cos(sp.rot) * dist;
      const dz = Math.sin(sp.rot) * dist;

      const npcA = this._createNPCHolder(sp.typeA, sp.idxA, 'idle');
      npcA.phase = i * 0.7;
      npcA.root.position.set(sp.x - dx, sidewalkY, sp.z - dz);
      npcA.root.lookAt(sp.x + dx, sidewalkY, sp.z + dz);
      npcA.baseYaw = npcA.root.rotation.y;

      const npcB = this._createNPCHolder(sp.typeB, sp.idxB, 'idle');
      npcB.phase = i * 0.7 + 0.5;
      npcB.root.position.set(sp.x + dx, sidewalkY, sp.z + dz);
      npcB.root.lookAt(sp.x - dx, sidewalkY, sp.z - dz);
      npcB.baseYaw = npcB.root.rotation.y;

      const lines = NPC_DIALOGUES[sp.dialIdx % NPC_DIALOGUES.length];
      const bubbleA = createChatBubbleSprite(lines[0]);
      const bubbleB = createChatBubbleSprite(lines[1]);
      bubbleB.visible = false;

      npcA.root.add(bubbleA);
      npcB.root.add(bubbleB);

      this.scene.add(npcA.root, npcB.root);
      this.chatters.push(npcA, npcB);
      this.chatPairs.push({
        npcA,
        npcB,
        bubbleA,
        bubbleB,
        timer: i * 1.4,
        turn: 0
      });
    });
  }

  update(dt, playerPos) {
    const activeDistSq = 210 * 210;

    // 1. Update NPC Pejalan Kaki Realistis di Trotoar
    for (let i = 0; i < this.walkers.length; i++) {
      const w = this.walkers[i];
      const dxp = w.root.position.x - playerPos.x;
      const dzp = w.root.position.z - playerPos.z;
      const near = (dxp * dxp + dzp * dzp) <= activeDistSq;
      w.root.visible = near;
      if (!near) continue;

      const target = w.waypoints[w.wpIndex];
      const dx = target.x - w.root.position.x;
      const dz = target.z - w.root.position.z;
      const dist = Math.hypot(dx, dz);

      if (dist < 0.35) {
        w.wpIndex = (w.wpIndex + 1) % w.waypoints.length;
      } else {
        const vx = (dx / dist) * w.speed;
        const vz = (dz / dist) * w.speed;
        w.root.position.x += vx * dt;
        w.root.position.z += vz * dt;

        const targetYaw = Math.atan2(vx, vz);
        let diff = targetYaw - w.root.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        w.root.rotation.y += diff * Math.min(1, 10 * dt);
      }

      if (w.mixer) {
        w.mixer.update(dt * (w.speed / 1.65));
      }
    }

    // 2. Update NPC Realistis Mengobrol di Trotoar
    const chatVisibleDistSq = 45 * 45;
    for (let i = 0; i < this.chatPairs.length; i++) {
      const pair = this.chatPairs[i];
      const dxp = pair.npcA.root.position.x - playerPos.x;
      const dzp = pair.npcA.root.position.z - playerPos.z;
      const dSq = dxp * dxp + dzp * dzp;

      const inRange = dSq <= activeDistSq;
      pair.npcA.root.visible = inRange;
      pair.npcB.root.visible = inRange;
      if (!inRange) continue;

      pair.timer += dt;
      if (pair.timer >= 3.4) {
        pair.timer = 0;
        pair.turn = 1 - pair.turn;
      }

      const showBubbles = dSq <= chatVisibleDistSq;
      pair.bubbleA.visible = showBubbles && pair.turn === 0;
      pair.bubbleB.visible = showBubbles && pair.turn === 1;

      const speaker = pair.turn === 0 ? pair.npcA : pair.npcB;
      const listener = pair.turn === 0 ? pair.npcB : pair.npcA;

      speaker.root.rotation.y = speaker.baseYaw + Math.sin(pair.timer * 3.8) * 0.14;
      listener.root.rotation.y = listener.baseYaw + Math.sin(pair.timer * 2.1) * 0.05;

      if (pair.npcA.mixer) pair.npcA.mixer.update(dt);
      if (pair.npcB.mixer) pair.npcB.mixer.update(dt);
    }
  }
}
