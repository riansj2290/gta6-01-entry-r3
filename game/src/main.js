// SOLMAR — boot, main loop and screen state machine. Wires every module
// into one world object W and drives it: title -> play -> pause -> end.
// The game is a single canvas, ES modules, no network, no build step.

import { City } from './city.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { Camera } from './camera.js';
import { Particles } from './fx.js';
import { Renderer } from './render.js';
import { HUD } from './hud.js';
import { Player, PedManager } from './actors.js';
import { VehicleManager } from './vehicles.js';
import { Police } from './police.js';
import { MissionManager } from './missions.js';
import { saveGame, loadGame, hasSave } from './save.js';
import { applyShot } from './shots.js';
import { WORLD, TUNING, RADIO_LINES } from './config.js';
import { clamp, dist } from './util.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const W = {
  time: 0,
  state: 'title', // title | play | pause | end
  endKind: null,
  endTimer: 0,
  cash: TUNING.startCash,
  muted: false,
  hasSave: hasSave(),
  recentShot: 0,
  viewW: window.innerWidth,
  viewH: window.innerHeight,
  stats: { shotsFired: 0, carsStolen: 0, pedsDown: 0, copsDown: 0, missionsDone: 0 },
  radioT: 40,
  radioI: 0,
};

W.city = new City();
W.rng = (() => {
  let s = (Date.now() % 2147483647) || 1;
  return {
    next() {
      s = (s * 1103515245 + 12345) % 2147483648;
      return s / 2147483648;
    },
    range(lo, hi) { return lo + this.next() * (hi - lo); },
    int(lo, hi) { return Math.floor(lo + this.next() * (hi - lo + 1)); },
    pick(arr) { return arr[Math.floor(this.next() * arr.length)]; },
    chance(p) { return this.next() < p; },
  };
})();
W.input = new Input(canvas);
W.audio = new AudioSys();
W.camera = new Camera();
W.fx = new Particles();
W.renderer = new Renderer();
W.hud = new HUD();
W.player = new Player(1900, 700);
W.actors = new PedManager(W);
W.vehicles = new VehicleManager(W);
W.police = new Police(W);
W.missions = new MissionManager(W);

W.saveGame = () => saveGame(W);
W.onPlayerDown = () => {
  W.audio.fail();
  W.audio.setEngine(0, false);
  W.audio.setSiren(false);
  W.endKind = 'wasted';
  W.state = 'end';
  W.endTimer = 0;
};
W.onBusted = () => {
  W.audio.fail();
  W.audio.setEngine(0, false);
  W.cash = Math.max(0, W.cash - 200);
  W.police.clearAll();
  W.endKind = 'busted';
  W.state = 'end';
  W.endTimer = 0;
};
W.onStoryComplete = () => {
  W.hud.showFlash('SOLMAR IS YOURS', 'All six missions complete — free roam!', '#7be07b');
  W.endKind = 'complete';
  W.endTimer = 2.5; // let the flash read before the end screen
};

function resize() {
  W.viewW = window.innerWidth;
  W.viewH = window.innerHeight;
  canvas.width = W.viewW;
  canvas.height = W.viewH;
}
window.addEventListener('resize', resize);
resize();
W.camera.snapTo(W.player.x, W.player.y);

// Leaving the tab mid-game pauses: nobody comes back to a busted Dario.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && W.state === 'play') {
    W.state = 'pause';
    W.audio.setEngine(0, false);
  }
});

// First gesture unlocks audio (browsers block it before then).
const unlockAudio = () => {
  W.audio.ensure();
  window.removeEventListener('pointerdown', unlockAudio);
  window.removeEventListener('keydown', unlockAudio);
};
window.addEventListener('pointerdown', unlockAudio);
window.addEventListener('keydown', unlockAudio);

function applyLoadedSave(data) {
  if (!data) return;
  W.cash = data.cash ?? TUNING.startCash;
  W.missions.index = data.missionIndex ?? 0;
  W.missions.completed = data.completed ?? [];
  if (data.player) {
    W.player.x = clamp(data.player.x ?? 1900, 30, WORLD.width - 30);
    W.player.y = clamp(data.player.y ?? 700, 30, WORLD.height - 30);
    W.player.health = data.player.health ?? TUNING.playerHealth;
  }
  if (data.stats) Object.assign(W.stats, data.stats);
  W.camera.snapTo(W.player.x, W.player.y);
  W.hud.showToast('Save loaded — welcome back to Solmar.');
}

