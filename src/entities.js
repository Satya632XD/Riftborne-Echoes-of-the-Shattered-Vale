import * as THREE from 'three';
import { clamp, damp, angleWrap, lerp } from './utils.js';
import { CONFIG } from './config.js';

function createMaterial(color, emissive = 0x000000, emissiveIntensity = 0){
  return new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity,
    roughness: 0.45,
    metalness: 0.15
  });
}

export class Player {
  constructor(scene, world){
    this.scene = scene;
    this.world = world;
    this.maxHp = CONFIG.INITIAL_PLAYER_HP;
    this.maxEnergy = CONFIG.INITIAL_PLAYER_ENERGY;
    this.hp = this.maxHp;
    this.energy = this.maxEnergy;
    this.score = 0;
    this.radius = CONFIG.PLAYER_RADIUS;
    this.speed = CONFIG.PLAYER_SPEED;
    this.dashSpeed = CONFIG.PLAYER_DASH_SPEED;
    this.energyRegen = 18;
    this.invulnerable = 0;
    this.attackCooldown = 0;
    this.dashCooldown = 0;
    this.dashTimer = 0;
    this.facing = 0;
    this.velocity = new THREE.Vector3();
    this.position = new THREE.Vector3();
    this.spawn();
    this._buildMesh();
  }

  _buildMesh(){
    this.group = new THREE.Group();

    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.7, 1.15, 4, 8),
      createMaterial(0xf5f7ff, 0x6a79ff, 0.04)
    );
    body.castShadow = true;
    body.receiveShadow = true;
    body.position.y = 1.45;
    this.group.add(body);

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 16, 16),
      createMaterial(0x83f7e0, 0x27d8bf, 0.75)
    );
    core.position.set(0, 1.35, 0.2);
    this.group.add(core);

    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 1.0, 1.25),
      createMaterial(0xcfd8ff, 0x8ba8ff, 0.1)
    );
    blade.position.set(0.9, 1.34, 0.0);
    blade.rotation.z = 0.24;
    this.group.add(blade);

    this.group.position.copy(this.position);
    this.scene.add(this.group);
  }

  spawn(){
    this.position.set(0, this.world.sampleHeight(0, 0) + 1.2, 10);
    this.velocity.set(0, 0, 0);
    this.hp = this.maxHp;
    this.energy = this.maxEnergy;
    this.invulnerable = 0;
    this.attackCooldown = 0;
    this.dashCooldown = 0;
    this.dashTimer = 0;
    this.facing = 0;
  }

  update(dt, input, cameraYaw, terrainSample){
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.dashTimer = Math.max(0, this.dashTimer - dt);
    this.invulnerable = Math.max(0, this.invulnerable - dt);

    const move = input.getMoveVector();
    const mag = move.length();
    const actions = input.consumeActions();

    const camForward = new THREE.Vector3(Math.sin(cameraYaw), 0, Math.cos(cameraYaw));
    const camRight = new THREE.Vector3(camForward.z, 0, -camForward.x);

    const moveDir = new THREE.Vector3();
    moveDir.addScaledVector(camRight, move.x);
    moveDir.addScaledVector(camForward, -move.y);
    if (moveDir.lengthSq() > 0.001) moveDir.normalize();

    let speed = this.speed;
    if (this.dashTimer > 0){
      speed = this.dashSpeed;
    }

    this.velocity.x = damp(this.velocity.x, moveDir.x * speed, 12, dt);
    this.velocity.z = damp(this.velocity.z, moveDir.z * speed, 12, dt);

    if (actions.dash && this.dashCooldown <= 0 && this.energy >= 25 && moveDir.lengthSq() > 0.01){
      this.dashCooldown = CONFIG.DASH_COOLDOWN;
      this.dashTimer = CONFIG.DASH_DURATION;
      this.energy = Math.max(0, this.energy - 25);
      this.velocity.x = moveDir.x * this.dashSpeed * 1.15;
      this.velocity.z = moveDir.z * this.dashSpeed * 1.15;
    }

    if (actions.attack) this.wantAttack = true;
    if (actions.interact) this.wantInteract = true;

    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;

    // keep inside the world
    const bound = this.world.worldSize * 0.48;
    this.position.x = clamp(this.position.x, -bound, bound);
    this.position.z = clamp(this.position.z, -bound, bound);

    const groundY = terrainSample(this.position.x, this.position.z) + 1.15;
    this.position.y = lerp(this.position.y, groundY, 1 - Math.exp(-20 * dt));

    if (moveDir.lengthSq() > 0.001){
      this.facing = Math.atan2(moveDir.x, moveDir.z);
    }

    this.energy = clamp(this.energy + this.energyRegen * dt, 0, this.maxEnergy);

    this.group.position.copy(this.position);
    this.group.rotation.y = this.facing;
    this.group.scale.setScalar(this.invulnerable > 0 ? 1.05 + Math.sin(performance.now() * 0.03) * 0.03 : 1.0);

    if (this.group.children[0]) this.group.children[0].material.emissiveIntensity = 0.04 + (this.energy / this.maxEnergy) * 0.06;
  }

  takeDamage(amount, knockDir = new THREE.Vector3()){
    if (this.invulnerable > 0) return false;
    this.hp = Math.max(0, this.hp - amount);
    this.invulnerable = 0.65;
    this.velocity.addScaledVector(knockDir, 5.5);
    return true;
  }

  clearActions(){
    this.wantAttack = false;
    this.wantInteract = false;
  }

  get attackReady(){
    return this.wantAttack && this.attackCooldown <= 0 && this.energy >= 10;
  }

  consumeAttack(){
    this.wantAttack = false;
    this.attackCooldown = CONFIG.ATTACK_COOLDOWN;
    this.energy = Math.max(0, this.energy - 10);
  }
}

