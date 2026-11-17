// Rendering: the city, its people and its cars, drawn on one canvas.
// Only what the camera sees is drawn (culling by the view rectangle).
// The look is a sun-soaked top-down city: warm ground, long soft shadows
// for tall downtown blocks, a blue marina, and a gold-hour tint over all.

import { WORLD, DISTRICTS, BEACH, WATER, PIER, AVENUES, STREETS } from './config.js';
import { clamp } from './util.js';

export class Renderer {
  constructor() {
    this.view = { x0: 0, y0: 0, x1: 0, y1: 0 };
  }

  drawWorld(ctx, W) {
    const cam = W.camera;
    const vw = W.viewW, vh = W.viewH;
    const sh = cam.shakeOffset(1 / 60);
    ctx.save();
    ctx.translate(vw / 2, vh / 2);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x + sh.x, -cam.y + sh.y);
    this.view.x0 = cam.x - vw / 2 / cam.zoom - 60;
    this.view.y0 = cam.y - vh / 2 / cam.zoom - 60;
    this.view.x1 = cam.x + vw / 2 / cam.zoom + 60;
    this.view.y1 = cam.y + vh / 2 / cam.zoom + 60;

    this.drawGround(ctx, W);
    this.drawRoads(ctx, W);
    this.drawParks(ctx, W);
    this.drawPier(ctx, W);
    this.drawBuildings(ctx, W);
    this.drawTrees(ctx, W);
    this.drawMarkers(ctx, W);
    this.drawCars(ctx, W);
    this.drawPeds(ctx, W);
    this.drawCops(ctx, W);
    this.drawPlayer(ctx, W);
    W.fx.draw(ctx);
    ctx.restore();

