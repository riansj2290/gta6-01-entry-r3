// Cars: arcade driving physics, traffic that follows the road graph, and
// the cars the player steals. One Car class serves the player, traffic and
// the police — only the driver differs (game-ai: perceive -> decide ->
// steer, with the road graph as the path layer).

import { WORLD, TUNING, CAR_COLORS, CAR_NAMES } from './config.js';
import { clamp, dist, angleDiff, angleLerp } from './util.js';

export class Car {
  constructor(x, y, angle, opts = {}) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.speed = 0; // signed, along the car's heading
    this.vx = 0;
    this.vy = 0;
    this.color = opts.color || CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];
    this.name = opts.name || CAR_NAMES[Math.floor(Math.random() * CAR_NAMES.length)];
    this.driver = opts.driver !== undefined ? opts.driver : 'traffic'; // player | traffic | police | ped | null (parked)
    this.health = TUNING.carHealth;
    this.dead = false; // wrecked
    this.length = TUNING.carLength;
    this.width = TUNING.carWidth;
    this.isVan = !!opts.isVan;
    if (this.isVan) { this.length = 58; this.width = 26; }
    this.isCop = !!opts.isCop;
    this.route = null; // array of node ids the traffic AI follows
    this.routeI = 0;
    this.cruise = TUNING.trafficCruiseMin
      + Math.random() * (TUNING.trafficCruiseMax - TUNING.trafficCruiseMin);
    this.waitT = 0;
    this.honkT = 0;
    this.skidT = 0;
    this.steerVis = 0;
    this.hitCd = 0; // throttle for building-impact damage
    this.bumpCd = 0; // throttle for car-car impact damage
  }

  get moving() {
    return Math.abs(this.speed) > 8;
  }

  // Arcade bicycle-ish model: accelerate along the heading, steer by speed,
  // grip pulls the velocity back toward the heading (drift when handbrake).
  driveInput(throttle, steer, dt, handbrake = false) {
    const maxF = this.isVan ? TUNING.carMaxSpeed * 0.82 : TUNING.carMaxSpeed;
    if (throttle > 0) this.speed += TUNING.carAccel * throttle * dt;
    else if (throttle < 0) {
      this.speed += (this.speed > 8 ? -TUNING.carBrake : TUNING.carReverse) * -throttle * dt;
    } else {
      this.speed -= this.speed * 0.9 * dt;
    }
    this.speed = clamp(this.speed, -TUNING.carMaxReverse, maxF);
    const steerAmount = steer * TUNING.carTurn * clamp(Math.abs(this.speed) / 120, 0, 1)
      * (this.speed < 0 ? -1 : 1) * dt;
    this.angle += steerAmount;
    this.steerVis = steer;
    // Velocity follows the heading with grip; less grip while handbraking.
    const grip = handbrake ? 2.2 : TUNING.carGrip;
    const tx = Math.cos(this.angle) * this.speed;
    const ty = Math.sin(this.angle) * this.speed;
    const k = Math.min(1, grip * dt);
    this.vx += (tx - this.vx) * k;
    this.vy += (ty - this.vy) * k;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  update(dt, W) {
    if (this.dead) return;
    if (this.hitCd > 0) this.hitCd -= dt;
    if (this.bumpCd > 0) this.bumpCd -= dt;
    if (this.driver === 'player') {
      const input = W.input;
      const throttle = (input.actionHeld('up') ? 1 : 0) - (input.actionHeld('down') ? 1 : 0);
      const steer = (input.actionHeld('left') ? -1 : 0) + (input.actionHeld('right') ? 1 : 0);
      this.driveInput(throttle, steer, dt, input.actionHeld('run'));
      if (input.actionPressed('horn')) W.audio.horn();
      W.audio.setEngine(Math.abs(this.speed) / TUNING.carMaxSpeed, true);
      // Tyre smoke and skid marks at high slip.
      const slip = Math.hypot(this.vx - Math.cos(this.angle) * this.speed, this.vy - Math.sin(this.angle) * this.speed);
      this.skidT -= dt;
      if (slip > 130 && this.skidT <= 0) {
        this.skidT = 0.05;
        W.fx.smoke(this.x - Math.cos(this.angle) * 20, this.y - Math.sin(this.angle) * 20, 1);
      }
    } else if (this.driver === 'traffic') {
      this.updateTraffic(dt, W);
      W.audio.setEngine(0, false);
    }
    // Collisions with buildings: stop and bounce a little, with sparks.
    // Damage is throttled so one long scrape is one crash, not twenty.
    this.x = clamp(this.x, 30, WORLD.width - 30);
    this.y = clamp(this.y, 30, WORLD.height - 30);
    const hit = this.collideBuildings(W);
    if (hit && Math.abs(this.speed) > 120 && this.hitCd <= 0) {
      this.hitCd = 0.6;
      W.fx.sparks(this.x, this.y, 6);
      W.audio.crash();
      W.camera.addTrauma(0.18);
      if (this.driver === 'player') W.police.addCrime('reckless', 2);
      this.damage(8 + Math.abs(this.speed) * 0.02, W);
    }
    if (W.city.isWater(this.x, this.y) && !W.city.isPier(this.x, this.y)) {
      // Cars do not float. Push back onto the beach.
      this.x = Math.min(this.x, 3436);
      this.speed *= 0.4;
    }
  }

  collideBuildings(W) {
    // Treat the car as a circle at its centre for building pushes, then
    // re-check the corners so long cars cannot clip through walls.
    const c = { x: this.x, y: this.y, r: this.length / 2 - 4 };
    const hit = W.city.collideCircle(c);
    if (hit) {
      const oldX = this.x, oldY = this.y;
      this.x = c.x;
      this.y = c.y;
      // A hard push means a real impact: kill some speed.
      if (Math.hypot(this.x - oldX, this.y - oldY) > 1) {
        this.speed *= 0.55;
        this.vx *= 0.55;
        this.vy *= 0.55;
      }
    }
    return hit;
  }

  damage(amount, W) {
    if (this.dead) return;
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
      this.speed = 0;
      this.vx = 0;
      this.vy = 0;
      W.fx.explosion(this.x, this.y);
      W.audio.crash();
      W.camera.addTrauma(0.55);
      if (this.driver === 'player') {
        W.player.exitCar(W);
        W.player.takeDamage(25, W);
      }
      this.driver = null;
    }
  }

  takeHit(dmg, angle, W) {
    // Shooting a car damages it; a wrecked car can explode under the driver.
    this.damage(dmg, W);
    W.fx.sparks(this.x, this.y, 4);
  }

  // Traffic AI: follow the road graph to a random destination, pause at
  // intersections sometimes, slow for the car ahead.
  updateTraffic(dt, W) {
    if (!this.route || this.routeI >= this.route.length) {
      const from = W.city.nearestNode(this.x, this.y);
      const to = Math.floor(Math.random() * W.city.nodes.length);
      this.route = W.city.route(from, to);
      this.routeI = 0;
      if (this.route.length < 2) { this.route = null; return; }
    }
    if (this.waitT > 0) {
      this.waitT -= dt;
      this.driveInput(0, 0, dt);
      return;
    }
    const node = W.city.nodes[this.route[this.routeI]];
    const d = dist(this.x, this.y, node.x, node.y);
    if (d < 26) {
      this.routeI++;
      if (Math.random() < 0.12) this.waitT = 0.4 + Math.random() * 0.9;
      return;
    }
    const want = Math.atan2(node.y - this.y, node.x - this.x);
    const diff = angleDiff(this.angle, want);
    const steer = clamp(diff * 2.2, -1, 1);
    // Slow down for the car ahead so traffic does not pile up.
    let throttle = this.cruise;
    const ahead = W.vehicles.carAhead(this, 70);
    if (ahead) throttle = 0.12;
    // Brake for a pedestrian crossing right ahead — Solmar drivers are
    // careless, but not murderers. The player on foot counts too: stand in
    // front of a car and it slows, which is how carjackings start.
    const aheadActors = [...W.actors.peds];
    if (!W.player.car) aheadActors.push(W.player);
    for (const ped of aheadActors) {
      if (ped.down) continue;
      const relX = ped.x - this.x;
      const relY = ped.y - this.y;
      const along = relX * Math.cos(this.angle) + relY * Math.sin(this.angle);
      const perp = Math.abs(relX * Math.sin(this.angle) - relY * Math.cos(this.angle));
      if (along > 0 && along < 64 && perp < 22) { throttle = 0.08; break; }
    }
    if (Math.abs(diff) > 1.2) throttle = 0.25; // tight turn: ease off
    this.driveInput(throttle, steer, dt);
    // Keep traffic on the road: if pushed off, steer back to the centre.
    if (!W.city.isRoad(this.x, this.y)) {
      const snap = W.city.nearestRoadPoint(this.x, this.y);
      const back = Math.atan2(snap.y - this.y, snap.x - this.x);
      this.angle = angleLerp(this.angle, back, Math.min(1, 3 * dt));
    }
  }
}

