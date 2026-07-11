import * as THREE from 'three';
import { CONFIG } from './config.js';
import { clamp, smoothStep, angleWrap, randRange, seededRandom } from './utils.js';
import { InputSystem } from './input.js';
import { UIManager } from './ui.js';
import { World } from './world.js';
import { Player, Enemy, Boss, Shard, Projectile, circleHit } from './entities.js';

export class Game {
  constructor(canvas){
    this.canvas = canvas;
    this.ui = new UIManager();
    this.ui.onRestart = () => this.restart();

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(CONFIG.FOG_COLOR, 24, 110);
    this.scene.background = new THREE.Color(CONFIG.FOG_COLOR);

    this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 500);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:false, powerPreference:'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this.input = new InputSystem(canvas, this.ui);

    this.clock = new THREE.Clock();
    this.time = 0;
    this.cameraYaw = 0.4;
    this.cameraPitch = 0.52;
    this.cameraDistance = CONFIG.CAMERA_DISTANCE;

    this.world = new World(this.scene, 1846);
    this.player = new Player(this.scene, this.world);

    this.shards = [];
    this.enemies = [];
    this.projectiles = [];
    this.boss = null;

    this.phase = 'explore';
    this.wave = 1;
    this.waveTimer = 0;
    this.spawnTimer = 0;
    this.score = 0;
    this.shardsCollected = 0;
    this.portalUnlocked = false;
    this.victory = false;
    this.gameOver = false;
    this.started = false;
    this.messageGate = 0;

    this._buildEffects();
    this._spawnShards();
    this._seedAmbientEntities();
    this._bindResize();

    this.ui.setMessage('Locate the Rift Shards and awaken the portal.');
    this.ui.hideLoading();
    this.started = true;