    // Golden-hour tint over the whole frame.
    ctx.save();
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = '#ffb347';
    ctx.fillRect(0, 0, vw, vh);
    ctx.restore();
  }

  drawGround(ctx, W) {
    const v = this.view;
    ctx.fillStyle = '#8a8a7a';
    ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
    for (const d of DISTRICTS) {
      if (d.x1 < v.x0 || d.x0 > v.x1 || d.y1 < v.y0 || d.y0 > v.y1) continue;
      ctx.fillStyle = d.ground;
      ctx.fillRect(d.x0, d.y0, d.x1 - d.x0, d.y1 - d.y0);
    }
    // Beach then water, east edge.
    ctx.fillStyle = BEACH.sand;
    ctx.fillRect(BEACH.x0, 0, BEACH.x1 - BEACH.x0, WORLD.height);
    ctx.fillStyle = WATER.color;
    ctx.fillRect(WATER.x0, 0, WORLD.width - WATER.x0, WORLD.height);
    // Water shimmer lines.
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 2;
    for (let y = 60; y < WORLD.height; y += 130) {
      const x = WATER.x0 + 30 + ((y * 7) % 90);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 60, y);
      ctx.stroke();
    }
    // Sand speckles.
    ctx.fillStyle = 'rgba(180,150,90,0.5)';
    for (let i = 0; i < 40; i++) {
      const x = BEACH.x0 + ((i * 53) % (BEACH.x1 - BEACH.x0));
      const y = (i * 97) % WORLD.height;
      ctx.fillRect(x, y, 3, 3);
    }
  }

  drawRoads(ctx, W) {
    const v = this.view;
    const half = WORLD.roadWidth / 2;
    ctx.fillStyle = '#3a3a40';
    for (const ax of AVENUES) ctx.fillRect(ax - half, 0, WORLD.roadWidth, WORLD.height);
    for (const sy of STREETS) ctx.fillRect(0, sy - half, WORLD.width, WORLD.roadWidth);
    // Sidewalks: lighter strips along each road.
    ctx.fillStyle = '#9a9a92';
    for (const ax of AVENUES) {
      ctx.fillRect(ax - half - 14, 0, 14, WORLD.height);
      ctx.fillRect(ax + half, 0, 14, WORLD.height);
    }
    for (const sy of STREETS) {
      ctx.fillRect(0, sy - half - 14, WORLD.width, 14);
      ctx.fillRect(0, sy + half, WORLD.width, 14);
    }
    // Centre dashes.
    ctx.strokeStyle = '#e8d23f';
    ctx.lineWidth = 3;
    ctx.setLineDash([22, 26]);
    ctx.beginPath();
    for (const ax of AVENUES) {
      ctx.moveTo(ax, 0);
      ctx.lineTo(ax, WORLD.height);
    }
    for (const sy of STREETS) {
      ctx.moveTo(0, sy);
      ctx.lineTo(WORLD.width, sy);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  drawParks(ctx, W) {
    for (const p of W.city.parks) {
      if (p.x > this.view.x1 || p.x + p.w < this.view.x0 || p.y > this.view.y1 || p.y + p.h < this.view.y0) continue;
      if (p.kind === 'plaza') {
        ctx.fillStyle = '#c9b896';
        ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.fillStyle = '#7fae62';
        ctx.beginPath();
        ctx.arc(p.x + p.w / 2, p.y + p.h / 2, 26, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#5d8a4a';
        ctx.beginPath();
        ctx.arc(p.x + p.w / 2, p.y + p.h / 2, 12, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#6da352';
        ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.fillStyle = '#7fb85e';
        ctx.beginPath();
        ctx.arc(p.x + p.w / 2, p.y + p.h / 2, Math.min(p.w, p.h) / 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  drawPier(ctx, W) {
    ctx.fillStyle = '#8a6a4a';
    ctx.fillRect(PIER.x, PIER.y, PIER.w, PIER.h);
    ctx.strokeStyle = '#6e5238';
    ctx.lineWidth = 2;
    for (let x = PIER.x + 12; x < PIER.x + PIER.w; x += 18) {
      ctx.beginPath();
      ctx.moveTo(x, PIER.y);
      ctx.lineTo(x, PIER.y + PIER.h);
      ctx.stroke();
    }
  }

  drawBuildings(ctx, W) {
    for (const b of W.city.buildings) {
      if (b.x + b.w < this.view.x0 || b.x > this.view.x1 || b.y + b.h < this.view.y0 || b.y > this.view.y1) continue;
      // Soft shadow offset to the south-east sells the height.
      const sh = b.tall ? 14 : 5;
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(b.x + sh, b.y + sh, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
      // Windows: a grid of small lit panes on the roof face.
      if (b.w > 60 && b.h > 50) {
        ctx.fillStyle = 'rgba(255,240,180,0.75)';
        const cols = Math.floor((b.w - 16) / 18);
        const rows = Math.floor((b.h - 16) / 18);
        for (let c = 0; c < cols; c++) {
          for (let r = 0; r < rows; r++) {
            if ((c * 7 + r * 3 + b.x) % 5 === 0) continue;
            ctx.fillRect(b.x + 10 + c * 18, b.y + 10 + r * 18, 8, 8);
          }
        }
      }
      // Rooftop clutter on tall blocks: AC boxes and a vent, so the roofs
      // read as roofs instead of flat colour.
      if (b.tall && b.w > 90 && b.h > 80) {
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(b.x + 14, b.y + 14, 16, 12);
        ctx.fillRect(b.x + b.w - 34, b.y + b.h - 30, 18, 14);
        ctx.beginPath();
        ctx.arc(b.x + b.w / 2, b.y + b.h / 2, 9, 0, Math.PI * 2);
        ctx.fill();
      }
      if (b.container) {
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth = 2;
        ctx.strokeRect(b.x + 3, b.y + 3, b.w - 6, b.h - 6);
      }
    }
  }

  drawTrees(ctx, W) {
    for (const t of W.city.trees) {
      if (t.x < this.view.x0 || t.x > this.view.x1 || t.y < this.view.y0 || t.y > this.view.y1) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.arc(t.x + 3, t.y + 4, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4a7a35';
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5d9440';
      ctx.beginPath();
      ctx.arc(t.x - 2, t.y - 2, t.r * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawMarkers(ctx, W) {
    const marker = W.missions.marker || W.missions.startMarker();
    if (!marker) return;
    const pulse = 1 + Math.sin(W.time * 4) * 0.12;
    const r = 26 * pulse;
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, r, 0, Math.PI * 2);
    ctx.fill();
    // A floating diamond above the marker so it reads at a glance.
    const bob = Math.sin(W.time * 3) * 4;
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.moveTo(marker.x, marker.y - 44 + bob);
    ctx.lineTo(marker.x + 9, marker.y - 30 + bob);
    ctx.lineTo(marker.x, marker.y - 16 + bob);
    ctx.lineTo(marker.x - 9, marker.y - 30 + bob);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // A guiding beam: a faint line from the player toward the marker.
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(W.player.x, W.player.y);
    ctx.lineTo(marker.x, marker.y);
    ctx.stroke();
    ctx.restore();
  }

  drawCarShape(ctx, car) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    const L = car.length, Wd = car.width;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-L / 2 + 3, -Wd / 2 + 4, L, Wd);
    // Body.
    ctx.fillStyle = car.color;
    ctx.beginPath();
    ctx.roundRect(-L / 2, -Wd / 2, L, Wd, 7);
    ctx.fill();
    // Cabin.
    ctx.fillStyle = 'rgba(20,28,38,0.85)';
    ctx.beginPath();
    ctx.roundRect(-L / 2 + 12, -Wd / 2 + 5, L * 0.42, Wd - 10, 4);
    ctx.fill();
    // Windshield + headlights.
    ctx.fillStyle = '#cfe8f2';
    ctx.fillRect(L / 2 - 6, -Wd / 2 + 4, 3, Wd - 8);
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(L / 2 - 2, -Wd / 2 + 2, 3, 4);
    ctx.fillRect(L / 2 - 2, Wd / 2 - 6, 3, 4);
    if (car.isCop) {
      // Light bar.
      ctx.fillStyle = '#ff3b30';
      ctx.fillRect(-4, -Wd / 2 + 2, 8, 5);
      ctx.fillStyle = '#2e6bff';
      ctx.fillRect(-4, Wd / 2 - 7, 8, 5);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 8px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PD', 0, 3);
    }
    if (car.isVan) {
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = 'bold 9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('KESTREL', 2, 3);
    }
    ctx.restore();
  }

  drawCars(ctx, W) {
    for (const car of W.vehicles.cars) {
      if (car.x < this.view.x0 || car.x > this.view.x1 || car.y < this.view.y0 || car.y > this.view.y1) continue;
      if (car.dead) {
        // Wreck: darkened, tilted, smoking.
        ctx.save();
        ctx.globalAlpha = 0.85;
        this.drawCarShape(ctx, { ...car, color: '#2b2b2b' });
        ctx.restore();
        continue;
      }
      this.drawCarShape(ctx, car);
    }
  }

  drawPerson(ctx, x, y, angle, shirt, skin, opts = {}) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(2, 3, 10, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    // Body.
    ctx.fillStyle = shirt;
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    // Head.
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(6, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    // Facing tick.
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(8, -2, 6, 4);
    if (opts.cop) {
      ctx.fillStyle = '#1c2733';
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 7px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PD', 0, 2.5);
      ctx.fillStyle = '#e8b98a';
      ctx.beginPath();
      ctx.arc(6, 0, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawPeds(ctx, W) {
    for (const p of W.actors.peds) {
      if (p.x < this.view.x0 || p.x > this.view.x1 || p.y < this.view.y0 || p.y > this.view.y1) continue;
      if (p.down) {
        ctx.save();
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = p.shirt;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, 13, 7, p.angle, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        continue;
      }
      // Walk bob: the body bobs with the stride.
      const bob = Math.sin(W.time * 9 + p.x) * 1.2;
      this.drawPerson(ctx, p.x, p.y + bob * 0.4, p.angle, p.shirt, p.skin);
    }
  }

  drawCops(ctx, W) {
    for (const c of W.police.cops) {
      if (c.x < this.view.x0 || c.x > this.view.x1 || c.y < this.view.y0 || c.y > this.view.y1) continue;
      if (c.down) {
        ctx.save();
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = '#1c2733';
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, 13, 7, c.angle, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        continue;
      }
      this.drawPerson(ctx, c.x, c.y, c.angle, '#1c2733', '#e8b98a', { cop: true });
    }
  }

  drawPlayer(ctx, W) {
    const p = W.player;
    if (p.dead) return;
    if (p.car) return; // the car drawing carries the player
    // Aim line while the mouse is held (a short, subtle guide).
    if (W.input.mouseDown) {
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + Math.cos(p.angle) * 90, p.y + Math.sin(p.angle) * 90);
      ctx.stroke();
      ctx.restore();
    }
    const bob = p.speed > 12 ? Math.sin(W.time * 11) * 1.4 : 0;
    this.drawPerson(ctx, p.x, p.y + bob * 0.4, p.angle, '#e84a4a', '#e8b98a');
    // Dario's red jacket reads at a glance against the city.
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 8px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('D', 0, 3);
    ctx.restore();
    // Low-health pulse ring.
    if (p.health < 35) {
      ctx.save();
      ctx.globalAlpha = 0.4 + Math.sin(W.time * 6) * 0.2;
      ctx.strokeStyle = '#ff3b30';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 20, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // Minimap: a small live map in the HUD corner. Districts, roads, water,
  // the player (white), cops (blue/red), the mission marker (yellow).
  drawMinimap(ctx, W, x, y, size) {
    const s = size / WORLD.width;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, size, size * (WORLD.height / WORLD.width));
    ctx.clip();
    ctx.fillStyle = 'rgba(10,14,20,0.82)';
    ctx.fillRect(x, y, size, size * (WORLD.height / WORLD.width));
    for (const d of DISTRICTS) {
      ctx.fillStyle = d.ground;
      ctx.globalAlpha = 0.9;
      ctx.fillRect(x + d.x0 * s, y + d.y0 * s, (d.x1 - d.x0) * s, (d.y1 - d.y0) * s);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = WATER.color;
    ctx.fillRect(x + WATER.x0 * s, y, (WORLD.width - WATER.x0) * s, WORLD.height * s);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    for (const ax of AVENUES) {
      ctx.beginPath();
      ctx.moveTo(x + ax * s, y);
      ctx.lineTo(x + ax * s, y + WORLD.height * s);
      ctx.stroke();
    }
    for (const sy of STREETS) {
      ctx.beginPath();
      ctx.moveTo(x, y + sy * s);
      ctx.lineTo(x + WORLD.width * s, y + sy * s);
      ctx.stroke();
    }
    const marker = W.missions.marker || W.missions.startMarker();
    if (marker) {
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.arc(x + marker.x * s, y + marker.y * s, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffd23f';
      ctx.beginPath();
      ctx.arc(x + marker.x * s, y + marker.y * s, 8 + Math.sin(W.time * 4) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const car of W.police.copCars) {
      ctx.fillStyle = '#4a90ff';
      ctx.beginPath();
      ctx.arc(x + car.x * s, y + car.y * s, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    const p = W.player;
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x + p.x * s, y + p.y * s, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // View rectangle.
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = 1;
    const vw = W.viewW / W.camera.zoom * s;
    const vh = W.viewH / W.camera.zoom * s;
    ctx.strokeRect(x + p.x * s - vw / 2, y + p.y * s - vh / 2, vw, vh);
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, size, size * (WORLD.height / WORLD.width));
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    const d = W.city.districtAt(p.x, p.y);
    ctx.fillText(d.name.toUpperCase(), x + 4, y + size * (WORLD.height / WORLD.width) + 15);
  }
}