export class Enemy {
  constructor(scene, world, type = 'stalker'){
    this.scene = scene;
    this.world = world;
    this.type = type;
    this.isBoss = false;
    this.maxHp = type === 'brute' ? 48 : 22;
    this.hp = this.maxHp;
    this.speed = type === 'brute' ? 6.2 : 8.6;
    this.damage = type === 'brute' ? 18 : 10;
    this.radius = type === 'brute' ? 1.35 : 1.0;
    this.attackRange = type === 'brute' ? 2.2 : 1.7;
    this.attackCooldown = 0;
    this.spin = 0;
    this.position = world.getRandomSpawnPoint(42, 96);
    this.velocity = new THREE.Vector3();
    this._buildMesh();
  }

  _buildMesh(){
    this.group = new THREE.Group();
    const color = this.type === 'brute' ? 0xff7d5d : 0xffb24b;
    const emissive = this.type === 'brute' ? 0x7d1f12 : 0x6e2d06;

    const core = new THREE.Mesh(
      this.type === 'brute' ? new THREE.IcosahedronGeometry(1.1, 0) : new THREE.SphereGeometry(0.75, 16, 14),
      createMaterial(color, emissive, 0.35)
    );
    core.castShadow = true;
    core.receiveShadow = true;
    core.position.y = this.type === 'brute' ? 1.1 : 0.9;
    this.group.add(core);

    const crown = new THREE.Mesh(
      new THREE.TetrahedronGeometry(this.type === 'brute' ? 0.7 : 0.42, 0),
      createMaterial(0x2c1733, 0x000000, 0)
    );
    crown.position.y = this.type === 'brute' ? 2.25 : 1.55;
    crown.rotation.set(0.4, 0.2, 0.1);
    this.group.add(crown);

    if (this.type === 'brute'){
      const shoulder = new THREE.Mesh(
        new THREE.TorusGeometry(1.0, 0.22, 8, 16),
        createMaterial(0x2a2b41, 0x000000, 0)
      );
      shoulder.rotation.x = Math.PI / 2;
      shoulder.position.y = 1.2;
      this.group.add(shoulder);
    }

    this.group.position.copy(this.position);
    this.scene.add(this.group);
  }

  update(dt, player, terrainSample){
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    const toPlayer = new THREE.Vector3().subVectors(player.position, this.position);
    toPlayer.y = 0;
    const dist = toPlayer.length();
    if (dist > 0.001) toPlayer.normalize();

    const speed = this.speed * (this.isBoss ? 0.6 : 1);
    this.velocity.x = damp(this.velocity.x, toPlayer.x * speed, 4.2, dt);
    this.velocity.z = damp(this.velocity.z, toPlayer.z * speed, 4.2, dt);

    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;

    const bound = this.world.worldSize * 0.49;
    this.position.x = clamp(this.position.x, -bound, bound);
    this.position.z = clamp(this.position.z, -bound, bound);

    const y = terrainSample(this.position.x, this.position.z);
    this.position.y = y + (this.type === 'brute' ? 1.6 : 1.0) + Math.sin(performance.now() * 0.002 + this.position.x) * 0.04;

    this.group.position.copy(this.position);
    this.group.rotation.y = Math.atan2(player.position.x - this.position.x, player.position.z - this.position.z);
    this.group.rotation.z = Math.sin(performance.now() * 0.003 + this.position.z) * 0.05;

    return dist;
  }

  canAttack(playerDistance){
    return playerDistance <= this.attackRange && this.attackCooldown <= 0;
  }

  attack(){
    this.attackCooldown = this.type === 'brute' ? 1.4 : 0.95;
  }

