// People: Dario on foot, and the pedestrians of Solmar. The player moves,
// fights and steals cars here; peds wander the sidewalks and flee from
// gunfire and speeding cars (game-ai: a two-state FSM — wander / flee —
// with hysteresis so they do not flicker between the two).

import { WORLD, TUNING, PED_SHIRTS } from './config.js';
import { clamp, dist, angleDiff } from './util.js';

export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.r = TUNING.playerRadius;
    this.angle = -Math.PI / 2; // facing north
    this.health = TUNING.playerHealth;
    this.ammo = TUNING.pistolAmmo;
    this.car = null; // the Car being driven, or null when on foot
    this.punchCd = 0;
    this.shootCd = 0;
    this.hurtCd = 0;
    this.dead = false;
    this.runDust = 0;
  }

  get speed() {
    return Math.hypot(this.vx, this.vy);
  }

  update(dt, W) {
    const input = W.input;
    if (this.punchCd > 0) this.punchCd -= dt;
    if (this.shootCd > 0) this.shootCd -= dt;
    if (this.hurtCd > 0) this.hurtCd -= dt;
    if (this.dead) return;

    if (this.car) {
      // Driving is the car's job; the player just rides along.
      this.x = this.car.x;
      this.y = this.car.y;
      this.angle = this.car.angle;
      if (input.actionPressed('enter')) this.exitCar(W);
      return;
    }

    const mv = input.moveVector();
    const running = input.actionHeld('run');
    const speed = running ? TUNING.runSpeed : TUNING.walkSpeed;
    const accel = 1400;
    this.vx += (mv.x * speed - this.vx) * Math.min(1, accel * dt / speed);
    this.vy += (mv.y * speed - this.vy) * Math.min(1, accel * dt / speed);
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.x = clamp(this.x, 20, WORLD.width - 20);
    this.y = clamp(this.y, 20, WORLD.height - 20);
    W.city.collideCircle(this);
    if (W.city.isWater(this.x, this.y) && !W.city.isPier(this.x, this.y)) {
      // The sea pushes back: nobody swims in SOLMAR.
      this.x = Math.min(this.x, 3438);
      this.vx = 0;
    }

    // Face movement, or the mouse when aiming with a weapon out.
    const mouse = W.camera.toWorld(input.mouse.x, input.mouse.y, W.viewW, W.viewH);
    if (input.mouseDown || this.shootCd > 0.12) {
      this.angle = Math.atan2(mouse.y - this.y, mouse.x - this.x);
    } else if (this.speed > 12) {
      this.angle = Math.atan2(this.vy, this.vx);
    }

    // Footstep dust while running.
    this.runDust -= dt;
    if (this.speed > 200 && this.runDust <= 0) {
      this.runDust = 0.16;
      W.fx.smoke(this.x, this.y + 8, 1);
    }

    // Buffered discrete actions (input-systems: an early press still fires).
    if (input.actionPressed('punch')) input.bufferPress('punch', W.time);
    if (input.actionPressed('enter')) input.bufferPress('enter', W.time);
    if (input.consume('punch', W.time)) this.punch(W);
    if (input.consume('enter', W.time)) this.tryEnterCar(W);
    if (input.actionPressed('shoot') || input.mouseDown) this.shoot(W, mouse);
    if (input.actionPressed('reload')) this.reload(W);
    if (input.actionPressed('horn')) W.audio.horn();
  }

  punch(W) {
    if (this.punchCd > 0) return;
    this.punchCd = TUNING.punchCooldown;
    W.audio.punch();
    const range = TUNING.punchRange;
    const hit = W.actors.nearestPunchable(this.x, this.y, this.angle, range);
    if (hit) {
      hit.target.takeHit(TUNING.punchDamage, this.angle, W, true);
      W.fx.burst(this.x + Math.cos(this.angle) * 22, this.y + Math.sin(this.angle) * 22, 5, '#fff', 120, 0.25, 2);
      W.camera.addTrauma(0.12);
    }
  }

  shoot(W, mouse) {
    if (this.shootCd > 0 || this.ammo <= 0) {
      if (this.ammo <= 0 && this.shootCd <= 0) {
        this.shootCd = 0.3;
        W.audio.blip(140, 0.06, 'square', 0.08); // dry click
      }
      return;
    }
    this.shootCd = TUNING.pistolCooldown;
    this.ammo--;
    const angle = Math.atan2(mouse.y - this.y, mouse.x - this.x);
    this.angle = angle;
    W.audio.shoot();
    W.camera.addTrauma(0.14);
    W.recentShot = 2; // peds nearby hear it and flee
    const mx = this.x + Math.cos(angle) * 20;
    const my = this.y + Math.sin(angle) * 20;
    W.fx.muzzle(mx, my, angle);
    const hit = W.actors.nearestAlongRay(this.x, this.y, angle, TUNING.pistolRange);
    if (hit) {
      hit.target.takeHit(TUNING.pistolDamage, angle, W, true);
      W.fx.sparks(hit.x, hit.y, 6);
    }
    W.police.addCrime('shoot', 6);
    W.stats.shotsFired++;
  }

  reload(W) {
    if (this.ammo < TUNING.pistolAmmo) {
      this.ammo = TUNING.pistolAmmo;
      W.audio.blip(520, 0.06, 'sine', 0.1);
    }
  }

  tryEnterCar(W) {
    const car = W.vehicles.nearestCar(this.x, this.y, 44);
    if (!car) return;
    if (car.driver === 'ped' || car.driver === 'traffic') {
      // Carjacking: the driver is pulled out, the city notices.
      car.driver = null;
      W.police.addCrime('steal', 14);
      W.fx.floatText(this.x, this.y - 24, 'CAR STOLEN!', '#ff5a5a');
      W.audio.crash();
      W.stats.carsStolen++;
    }
    this.car = car;
    car.driver = 'player';
    W.audio.setEngine(0, true);
    W.audio.blip(300, 0.1, 'square', 0.12);
    W.missions.onEnterCar(car);
  }

  exitCar(W) {
    const car = this.car;
    if (!car) return;
    this.car = null;
    car.driver = null;
    // Step out to the side of the car, clear of its body.
    const side = Math.PI / 2;
    this.x = car.x + Math.cos(car.angle + side) * 34;
    this.y = car.y + Math.sin(car.angle + side) * 34;
    this.vx = 0;
    this.vy = 0;
    W.city.collideCircle(this);
    W.audio.setEngine(0, false);
  }

  takeDamage(amount, W) {
    if (this.hurtCd > 0 || this.dead) return;
    this.hurtCd = 0.35;
    this.health -= amount;
    W.camera.addTrauma(0.3);
    W.fx.blood(this.x, this.y);
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
      W.onPlayerDown();
    }
  }

  heal(amount) {
    this.health = Math.min(TUNING.playerHealth, this.health + amount);
  }
}

