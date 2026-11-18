// Pedestrians: sidewalk walkers who flee gunfire, crashes and explosions,
// and occasionally fight back when their car is stolen. Simple state machine:
// walk -> flee -> (calm) walk; angry -> chase + punch the player.

import { PED_NAMES, clamp } from './config.js';
import { isOnRoad, randomRoadPoint } from './world.js';

const SKINS = ['#e8b13c', '#7db8e8', '#e87d7d', '#9ad97d', '#d9a0e8', '#e8d27d', '#8ad9c9'];

export function spawnPed(S, x, y) {
  const rng = S.rng;
  const p = {
    x: x ?? 0, y: y ?? 0, angle: rng() * Math.PI * 2,
    hp: 30, speed: 40 + rng() * 30, state: 'walk', timer: 2 + rng() * 4,
    target: null, color: SKINS[Math.floor(rng() * SKINS.length)],
    name: PED_NAMES[Math.floor(rng() * PED_NAMES.length)],
    walkPhase: rng() * 10, dead: false, punchTimer: 0,
  };
  if (x === undefined) {
    const pt = randomRoadPoint(rng);
    // Step off the road onto the sidewalk.
    p.x = pt.x + (rng() < 0.5 ? -55 : 55);
    p.y = pt.y + (rng() < 0.5 ? -55 : 55);
  }
  S.peds.push(p);
  return p;
}

export function updatePeds(S, dt) {
  const px = S.player.x, py = S.player.y;
  for (const p of S.peds) {
    if (p.dead) continue;
    p.walkPhase += dt * (p.state === 'flee' ? 14 : 6);
    p.timer -= dt;
    if (p.state === 'walk') {
      if (p.timer <= 0) {
        // Pick a new nearby waypoint on a sidewalk.
        const a = S.rng() * Math.PI * 2;
        p.target = { x: clamp(p.x + Math.cos(a) * 160, 40, 2360), y: clamp(p.y + Math.sin(a) * 160, 40, 2360) };
        p.timer = 3 + S.rng() * 4;
      }
      if (p.target) {
        const dx = p.target.x - p.x, dy = p.target.y - p.y;
        const d = Math.hypot(dx, dy);
        if (d < 8) p.target = null;
        else {
          p.angle = Math.atan2(dy, dx);
          p.x += Math.cos(p.angle) * p.speed * dt;
          p.y += Math.sin(p.angle) * p.speed * dt;
        }
      }
      // A car speeding at you, or a gunshot nearby, makes you run.
      const nearCar = S.vehicles.some((v) => !v.dead && Math.abs(v.speed) > 120 && Math.hypot(v.x - p.x, v.y - p.y) < 70);
      if (nearCar || S.alarm > 0) { p.state = 'flee'; p.timer = 2 + S.rng() * 2; }
    } else if (p.state === 'flee') {
      const a = Math.atan2(p.y - py, p.x - px);
      p.angle = a;
      p.x += Math.cos(a) * p.speed * 2.2 * dt;
      p.y += Math.sin(a) * p.speed * 2.2 * dt;
      if (p.timer <= 0) { p.state = 'walk'; p.timer = 2; }
    } else if (p.state === 'angry') {
      // Chase the player and punch them.
      const d = Math.hypot(px - p.x, py - p.y);
      p.angle = Math.atan2(py - p.y, px - p.x);
      if (d > 24) {
        p.x += Math.cos(p.angle) * 130 * dt;
        p.y += Math.sin(p.angle) * 130 * dt;
      } else if (p.punchTimer <= 0) {
        p.punchTimer = 0.8;
        S.audio.punch();
        if (S.damagePlayer(6)) S.gameOver('wasted');
      }
      if (p.punchTimer > 0) p.punchTimer -= dt;
      if (p.timer <= 0) { p.state = 'walk'; p.timer = 2; }
    }
    p.x = clamp(p.x, 24, 2376);
    p.y = clamp(p.y, 24, 2376);
    // Getting run over kills a ped (and raises the heat).
    for (const v of S.vehicles) {
      if (v.dead || Math.abs(v.speed) < 60) continue;
      if (Math.hypot(v.x - p.x, v.y - p.y) < 24) {
        killPed(S, p, v.driver === 'player' ? 'run over' : 'hit');
        break;
      }
    }
  }
  // Recycle: keep the crowd near the player.
  for (const p of S.peds) {
    if (!p.dead && Math.hypot(p.x - px, p.y - py) > 1000) {
      const pt = randomRoadPoint(S.rng);
      p.x = pt.x; p.y = pt.y;
    }
  }
  S.peds = S.peds.filter((p) => !p.dead || p.deathT > 0);
}

export function killPed(S, p, cause) {
  if (p.dead) return;
  p.dead = true;
  p.deathT = 6; // body stays a while, then is cleaned up
  S.parts.push({ kind: 'blood', x: p.x, y: p.y, life: 1.2, max: 1.2, size: 14 });
  if (cause === 'run over' || cause === 'shot' || cause === 'punched') {
    S.stats.kills += 1;
    S.raiseWanted(1, cause);
  }
}
