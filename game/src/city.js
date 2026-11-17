// The city of Solmar: a road grid, five districts, buildings, a beach and a
// pier. Generation is seeded, so every load (and every staged screenshot)
// builds the same city. The class answers the questions the simulation asks:
// what district is this, is this point drivable, what does this circle hit,
// where is the nearest road, and how do I draw the minimap.

import { WORLD, AVENUES, STREETS, DISTRICTS, BEACH, WATER, PIER, TUNING } from './config.js';
import { makeRng, clamp, boxesOverlap, pointInBox } from './util.js';

export class City {
  constructor() {
    const rng = makeRng(WORLD.seed);
    this.rng = rng;
    this.buildings = [];
    this.trees = [];
    this.parks = [];
    this.generate();
    this.buildRoadGraph();
  }

  generate() {
    const rng = this.rng;
    // One block per cell between neighbouring avenues and streets.
    for (let ai = 0; ai < AVENUES.length - 1; ai++) {
      for (let si = 0; si < STREETS.length - 1; si++) {
        const x0 = AVENUES[ai] + WORLD.roadWidth / 2 + WORLD.sidewalk;
        const x1 = AVENUES[ai + 1] - WORLD.roadWidth / 2 - WORLD.sidewalk;
        const y0 = STREETS[si] + WORLD.roadWidth / 2 + WORLD.sidewalk;
        const y1 = STREETS[si + 1] - WORLD.roadWidth / 2 - WORLD.sidewalk;
        const cx = (x0 + x1) / 2;
        const cy = (y0 + y1) / 2;
        const d = this.districtAt(cx, cy);
        // The beach strip holds no buildings; the plaza block stays open.
        if (x0 > BEACH.x0 - 60) continue;
        if (d.id === 'oldtown' && ai === 3 && si === 4) {
          this.parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, kind: 'plaza' });
          continue;
        }
        if (d.id === 'suburbs' && rng.chance(0.35)) {
          this.parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, kind: 'park' });
          this.scatterTrees(x0, y0, x1, y1, rng.int(4, 8));
          continue;
        }
        const bw = x1 - x0;
        const bh = y1 - y0;
        const cols = bw > 260 ? 2 : 1;
        const rows = bh > 260 ? 2 : 1;
        for (let c = 0; c < cols; c++) {
          for (let r = 0; r < rows; r++) {
            const bx = x0 + (c * bw) / cols + 8;
            const by = y0 + (r * bh) / rows + 8;
            const bwid = bw / cols - 16;
            const bhei = bh / rows - 16;
            if (bwid < 40 || bhei < 40) continue;
            const tall = d.id === 'downtown' && rng.chance(0.5);
            this.buildings.push({
              x: bx, y: by, w: bwid, h: bhei,
              color: rng.pick(d.building), roof: rng.pick(d.roof),
              tall, floors: tall ? rng.int(6, 14) : rng.int(1, 3),
              district: d.id,
            });
          }
        }
        // Street trees along the block edge in the greener districts.
        if (d.id === 'suburbs' || d.id === 'marina') {
          this.scatterTrees(x0, y0, x1, y1, rng.int(1, 3));
        }
      }
    }
    // The freight yard: containers instead of buildings, top-left industrial.
    for (let i = 0; i < 10; i++) {
      this.buildings.push({
        x: 380 + (i % 5) * 130, y: 380 + Math.floor(i / 5) * 150,
        w: 104, h: 56, color: ['#b8543f', '#3f7d8c', '#c98f2e', '#5d6b84'][i % 4],
        roof: '#4f4a44', tall: false, floors: 1, district: 'industrial', container: true,
      });
    }
    // Fill the margin strips the road grid leaves bare (north, west and
    // south edges) with warehouses and houses, so no one can cruise for a
    // kilometre over featureless ground. Positions sit between the roads,
    // never on them.
    for (let x = 356; x < 3060; x += 400) {
      this.buildings.push({
        x, y: 30, w: 210, h: 180, color: rng.pick(DISTRICTS[0].building),
        roof: rng.pick(DISTRICTS[0].roof), tall: false, floors: 1, district: 'industrial',
      });
      this.buildings.push({
        x, y: 2460, w: 210, h: 120, color: rng.pick(DISTRICTS[3].building),
        roof: rng.pick(DISTRICTS[3].roof), tall: false, floors: 1, district: 'suburbs',
      });
    }
    for (let y = 356; y < 2400; y += 400) {
      this.buildings.push({
        x: 30, y, w: 180, h: 210, color: rng.pick(DISTRICTS[3].building),
        roof: rng.pick(DISTRICTS[3].roof), tall: false, floors: 1, district: 'suburbs',
      });
    }
  }

  scatterTrees(x0, y0, x1, y1, n) {
    const rng = this.rng;
    for (let i = 0; i < n; i++) {
      this.trees.push({
        x: rng.range(x0 + 14, x1 - 14), y: rng.range(y0 + 14, y1 - 14),
        r: rng.range(9, 15),
      });
    }
  }

  districtAt(x, y) {
    for (const d of DISTRICTS) {
      if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d;
    }
    return DISTRICTS[2];
  }

  isWater(x, y) {
    return x > WATER.x0;
  }

  isBeach(x, y) {
    return x >= BEACH.x0 && x <= WATER.x0;
  }

  isPier(x, y) {
    return pointInBox(x, y, PIER.x, PIER.y, PIER.w, PIER.h);
  }

  // Drivable ground: roads, beach, pier and parking lots. Buildings block.
  isRoad(x, y) {
    if (this.isPier(x, y) || this.isBeach(x, y)) return true;
    const half = WORLD.roadWidth / 2;
    for (const ax of AVENUES) if (Math.abs(x - ax) < half) return true;
    for (const sy of STREETS) if (Math.abs(y - sy) < half) return true;
    return false;
  }

  // Resolve a circle against every nearby building. Returns true on contact.
  collideCircle(c) {
    let hit = false;
    for (const b of this.buildings) {
      if (c.x + c.r < b.x - 4 || c.x - c.r > b.x + b.w + 4) continue;
      if (c.y + c.r < b.y - 4 || c.y - c.r > b.y + b.h + 4) continue;
      const nx = clamp(c.x, b.x, b.x + b.w);
      const ny = clamp(c.y, b.y, b.y + b.h);
      const dx = c.x - nx;
      const dy = c.y - ny;
      const d2 = dx * dx + dy * dy;
      if (d2 >= c.r * c.r) continue;
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        const push = (c.r - d) / d;
        c.x += dx * push;
        c.y += dy * push;
      } else {
        const left = c.x - b.x, right = b.x + b.w - c.x;
        const top = c.y - b.y, bottom = b.y + b.h - c.y;
        const m = Math.min(left, right, top, bottom);
        if (m === left) c.x = b.x - c.r;
        else if (m === right) c.x = b.x + b.w + c.r;
        else if (m === top) c.y = b.y - c.r;
        else c.y = b.y + b.h + c.r;
      }
    }
    return hit;
  }

  // True when a rectangle (a car) overlaps any building.
  rectHitsBuilding(x, y, w, h) {
    for (const b of this.buildings) {
      if (boxesOverlap(x, y, w, h, b.x, b.y, b.w, b.h)) return b;
    }
    return null;
  }

  // Road graph: intersections are nodes, neighbouring intersections edges.
  buildRoadGraph() {
    this.nodes = [];
    this.nodeIndex = new Map();
    for (const ax of AVENUES) {
      for (const sy of STREETS) {
        const id = this.nodes.length;
        this.nodes.push({ x: ax, y: sy, id });
        this.nodeIndex.set(ax + ',' + sy, id);
      }
    }
    this.edges = this.nodes.map(() => []);
    const link = (a, b) => { this.edges[a].push(b); this.edges[b].push(a); };
    for (let ai = 0; ai < AVENUES.length; ai++) {
      for (let si = 0; si < STREETS.length; si++) {
        const id = this.nodeIndex.get(AVENUES[ai] + ',' + STREETS[si]);
        if (ai + 1 < AVENUES.length) link(id, this.nodeIndex.get(AVENUES[ai + 1] + ',' + STREETS[si]));
        if (si + 1 < STREETS.length) link(id, this.nodeIndex.get(AVENUES[ai] + ',' + STREETS[si + 1]));
      }
    }
  }

  nearestNode(x, y) {
    let best = 0;
    let bestD = Infinity;
    for (const n of this.nodes) {
      const d = (n.x - x) ** 2 + (n.y - y) ** 2;
      if (d < bestD) { bestD = d; best = n.id; }
    }
    return best;
  }

  // Snap any point onto the nearest road centre line.
  nearestRoadPoint(x, y) {
    let bx = AVENUES[0], bd = Infinity;
    for (const ax of AVENUES) {
      const d = Math.abs(x - ax);
      if (d < bd) { bd = d; bx = ax; }
    }
    let by = STREETS[0], bd2 = Infinity;
    for (const sy of STREETS) {
      const d = Math.abs(y - sy);
      if (d < bd2) { bd2 = d; by = sy; }
    }
    // Pick the closer axis: if we are nearer a vertical road, snap x to it.
    return bd < bd2 ? { x: bx, y: clamp(y, 0, WORLD.height) } : { x: clamp(x, 0, WORLD.width), y: by };
  }

  // A point on the sidewalk beside the nearest road: peds walk here, never
  // in the middle of the traffic.
  sidewalkPoint(x, y, rng) {
    let ax = AVENUES[0], ad = Infinity;
    for (const a of AVENUES) {
      const d = Math.abs(x - a);
      if (d < ad) { ad = d; ax = a; }
    }
    let sy = STREETS[0], sd = Infinity;
    for (const s of STREETS) {
      const d = Math.abs(y - s);
      if (d < sd) { sd = d; sy = s; }
    }
    const side = rng && rng.chance(0.5) ? 1 : -1;
    const off = WORLD.roadWidth / 2 + 14 + (rng ? rng.range(0, 14) : 0);
    if (ad < sd) {
      return { x: clamp(ax + side * off, 20, WORLD.width - 20), y: clamp(y, 20, WORLD.height - 20) };
    }
    return { x: clamp(x, 20, WORLD.width - 20), y: clamp(sy + side * off, 20, WORLD.height - 20) };
  }

  randomRoadPoint(rng) {
    const ax = rng.pick(AVENUES);
    const sy = rng.pick(STREETS);
    return { x: ax + rng.range(-20, 20), y: sy + rng.range(-20, 20) };
  }

  // A short route along the graph (BFS). Traffic follows the returned nodes.
  route(fromId, toId) {
    if (fromId === toId) return [fromId];
    const prev = new Map([[fromId, -1]]);
    const queue = [fromId];
    while (queue.length) {
      const cur = queue.shift();
      for (const nb of this.edges[cur]) {
        if (prev.has(nb)) continue;
        prev.set(nb, cur);
        if (nb === toId) {
          const path = [toId];
          let p = cur;
          while (p !== -1) { path.unshift(p); p = prev.get(p); }
          return path;
        }
        queue.push(nb);
      }
    }
    return [fromId];
  }
}