// One pedestrian: wanders between sidewalk points, flees danger, can be
// knocked down. Kept deliberately simple — the crowd's life comes from
// numbers and variety, not from deep individual brains.
export class Ped {
  constructor(x, y, rng) {
    this.x = x;
    this.y = y;
    this.r = 11;
    this.angle = rng.range(0, Math.PI * 2);
    this.speed = rng.range(28, 52);
    this.shirt = rng.pick(PED_SHIRTS);
    this.skin = ['#e8b98a', '#c98a5e', '#8a5e3f', '#f0c8a0'][rng.int(0, 3)];
    this.state = 'walk'; // walk | idle | flee | down
    this.stateT = rng.range(0, 4);
    this.target = { x, y };
    this.health = 40;
    this.down = false;
    this.fleeT = 0;
  }

  // byPlayer: only the player's violence is a crime. A traffic accident
  // knocks the ped down without putting a star on Dario.
  takeHit(dmg, angle, W, byPlayer = false) {
    if (this.down) return;
    this.health -= dmg;
    W.fx.blood(this.x, this.y);
    if (this.health <= 0) {
      this.down = true;
      this.state = 'down';
      if (byPlayer) W.police.addCrime('assault', 10);
      W.stats.pedsDown++;
    } else {
      this.state = 'flee';
      this.fleeT = 3;
      this.angle = angle + Math.PI + (Math.random() - 0.5);
    }
  }

