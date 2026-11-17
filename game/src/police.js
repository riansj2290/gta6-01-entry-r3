// The law: a heat meter, five wanted stars, and police who respond.
// (game-ai: FSM per cop — patrol / chase / search / arrest — with separate
// enter/exit thresholds and a minimum time in state so they never flicker.
// Perception runs on a slow timer and chases the last known position, not
// the player's live one, once sight is lost.)

import { WORLD, TUNING } from './config.js';
import { clamp, dist, angleDiff } from './util.js';
import { Car } from './vehicles.js';

const STAR_NAMES = ['', '1 STAR', '2 STARS', '3 STARS', '4 STARS', '5 STARS'];

export class Police {
  constructor(W) {
    this.W = W;
    this.heat = 0; // 0..125; stars = floor(heat / 25), capped at 5
    this.copCars = [];
    this.cops = []; // foot cops
    this.spawnT = 0;
    this.seenT = 0; // seconds since any cop last saw the player
    this.lastKnown = { x: 0, y: 0 };
    this.bustT = 0; // arrest progress while a cop touches the player
    this.sirenWasOn = false;
    this.lastReckless = -10; // throttle for repeated reckless-driving crime
  }

  get stars() {
    return Math.min(5, Math.floor(this.heat / TUNING.heatPerStar));
  }

  addCrime(kind, amount) {
    // Reckless driving is one long scrape, not one crime per frame: throttle it.
    if (kind === 'reckless') {
      if (this.W.time - this.lastReckless < 1.5) return;
      this.lastReckless = this.W.time;
    }
    const before = this.stars;
    this.heat = clamp(this.heat + amount, 0, 125);
    const after = this.stars;
    if (after > before) {
      this.W.fx.floatText(this.W.player.x, this.W.player.y - 30, 'WANTED: ' + STAR_NAMES[after], '#ff5a5a');
      this.W.audio.setSiren(after >= 1);
      this.seenT = 0;
      this.lastKnown = { x: this.W.player.x, y: this.W.player.y };
    }
    if (kind === 'shoot' || kind === 'assault' || kind === 'hitped') {
      this.seenT = 0;
      this.lastKnown = { x: this.W.player.x, y: this.W.player.y };
    }
  }

  update(dt) {
    const W = this.W;
    const player = W.player;
    const stars = this.stars;
    // Heat decays; faster when no cop can see the player.
    const decay = this.seenT > 6 ? TUNING.heatDecayHidden : TUNING.heatDecay;
    this.heat = Math.max(0, this.heat - decay * dt);
    if (stars === 0) {
      this.bustT = 0;
      if (this.sirenWasOn) { W.audio.setSiren(false); this.sirenWasOn = false; }
      this.audioIntensity(W, 0);
      // The heat is gone: the cops stand down and their cars join traffic.
      for (const car of this.copCars) {
        car.driver = 'traffic';
        car.route = null;
      }
      this.copCars = [];
      this.cops = [];
      return;
    }
    this.audioIntensity(W, stars / 5);
    if (!this.sirenWasOn) { W.audio.setSiren(true); this.sirenWasOn = true; }

    // Perception tick: can any cop see the player?
    this.seenT += dt;
    const seen = this.anyCopSeesPlayer();
    if (seen) {
      this.seenT = 0;
      this.lastKnown = { x: player.x, y: player.y };
    }

    // Spawn budget scales with stars; cops arrive at the edge of the view.
    this.spawnT -= dt;
    const wantCars = Math.min(TUNING.maxCops[stars], stars >= 3 ? 3 : 2);
    const wantFoot = stars >= 2 ? Math.min(3, stars - 1) : 0;
    if (this.spawnT <= 0) {
      this.spawnT = 1.6;
      if (this.copCars.length < wantCars) this.spawnCopCar();
      if (this.cops.length < wantFoot) this.spawnFootCop();
    }

    // Cop cars chase the last known position, then search around it.
    for (let i = this.copCars.length - 1; i >= 0; i--) {
      const car = this.copCars[i];
      if (car.dead) { this.copCars.splice(i, 1); continue; }
      this.updateCopCar(car, dt);
      if (dist(car.x, car.y, player.x, player.y) > 1700) {
        // Too far to matter: remove it, it will respawn closer.
        car.driver = null;
        this.copCars.splice(i, 1);
        const idx = W.vehicles.cars.indexOf(car);
        if (idx >= 0) W.vehicles.cars.splice(idx, 1);
      }
    }
    for (let i = this.cops.length - 1; i >= 0; i--) {
      const cop = this.cops[i];
      if (cop.down) { this.cops.splice(i, 1); continue; }
      this.updateFootCop(cop, dt);
      if (dist(cop.x, cop.y, player.x, player.y) > 1500) this.cops.splice(i, 1);
    }

    // Arrest: a foot cop touching the player on foot builds the bust meter.
    if (!player.car) {
      let touching = false;
      for (const cop of this.cops) {
        if (dist(cop.x, cop.y, player.x, player.y) < 30) { touching = true; break; }
      }
      if (touching) {
        this.bustT += dt;
        if (this.bustT > 1.6) W.onBusted();
      } else {
        this.bustT = Math.max(0, this.bustT - dt * 2);
      }
    } else {
      this.bustT = 0;
    }
  }

  audioIntensity(W, v) {
    W.audio.setIntensity(v);
  }

