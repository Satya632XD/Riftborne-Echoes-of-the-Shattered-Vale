import * as THREE from 'three';
import { clamp, randRange, randInt, seededRandom } from './utils.js';

export class World {
  constructor(scene, rngSeed = 2607){
    this.scene = scene;
    this.rand = seededRandom(rngSeed);
    this.worldSize = 260;
    this.terrain = null;
    this.terrainMesh = null;
    this.decor = new THREE.Group();
    this.scene.add(this.decor);
    this.portalGroup = null;
    this.portal = null;
    this.groundColor = new THREE.Color(0x28324f);
    this.terrainData = null;
    this._build();
  }

  _build(){
    this._buildTerrain();
    this._buildSky();
    this._buildProps();
    this._buildPortal();
    this._buildObelisks();
  }

  _heightFunction(x, z){
    const n1 = Math.sin(x * 0.045) * 2.8 + Math.cos(z * 0.038) * 2.2;
    const n2 = Math.sin((x + z) * 0.018) * 4.0;
    const n3 = Math.cos(Math.hypot(x * 0.018, z * 0.02) * 1.7) * 3.3;
    const crater = Math.exp(-(x*x + z*z) / (2 * 42 * 42)) * -5.6;
    return n1 + n2 + n3 + crater;
  }

  sampleHeight(x, z){
    return this._heightFunction(x, z);
  }

  _buildTerrain(){
    const size = this.worldSize;
    const segments = 120;
    const geo = new THREE.PlaneGeometry(size, size, segments, segments);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    const colors = [];
    const color = new THREE.Color();
    for(let i=0; i<pos.count; i++){
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = this._heightFunction(x, z);
      pos.setY(i, h);
      const t = clamp((h + 10) / 20, 0, 1);
      color.setHSL(0.62 - t * 0.08, 0.34 + t * 0.1, 0.17 + t * 0.2);
      colors.push(color.r, color.g, color.b);
    }

    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 1,
      metalness: 0,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.terrainMesh = mesh;
    this.terrain = geo;
  }

  _buildSky(){
    const skyGeo = new THREE.SphereGeometry(500, 24, 16);
    const skyMat = new THREE.MeshBasicMaterial({
      color: 0x050a18,
      side: THREE.BackSide,
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(sky);

    this.sun = new THREE.DirectionalLight(0xc8d8ff, 3.1);
    this.sun.position.set(35, 60, 18);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 180;
    this.sun.shadow.camera.left = -90;
    this.sun.shadow.camera.right = 90;
    this.sun.shadow.camera.top = 90;
    this.sun.shadow.camera.bottom = -90;
    this.scene.add(this.sun);

    this.ambient = new THREE.AmbientLight(0x596aa8, 1.25);
    this.scene.add(this.ambient);

    this.moon = new THREE.PointLight(0x7b87ff, 1.3, 140, 2);
    this.moon.position.set(-48, 30, -30);
    this.scene.add(this.moon);

    this.fogNear = 26;
    this.fogFar = 100;
  }

  _spawnTree(x, z, scale = 1){
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28 * scale, 0.45 * scale, 2.4 * scale, 7),
      new THREE.MeshStandardMaterial({ color: 0x4c3526, roughness: 1 })
    );
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    trunk.position.set(x, this.sampleHeight(x, z) + 1.15 * scale, z);

    const leaves = new THREE.Mesh(
      new THREE.ConeGeometry(1.4 * scale, 3.4 * scale, 8),
      new THREE.MeshStandardMaterial({ color: 0x355e42, roughness: 1 })
    );
    leaves.castShadow = true;
    leaves.receiveShadow = true;
    leaves.position.set(x, trunk.position.y + 2.3 * scale, z);

    this.decor.add(trunk, leaves);
  }

