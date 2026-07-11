import { clamp } from './utils.js';
import * as THREE from 'three';

export class InputSystem {
  constructor(canvas, ui){
    this.canvas = canvas;
    this.ui = ui;

    this.keys = new Set();
    this.pointerDown = false;
    this.pointerId = null;
    this.pointerStart = new THREE.Vector2();
    this.pointerLast = new THREE.Vector2();
    this.lookDelta = new THREE.Vector2();
    this.attackQueued = false;
    this.dashQueued = false;
    this.interactQueued = false;
    this.paused = false;

    this.mobile = matchMedia('(pointer:coarse)').matches || window.innerWidth < 980;

    this.leftStick = { active:false, id:null, base:new THREE.Vector2(), knob:new THREE.Vector2(), vector:new THREE.Vector2() };
    this.rightLook = { active:false, id:null, last:new THREE.Vector2() };

    this._bindKeyboard();
    this._bindPointer();
    this._bindTouchButtons();
  }

  _bindKeyboard(){
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (e.code === 'Space') this.attackQueued = true;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.dashQueued = true;
      if (e.code === 'KeyE') this.interactQueued = true;
      if (e.code === 'KeyP') this.paused = !this.paused;
    }, { passive:false });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
  }

  _bindPointer(){
    this.canvas.addEventListener('pointerdown', (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      this.pointerDown = true;
      this.pointerId = e.pointerId;
      this.pointerStart.set(e.clientX, e.clientY);
      this.pointerLast.set(e.clientX, e.clientY);
      this.canvas.setPointerCapture(e.pointerId);
    });

    window.addEventListener('pointermove', (e) => {
      if (!this.pointerDown || e.pointerId !== this.pointerId) return;
      const dx = e.clientX - this.pointerLast.x;
      const dy = e.clientY - this.pointerLast.y;
      this.lookDelta.x += dx;
      this.lookDelta.y += dy;
      this.pointerLast.set(e.clientX, e.clientY);
    });

    window.addEventListener('pointerup', (e) => {
      if (e.pointerId === this.pointerId){
        this.pointerDown = false;
        this.pointerId = null;
      }
    });

    window.addEventListener('pointercancel', (e) => {
      if (e.pointerId === this.pointerId){
        this.pointerDown = false;
        this.pointerId = null;
      }
    });
  }

  _bindTouchButtons(){
    const bind = (id, prop) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this[prop] = true;
        el.setPointerCapture(e.pointerId);
      });
      el.addEventListener('pointerup', (e) => {
        e.preventDefault();
      });
      el.addEventListener('click', (e) => e.preventDefault());
    };

    bind('btnAttack', 'attackQueued');
    bind('btnDash', 'dashQueued');
    bind('btnInteract', 'interactQueued');

    const stickBase = document.getElementById('stickBase');
    const stickKnob = document.getElementById('stickKnob');
    if (stickBase && stickKnob){
      const maxDist = 42;
      let pid = null;
      let rect = null;

      const setKnob = (dx, dy) => {
        const len = Math.hypot(dx, dy);
        const scale = len > maxDist ? maxDist / len : 1;
        const x = dx * scale;
        const y = dy * scale;
        stickKnob.style.transform = `translate(${x}px, ${y}px)`;
        this.leftStick.vector.set(x / maxDist, y / maxDist);
      };

      stickBase.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        rect = stickBase.getBoundingClientRect();
        pid = e.pointerId;
        this.leftStick.active = true;
        stickBase.setPointerCapture(pid);
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        this.leftStick.base.set(cx, cy);
        this.leftStick.knob.set(e.clientX, e.clientY);
        setKnob(e.clientX - cx, e.clientY - cy);
      });

      window.addEventListener('pointermove', (e) => {
        if (!this.leftStick.active || e.pointerId !== pid || !rect) return;
        const cx = this.leftStick.base.x;
        const cy = this.leftStick.base.y;
        setKnob(e.clientX - cx, e.clientY - cy);
      });

      const resetStick = () => {
        if (!this.leftStick.active) return;
        this.leftStick.active = false;
        pid = null;
        rect = null;
        this.leftStick.vector.set(0, 0);
        stickKnob.style.transform = 'translate(0px, 0px)';
      };

      window.addEventListener('pointerup', (e) => { if (e.pointerId === pid) resetStick(); });
      window.addEventListener('pointercancel', (e) => { if (e.pointerId === pid) resetStick(); });
    }

    const rightZone = document.getElementById('rightZone');
    if (rightZone){
      rightZone.addEventListener('pointerdown', (e) => {
        if (e.target.closest('button')) return;
        this.rightLook.active = true;
        this.rightLook.id = e.pointerId;
        this.rightLook.last.set(e.clientX, e.clientY);
        rightZone.setPointerCapture(e.pointerId);
      });

      window.addEventListener('pointermove', (e) => {
        if (!this.rightLook.active || e.pointerId !== this.rightLook.id) return;
        const dx = e.clientX - this.rightLook.last.x;
        const dy = e.clientY - this.rightLook.last.y;
        this.lookDelta.x += dx;
        this.lookDelta.y += dy;
        this.rightLook.last.set(e.clientX, e.clientY);
      });

      const resetLook = (e) => {
        if (e.pointerId === this.rightLook.id){
          this.rightLook.active = false;
          this.rightLook.id = null;
        }
      };
      window.addEventListener('pointerup', resetLook);
      window.addEventListener('pointercancel', resetLook);
    }
  }

  getMoveVector(){
    const x = (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) - (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0);
    const y = (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0) - (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0);
    const kb = new THREE.Vector2(x, y);

    if (this.leftStick.active){
      const s = this.leftStick.vector;
      kb.x = s.x;
      kb.y = s.y;
    }

    if (kb.lengthSq() > 1) kb.normalize();
    return kb;
  }

  getLookDelta(){
    const delta = this.lookDelta.clone();
    this.lookDelta.set(0, 0);
    return delta;
  }

  consumeActions(){
    const actions = {
      attack: this.attackQueued,
      dash: this.dashQueued,
      interact: this.interactQueued,
    };
    this.attackQueued = false;
    this.dashQueued = false;
    this.interactQueued = false;
    return actions;
  }

  get swipeActive(){
    return this.pointerDown || this.rightLook.active;
  }
}