function startGame() {
  W.audio.ensure();
  if (W.hasSave) applyLoadedSave(loadGame());
  W.state = 'play';
  W.missions.say('Mara', 'Dario — Solmar, 6pm. Six jobs, one city. Go to the yellow marker and press E.');
}

function respawn() {
  const p = W.player;
  p.dead = false;
  p.health = TUNING.playerHealth;
  p.ammo = TUNING.pistolAmmo;
  if (p.car) { p.car.driver = null; p.car = null; }
  // The Marina clinic patches Dario up.
  p.x = 2950; p.y = 1300;
  p.vx = 0; p.vy = 0;
  W.police.clearAll();
  W.camera.snapTo(p.x, p.y);
  W.state = 'play';
  W.hud.showToast('Back on your feet. The city is still yours to take.');
}

function update(dt) {
  W.time += dt;
  if (W.recentShot > 0) W.recentShot -= dt;
  W.audio.update();

  if (W.state === 'title') {
    // Slow drift over downtown so the title sits on a living city.
    const t = W.time * 0.02;
    W.camera.snapTo(1900 + Math.sin(t) * 260, 650 + Math.cos(t * 0.7) * 160);
    W.vehicles.update(dt);
    W.actors.update(dt);
    W.fx.update(dt);
    if (W.input.actionPressed('shoot') || W.input.anyKey && W.input.actionPressed('enter')) {
      W.input.anyKey = false;
      startGame();
    }
    if (W.input.mouseDown) startGame();
    return;
  }

  if (W.state === 'pause') {
    if (W.input.actionPressed('pause')) { W.state = 'play'; W.audio.click(); }
    if (W.input.held.has('KeyS')) { W.saveGame(); W.hud.showToast('Game saved.'); }
    if (W.input.held.has('KeyQ')) { W.state = 'title'; W.audio.click(); }
    return;
  }

  if (W.state === 'end') {
    W.fx.update(dt);
    if (W.endKind === 'complete' && W.endTimer > 0) {
      W.endTimer -= dt;
      if (W.endTimer <= 0) { /* stay on the end screen */ }
    }
    if (W.input.mouseDown || W.input.actionPressed('enter')) {
      if (W.endKind === 'complete') { W.state = 'play'; W.endKind = null; }
      else respawn();
    }
    return;
  }

  // --- play ---
  if (W.input.actionPressed('pause')) {
    W.state = 'pause';
    W.audio.click();
    W.input.endFrame();
    return;
  }
  if (W.input.actionPressed('mute')) {
    W.muted = !W.muted;
    W.audio.setMuted(W.muted);
    W.hud.showToast(W.muted ? 'Sound muted (M to unmute)' : 'Sound on');
  }

  // Start a mission by pressing E at the start marker.
  if (!W.missions.active && !W.missions.finished) {
    const m = W.missions.startMarker();
    if (m && dist(W.player.x, W.player.y, m.x, m.y) < 80 && W.input.actionPressed('enter')) {
      W.missions.start();
    }
  }

  W.player.update(dt, W);
  W.vehicles.update(dt, W);
  W.actors.update(dt);
  W.police.update(dt);
  W.missions.update(dt);
  W.fx.update(dt);
  W.hud.update(dt);

  // Camera follows the player (or the car) with a wider zoom while driving.
  const p = W.player;
  const zoom = p.car ? TUNING.camZoomCar : TUNING.camZoomFoot;
  W.camera.follow(p.x, p.y, p.vx, p.vy, dt, W.viewW, W.viewH, zoom);

  // Radio flavour, one line a minute, quiet while wanted.
  W.radioT -= dt;
  if (W.radioT <= 0) {
    W.radioT = 55;
    if (W.police.stars === 0) {
      W.hud.showToast('SOLMAR FM: ' + RADIO_LINES[W.radioI % RADIO_LINES.length]);
      W.radioI++;
    }
  }
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  // Render every frame, in every state, so menus sit on the live city.
  ctx.clearRect(0, 0, W.viewW, W.viewH);
  W.renderer.drawWorld(ctx, W);
  if (W.state === 'play' || W.state === 'pause') W.hud.draw(ctx, W);
  if (W.state === 'title') W.hud.drawTitle(ctx, W, W.viewW, W.viewH);
  if (W.state === 'pause') W.hud.drawPause(ctx, W, W.viewW, W.viewH);
  if (W.state === 'end') W.hud.drawEnd(ctx, W, W.viewW, W.viewH, W.endKind);
  W.input.endFrame();
  requestAnimationFrame(frame);
}

// Staged screenshot mode: ?shot=start|drive|chase|mission
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot) applyShot(shot, W);

window.__solmar = W; // debug handle for play-testing
requestAnimationFrame(frame);