  takeDamage(amount, knockDir){
    this.hp = Math.max(0, this.hp - amount);
    this.velocity.addScaledVector(knockDir, 3.2);
    return this.hp <= 0;
  }

  updateVisual(dt){
    const pulse = 1 + Math.sin(performance.now() * 0.01) * 0.03;
    this.group.scale.setScalar(this.isBoss ? pulse * 1.3 : pulse);
  }
}

export class Boss extends Enemy {
  constructor(scene, world){
    super(scene, world, 'brute');
    this.isBoss = true;
    this.maxHp = 360;
    this.hp = this.maxHp;
    this.speed = 5.1;
    this.damage = 24;
    this.radius = 2.6;
    this.attackRange = 3.6;
    this.phase = 1;
    this.attackCooldown = 0;
    this.enrageTimer = 0;
    this.group.scale.setScalar(1.9);
    this.group.children[0].material = createMaterial(0xc13d6f, 0x7d1238, 0.55);
    if (this.group.children[1]) this.group.children[1].material = createMaterial(0x1a1022);
    this.position = new THREE.Vector3(0, world.sampleHeight(0, 0) + 1.8, 0);
    this.group.position.copy(this.position);
  }

  update(dt, player, terrainSample){
    const dist = super.update(dt, player, terrainSample);
    const hpPct = this.hp / this.maxHp;
    this.phase = hpPct < 0.35 ? 3 : hpPct < 0.7 ? 2 : 1;
    this.speed = this.phase === 3 ? 7.4 : this.phase === 2 ? 6.2 : 5.1;
    return dist;
  }

  canAttack(playerDistance){
    return playerDistance <= this.attackRange + (this.phase === 3 ? 1.2 : 0) && this.attackCooldown <= 0;
  }

  attack(){
    this.attackCooldown = this.phase === 3 ? 0.78 : 1.08;
  }
}

export class Shard {
  constructor(scene, position, index){
    this.scene = scene;
    this.index = index;
    this.position = position.clone();
    this.collected = false;
    this.radius = 0.9;
    this._buildMesh();
  }

  _buildMesh(){
    this.group = new THREE.Group();
    const core = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.6, 0),
      new THREE.MeshStandardMaterial({
        color: 0xb8c5ff,
        emissive: 0x3350ff,
        emissiveIntensity: 0.95,
        roughness: 0.22,
        metalness: 0.18
      })
    );
    core.castShadow = true;
    this.group.add(core);

    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(1.1, 0.08, 10, 18),
      new THREE.MeshBasicMaterial({ color: 0x83f7e0, transparent:true, opacity: 0.65 })
    );
    halo.rotation.x = Math.PI / 2;
    this.group.add(halo);

    this.group.position.copy(this.position);
    this.scene.add(this.group);
  }

  update(dt, time){
    if (this.collected) return;
    this.group.rotation.y += dt * 0.8;
    this.group.position.y = this.position.y + Math.sin(time * 2.4 + this.index) * 0.32;
  }

  collect(){
    this.collected = true;
    this.group.visible = false;
  }
}

export class Projectile {
  constructor(scene, position, direction, speed, damage, color = 0xff7b5a){
    this.scene = scene;
    this.position = position.clone();
    this.velocity = direction.clone().normalize().multiplyScalar(speed);
    this.damage = damage;
    this.radius = 0.45;
    this.life = 5.5;
    this.dead = false;
    this._buildMesh(color);
  }

  _buildMesh(color){
    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 12, 12),
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.9,
        roughness: 0.3,
        metalness: 0.0
      })
    );
    this.mesh.castShadow = true;
    this.mesh.position.copy(this.position);
    this.scene.add(this.mesh);

    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.45, 12, 12),
      new THREE.MeshBasicMaterial({ color, transparent:true, opacity: 0.14 })
    );
    this.mesh.add(glow);
  }

  update(dt, terrainSample){
    if (this.dead) return;
    this.life -= dt;
    if (this.life <= 0){
      this.destroy();
      return;
    }
    this.position.addScaledVector(this.velocity, dt);
    this.position.y = terrainSample(this.position.x, this.position.z) + 1.5 + Math.sin(performance.now() * 0.015) * 0.15;
    this.mesh.position.copy(this.position);
    this.mesh.rotation.y += dt * 8;
  }

  destroy(){
    if (this.dead) return;
    this.dead = true;
    this.scene.remove(this.mesh);
  }
}

export function circleHit(aPos, aRadius, bPos, bRadius){
  const dx = aPos.x - bPos.x;
  const dz = aPos.z - bPos.z;
  const r = aRadius + bRadius;
  return dx * dx + dz * dz <= r * r;
}
