// Solmar Bay — procedural city generation and collision.
// Roads are a grid with one diagonal avenue; blocks hold buildings, parks,
// parking lots and plazas. Everything is seeded, so the same seed always
// builds the same city (screenshots are reproducible).

import { WORLD, ROAD_LINES, ROAD_HALF, BLOCK, DISTRICTS, districtAt, mulberry32, pick, clamp, circleHitsRect } from './config.js';

export function buildCity(seed) {
  const rng = mulberry32(seed);
  const buildings = [];   // {x,y,w,h,color,district,windows,roof}
  const trees = [];       // {x,y,r}
  const parks = [];       // {x,y,w,h}
  const lamps = [];       // {x,y}
  const parkingLots = []; // {x,y,w,h} — places parked cars spawn
  const plazas = [];

  // The diagonal avenue runs from (0, 2100) to (2100, 0): it is drawn, and
  // buildings are kept clear of a 70px band around it.
  function nearDiagonal(x, y) {
    // line: x + y = 2100
    return Math.abs(x + y - 2100) < 110;
  }
  function onRoad(x, y) {
    for (const c of ROAD_LINES) {
      if (Math.abs(x - c) < ROAD_HALF + 6 || Math.abs(y - c) < ROAD_HALF + 6) return true;
    }
    return false;
  }

  for (let bx = 0; bx < 8; bx += 1) {
    for (let by = 0; by < 8; by += 1) {
      const x0 = ROAD_LINES[bx] + ROAD_HALF;
      const y0 = ROAD_LINES[by] + ROAD_HALF;
      const x1 = (bx + 1 < 8 ? ROAD_LINES[bx + 1] : WORLD) - ROAD_HALF;
      const y1 = (by + 1 < 8 ? ROAD_LINES[by + 1] : WORLD) - ROAD_HALF;
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      const d = districtAt(cx, cy);
      // Airport block: tarmac, terminal, runway — no ordinary buildings.
      if (d.name === 'Solmar Intl') {
        if (bx === 6 && by === 0) buildings.push({ x: 1960, y: 120, w: 260, h: 120, color: '#7d8891', district: d.name, windows: 8, roof: '#5a6a74' });
        if (bx === 7 && by === 1) buildings.push({ x: 2150, y: 330, w: 130, h: 90, color: '#6b7d88', district: d.name, windows: 5, roof: '#4a5a64' });
        continue;
      }
      // Beach strip: sand, palms, no buildings.
      if (cy > 2250) {
        for (let i = 0; i < 5; i += 1) trees.push({ x: x0 + 20 + rng() * (x1 - x0 - 40), y: y0 + 20 + rng() * (y1 - y0 - 40), r: 9 });
        continue;
      }
      const roll = rng();
      if (roll < 0.16) {
        // Park: grass + trees.
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        const n = 5 + Math.floor(rng() * 5);
        for (let i = 0; i < n; i += 1) trees.push({ x: x0 + 15 + rng() * (x1 - x0 - 30), y: y0 + 15 + rng() * (y1 - y0 - 30), r: 7 + rng() * 5 });
      } else if (roll < 0.28) {
        // Parking lot or plaza.
        if (rng() < 0.55) parkingLots.push({ x: x0 + 8, y: y0 + 8, w: x1 - x0 - 16, h: y1 - y0 - 16 });
        else plazas.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        for (let i = 0; i < 3; i += 1) trees.push({ x: x0 + 15 + rng() * (x1 - x0 - 30), y: y0 + 15 + rng() * (y1 - y0 - 30), r: 7 });
      } else {
        // 1–3 buildings per block.
        const n = 1 + Math.floor(rng() * 3);
        for (let i = 0; i < n; i += 1) {
          const w = 60 + rng() * 90;
          const h = 50 + rng() * 80;
          const x = x0 + 12 + rng() * Math.max(1, x1 - x0 - w - 24);
          const y = y0 + 12 + rng() * Math.max(1, y1 - y0 - h - 24);
          if (nearDiagonal(x + w / 2, y + h / 2)) continue;
          if (d.name === 'Neon Mile' && rng() < 0.5) {
            // Neon Mile towers are taller and brighter.
            buildings.push({ x, y, w, h, color: pick(rng, d.roofs), district: d.name, windows: 10, roof: '#20242c', neon: pick(rng, ['#ff5ad0', '#2bd9ff', '#ffe14d', '#7dff5a']) });
          } else {
            buildings.push({ x, y, w, h, color: pick(rng, d.roofs), district: d.name, windows: 4 + Math.floor(rng() * 5), roof: '#2a2f38' });
          }
        }
        if (rng() < 0.5) trees.push({ x: x0 + 15 + rng() * (x1 - x0 - 30), y: y0 + 15 + rng() * (y1 - y0 - 30), r: 7 });
      }
    }
  }

  // Street lamps along the roads.
  for (const c of ROAD_LINES) {
    for (let t = 150; t < WORLD; t += 300) {
      lamps.push({ x: c + ROAD_HALF + 8, y: t });
      lamps.push({ x: t, y: c - ROAD_HALF - 8 });
    }
  }

  return { seed, buildings, trees, parks, lamps, parkingLots, plazas, districts: DISTRICTS, rng };
}

// Is point (x,y) inside any building? Used for movement + spawn checks.
export function hitsBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    if (circleHitsRect(x, y, r, b)) return b;
  }
  return null;
}

// Slide a circle along obstacles: try x, then y, so the player/vehicle
// slides along walls instead of sticking.
export function moveWithCollision(city, pos, dx, dy, r) {
  const nx = pos.x + dx;
  if (!hitsBuilding(city, nx, pos.y, r) && nx > 16 && nx < WORLD - 16) pos.x = nx;
  const ny = pos.y + dy;
  if (!hitsBuilding(city, pos.x, ny, r) && ny > 16 && ny < WORLD - 16) pos.y = ny;
}

// On a road (asphalt)? Used by traffic AI and the spray-shop logic.
export function isOnRoad(x, y) {
  for (const c of ROAD_LINES) {
    if (Math.abs(x - c) < ROAD_HALF || Math.abs(y - c) < ROAD_HALF) return true;
  }
  return false;
}

// Nearest road centreline coordinate for a given axis value.
export function nearestRoadCoord(v) {
  let best = ROAD_LINES[0];
  for (const c of ROAD_LINES) if (Math.abs(c - v) < Math.abs(best - v)) best = c;
  return best;
}

// Traffic lights: one phase per intersection, cycling green/amber/red.
// lightPhase(t, ix, iy) returns 'green' | 'amber' | 'red' for north-south.
export function lightPhase(t, ix, iy) {
  const cycle = 16;
  const p = (t + (ix * 3 + iy * 5)) % cycle;
  if (p < 7) return 'green';
  if (p < 8) return 'amber';
  return 'red';
}

// Random point on a road, away from buildings — spawn helper.
export function randomRoadPoint(rng) {
  const vertical = rng() < 0.5;
  const line = pick(rng, ROAD_LINES);
  const along = 100 + rng() * (WORLD - 200);
  return vertical ? { x: line + (rng() < 0.5 ? -18 : 18), y: along } : { x: along, y: line + (rng() < 0.5 ? -18 : 18) };
}
