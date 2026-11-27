import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const REMOTE_CAR_GLB = 'https://raw.githubusercontent.com/mrdoob/three.js/r160/examples/models/gltf/ferrari.glb';

export class VehicleManager {
  constructor(scene, onAssetLoaded) {
    this.scene = scene;
    this.onAssetLoaded = onAssetLoaded;
    this.vehicles = [];
    this.trafficCars = [];
    this.night = false;

    this.dracoLoader = new DRACOLoader();
    this.dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');

    this.loader = new GLTFLoader();
    this.loader.setDRACOLoader(this.dracoLoader);

    this.spawnDefaultCars();
    this.spawnTrafficAI();
  }

  spawnDefaultCars() {
    this.createVehicle({
      name: 'Elegy GT Supercar',
      x: 4.5,
      z: -2.5,
      color: 0xf8fafc,
      localGlb: 'models/sportcar.glb',
      remoteGlb: REMOTE_CAR_GLB,
      notifyLoad: true
    });

    this.createVehicle({
      name: 'Premier GT Silver',
      x: -5.2,
      z: 13.5,
      color: 0xcbd5e1,
      remoteGlb: REMOTE_CAR_GLB
    });

    this.createVehicle({
      name: 'Infernus Rosso',
      x: 24,
      z: 28,
      color: 0xdc2626,
      remoteGlb: REMOTE_CAR_GLB
    });
  }

  // Lalu lintas AI berjalan otomatis di jalan raya seperti OneState RP
  spawnTrafficAI() {
    const routes = [
      { x: 3.5, z: -152, dirX: 0, dirZ: 1, rotY: Math.PI, color: 0x0f172a, name: 'VCPD Interceptor' },
      { x: -3.5, z: 152, dirX: 0, dirZ: -1, rotY: 0, color: 0xfacc15, name: 'Downtown Cab' },
      { x: 79.5, z: -90, dirX: 0, dirZ: 1, rotY: Math.PI, color: 0x2563eb, name: 'Sultan RS Blue' },
      { x: -79.5, z: 90, dirX: 0, dirZ: -1, rotY: 0, color: 0xe2e8f0, name: 'Executive Sedan' },
      { x: -140, z: 3.5, dirX: 1, dirZ: 0, rotY: -Math.PI / 2, color: 0x16a34a, name: 'Banshee Emerald' },
      { x: 140, z: -3.5, dirX: -1, dirZ: 0, rotY: Math.PI / 2, color: 0x9333ea, name: 'Cheetah Violet' }
    ];

    routes.forEach((r) => {
      const car = this.createVehicle({
        name: r.name,
        x: r.x,
        z: r.z,
        color: r.color,
        remoteGlb: REMOTE_CAR_GLB,
        isTraffic: true
      });
      car.group.rotation.y = r.rotY;
      car.trafficDir = new THREE.Vector3(r.dirX, 0, r.dirZ);
      car.trafficSpeed = 10.5 + Math.random() * 4.5;
      this.trafficCars.push(car);
    });
  }

