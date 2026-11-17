// HUD and menus, drawn on the canvas over the world (game-ui-ux: HUD
// anchored to corners, driven by game state, one screen at a time — title,
// play, pause, busted, wasted, story complete — as a stack where only the
// top screen takes input).

import { fmtCash, fmtTime } from './util.js';
import { MISSIONS } from './config.js';

export class HUD {
  constructor() {
    this.flash = null; // {text, sub, t, color}
    this.toast = null; // {text, t}
  }

  showFlash(text, sub = '', color = '#ffd23f') {
    this.flash = { text, sub, t: 2.6, color };
  }

  showToast(text) {
    this.toast = { text, t: 3 };
  }

  update(dt) {
    if (this.flash) { this.flash.t -= dt; if (this.flash.t <= 0) this.flash = null; }
    if (this.toast) { this.toast.t -= dt; if (this.toast.t <= 0) this.toast = null; }
  }

  draw(ctx, W) {
    const vw = W.viewW, vh = W.viewH;
    this.drawTopLeft(ctx, W, vw);
    this.drawStars(ctx, W, vw);
    this.drawObjective(ctx, W, vw, vh);
    this.drawDialogue(ctx, W, vw, vh);
    this.drawMinimapBox(ctx, W, vw);
    this.drawSpeed(ctx, W, vw, vh);
    this.drawBustMeter(ctx, W, vw, vh);
    if (this.flash) this.drawFlash(ctx, W, vw, vh);
    if (this.toast) this.drawToast(ctx, W, vw);
  }

  drawTopLeft(ctx, W, vw) {
    const p = W.player;
    const x = 16, y = 16;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.roundRect(x, y, 250, 64, 10);
    ctx.fill();
    // Health bar.
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.roundRect(x + 12, y + 12, 150, 14, 7);
    ctx.fill();
    const hp = Math.max(0, p.health / 100);
    ctx.fillStyle = hp > 0.5 ? '#58c96b' : hp > 0.25 ? '#e8c33f' : '#e84a4a';
    ctx.beginPath();
    ctx.roundRect(x + 12, y + 12, 150 * hp, 14, 7);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('DARIO', x + 170, y + 24);
    // Cash.
    ctx.fillStyle = '#7be07b';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText('$' + fmtCash(W.cash), x + 12, y + 50);
    ctx.fillStyle = '#ccc';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText('AMMO ' + p.ammo + '  •  MISSIONS ' + W.missions.completed.length + '/' + MISSIONS.length, x + 120, y + 50);
    ctx.restore();
  }