export class VehicleManager {
  constructor(W) {
    this.W = W;
    this.cars = [];
    const rng = W.rng;
    // Parked cars along the avenues, plus moving traffic.
    for (let i = 0; i < 16; i++) {
      const p = W.city.randomRoadPoint(rng);
      const angle = rng.chance(0.5) ? 0 : Math.PI / 2;
      const c = new Car(p.x + rng.range(-30, 30), p.y + rng.range(-30, 30), angle + rng.range(-0.1, 0.1), { driver: null });
      this.cars.push(c);
    }
    for (let i = 0; i < 13; i++) {
      const p = W.city.randomRoadPoint(rng);
      const c = new Car(p.x, p.y, rng.range(0, Math.PI * 2), { driver: 'traffic' });
      this.cars.push(c);
    }
    // The armored van for mission 5, parked in the freight yard.
    const van = new Car(900, 500, 0, { driver: null, isVan: true, color: '#3f4a3a', name: 'Kestrel Van' });
    van.missionVan = true;
    this.cars.push(van);
  }

  nearestCar(x, y, range) {
    let best = null;
    let bestD = range;
    for (const c of this.cars) {
      if (c.dead) continue;
      const d = dist(x, y, c.x, c.y);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  // The car directly ahead of `car` within `range` (traffic following).
  carAhead(car, range) {
    const dx = Math.cos(car.angle);
    const dy = Math.sin(car.angle);
    for (const other of this.cars) {
      if (other === car || other.dead) continue;
      const relX = other.x - car.x;
      const relY = other.y - car.y;
      const along = relX * dx + relY * dy;
      if (along < 0 || along > range) continue;
      const perp = Math.abs(relX * dy - relY * dx);
      if (perp < 26) return other;
    }
    return null;
  }

  update(dt) {
    const W = this.W;
    for (const c of this.cars) c.update(dt, W);
    // Car-car collisions: soft push-apart plus a speed exchange.
    for (let i = 0; i < this.cars.length; i++) {
      const a = this.cars[i];
      if (a.dead) continue;
      for (let j = i + 1; j < this.cars.length; j++) {
        const b = this.cars[j];
        if (b.dead) continue;
        const d = dist(a.x, a.y, b.x, b.y);
        const min = 42;
        if (d >= min || d < 0.01) continue;
        const push = (min - d) / 2;
        const nx = (b.x - a.x) / d;
        const ny = (b.y - a.y) / d;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
        const impact = Math.abs(a.speed - b.speed);
        // One crash per contact, not one per frame while they overlap.
        if (impact > 90 && (a.bumpCd <= 0 || b.bumpCd <= 0)) {
          a.bumpCd = 0.5;
          b.bumpCd = 0.5;
          W.fx.sparks((a.x + b.x) / 2, (a.y + b.y) / 2, 5);
          W.audio.crash();
          a.damage(impact * 0.03, W);
          b.damage(impact * 0.03, W);
          if (a.driver === 'player' || b.driver === 'player') {
            W.camera.addTrauma(0.22);
            W.police.addCrime('reckless', 2);
          }
        }
        // Exchange a little speed so the shove reads as a crash, not a slide.
        const tmp = a.speed;
        a.speed = a.speed * 0.7 + b.speed * 0.3;
        b.speed = b.speed * 0.7 + tmp * 0.3;
      }
    }
    // Cars vs peds: a fast car knocks a ped down. Only the player's car is
    // a crime — traffic accidents are the city's problem, not the player's.
    for (const c of this.cars) {
      if (!c.moving || Math.abs(c.speed) < 60) continue;
      for (const p of W.actors.peds) {
        if (p.down) continue;
        if (dist(c.x, c.y, p.x, p.y) < 30) {
          p.takeHit(60, Math.atan2(p.y - c.y, p.x - c.x), W, c.driver === 'player');
          if (c.driver === 'player') W.police.addCrime('hitped', 12);
          W.fx.blood(p.x, p.y);
          c.speed *= 0.8;
        }
      }
    }
    // Keep traffic density around the player.
    let traffic = 0;
    for (const c of this.cars) if (c.driver === 'traffic') traffic++;
    if (traffic < 11 && Math.random() < dt * 0.5) {
      const p = W.city.randomRoadPoint(W.rng);
      const px = W.player.x + (p.x - W.player.x) * 0.3 + (Math.random() - 0.5) * 500;
      const py = W.player.y + (p.y - W.player.y) * 0.3 + (Math.random() - 0.5) * 500;
      this.cars.push(new Car(px, py, Math.random() * Math.PI * 2, { driver: 'traffic' }));
    }
    // Remove wrecks far from the player so the list stays short.
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const c = this.cars[i];
      if (c.dead && !c.missionVan && dist(c.x, c.y, W.player.x, W.player.y) > 1600) {
        this.cars.splice(i, 1);
      }
    }
  }
}