  createVehicle({ name, x, z, color, localGlb = null, remoteGlb = REMOTE_CAR_GLB, notifyLoad = false, isTraffic = false }) {
    const carGroup = new THREE.Group();
    const wheels = [];

    const placeholder = new THREE.Mesh(
      new THREE.BoxGeometry(1.9, 0.8, 4.2),
      new THREE.MeshPhysicalMaterial({ color, metalness: 0.45, roughness: 0.2, clearcoat: 1 })
    );
    placeholder.position.y = 0.6;
    carGroup.add(placeholder);

    // Lampu depan & lampu rem 3D realistis
    const headMat = new THREE.MeshBasicMaterial({ color: 0xfef9c3 });
    const tailMat = new THREE.MeshBasicMaterial({ color: 0x991b1b });

    const hlLeft = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.1), headMat);
    hlLeft.position.set(-0.66, 0.65, -2.12);
    const hlRight = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.1), headMat);
    hlRight.position.set(0.66, 0.65, -2.12);

    const tlLeft = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.1), tailMat);
    tlLeft.position.set(-0.64, 0.68, 2.12);
    const tlRight = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.1), tailMat.clone());
    tlRight.position.set(0.64, 0.68, 2.12);

    carGroup.add(hlLeft, hlRight, tlLeft, tlRight);

    carGroup.position.set(x, 0.08, z);
    this.scene.add(carGroup);

    const setupCarModel = (gltf) => {
      carGroup.remove(placeholder);
      const model = gltf.scene;
      model.scale.set(1.05, 1.05, 1.05);

      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;

          const matName = (child.material && child.material.name || '').toLowerCase();
          const meshName = (child.name || '').toLowerCase();
          if (matName.includes('body') || meshName.includes('body') || matName.includes('paint')) {
            child.material = new THREE.MeshPhysicalMaterial({
              color,
              metalness: 0.52,
              roughness: 0.12,
              clearcoat: 1.0,
              clearcoatRoughness: 0.05,
              envMapIntensity: 1.35
            });
          }
        }

        if (child.name && child.name.toLowerCase().includes('wheel')) {
          wheels.push(child);
        }
      });

      const shadowPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(2.45, 4.9),
        new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.48, depthWrite: false })
      );
      shadowPlane.rotation.x = -Math.PI / 2;
      shadowPlane.position.y = 0.02;
      carGroup.add(shadowPlane);

      carGroup.add(model);
      if (notifyLoad && this.onAssetLoaded) this.onAssetLoaded('vehicle');
    };

    if (localGlb) {
      this.loader.load(
        localGlb,
        setupCarModel,
        undefined,
        () => this.loader.load(remoteGlb, setupCarModel, undefined, () => {
          if (notifyLoad && this.onAssetLoaded) this.onAssetLoaded('vehicle');
        })
      );
    } else {
      this.loader.load(remoteGlb, setupCarModel);
    }

    const vehicleObj = {
      name,
      group: carGroup,
      wheels,
      tailLights: [tlLeft, tlRight],
      headMat,
      tailMat,
      speed: 0,
      steer: 0,
      bodyRoll: 0,
      isTraffic
    };
    this.vehicles.push(vehicleObj);
    if (this.night) this.setNight(true);
    return vehicleObj;
  }

  // Lampu depan/belakang bernilai HDR di malam hari agar bersinar lewat bloom
  setNight(isNight) {
    this.night = isNight;
    for (const v of this.vehicles) {
      v.headMat.color.setHex(0xfef9c3);
      if (isNight) v.headMat.color.multiplyScalar(5);
      if (v.isTraffic) {
        v.tailMat.color.setHex(0x991b1b);
        if (isNight) v.tailMat.color.multiplyScalar(2.5);
      }
    }
  }

  updateTraffic(dt, activeVehicle) {
    const limit = 340;
    for (const car of this.trafficCars) {
      if (car === activeVehicle) continue;
      car.group.position.addScaledVector(car.trafficDir, car.trafficSpeed * dt);
      car.wheels.forEach((w) => {
        w.rotation.x -= car.trafficSpeed * dt * 2.4;
      });

      if (car.group.position.z > limit) car.group.position.z = -limit;
      if (car.group.position.z < -limit) car.group.position.z = limit;
      if (car.group.position.x > limit) car.group.position.x = -limit;
      if (car.group.position.x < -limit) car.group.position.x = limit;
    }
  }

  updateVehicle(car, dt, throttle, steerInput, brake) {
    const maxSpeed = 36;
    if (throttle > 0) {
      car.speed = Math.min(car.speed + 20 * throttle * dt, maxSpeed);
    } else if (throttle < 0) {
      car.speed = Math.max(car.speed + 21 * throttle * dt, -11);
    } else {
      car.speed *= Math.pow(0.45, dt);
    }

    if (brake) {
      car.speed *= Math.pow(0.08, dt);
    }

    // Lampu rem menyala terang saat mengerem / mundur
    const brakingNow = brake || throttle < 0;
    if (car.tailLights) {
      car.tailLights.forEach((tl) => {
        tl.material.color.setHex(brakingNow ? 0xff2a2a : 0x881313);
        tl.material.color.multiplyScalar(brakingNow ? (this.night ? 6 : 2.2) : (this.night ? 1.8 : 1));
      });
    }

    car.steer = THREE.MathUtils.lerp(car.steer, steerInput * 0.65, 8.5 * dt);

    // Body roll suspensi realistis saat menikung tajam
    const targetRoll = -car.steer * (car.speed / maxSpeed) * 0.08;
    car.bodyRoll = THREE.MathUtils.lerp(car.bodyRoll, targetRoll, 10 * dt);
    car.group.rotation.z = car.bodyRoll;

    if (Math.abs(car.speed) > 0.15) {
      const dirSign = car.speed >= 0 ? 1 : -1;
      car.group.rotation.y += car.steer * 2.25 * dt * dirSign;

      const forwardX = -Math.sin(car.group.rotation.y);
      const forwardZ = -Math.cos(car.group.rotation.y);
      car.group.position.x += forwardX * car.speed * dt;
      car.group.position.z += forwardZ * car.speed * dt;
    }

    car.wheels.forEach((w) => {
      w.rotation.x -= car.speed * dt * 2.4;
    });
  }
}