  anyCopSeesPlayer() {
    const W = this.W;
    const p = W.player;
    for (const car of this.copCars) {
      if (dist(car.x, car.y, p.x, p.y) < 620) return true;
    }
    for (const cop of this.cops) {
      if (dist(cop.x, cop.y, p.x, p.y) < 380) return true;
    }
    return false;
  }

  spawnCopCar() {
    const W = this.W;
    const p = W.player;
    // Appear on a road just off-screen, ahead of the player's direction.
    const angle = Math.random() * Math.PI * 2;
    let x = p.x + Math.cos(angle) * 950;
    let y = p.y + Math.sin(angle) * 950;
    x = clamp(x, 60, WORLD.width - 60);
    y = clamp(y, 60, WORLD.height - 60);
    const snap = W.city.nearestRoadPoint(x, y);
    const car = new Car(snap.x, snap.y, Math.atan2(p.y - snap.y, p.x - snap.x), {
      driver: 'police', isCop: true, color: '#1c2733', name: 'Solmar PD',
    });
    car.knownX = p.x;
    car.knownY = p.y;
    car.searchT = 0;
    this.copCars.push(car);
    W.vehicles.cars.push(car);
  }

  spawnFootCop() {
    const W = this.W;
    const p = W.player;
    const angle = Math.random() * Math.PI * 2;
    const x = clamp(p.x + Math.cos(angle) * 420, 40, WORLD.width - 40);
    const y = clamp(p.y + Math.sin(angle) * 420, 40, WORLD.height - 40);
    const cop = {
      x, y, r: 12, angle: 0, speed: 150, health: 60, down: false,
      state: 'chase', stateT: 0, shootCd: 0,
      takeHit(dmg, a, W2) {
        if (this.down) return;
        this.health -= dmg;
        W2.fx.blood(this.x, this.y);
        if (this.health <= 0) {
          this.down = true;
          W2.police.addCrime('assault', 14);
          W2.stats.copsDown++;
        }
      },
    };
    this.cops.push(cop);
  }

  updateCopCar(car, dt) {
    const W = this.W;
    const p = W.player;
    // Chase the last known position; if it goes stale, search around it.
    const target = this.seenT < 4
      ? { x: p.x, y: p.y }
      : { x: this.lastKnown.x + Math.sin(W.time * 0.7) * 120, y: this.lastKnown.y + Math.cos(W.time * 0.5) * 120 };
    const want = Math.atan2(target.y - car.y, target.x - car.x);
    const diff = angleDiff(car.angle, want);
    const steer = clamp(diff * 2.4, -1, 1);
    const d = dist(car.x, car.y, target.x, target.y);
    let throttle = 0.9;
    if (d < 60) throttle = 0.2;
    // Ram the player when close and the player is in a car.
    if (p.car && d < 90) throttle = 1;
    car.driveInput(throttle, steer, dt);
    // A cop car that touches the player's car shoves and scratches it —
    // a nudge, not a wrecking ball: 20 damage a second, not 60.
    if (p.car) {
      const pd = dist(car.x, car.y, p.car.x, p.car.y);
      if (pd < 46) {
        p.car.damage(2 * dt * 10, W);
        W.camera.addTrauma(0.1);
      }
    }
    // Cop cars also use the shared building collision via update().
    car.x = clamp(car.x, 30, WORLD.width - 30);
    car.y = clamp(car.y, 30, WORLD.height - 30);
    car.collideBuildings(W);
  }

  updateFootCop(cop, dt) {
    const W = this.W;
    const p = W.player;
    cop.stateT -= dt;
    const d = dist(cop.x, cop.y, p.x, p.y);
    if (cop.state === 'chase') {
      const want = Math.atan2(p.y - cop.y, p.x - cop.x);
      cop.angle += angleDiff(cop.angle, want) * Math.min(1, 6 * dt);
      cop.x += Math.cos(cop.angle) * cop.speed * dt;
      cop.y += Math.sin(cop.angle) * cop.speed * dt;
      // Shoot at the player from range when the player is on foot.
      cop.shootCd -= dt;
      if (!p.car && d < 320 && d > 60 && cop.shootCd <= 0) {
        cop.shootCd = 1.1;
        W.audio.shoot();
        W.fx.muzzle(cop.x + Math.cos(cop.angle) * 18, cop.y + Math.sin(cop.angle) * 18, cop.angle);
        if (Math.random() < 0.35) p.takeDamage(8, W);
      }
      if (d > 700) { cop.state = 'search'; cop.stateT = 4; }
    } else {
      // Search: wander around the last known position.
      if (cop.stateT <= 0) {
        cop.state = 'chase';
      } else {
        cop.x += Math.cos(cop.angle) * cop.speed * 0.5 * dt;
        cop.y += Math.sin(cop.angle) * cop.speed * 0.5 * dt;
        cop.angle += dt * 0.8;
      }
      if (d < 300) cop.state = 'chase';
    }
    cop.x = clamp(cop.x, 20, WORLD.width - 20);
    cop.y = clamp(cop.y, 20, WORLD.height - 20);
    W.city.collideCircle(cop);
  }

  clearAll() {
    const W = this.W;
    for (const car of this.copCars) {
      const idx = W.vehicles.cars.indexOf(car);
      if (idx >= 0) W.vehicles.cars.splice(idx, 1);
    }
    this.copCars = [];
    this.cops = [];
    this.heat = 0;
    this.bustT = 0;
    W.audio.setSiren(false);
    this.sirenWasOn = false;
    W.audio.setIntensity(0);
  }
}