    this._tick = this._tick.bind(this);
    requestAnimationFrame(this._tick);
  }

  _buildEffects(){
    const hemi = new THREE.HemisphereLight(0xa9c2ff, 0x0c1120, 0.85);
    this.scene.add(hemi);

    const rim = new THREE.DirectionalLight(0x90ffe7, 0.4);
    rim.position.set(-20, 18, -12);
    this.scene.add(rim);

    const skyParticles = new THREE.BufferGeometry();
    const count = 420;
    const positions = new Float32Array(count * 3);
    for(let i=0; i<count; i++){
      positions[i*3+0] = (Math.random() - 0.5) * 320;
      positions[i*3+1] = Math.random() * 70 + 8;
      positions[i*3+2] = (Math.random() - 0.5) * 320;
    }
    skyParticles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color: 0xdfe6ff, size: 0.18, transparent:true, opacity: 0.4 });
    this.stars = new THREE.Points(skyParticles, mat);
    this.scene.add(this.stars);
  }

  _seedAmbientEntities(){
    this.shards = [];
    for (let i = 0; i < CONFIG.SHARD_TARGET; i++){
      const pos = this.world.getRandomSpawnPoint(28, 92);
      this.shards.push(new Shard(this.scene, pos, i));
    }
  }

  _spawnShards(){
    this._seedAmbientEntities();
  }

  restart(){
    this._disposeEntities();
    this.player.spawn();
    this.wave = 1;
    this.waveTimer = 0;
    this.spawnTimer = 0;
    this.score = 0;
    this.shardsCollected = 0;
    this.portalUnlocked = false;
    this.victory = false;
    this.gameOver = false;
    this.phase = 'explore';
    this.boss = null;
    this._spawnShards();
    this.ui.setMessage('The vale stirs again. Collect the shards.');
    this.ui.overlay.classList.add('hidden');
  }

  _disposeEntities(){
    for (const e of this.enemies) e.scene.remove(e.group);
    for (const p of this.projectiles) p.destroy();
    if (this.boss) this.boss.scene.remove(this.boss.group);
    for (const s of this.shards) s.scene.remove(s.group);
    this.enemies.length = 0;
    this.projectiles.length = 0;
    this.shards.length = 0;
  }

  _bindResize(){
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  _spawnEnemy(){
    const type = Math.random() < 0.72 ? 'stalker' : 'brute';
    const enemy = new Enemy(this.scene, this.world, type);
    this.enemies.push(enemy);
    return enemy;
  }

  _spawnWave(){
    const count = 2 + this.wave + Math.floor(this.wave * 0.6);
    for (let i = 0; i < count; i++) this._spawnEnemy();
    this.ui.setMessage(`Wave ${this.wave} emerged from the Rift.`);
  }

  _spawnBoss(){
    this.boss = new Boss(this.scene, this.world);
    this.boss.position.set(0, this.world.sampleHeight(0, 0) + 1.8, 0);
    this.boss.group.position.copy(this.boss.position);
    this.phase = 'boss';
    this.ui.setMessage('The Rift Sovereign descends.');
  }

  _openPortal(){
    this.portalUnlocked = true;
    this.phase = 'portal';
    this.ui.setMessage('The portal is awake. Survive the surge and destroy the Sovereign.');
    this._spawnBoss();
  }

  _gameOver(win){
    this.gameOver = true;
    this.victory = win;
    if (win){
      this.ui.setOverlay('Victory', 'The shattered vale is sealed. Your echoes remain in the rift.');
    } else {
      this.ui.setOverlay('Defeated', 'The Rift consumed the last spark of your expedition.');
    }
  }

  _terrainSample = (x, z) => this.world.sampleHeight(x, z);

  _updateCamera(dt){
    const look = this.input.getLookDelta();
    this.cameraYaw -= look.x * CONFIG.CAMERA_LOOK_SENSITIVITY;
    this.cameraPitch = clamp(this.cameraPitch - look.y * CONFIG.CAMERA_LOOK_SENSITIVITY * 0.75, 0.18, 1.08);

    const wheel = this._wheelDelta || 0;
    if (wheel){
      this.cameraDistance = clamp(this.cameraDistance + wheel * CONFIG.CAMERA_ZOOM_STEP, CONFIG.CAMERA_MIN_DISTANCE, CONFIG.CAMERA_MAX_DISTANCE);
      this._wheelDelta = 0;
    }

    const behind = new THREE.Vector3(
      Math.sin(this.cameraYaw) * Math.cos(this.cameraPitch),
      Math.sin(this.cameraPitch),
      Math.cos(this.cameraYaw) * Math.cos(this.cameraPitch)
    ).multiplyScalar(-this.cameraDistance);

    const desired = this.player.position.clone().add(behind);
    desired.y += CONFIG.CAMERA_HEIGHT;
    this.camera.position.lerp(desired, 1 - Math.exp(-8 * dt));
    this.camera.lookAt(this.player.position.x, this.player.position.y + 1.2, this.player.position.z);
  }

  _handlePicking(dt){
    if (this.player.attackReady){
      this.player.consumeAttack();
      const attackFacing = this.player.facing;
      const attackDir = new THREE.Vector3(Math.sin(attackFacing), 0, Math.cos(attackFacing));
      const attackOrigin = this.player.position.clone().addScaledVector(attackDir, 1.8);

      let hits = 0;
      const applyDamage = (enemy) => {
        const toEnemy = enemy.position.clone().sub(attackOrigin);
        toEnemy.y = 0;
        const dist = toEnemy.length();
        if (dist <= CONFIG.ATTACK_RANGE){
          const ang = angleWrap(Math.atan2(toEnemy.x, toEnemy.z) - attackFacing);
          if (Math.abs(ang) <= CONFIG.ATTACK_ARC){
            const dead = enemy.takeDamage(enemy.isBoss ? 18 : 22, attackDir);
            this.score += enemy.isBoss ? 35 : 12;
            hits++;
            return dead;
          }
        }
        return false;
      };

      if (this.boss && applyDamage(this.boss) && this.boss.hp <= 0){
        this._bossDefeated();
      }

      for (let i = this.enemies.length - 1; i >= 0; i--){
        if (applyDamage(this.enemies[i])){
          this.scene.remove(this.enemies[i].group);
          this.enemies.splice(i, 1);
        }
      }

      if (hits > 0) this.ui.setMessage(`Slash landed on ${hits} foe${hits > 1 ? 's' : ''}.`);
    }
  }

  _bossDefeated(){
    this.score += 150;
    this.ui.setMessage('The Rift Sovereign has fallen.');
    this._gameOver(true);
  }

  _updateCombat(dt){
    if (this.gameOver) return;

    this._handlePicking(dt);

    // shard collection
    for (const shard of this.shards){
      if (!shard.collected && circleHit(this.player.position, this.player.radius, shard.position, shard.radius)){
        shard.collect();
        this.shardsCollected++;
        this.score += 25;
        this.ui.setMessage(`Rift Shard recovered (${this.shardsCollected}/${CONFIG.SHARD_TARGET}).`);
      }
    }

    if (!this.portalUnlocked && this.shardsCollected >= CONFIG.SHARD_TARGET){
      this._openPortal();
    }

    // enemy spawns
    this.waveTimer += dt;
    this.spawnTimer += dt;

    if (!this.portalUnlocked && this.spawnTimer >= CONFIG.ENEMY_SPAWN_INTERVAL){
      this.spawnTimer = 0;
      if (this.enemies.length < CONFIG.ENEMY_CAP) this._spawnWave();
      this.wave++;
    }

    // enemy AI
    for (let i = this.enemies.length - 1; i >= 0; i--){
      const enemy = this.enemies[i];
      const dist = enemy.update(dt, this.player, this._terrainSample);
      enemy.updateVisual(dt);

      if (enemy.canAttack(dist)){
        enemy.attack();
        const hitDir = new THREE.Vector3().subVectors(this.player.position, enemy.position).setY(0).normalize();
        if (this.player.takeDamage(enemy.damage, hitDir)){
          this.score = Math.max(0, this.score - 8);
          this.ui.setMessage(enemy.type === 'brute' ? 'A brute tore through your guard.' : 'A stalker struck you.');
        } else {
          this.ui.setMessage('You were hit.');
        }
      }

      if (enemy.hp <= 0){
        this.scene.remove(enemy.group);
        this.enemies.splice(i, 1);
      }
    }

    // boss
    if (this.boss && !this.gameOver){
      const dist = this.boss.update(dt, this.player, this._terrainSample);
      this.boss.updateVisual(dt);
      if (this.boss.canAttack(dist)){
        this.boss.attack();
        const hitDir = new THREE.Vector3().subVectors(this.player.position, this.boss.position).setY(0).normalize();
        const damage = this.boss.phase === 3 ? 34 : this.boss.damage;
        if (this.player.takeDamage(damage, hitDir)){
          this.ui.setMessage('The Sovereign shattered your shield.');
        } else {
          this.ui.setMessage('Boss strike!');
        }
      }

      if (this.boss.hp <= 0){
        this.scene.remove(this.boss.group);
        this._gameOver(true);
      }
    }

    // player death
    if (this.player.hp <= 0){
      this._gameOver(false);
    }
  }

  _updateProjectiles(dt){
    for (let i = this.projectiles.length - 1; i >= 0; i--){
      const p = this.projectiles[i];
      p.update(dt, this._terrainSample);
      if (p.dead || p.life <= 0){
        this.projectiles.splice(i, 1);
      }
    }
  }

  _updateWorld(time, dt){
    this.world.update(time, dt, {
      portalUnlocked: this.portalUnlocked
    });

    for (const shard of this.shards) shard.update(dt, time);
    this.stars.rotation.y += dt * 0.004;
  }

  _updatePlayer(dt){
    this.player.update(dt, this.input, this.cameraYaw, this._terrainSample);
  }

  _tick(){
    const dt = Math.min(this.clock.getDelta(), 0.033);
    this.time += dt;
    if (this.input.paused){
      requestAnimationFrame(this._tick);
      return;
    }

    if (!this.gameOver){
      this._updatePlayer(dt);
      this._updateCamera(dt);
      this._updateCombat(dt);
      this._updateProjectiles(dt);
      this._updateWorld(this.time, dt);
      this.ui.updateHUD({
        phaseLabel: this._phaseLabel(),
        objective: this._objectiveText(),
        player: this.player,
        shardsCollected: this.shardsCollected,
        shardTarget: CONFIG.SHARD_TARGET,
        wave: this.wave,
        score: this.score,
        boss: this.boss,
        worldSize: this.world.worldSize,
        portal: this.world.portal,
        shards: this.shards,
        enemies: this.enemies,
      });
      this.ui.drawMinimap({
        player: this.player,
        shardsCollected: this.shardsCollected,
        shardTarget: CONFIG.SHARD_TARGET,
        wave: this.wave,
        score: this.score,
        boss: this.boss,
        worldSize: this.world.worldSize,
        portal: this.world.portal,
        shards: this.shards,
        enemies: this.enemies,
      });
    }

    this.ui.updateMessage(dt);
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this._tick);
  }

  _phaseLabel(){
    if (this.gameOver) return this.victory ? 'Rift Sealed' : 'Expedition Lost';
    if (this.boss) return `Boss Phase ${this.boss.phase}`;
    if (this.portalUnlocked) return 'Portal Open';
    return 'Shard Hunt';
  }

  _objectiveText(){
    if (this.gameOver) return this.victory ? 'You won. The vale is safe for now.' : 'You lost. Reopen the rift and try again.';
    if (this.portalUnlocked) return 'Defeat the Rift Sovereign to seal the portal.';
    return `Collect ${CONFIG.SHARD_TARGET - this.shardsCollected} more Rift Shard${CONFIG.SHARD_TARGET - this.shardsCollected === 1 ? '' : 's'}.`;
  }
}
