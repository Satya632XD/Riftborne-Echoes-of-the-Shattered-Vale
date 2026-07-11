import * as THREE from 'three';

export function clamp(value, min, max){
  return Math.max(min, Math.min(max, value));
}

export function lerp(a, b, t){
  return a + (b - a) * t;
}

export function damp(current, target, lambda, dt){
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

export function smoothStep(edge0, edge1, x){
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function length2(x, z){
  return Math.sqrt(x * x + z * z);
}

export function seededRandom(seed){
  let s = seed >>> 0;
  return function rand(){
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function randRange(rand, min, max){
  return min + (max - min) * rand();
}

export function randInt(rand, min, max){
  return Math.floor(randRange(rand, min, max + 1));
}

export function angleWrap(a){
  while(a > Math.PI) a -= Math.PI * 2;
  while(a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function worldToMap(x, z, worldSize, mapRadius){
  const nx = x / (worldSize * 0.5);
  const nz = z / (worldSize * 0.5);
  return {
    x: nx * mapRadius,
    y: nz * mapRadius
  };
}

export function setVec3(v, x, y, z){
  v.set(x, y, z);
  return v;
}

export function makeGradientTexture(colors){
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = colors.length;
  const ctx = canvas.getContext('2d');
  colors.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(0, i, 1, 1);
  });
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}
