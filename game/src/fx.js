// Particles and floating text: the juice layer (game-feel). Small, brief,
// exaggerated responses fired together on one event — sparks on a crash,
// smoke from tyres, a muzzle flash, an explosion, cash popping up. Nothing
// here touches the simulation; it only draws.

export class Particles {
  constructor() {
    this.list = [];
    this.texts = [];
  }

  spawn(x, y, vx, vy, life, size, color, gravity = 0) {
    if (this.list.length > 420) return;
    this.list.push({ x, y, vx, vy, life, maxLife: life, size, color, gravity });
  }

  burst(x, y, n, color, speed = 160, life = 0.5, size = 3) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.7);
      this.spawn(x, y, Math.cos(a) * s, Math.sin(a) * s, life * (0.5 + Math.random()), size, color);
    }
  }

  sparks(x, y, n = 10) { this.burst(x, y, n, '#ffd23f', 220, 0.4, 3); }
  smoke(x, y, n = 4) { this.burst(x, y, n, 'rgba(120,120,120,0.5)', 40, 0.9, 6); }
  muzzle(x, y, angle) {
    for (let i = 0; i < 5; i++) {
      const a = angle + (Math.random() - 0.5) * 0.5;
      const s = 260 + Math.random() * 160;
      this.spawn(x, y, Math.cos(a) * s, Math.sin(a) * s, 0.09, 3, '#ffe08a');
    }
  }
  explosion(x, y) {
    this.burst(x, y, 34, '#ff7b2e', 320, 0.8, 5);
    this.burst(x, y, 18, '#ffd23f', 200, 0.5, 4);
    this.burst(x, y, 12, 'rgba(90,90,90,0.6)', 60, 1.4, 8);
  }
  blood(x, y) { this.burst(x, y, 8, '#a02020', 120, 0.5, 3); }

  floatText(x, y, text, color = '#ffd23f') {
    if (this.texts.length > 24) this.texts.shift();
    // Stack repeated callouts instead of printing them on top of each other.
    const sameSpot = this.texts.filter((t) => Math.abs(t.x - x) < 40 && Math.abs(t.y - y) < 40).length;
    this.texts.push({ x, y: y - sameSpot * 18, text, color, life: 1.1, maxLife: 1.1 });
  }

  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) { this.list.splice(i, 1); continue; }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - 2.4 * dt;
      p.vy *= 1 - 2.4 * dt;
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;
      t.y -= 34 * dt;
      if (t.life <= 0) this.texts.splice(i, 1);
    }
  }

  draw(ctx) {
    for (const p of this.list) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.5 + 0.5 * (p.life / p.maxLife)), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.font = 'bold 15px system-ui, sans-serif';
    for (const t of this.texts) {
      ctx.globalAlpha = Math.max(0, t.life / t.maxLife);
      ctx.fillStyle = t.color;
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.lineWidth = 3;
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }
}
