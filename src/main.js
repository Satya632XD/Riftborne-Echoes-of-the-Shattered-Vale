import { Game } from './game.js';

const canvas = document.getElementById('game');
const game = new Game(canvas);

let wheelAccum = 0;
canvas.addEventListener('wheel', (e) => {
  wheelAccum += Math.sign(e.deltaY);
  game._wheelDelta = wheelAccum;
  wheelAccum = 0;
}, { passive:true });

// keep the game reachable from devtools for quick debugging
window.__riftborne = game;
