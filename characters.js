import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

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
    // Gravitasi & Lompat
    if (!this.isGrounded || this.group.position.y > this.groundY) {
      this.velY -= 19.5 * dt;
      this.group.position.y += this.velY * dt;
      if (this.group.position.y <= this.groundY) {
        this.group.position.y = this.groundY;
        this.velY = 0;
        this.isGrounded = true;
      }
    }

    // Visual tinggi saat jongkok
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
      // Rotasi karakter halus seperti di OneState
      let diff = targetAngle - this.group.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.group.rotation.y += diff * Math.min(1, 14 * dt);

      const nextX = this.group.position.x + Math.sin(targetAngle) * this.speed * dt;
      const nextZ = this.group.position.z + Math.cos(targetAngle) * this.speed * dt;

      // Sliding collision terpisah sumbu X & Z (radius tubuh 0.45m) agar dinding gedung keras & tidak tembus
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


// ---------- Sistem NPC Pejalan Kaki & NPC Mengobrol di Trotoar Ala OneState RP ----------
const NPC_DIALOGUES = [
  ['Halo bro, apa kabar?', 'Baik! Lagi santai di kota.'],
  ['Mobil sport tadi keren banget!', 'Iya, baru keluar dari bengkel.'],
  ['Hati-hati di persimpangan depan.', 'Siap, lalu lintas lagi ramai.'],
  ['Mau ke Vice Point Plaza?', 'Nanti sore ketemu di sana ya!'],
  ['Cuaca Vice City cerah hari ini.', 'Pas banget buat keliling kota.'],
  ['Kerja di VCPD sibuk terus ya?', 'Lumayan, jaga kota tetap aman!']
];

