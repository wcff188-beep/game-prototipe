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

      if (!this.checkCollision(nextX, nextZ, colliders)) {
        this.group.position.x = nextX;
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
    for (const c of colliders) {
      if (x > c.minX && x < c.maxX && z > c.minZ && z < c.maxZ) return true;
    }
    return false;
  }
}