  drawStars(ctx, W, vw) {
    const stars = W.police.stars;
    const x = vw - 190, y = 20;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.roundRect(x, y, 174, 34, 10);
    ctx.fill();
    ctx.font = '22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i < stars ? '#ffd23f' : 'rgba(255,255,255,0.25)';
      ctx.fillText('★', x + 22 + i * 32, y + 26);
    }
    ctx.restore();
  }

  drawObjective(ctx, W, vw, vh) {
    const text = W.missions.objectiveText();
    if (!text) return;
    ctx.save();
    ctx.font = 'bold 15px system-ui, sans-serif';
    const w = ctx.measureText(text).width + 28;
    const x = (vw - w) / 2;
    const y = 16;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, 32, 8);
    ctx.fill();
    ctx.fillStyle = '#ffd23f';
    ctx.textAlign = 'left';
    ctx.fillText('◆ ' + text, x + 14, y + 21);
    ctx.restore();
  }

  drawDialogue(ctx, W, vw, vh) {
    const d = W.missions.dialogue;
    if (!d.length) return;
    const line = d[0];
    ctx.save();
    const w = Math.min(vw - 40, 640);
    const x = (vw - w) / 2;
    const y = vh - 118;
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, 58, 10);
    ctx.fill();
    ctx.fillStyle = line.speaker === 'Mara' ? '#7fd4ff' : '#ffb347';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(line.speaker.toUpperCase(), x + 16, y + 20);
    ctx.fillStyle = '#fff';
    ctx.font = '14px system-ui, sans-serif';
    this.wrapText(ctx, line.text, x + 16, y + 40, w - 32, 18);
    ctx.restore();
  }

  wrapText(ctx, text, x, y, maxW, lineH) {
    const words = text.split(' ');
    let line = '';
    let yy = y;
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x, yy);
        line = word;
        yy += lineH;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, x, yy);
  }

  drawMinimapBox(ctx, W, vw) {
    const size = 190;
    const x = vw - size - 16;
    const y = 66;
    W.renderer.drawMinimap(ctx, W, x, y, size);
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.roundRect(x, y + size * (2600 / 3600) + 22, size, 22, 6);
    ctx.fill();
    ctx.fillStyle = '#ccc';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('TIME ' + fmtTime(W.time) + '  •  ' + (W.muted ? 'MUTED (M)' : 'M: MUTE'), x + 8, y + size * (2600 / 3600) + 37);
    ctx.restore();
  }

  drawSpeed(ctx, W, vw, vh) {
    const p = W.player;
    if (!p.car) return;
    const kmh = Math.round(Math.abs(p.car.speed) * 0.36);
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.roundRect(vw - 124, vh - 64, 108, 48, 10);
    ctx.fill();
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(p.car.name.toUpperCase(), vw - 112, vh - 48);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(String(kmh), vw - 62, vh - 26);
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = '#ccc';
    ctx.textAlign = 'left';
    ctx.fillText('km/h', vw - 56, vh - 26);
    ctx.restore();
  }

  drawBustMeter(ctx, W, vw, vh) {
    const b = W.police.bustT;
    if (b <= 0) return;
    ctx.save();
    const w = 260;
    const x = (vw - w) / 2;
    const y = vh / 2 - 90;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, 34, 8);
    ctx.fill();
    ctx.fillStyle = '#ff5a5a';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BUSTED IN ' + Math.max(0, 1.6 - b).toFixed(1) + 's — RUN!', vw / 2, y + 22);
    ctx.restore();
  }

  drawFlash(ctx, W, vw, vh) {
    const f = this.flash;
    ctx.save();
    ctx.globalAlpha = Math.min(1, f.t);
    ctx.fillStyle = f.color;
    ctx.font = 'bold 44px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.lineWidth = 6;
    ctx.strokeText(f.text, vw / 2, vh / 2 - 40);
    ctx.fillText(f.text, vw / 2, vh / 2 - 40);
    if (f.sub) {
      ctx.font = '18px system-ui, sans-serif';
      ctx.fillStyle = '#fff';
      ctx.strokeText(f.sub, vw / 2, vh / 2 - 8);
      ctx.fillText(f.sub, vw / 2, vh / 2 - 8);
    }
    ctx.restore();
  }

  drawToast(ctx, W, vw) {
    const t = this.toast;
    ctx.save();
    ctx.globalAlpha = Math.min(1, t.t);
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.font = '14px system-ui, sans-serif';
    const w = ctx.measureText(t.text).width + 28;
    ctx.beginPath();
    ctx.roundRect((vw - w) / 2, 60, w, 28, 8);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(t.text, vw / 2, 79);
    ctx.restore();
  }

  // ---- Screens ----

  drawTitle(ctx, W, vw, vh) {
    ctx.save();
    // Dim the city behind the title.
    ctx.fillStyle = 'rgba(8,10,18,0.62)';
    ctx.fillRect(0, 0, vw, vh);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 84px system-ui, sans-serif';
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 8;
    ctx.strokeText('SOLMAR', vw / 2, vh / 2 - 110);
    ctx.fillText('SOLMAR', vw / 2, vh / 2 - 110);
    ctx.fillStyle = '#fff';
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillText('An open-world crime story — Dario Cruz & Mara Solis', vw / 2, vh / 2 - 66);
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillStyle = '#ffd9a0';
    const lines = [
      'WASD / Arrows — move & drive      E — steal / enter car      F — punch',
      'Mouse — aim      Click — shoot      R — reload      Shift — run / handbrake',
      'H — horn      P / Esc — pause      M — mute',
      '',
      'Steal cars. Lose the cops. Run the six missions. Own Solmar.',
    ];
    lines.forEach((l, i) => ctx.fillText(l, vw / 2, vh / 2 - 20 + i * 24));
    const has = W.hasSave;
    ctx.fillStyle = '#7be07b';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText(has ? 'CLICK TO CONTINUE — your save is ready' : 'CLICK TO START', vw / 2, vh / 2 + 150);
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText('A complete open world: five districts, traffic, pedestrians, police, missions, saves.', vw / 2, vh / 2 + 182);
    ctx.restore();
  }

  drawPause(ctx, W, vw, vh) {
    ctx.save();
    ctx.fillStyle = 'rgba(8,10,18,0.7)';
    ctx.fillRect(0, 0, vw, vh);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 52px system-ui, sans-serif';
    ctx.fillText('PAUSED', vw / 2, vh / 2 - 60);
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillStyle = '#ccc';
    const lines = [
      'P / Esc — resume',
      'S — save game now',
      'M — ' + (W.muted ? 'unmute' : 'mute'),
      'Q — quit to title',
      '',
      'Missions done: ' + W.missions.completed.length + ' / ' + MISSIONS.length + '    •    Cash: $' + fmtCash(W.cash),
    ];
    lines.forEach((l, i) => ctx.fillText(l, vw / 2, vh / 2 - 10 + i * 26));
    ctx.restore();
  }

  drawEnd(ctx, W, vw, vh, kind) {
    ctx.save();
    ctx.fillStyle = kind === 'complete' ? 'rgba(10,26,12,0.78)' : 'rgba(20,6,8,0.78)';
    ctx.fillRect(0, 0, vw, vh);
    ctx.textAlign = 'center';
    const title = kind === 'busted' ? 'BUSTED' : kind === 'wasted' ? 'WASTED' : 'SOLMAR IS YOURS';
    const color = kind === 'complete' ? '#7be07b' : '#ff5a5a';
    ctx.fillStyle = color;
    ctx.font = 'bold 72px system-ui, sans-serif';
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 8;
    ctx.strokeText(title, vw / 2, vh / 2 - 40);
    ctx.fillText(title, vw / 2, vh / 2 - 40);
    ctx.fillStyle = '#fff';
    ctx.font = '18px system-ui, sans-serif';
    const sub = kind === 'busted'
      ? 'The Solmar PD took you in. You lost $200 bail — and your heat.'
      : kind === 'wasted'
        ? 'Dario went down. Mara patched him up at the Marina clinic.'
        : 'All six missions complete. Dario and Mara drive off into the Solmar sunset.';
    ctx.fillText(sub, vw / 2, vh / 2 + 4);
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillStyle = '#ffd9a0';
    ctx.fillText('Cash $' + fmtCash(W.cash) + '  •  Missions ' + W.missions.completed.length + '/' + MISSIONS.length +
      '  •  Cars stolen ' + W.stats.carsStolen + '  •  Time ' + fmtTime(W.time), vw / 2, vh / 2 + 44);
    ctx.fillStyle = '#7be07b';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText('CLICK TO CONTINUE', vw / 2, vh / 2 + 96);
    ctx.restore();
  }
}