  update(dt, W) {
    if (this.down) return;
    this.stateT -= dt;
    const player = W.player;
    const dPlayer = dist(this.x, this.y, player.x, player.y);
    // Perception (game-ai: cheap distance check first, then decide).
    if (this.state !== 'flee' && (dPlayer < 90 && W.recentShot > 0 || dPlayer < 55 && player.car && player.car.speed > 200)) {
      this.state = 'flee';
      this.fleeT = 2.5;
    }
    if (this.state === 'flee') {
      this.fleeT -= dt;
      const away = Math.atan2(this.y - player.y, this.x - player.x);
      this.angle += angleDiff(this.angle, away) * Math.min(1, 6 * dt);
      this.x += Math.cos(this.angle) * this.speed * 2.4 * dt;
      this.y += Math.sin(this.angle) * this.speed * 2.4 * dt;
      if (this.fleeT <= 0 && dPlayer > 260) this.state = 'walk';
    } else if (this.state === 'walk') {
      if (dist(this.x, this.y, this.target.x, this.target.y) < 14 || this.stateT <= 0) {
        if (Math.random() < 0.3) {
          this.state = 'idle';
          this.stateT = 1 + Math.random() * 3;
        } else {
          // Wander to a sidewalk point, never the middle of the road.
          this.target = W.city.sidewalkPoint(
            this.x + (Math.random() - 0.5) * 500,
            this.y + (Math.random() - 0.5) * 500,
            W.rng,
          );
          this.stateT = 8;
        }
      }
      const a = Math.atan2(this.target.y - this.y, this.target.x - this.x);
      this.angle += angleDiff(this.angle, a) * Math.min(1, 5 * dt);
      this.x += Math.cos(this.angle) * this.speed * dt;
      this.y += Math.sin(this.angle) * this.speed * dt;
    } else if (this.state === 'idle') {
      if (this.stateT <= 0) this.state = 'walk';
    }
    this.x = clamp(this.x, 16, WORLD.width - 16);
    this.y = clamp(this.y, 16, WORLD.height - 16);
    W.city.collideCircle(this);
  }
}

export class PedManager {
  constructor(W) {
    this.W = W;
    this.peds = [];
    const rng = W.rng;
    for (let i = 0; i < 42; i++) {
      const p = W.city.sidewalkPoint(rng.range(200, WORLD.width - 200), rng.range(200, WORLD.height - 200), rng);
      this.peds.push(new Ped(p.x, p.y, rng));
    }
  }

  update(dt) {
    const W = this.W;
    for (const p of this.peds) p.update(dt, W);
    // Keep the crowd near the player: recycle peds that drifted far away,
    // dropping them back on a sidewalk near the action.
    for (const p of this.peds) {
      if (dist(p.x, p.y, W.player.x, W.player.y) > 1300) {
        const near = W.city.sidewalkPoint(
          W.player.x + (Math.random() - 0.5) * 900,
          W.player.y + (Math.random() - 0.5) * 900,
          W.rng,
        );
        p.x = near.x;
        p.y = near.y;
        p.down = false;
        p.health = 40;
        p.state = 'walk';
      }
    }
  }

  // Nearest punchable target in front of the player: a ped or a cop.
  nearestPunchable(x, y, angle, range) {
    let best = null;
    let bestD = range;
    const consider = (t, tx, ty) => {
      const d = dist(x, y, tx, ty);
      if (d > bestD) return;
      const a = Math.atan2(ty - y, tx - x);
      if (Math.abs(angleDiff(angle, a)) > 1.1) return;
      best = { target: t, x: tx, y: ty };
      bestD = d;
    };
    for (const p of this.peds) if (!p.down) consider(p, p.x, p.y);
    for (const c of this.W.police.cops) if (!c.down) consider(c, c.x, c.y);
    return best;
  }

  // Nearest target along a shot ray (peds, cops, and car drivers).
  nearestAlongRay(x, y, angle, range) {
    let best = null;
    let bestD = range;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const consider = (t, tx, ty, radius) => {
      const relX = tx - x;
      const relY = ty - y;
      const along = relX * dx + relY * dy;
      if (along < 0 || along > bestD) return;
      const perp = Math.abs(relX * dy - relY * dx);
      if (perp > radius + 6) return;
      best = { target: t, x: tx, y: ty };
      bestD = along;
    };
    for (const p of this.peds) if (!p.down) consider(p, p.x, p.y, 12);
    for (const c of this.W.police.cops) if (!c.down) consider(c, c.x, c.y, 12);
    for (const car of this.W.vehicles.cars) {
      if (car.driver === 'traffic' || car.driver === 'ped') {
        consider(car, car.x, car.y, 20);
      }
    }
    return best;
  }
}