function createChatBubbleSprite(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  // Kotak bubble bulat gelap semi-transparan ala OneState RP
  ctx.fillStyle = 'rgba(15, 23, 42, 0.86)';
  ctx.strokeStyle = 'rgba(246, 201, 69, 0.85)';
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
  ctx.font = 'bold 26px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, y + h / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(2.35, 0.58, 1);
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
    this._sharedGeos = this._createSharedGeos();

    this.spawnSidewalkWalkers();
    this.spawnSidewalkChatters();
  }

  _createSharedGeos() {
    return {
      head: new THREE.SphereGeometry(0.18, 12, 12),
      hair: new THREE.SphereGeometry(0.188, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
      torso: new THREE.CylinderGeometry(0.21, 0.18, 0.68, 10),
      limb: new THREE.CylinderGeometry(0.068, 0.058, 0.66, 8)
    };
  }

  _buildHumanoidMesh(shirtColor, pantsColor, skinColor, hairColor) {
    const root = new THREE.Group();
    const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.65 });
    const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.72 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.8 });
    const hairMat = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.85 });

    // Torso
    const torso = new THREE.Mesh(this._sharedGeos.torso, shirtMat);
    torso.position.y = 1.04;
    torso.castShadow = true;
    root.add(torso);

    // Kepala & rambut
    const head = new THREE.Mesh(this._sharedGeos.head, skinMat);
    head.position.y = 1.56;
    head.castShadow = true;
    const hair = new THREE.Mesh(this._sharedGeos.hair, hairMat);
    hair.position.y = 1.58;
    root.add(head, hair);

    // Pivot Lengan Kiri & Kanan
    const leftArmPivot = new THREE.Group();
    leftArmPivot.position.set(-0.27, 1.32, 0);
    const leftArm = new THREE.Mesh(this._sharedGeos.limb, skinMat);
    leftArm.position.y = -0.28;
    leftArmPivot.add(leftArm);

    const rightArmPivot = new THREE.Group();
    rightArmPivot.position.set(0.27, 1.32, 0);
    const rightArm = new THREE.Mesh(this._sharedGeos.limb, skinMat);
    rightArm.position.y = -0.28;
    rightArmPivot.add(rightArm);

    // Pivot Kaki Kiri & Kanan
    const leftLegPivot = new THREE.Group();
    leftLegPivot.position.set(-0.11, 0.72, 0);
    const leftLeg = new THREE.Mesh(this._sharedGeos.limb, pantsMat);
    leftLeg.position.y = -0.33;
    leftLeg.castShadow = true;
    leftLegPivot.add(leftLeg);

    const rightLegPivot = new THREE.Group();
    rightLegPivot.position.set(0.11, 0.72, 0);
    const rightLeg = new THREE.Mesh(this._sharedGeos.limb, pantsMat);
    rightLeg.position.y = -0.33;
    rightLeg.castShadow = true;
    rightLegPivot.add(rightLeg);

    root.add(leftArmPivot, rightArmPivot, leftLegPivot, rightLegPivot);
    return { root, head, leftArmPivot, rightArmPivot, leftLegPivot, rightLegPivot };
  }

  // NPC berjalan mengelilingi jalur trotoar (tinggi trotoar y = 0.32)
  spawnSidewalkWalkers() {
    const shirts = [0x0ea5e9, 0xf43f5e, 0x10b981, 0xf59e0b, 0x8b5cf6, 0xe2e8f0, 0xec4899, 0x14b8a6];
    const pants = [0x1e293b, 0x334155, 0x1e3a8a, 0x3f3f46, 0x78350f];
    const skins = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];
    const hairs = [0x0f172a, 0x3b2f2f, 0x713f12, 0x9ca3af];

    const span = this.world.span; // 76
    const sidewalkOffset = 22.8; // tepat di jalur trotoar luar gedung & dalam tepi jalan
    const sidewalkY = 0.32;

    // Sebar 28 NPC pejalan kaki di blok-blok utama kota
    const blocks = [
      [0, 0], [-1, 0], [0, -1], [-1, -1],
      [1, 0], [0, 1], [-2, 0], [0, -2],
      [1, -1], [-1, 1], [1, 1], [-2, -1],
      [2, 0], [0, 2]
    ];

    blocks.forEach(([ix, iz], idx) => {
      const cx = ix * span + span / 2;
      const cz = iz * span + span / 2;

      // 2 pejalan kaki per blok dengan arah berlawanan mengelilingi trotoar
      for (let k = 0; k < 2; k++) {
        const sIdx = (idx * 3 + k) % shirts.length;
        const rig = this._buildHumanoidMesh(
          shirts[sIdx],
          pants[(idx + k) % pants.length],
          skins[(idx + k * 2) % skins.length],
          hairs[(idx + k) % hairs.length]
        );

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
        rig.root.position.set(waypoints[startWp].x, sidewalkY, waypoints[startWp].z);
        this.scene.add(rig.root);

        this.walkers.push({
          ...rig,
          waypoints,
          wpIndex: (startWp + 1) % 4,
          speed: 1.45 + ((idx + k) % 4) * 0.22,
          phase: (idx + k) * 1.7
        });
      }
    });
  }

  // Pasangan NPC berdiri saling berhadapan & mengobrol di trotoar dengan gestur tangan + balon percakapan
  spawnSidewalkChatters() {
    const sidewalkY = 0.32;
    const spots = [
      { x: 15.5, z: 16.0, rot: 0.4, dialIdx: 0 },
      { x: -16.5, z: 16.0, rot: -0.5, dialIdx: 1 },
      { x: 16.0, z: -15.5, rot: 1.1, dialIdx: 2 },
      { x: -16.0, z: -16.0, rot: 2.2, dialIdx: 3 },
      { x: 54.0, z: 16.2, rot: 0.2, dialIdx: 4 },
      { x: -54.0, z: -16.2, rot: 1.8, dialIdx: 5 },
      { x: 16.2, z: 54.5, rot: 0.8, dialIdx: 0 },
      { x: -16.2, z: -54.5, rot: 2.6, dialIdx: 2 }
    ];

    const shirts = [0x38bdf8, 0xfbbf24, 0xa855f7, 0x34d399, 0xf87171, 0xfb923c];
    const pants = [0x0f172a, 0x1e3a8a, 0x374151, 0x4b5563];
    const skins = [0xf1c27d, 0xc68642, 0xe0ac69, 0x8d5524];

    spots.forEach((sp, i) => {
      const dist = 0.62;
      const dx = Math.cos(sp.rot) * dist;
      const dz = Math.sin(sp.rot) * dist;

      const npcA = this._buildHumanoidMesh(shirts[i % shirts.length], pants[i % pants.length], skins[i % skins.length], 0x1e293b);
      npcA.root.position.set(sp.x - dx, sidewalkY, sp.z - dz);
      npcA.root.lookAt(sp.x + dx, sidewalkY, sp.z + dz);

      const npcB = this._buildHumanoidMesh(shirts[(i + 2) % shirts.length], pants[(i + 1) % pants.length], skins[(i + 1) % skins.length], 0x451a03);
      npcB.root.position.set(sp.x + dx, sidewalkY, sp.z + dz);
      npcB.root.lookAt(sp.x - dx, sidewalkY, sp.z - dz);

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

    // 1. Update NPC Pejalan Kaki di Trotoar
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

      // Animasi ayunan tangan & kaki berjalan natural
      w.phase += dt * w.speed * 4.6;
      const swing = Math.sin(w.phase) * 0.55;
      w.leftLegPivot.rotation.x = swing;
      w.rightLegPivot.rotation.x = -swing;
      w.leftArmPivot.rotation.x = -swing * 0.7;
      w.rightArmPivot.rotation.x = swing * 0.7;
    }

    // 2. Update NPC Mengobrol di Trotoar (gestur tangan & gantian balon chat saat pemain dekat)
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

      // Gestur tangan berbicara & anggukan kepala lawan bicara
      speaker.rightArmPivot.rotation.x = -0.65 + Math.sin(pair.timer * 7.5) * 0.35;
      speaker.rightArmPivot.rotation.z = -0.2 + Math.cos(pair.timer * 5.0) * 0.15;
      speaker.leftArmPivot.rotation.x = -0.25 + Math.cos(pair.timer * 6.0) * 0.18;
      speaker.head.rotation.y = Math.sin(pair.timer * 3.2) * 0.14;

      listener.rightArmPivot.rotation.x = THREE.MathUtils.lerp(listener.rightArmPivot.rotation.x, 0, 6 * dt);
      listener.leftArmPivot.rotation.x = THREE.MathUtils.lerp(listener.leftArmPivot.rotation.x, 0, 6 * dt);
      listener.head.rotation.x = Math.sin(pair.timer * 4.5) * 0.1;
    }
  }
}
