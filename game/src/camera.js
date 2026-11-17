// Camera: exponential-smooth follow with a deadzone and look-ahead, clamped
// so the view never shows past the world edge (camera-systems skill), plus
// trauma-based screen shake (game-feel: shake = trauma^2, summed sines,
// decays in real time so it never freezes off-centre).

import { WORLD, TUNING } from './config.js';
import { clamp, smoothFactor } from './util.js';

export class Camera {
  constructor() {
    this.x = WORLD.width / 2;
    this.y = WORLD.height / 2;
    this.zoom = 1;
    this.trauma = 0;
    this.shakeT = 0;
    this._focusX = this.x;
    this._focusY = this.y;
  }

  snapTo(x, y) {
    this.x = x;
    this.y = y;
    this._focusX = x;
    this._focusY = y;
    this.trauma = 0;
  }

  addTrauma(amount) {
    this.trauma = clamp(this.trauma + amount, 0, 1);
  }

  follow(tx, ty, vx, vy, dt, viewW, viewH, zoomTarget) {
    // Deadzone: the focus only moves once the target leaves a small box.
    const dzX = 42, dzY = 30;
    const dx = tx - this._focusX;
    const dy = ty - this._focusY;
    if (Math.abs(dx) > dzX) this._focusX += (Math.abs(dx) - dzX) * Math.sign(dx);
    if (Math.abs(dy) > dzY) this._focusY += (Math.abs(dy) - dzY) * Math.sign(dy);
    // Look-ahead: aim ahead of motion so the player sees where they go.
    const speed = Math.hypot(vx, vy);
    let leadX = 0, leadY = 0;
    if (speed > 20) {
      leadX = (vx / speed) * TUNING.camLookAhead;
      leadY = (vy / speed) * TUNING.camLookAhead;
    }
    const goalX = this._focusX + leadX;
    const goalY = this._focusY + leadY;
    const t = smoothFactor(TUNING.camRate, dt);
    this.x += (goalX - this.x) * t;
    this.y += (goalY - this.y) * t;
    // Zoom eases toward its target and stays inside sane bounds even if a
    // caller passes something wild.
    this.zoom += (zoomTarget - this.zoom) * smoothFactor(2.5, dt);
    this.zoom = clamp(this.zoom, 0.7, 1.15);
    // Clamp the VIEW, not the centre, to the world rectangle.
    const halfW = viewW / 2 / this.zoom;
    const halfH = viewH / 2 / this.zoom;
    this.x = WORLD.width <= viewW / this.zoom
      ? WORLD.width / 2
      : clamp(this.x, halfW, WORLD.width - halfW);
    this.y = WORLD.height <= viewH / this.zoom
      ? WORLD.height / 2
      : clamp(this.y, halfH, WORLD.height - halfH);
  }

  // Shake offset for this frame; call once per render, after follow().
  shakeOffset(dt) {
    if (this.trauma <= 0) return { x: 0, y: 0 };
    this.trauma = Math.max(0, this.trauma - 1.4 * dt);
    const s = this.trauma * this.trauma;
    this.shakeT += dt * 31;
    return {
      x: 13 * s * Math.sin(this.shakeT * 1.7),
      y: 9 * s * Math.sin(this.shakeT * 2.3),
    };
  }

  // World -> screen transform helpers (used by the renderer and the HUD).
  toScreen(wx, wy, viewW, viewH) {
    return {
      x: (wx - this.x) * this.zoom + viewW / 2,
      y: (wy - this.y) * this.zoom + viewH / 2,
    };
  }

  toWorld(sx, sy, viewW, viewH) {
    return {
      x: (sx - viewW / 2) / this.zoom + this.x,
      y: (sy - viewH / 2) / this.zoom + this.y,
    };
  }
}
