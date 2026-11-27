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

// ---------- Sistem NPC Realistis (Rigged 3D Human GLTF) Dengan Tekstur Pakaian Cerah & Animasi Alami ----------
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

// Indeks cell 0..15 merujuk pada grid 4x4 di assets/textures/npc_outfits_clean.jpg (tanpa latar hitam)
const NPC_OUTFIT_PRESETS = [
  // Pekerja Konstruksi (cell 0..7)
  { cell: 0, baseColor: 0xffedd5, hatType: 'hardhat', hatCol: 0xfacc15, hasVest: true, vestCol: 0xf97316, hasToolbelt: true },
  { cell: 1, baseColor: 0xdbeafe, hatType: 'hardhat', hatCol: 0xf8fafc, hasVest: false, hasToolbelt: false },
  { cell: 2, baseColor: 0xe5e7eb, hatType: 'hardhat', hatCol: 0xdc2626, hasVest: false, hasToolbelt: true },
  { cell: 3, baseColor: 0xecfccb, hatType: 'hardhat', hatCol: 0xfacc15, hasVest: true, vestCol: 0xbef264, hasToolbelt: false },
  { cell: 4, baseColor: 0xf3f4f6, hatType: 'hardhat', hatCol: 0xfacc15, hasVest: false, hasToolbelt: true },
  { cell: 5, baseColor: 0xffedd5, hatType: 'hardhat', hatCol: 0xf8fafc, hasVest: true, vestCol: 0xf97316, hasToolbelt: false },
  // Warga Vice City (cell 8..15)
  { cell: 8, baseColor: 0xe0f2fe, hatType: 'none', hasChain: false, hasGlasses: false },
  { cell: 9, baseColor: 0xfce7f3, hatType: 'none', hasChain: true, hasGlasses: true },
  { cell: 10, baseColor: 0xfee2e2, hatType: 'cap', hatCol: 0x111827, hasChain: true, hasGlasses: false },
  { cell: 11, baseColor: 0xdbeafe, hatType: 'none', hasChain: false, hasGlasses: true },
  { cell: 12, baseColor: 0xffffff, hatType: 'cap', hatCol: 0xd6c7b2, hasChain: true, hasGlasses: false },
  { cell: 13, baseColor: 0xf3f4f6, hatType: 'cap', hatCol: 0x1e293b, hasChain: false, hasGlasses: false },
  { cell: 14, baseColor: 0xfef3c7, hatType: 'none', hasChain: false, hasGlasses: true },
  { cell: 15, baseColor: 0xecfccb, hatType: 'cap', hatCol: 0x3f6212, hasChain: false, hasGlasses: false }
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
    this.cleanOutfitTex = this._texLoader.load('assets/textures/npc_outfits_clean.jpg');
    this.cleanOutfitTex.colorSpace = THREE.SRGBColorSpace;
    this.cleanOutfitTex.anisotropy = 4;

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

    this.spawnSidewalkWalkers();
    this.spawnSidewalkChatters();
    this.loadRealisticHumanBase();
  }

  loadRealisticHumanBase() {
    const loader = new GLTFLoader();
    const onLoaded = (gltf) => {
      this.baseGltf = gltf;
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

  // Ambil 1 cell kain baju bersih dari grid 4x4 npc_outfits_clean.jpg (tanpa latar belakang hitam)
  _getCleanOutfitMaterial(presetIdx) {
    const preset = NPC_OUTFIT_PRESETS[presetIdx % NPC_OUTFIT_PRESETS.length];
    const key = `clean_cell_${preset.cell}`;
    if (this._materialCache.has(key)) return this._materialCache.get(key);

    const col = preset.cell % 4;
    const row = Math.floor(preset.cell / 4);
    const clonedTex = this.cleanOutfitTex.clone();
    clonedTex.needsUpdate = true;
    clonedTex.wrapS = THREE.MirroredRepeatWrapping;
    clonedTex.wrapT = THREE.MirroredRepeatWrapping;
    clonedTex.repeat.set(0.24, 0.24);
    clonedTex.offset.set(col * 0.25 + 0.005, 1.0 - (row + 1) * 0.25 + 0.005);

    const mat = new THREE.MeshStandardMaterial({
      map: clonedTex,
      color: preset.baseColor,
      roughness: 0.65,
      metalness: 0.05
    });
    this._materialCache.set(key, mat);
    return mat;
  }

  _attach3DOutfitAccessories(model, preset) {
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
      if (preset.hatType === 'hardhat') {
        const hatMat = new THREE.MeshStandardMaterial({ color: preset.hatCol, roughness: 0.3, metalness: 0.1 });
        const dome = new THREE.Mesh(this._gearGeos.hardhatDome, hatMat);
        dome.position.set(0, 0.11, 0);
        dome.castShadow = true;
        const brim = new THREE.Mesh(this._gearGeos.hardhatBrim, hatMat);
        brim.position.set(0, 0.105, -0.02);
        headBone.add(dome, brim);
      } else if (preset.hatType === 'cap') {
        const capMat = new THREE.MeshStandardMaterial({ color: preset.hatCol, roughness: 0.78 });
        const crown = new THREE.Mesh(this._gearGeos.capCrown, capMat);
        crown.position.set(0, 0.11, 0);
        const visor = new THREE.Mesh(this._gearGeos.capVisor, capMat);
        visor.position.set(0, 0.10, -0.13);
        visor.rotation.x = -0.15;
        headBone.add(crown, visor);
      }

      if (preset.hasGlasses) {
        const glassMat = new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.15, metalness: 0.7 });
        const glasses = new THREE.Mesh(this._gearGeos.glasses, glassMat);
        glasses.position.set(0, 0.055, -0.12);
        headBone.add(glasses);
      }
    }

    if (spineBone) {
      if (preset.hasVest) {
        const vestMat = new THREE.MeshStandardMaterial({ color: preset.vestCol, roughness: 0.52 });
        const vest = new THREE.Mesh(this._gearGeos.vestShell, vestMat);
        vest.position.set(0, 0.06, 0);
        const stripeMat = new THREE.MeshStandardMaterial({
          color: 0xf8fafc,
          roughness: 0.25,
          metalness: 0.45,
          emissive: 0x475569,
          emissiveIntensity: 0.35
        });
        const s1 = new THREE.Mesh(this._gearGeos.hiVisStripe, stripeMat);
        s1.position.set(0, -0.04, 0);
        const s2 = new THREE.Mesh(this._gearGeos.hiVisStripe, stripeMat);
        s2.position.set(0, 0.12, 0);
        spineBone.add(vest, s1, s2);
      }

      if (preset.hasToolbelt) {
        const beltMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.7 });
        const belt = new THREE.Mesh(this._gearGeos.toolbelt, beltMat);
        belt.position.set(0, -0.16, 0);
        spineBone.add(belt);
      }

      if (preset.hasChain) {
        const chainMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.88, roughness: 0.2 });
        const chain = new THREE.Mesh(this._gearGeos.chain, chainMat);
        chain.position.set(0, 0.22, -0.13);
        chain.rotation.x = -Math.PI * 0.85;
        spineBone.add(chain);
      }
    }
  }

  _upgradeNPCToRealisticGLTF(npcObj, mode = 'walk') {
    if (!this.baseGltf) return;

    if (npcObj.placeholder) {
      npcObj.root.remove(npcObj.placeholder);
      npcObj.placeholder = null;
    }

    const clonedModel = SkeletonUtils.clone(this.baseGltf.scene);
    clonedModel.scale.set(1.03, 1.03, 1.03);
    clonedModel.rotation.y = Math.PI;

    const preset = NPC_OUTFIT_PRESETS[npcObj.presetIdx % NPC_OUTFIT_PRESETS.length];
    const outfitMat = this._getCleanOutfitMaterial(npcObj.presetIdx);

    clonedModel.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.material = outfitMat;
      }
    });

    this._attach3DOutfitAccessories(clonedModel, preset);
    npcObj.root.add(clonedModel);
    npcObj.modelRoot = clonedModel;

    // Pastikan animasi skeletal terpasang sempurna dengan bobot penuh (1.0) agar tidak pernah T-pose!
    const clips = this.baseGltf.animations || [];
    if (clips.length > 0) {
      const mixer = new THREE.AnimationMixer(clonedModel);
      let chosenClip = null;

      if (mode === 'walk') {
        chosenClip = clips.find((c) => c.name.toLowerCase().includes('walk'))
          || clips.find((c) => c.name.toLowerCase().includes('run'))
          || clips[0];
      } else {
        chosenClip = clips.find((c) => c.name.toLowerCase().includes('idle'))
          || clips[0];
      }

      if (chosenClip) {
        const action = mixer.clipAction(chosenClip);
        action.reset();
        action.setEffectiveWeight(1.0);
        action.setEffectiveTimeScale(1.0);
        action.time = (npcObj.phase || 0) % Math.max(0.4, chosenClip.duration);
        action.play();
        mixer.update(0.016); // Evaluasi pose kerangka segera di frame pertama agar tangan langsung turun alami
      }

      npcObj.mixer = mixer;
    }
  }

  _createNPCHolder(presetIdx, mode) {
    const root = new THREE.Group();
    const preset = NPC_OUTFIT_PRESETS[presetIdx % NPC_OUTFIT_PRESETS.length];
    const placeholder = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.26, 1.08, 6, 12),
      new THREE.MeshStandardMaterial({ color: preset.baseColor, roughness: 0.7 })
    );
    placeholder.position.y = 0.85;
    placeholder.castShadow = true;
    root.add(placeholder);

    const obj = {
      root,
      placeholder,
      modelRoot: null,
      mixer: null,
      presetIdx,
      phase: 0
    };

    if (this.baseGltf) {
      this._upgradeNPCToRealisticGLTF(obj, mode);
    }
    return obj;
  }

  // NPC berjalan mengelilingi jalur trotoar (y = 0.32, di luar garis kotak pohon pojok)
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
        const presetIdx = idx * 2 + k;
        const npc = this._createNPCHolder(presetIdx, 'walk');

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
        npc.phase = (idx + k) * 1.1;
        npc.root.position.set(waypoints[startWp].x, sidewalkY, waypoints[startWp].z);
        this.scene.add(npc.root);

        this.walkers.push({
          ...npc,
          waypoints,
          wpIndex: (startWp + 1) % 4,
          speed: 1.55 + ((idx + k) % 4) * 0.22
        });
      }
    });
  }

  // Pasangan NPC berdiri mengobrol di trotoar keramik terbuka (bebas dari petak pohon pojok)
  spawnSidewalkChatters() {
    const sidewalkY = 0.32;
    // Setiap blok memiliki pusat di (ix*76 + 38, iz*76 + 38), gedung di +-13m, petak pohon pojok di +-19.5m.
    // Ruang trotoar keramik bersih berada di sisi tengah blok (offset 0 dari pusat blok pada salah satu sumbu, dan +-18.5m pada sumbu lainnya)!
    const spots = [
      { x: 18.8, z: 36.0, rot: 0.2, dialIdx: 0, idxA: 0, idxB: 1 },
      { x: -18.8, z: 36.0, rot: -0.3, dialIdx: 1, idxA: 6, idxB: 7 },
      { x: 36.0, z: 18.8, rot: 1.4, dialIdx: 2, idxA: 8, idxB: 9 },
      { x: 36.0, z: -18.8, rot: 1.7, dialIdx: 3, idxA: 2, idxB: 10 },
      { x: 57.2, z: 38.0, rot: 0.1, dialIdx: 4, idxA: 11, idxB: 12 },
      { x: -57.2, z: -38.0, rot: 2.9, dialIdx: 5, idxA: 3, idxB: 4 },
      { x: 38.0, z: 57.2, rot: 1.5, dialIdx: 6, idxA: 5, idxB: 13 },
      { x: -38.0, z: -57.2, rot: 1.6, dialIdx: 7, idxA: 6, idxB: 8 }
    ];

    spots.forEach((sp, i) => {
      const dist = 0.72;
      const dx = Math.cos(sp.rot) * dist;
      const dz = Math.sin(sp.rot) * dist;

      const npcA = this._createNPCHolder(sp.idxA, 'idle');
      npcA.phase = i * 0.7;
      npcA.root.position.set(sp.x - dx, sidewalkY, sp.z - dz);
      npcA.root.lookAt(sp.x + dx, sidewalkY, sp.z + dz);
      npcA.baseYaw = npcA.root.rotation.y;

      const npcB = this._createNPCHolder(sp.idxB, 'idle');
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