  _spawnRock(x, z, scale = 1){
    const geo = new THREE.DodecahedronGeometry(0.7 * scale, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0x616a7c, roughness: 1, metalness: 0 });
    const rock = new THREE.Mesh(geo, mat);
    rock.castShadow = true;
    rock.receiveShadow = true;
    rock.rotation.set(this.rand() * Math.PI, this.rand() * Math.PI, this.rand() * Math.PI);
    rock.position.set(x, this.sampleHeight(x, z) + 0.45 * scale, z);
    this.decor.add(rock);
  }

  _spawnCrystal(x, z, scale = 1){
    const geo = new THREE.OctahedronGeometry(0.7 * scale, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x87a5ff,
      emissive: 0x2d3cff,
      emissiveIntensity: 0.5,
      roughness: 0.25,
      metalness: 0.2
    });
    const crystal = new THREE.Mesh(geo, mat);
    crystal.castShadow = true;
    crystal.receiveShadow = true;
    crystal.rotation.set(this.rand() * Math.PI, this.rand() * Math.PI, this.rand() * Math.PI);
    crystal.position.set(x, this.sampleHeight(x, z) + 0.9 * scale, z);
    crystal.userData.spin = 0.4 + this.rand() * 0.7;
    this.decor.add(crystal);
    return crystal;
  }

  _buildProps(){
    this.crystals = [];
    const treeCount = 48;
    const rockCount = 44;
    const crystalCount = 18;

    for(let i=0; i<treeCount; i++){
      const x = randRange(this.rand, -this.worldSize * 0.46, this.worldSize * 0.46);
      const z = randRange(this.rand, -this.worldSize * 0.46, this.worldSize * 0.46);
      if (Math.hypot(x, z) < 18) continue;
      this._spawnTree(x, z, randRange(this.rand, 0.8, 1.45));
    }

    for(let i=0; i<rockCount; i++){
      const x = randRange(this.rand, -this.worldSize * 0.47, this.worldSize * 0.47);
      const z = randRange(this.rand, -this.worldSize * 0.47, this.worldSize * 0.47);
      if (Math.hypot(x, z) < 14) continue;
      this._spawnRock(x, z, randRange(this.rand, 0.75, 1.9));
    }

    for(let i=0; i<crystalCount; i++){
      const angle = (i / crystalCount) * Math.PI * 2 + (this.rand() - 0.5) * 0.35;
      const radius = randRange(this.rand, 18, 42);
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const c = this._spawnCrystal(x, z, randRange(this.rand, 0.9, 1.35));
      this.crystals.push(c);
    }
  }

  _buildPortal(){
    this.portalGroup = new THREE.Group();
    this.portalGroup.position.set(0, this.sampleHeight(0, 0) + 0.4, 0);

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(7.2, 7.8, 0.8, 12),
      new THREE.MeshStandardMaterial({ color: 0x11172b, roughness: 0.9, metalness: 0.1 })
    );
    base.receiveShadow = true;
    this.portalGroup.add(base);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(4.1, 0.34, 12, 28),
      new THREE.MeshStandardMaterial({
        color: 0x3148d4,
        emissive: 0x0e1f66,
        emissiveIntensity: 0.25,
        roughness: 0.4,
        metalness: 0.65
      })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 4.5;
    ring.castShadow = true;
    this.portalGroup.add(ring);

    const inner = new THREE.Mesh(
      new THREE.CircleGeometry(3.75, 40),
      new THREE.MeshBasicMaterial({ color: 0x0b1230, transparent:true, opacity: 0.92, side: THREE.DoubleSide })
    );
    inner.rotation.x = -Math.PI / 2;
    inner.position.y = 4.51;
    this.portalGroup.add(inner);

    const glow = new THREE.PointLight(0x5d72ff, 1.5, 32, 2);
    glow.position.set(0, 4.8, 0);
    this.portalGroup.add(glow);

    this.scene.add(this.portalGroup);
    this.portal = {
      active: false,
      ring,
      inner,
      glow,
      position: this.portalGroup.position
    };
  }

  _buildObelisks(){
    this.obelisks = [];
    const count = 6;
    const radius = 9.8;
    for(let i=0; i<count; i++){
      const a = (i / count) * Math.PI * 2;
      const x = Math.cos(a) * radius;
      const z = Math.sin(a) * radius;
      const h = 6 + (i % 2) * 1.8;
      const obelisk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.65, 1.0, h, 6),
        new THREE.MeshStandardMaterial({ color: 0x20283e, roughness: 0.9, metalness: 0.1 })
      );
      obelisk.castShadow = true;
      obelisk.receiveShadow = true;
      obelisk.position.set(x, this.sampleHeight(x, z) + h / 2, z);
      obelisk.rotation.y = a * 0.5 + Math.PI / 6;
      this.decor.add(obelisk);

      const shard = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.45, 0),
        new THREE.MeshStandardMaterial({ color: 0x8ba8ff, emissive: 0x2940bf, emissiveIntensity: 0.8, roughness: 0.2 })
      );
      shard.position.set(x, obelisk.position.y + h * 0.5 + 0.6, z);
      shard.castShadow = true;
      this.decor.add(shard);
      this.obelisks.push({ obelisk, shard, baseX:x, baseZ:z });
    }
  }

  update(time, dt, state){
    if (this.portalGroup){
      this.portalGroup.rotation.y += dt * 0.15;
      const active = state.portalUnlocked;
      this.portal.visible = true;
      this.portal.ring.material.emissiveIntensity = active ? 1.3 : 0.25;
      this.portal.inner.material.opacity = active ? 0.98 : 0.62;
      this.portal.glow.intensity = active ? 3.8 : 1.5;
      this.portalGroup.scale.setScalar(active ? 1.0 + Math.sin(time * 3.6) * 0.02 : 0.96);
    }

    for (const c of this.crystals){
      if (!c) continue;
      c.rotation.y += dt * (c.userData.spin || 0.5);
      c.position.y += Math.sin(time * 2.4 + c.position.x * 0.15) * 0.001;
    }

    for (const o of this.obelisks){
      o.shard.rotation.x += dt * 1.1;
      o.shard.rotation.y += dt * 0.9;
      o.shard.position.y += Math.sin(time * 2 + o.baseX * 0.1) * 0.001;
    }

    // day-night cycle
    const dayPhase = (time / 240) % 1;
    const sunY = Math.cos(dayPhase * Math.PI * 2) * 48 + 24;
    const sunX = Math.sin(dayPhase * Math.PI * 2) * 60;
    this.sun.position.set(sunX, sunY, 22);
    this.ambient.intensity = 0.8 + 0.5 * (0.5 + 0.5 * Math.sin(dayPhase * Math.PI * 2));
    this.moon.intensity = 0.8 + 0.8 * (0.5 + 0.5 * Math.cos(dayPhase * Math.PI * 2));
  }

  getRandomSpawnPoint(minRadius = 30, maxRadius = 98){
    for(let tries=0; tries<80; tries++){
      const angle = this.rand() * Math.PI * 2;
      const radius = randRange(this.rand, minRadius, maxRadius);
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      if (Math.hypot(x, z) < 16) continue;
      return new THREE.Vector3(x, this.sampleHeight(x, z) + 1.3, z);
    }
    return new THREE.Vector3(maxRadius, this.sampleHeight(maxRadius, 0) + 1.3, 0);
  }
}
