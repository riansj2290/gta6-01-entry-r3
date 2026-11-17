// Shared math and random helpers for SOLMAR. No game logic lives here, only
// small pure functions every other module can rely on.

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Frame-rate independent exponential smoothing factor (camera-systems skill:
// 1 - exp(-rate * dt) keeps the feel identical at any frame rate).
export function smoothFactor(rate, dt) {
  return 1 - Math.exp(-rate * dt);
}

export function dist2(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

export function dist(ax, ay, bx, by) {
  return Math.sqrt(dist2(ax, ay, bx, by));
}

// Shortest signed difference between two angles, in (-PI, PI].
export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function angleLerp(a, b, t) {
  return a + angleDiff(a, b) * t;
}

// Deterministic PRNG (mulberry32) so the city and the staged screenshots are
// identical on every load. The world seed is fixed; gameplay rolls use a
// separate stream seeded from the wall clock at boot.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed) {
  const next = mulberry32(seed);
  return {
    next,
    range(lo, hi) {
      return lo + next() * (hi - lo);
    },
    int(lo, hi) {
      return Math.floor(lo + next() * (hi - lo + 1));
    },
    pick(arr) {
      return arr[Math.floor(next() * arr.length)];
    },
    chance(p) {
      return next() < p;
    },
  };
}

// Axis-aligned box overlap test, used for building collision.
export function boxesOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

export function pointInBox(px, py, bx, by, bw, bh) {
  return px >= bx && px <= bx + bw && py >= by && py <= by + bh;
}

// Push a circle out of an AABB. Returns true when a push happened.
export function pushCircleOutOfBox(c, box) {
  const nearestX = clamp(c.x, box.x, box.x + box.w);
  const nearestY = clamp(c.y, box.y, box.y + box.h);
  const dx = c.x - nearestX;
  const dy = c.y - nearestY;
  const d2 = dx * dx + dy * dy;
  if (d2 >= c.r * c.r) return false;
  if (d2 > 0.0001) {
    const d = Math.sqrt(d2);
    const push = (c.r - d) / d;
    c.x += dx * push;
    c.y += dy * push;
  } else {
    // Centre is inside the box: shove out along the smallest penetration axis.
    const left = c.x - box.x;
    const right = box.x + box.w - c.x;
    const top = c.y - box.y;
    const bottom = box.y + box.h - c.y;
    const m = Math.min(left, right, top, bottom);
    if (m === left) c.x = box.x - c.r;
    else if (m === right) c.x = box.x + box.w + c.r;
    else if (m === top) c.y = box.y - c.r;
    else c.y = box.y + box.h + c.r;
  }
  return true;
}

// Format a money amount with a thousands separator, e.g. 12,450.
export function fmtCash(n) {
  return Math.floor(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Fisher-Yates shuffle driven by a seeded RNG, so a shuffled deck or loot
// table is reproducible from the seed.
export function shuffle(rng, arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Format a clock time (seconds since mission start) as M:SS.
export function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m + ':' + (s < 10 ? '0' : '') + s;
}
