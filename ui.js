import { clamp, worldToMap } from './utils.js';

export class UIManager {
  constructor(){
    this.phaseText = document.getElementById('phaseText');
    this.objectiveText = document.getElementById('objectiveText');
    this.healthFill = document.getElementById('healthFill');
    this.energyFill = document.getElementById('energyFill');
    this.shardCount = document.getElementById('shardCount');
    this.waveCount = document.getElementById('waveCount');
    this.scoreCount = document.getElementById('scoreCount');
    this.bossHealthText = document.getElementById('bossHealthText');
    this.log = document.getElementById('log');
    this.overlay = document.getElementById('overlay');
    this.overlayTitle = document.getElementById('overlayTitle');
    this.overlayText = document.getElementById('overlayText');
    this.restartBtn = document.getElementById('restartBtn');
    this.loading = document.getElementById('loading');
    this.minimap = document.getElementById('minimap');
    this.mctx = this.minimap.getContext('2d');
    this.message = '';
    this.messageTimer = 0;
    this.recentLines = [];

    this.restartBtn.addEventListener('click', () => {
      this.overlay.classList.add('hidden');
      this.onRestart?.();
    });
  }

  hideLoading(){
    this.loading.classList.add('hidden');
  }

  setMessage(text, seconds = 3.5){
    this.message = text;
    this.messageTimer = seconds;
    this.recentLines.unshift(text);
    this.recentLines = this.recentLines.slice(0, 3);
    this.log.innerHTML = this.recentLines.map(t => `• ${t}`).join('<br>');
  }

  setOverlay(title, text){
    this.overlayTitle.textContent = title;
    this.overlayText.textContent = text;
    this.overlay.classList.remove('hidden');
  }

  updateHUD(state){
    this.phaseText.textContent = state.phaseLabel;
    this.objectiveText.textContent = state.objective;
    this.healthFill.style.width = `${clamp((state.player.hp / state.player.maxHp) * 100, 0, 100)}%`;
    this.energyFill.style.width = `${clamp((state.player.energy / state.player.maxEnergy) * 100, 0, 100)}%`;
    this.shardCount.textContent = `${state.shardsCollected} / ${state.shardTarget}`;
    this.waveCount.textContent = `${state.wave}`;
    this.scoreCount.textContent = `${state.score}`;
    this.bossHealthText.textContent = state.boss ? `${Math.max(0, Math.floor((state.boss.hp / state.boss.maxHp) * 100))}%` : '—';
  }

  updateMessage(dt){
    if (this.messageTimer > 0){
      this.messageTimer -= dt;
      if (this.messageTimer <= 0) this.message = '';
    }
  }

  drawMinimap(state){
    const ctx = this.mctx;
    const size = this.minimap.width;
    ctx.clearRect(0, 0, size, size);

    const gradient = ctx.createRadialGradient(size*0.5, size*0.42, 6, size*0.5, size*0.5, size*0.5);
    gradient.addColorStop(0, 'rgba(19,24,48,0.95)');
    gradient.addColorStop(1, 'rgba(4,7,16,0.98)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    const cx = size * 0.5;
    const cy = size * 0.5;
    const scale = size / (state.worldSize * 2);

    const drawPoint = (x, z, color, r = 3) => {
      const p = worldToMap(x, z, state.worldSize, size * 0.42);
      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.arc(cx + p.x, cy + p.y, r, 0, Math.PI * 2);
      ctx.fill();
    };

    // ring
    ctx.strokeStyle = 'rgba(123,135,255,0.28)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, size*0.42, 0, Math.PI*2);
    ctx.stroke();

    // portal
    if (state.portal){
      drawPoint(state.portal.position.x, state.portal.position.z, 'rgba(53,224,201,0.95)', 5);
    }

    // shards
    for (const shard of state.shards){
      if (!shard.collected) drawPoint(shard.position.x, shard.position.z, 'rgba(193,201,255,0.9)', 2.4);
    }

    // enemies
    for (const enemy of state.enemies){
      drawPoint(enemy.position.x, enemy.position.z, enemy.isBoss ? 'rgba(255,95,122,0.95)' : 'rgba(255,171,75,0.9)', enemy.isBoss ? 4.5 : 2.8);
    }

    // player
    drawPoint(state.player.position.x, state.player.position.z, 'rgba(255,255,255,1)', 4.5);

    // north marker
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.beginPath();
    ctx.moveTo(cx, cy - size * 0.42);
    ctx.lineTo(cx, cy - size * 0.36);
    ctx.stroke();
  }
}
