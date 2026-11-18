// Vehicles: arcade driving physics, traffic AI, stealing, damage and
// explosions. A vehicle is {model, x, y, angle, speed, hp, color, driver,
// ...}. driver is 'player' | 'traffic' | 'police' | 'parked' | 'none' | 'npc'.

import { VEHICLES, WORLD, ROAD_LINES, ROAD_HALF, clamp, dist, angleDiff, mulberry32, pick } from './config.js';
import { hitsBuilding, isOnRoad, nearestRoadCoord, lightPhase, randomRoadPoint } from './world.js';

let uid = 1;
export function makeVehicle(model, x, y, angle, driver) {
  const def = VEHICLES[model];
  return {
    id: uid += 1, model, name: def.name, x, y, angle, speed: 0,
    hp: def.hp, maxHp: def.hp, color: pick(mulberry32((uid * 7919) ^ 12345), def.colors),
    driver: driver || 'parked', w: model === 'lobo' ? 52 : 46, h: 22,
    smoke: 0, dead: false, honk: 0, ai: null, stuck: 0, brakeLight: false,
    targetSpeed: 0, exploded: false, flame: 0,
  };
}

// ------------------------------------------------------------------ driving
// Arcade car physics: accelerate / brake / reverse / steer by speed.
export function driveVehicle(S, v, dt, gas, brake, steer) {
  const def = VEHICLES[v.model];
  const maxFwd = def.top;
  const maxRev = 120;
  if (gas > 0) v.speed += def.accel * gas * dt;
  if (brake > 0) {
    if (v.speed > 5) v.speed -= def.accel * 1.6 * brake * dt;
    else v.speed -= def.accel * 0.7 * brake * dt; // reverse
  }
  // Drag + rolling resistance.
  v.speed -= v.speed * 0.55 * dt;
  if (Math.abs(v.speed) < 4 && gas === 0 && brake === 0) v.speed = 0;
  v.speed = clamp(v.speed, -maxRev, maxFwd);
  const steerDir = v.speed >= 0 ? 1 : -1;
  v.angle += steer * def.turn * steerDir * clamp(Math.abs(v.speed) / 120, 0, 1) * dt;
  const nx = v.x + Math.cos(v.angle) * v.speed * dt;
  const ny = v.y + Math.sin(v.angle) * v.speed * dt;
  // Collide with buildings: stop and take a little damage on hard hits.
  const hit = hitsBuilding(S.city, nx, ny, 20);
  if (!hit && nx > 20 && nx < WORLD - 20 && ny > 20 && ny < WORLD - 20) {
    v.x = nx; v.y = ny;
  } else {
    if (Math.abs(v.speed) > 140) damageVehicle(S, v, 8);
    v.speed *= -0.25;
  }
  v.brakeLight = brake > 0 && v.speed > 5;
}

// Player input while driving. Returns nothing; mutates the vehicle.
export function updatePlayerVehicle(S, dt) {
  const v = S.playerCar;
  if (!v) return;
  const inp = S.input;
  let steer = 0;
  if (inp.down('left')) steer -= 1;
  if (inp.down('right')) steer += 1;
  const gas = inp.down('up') ? 1 : 0;
  const brake = inp.down('down') || inp.down('brake') ? 1 : 0;
  driveVehicle(S, v, dt, gas, brake, steer);
  if (inp.hit('horn')) { S.audio.horn(); v.honk = 0.5; }
  if (v.honk > 0) v.honk -= dt;
  // Skid marks when handbraking at speed.
  if (inp.down('brake') && Math.abs(v.speed) > 150 && Math.random() < 0.6) {
    S.parts.push({ kind: 'skid', x: v.x - Math.cos(v.angle) * 20, y: v.y - Math.sin(v.angle) * 20, life: 4, max: 4 });
  }
  // Exhaust puffs.
  if (Math.abs(v.speed) > 60 && Math.random() < 0.25) {
    S.parts.push({ kind: 'smoke', x: v.x - Math.cos(v.angle) * 24, y: v.y - Math.sin(v.angle) * 24, vx: 0, vy: -12, life: 0.7, max: 0.7, size: 5 });
  }
  // Damage smoke + fire.
  if (v.hp < v.maxHp * 0.4) {
    v.smoke += dt;
    if (Math.random() < 0.4) S.parts.push({ kind: 'smoke', x: v.x + (Math.random() - 0.5) * 20, y: v.y - 10, vx: 0, vy: -30, life: 1, max: 1, size: 8 });
    if (v.hp < v.maxHp * 0.2 && Math.random() < 0.3) S.parts.push({ kind: 'fire', x: v.x + (Math.random() - 0.5) * 16, y: v.y, vx: 0, vy: -20, life: 0.5, max: 0.5, size: 9 });
  }
  // Explode when wrecked.
  if (v.hp <= 0 && !v.exploded) explodeVehicle(S, v);
}

// ------------------------------------------------------------------ traffic
export function spawnTrafficCar(S) {
  const rng = S.rng;
  const p = randomRoadPoint(rng);
  const model = pick(rng, ['vulture', 'rustler', 'bison', 'lobo', 'sunset', 'wave']);
  const vertical = Math.abs(p.x - nearestRoadCoord(p.x)) < 1;
  const v = makeVehicle(model, p.x, p.y, vertical ? (p.y % 2 ? Math.PI / 2 : -Math.PI / 2) : (p.x % 2 ? 0 : Math.PI), 'traffic');
  v.ai = {
    axis: vertical ? 'v' : 'h',
    dir: rng() < 0.5 ? 1 : -1,
    cruise: 130 + rng() * 90,
    lane: 18,
  };
  v.angle = v.ai.axis === 'v' ? (v.ai.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (v.ai.dir > 0 ? 0 : Math.PI);
  v.speed = v.ai.cruise;
  S.vehicles.push(v);
  return v;
}

function carAhead(S, v, look) {
  let best = null, bestD = look;
  for (const o of S.vehicles) {
    if (o === v || o.dead) continue;
    const dx = o.x - v.x, dy = o.y - v.y;
    const fwd = dx * Math.cos(v.angle) + dy * Math.sin(v.angle);
    const side = Math.abs(-dx * Math.sin(v.angle) + dy * Math.cos(v.angle));
    if (fwd > 0 && fwd < bestD && side < 26) { best = o; bestD = fwd; }
  }
  return best;
}

export function updateTraffic(S, dt) {
  for (const v of S.vehicles) {
    if (v.driver !== 'traffic' || v.dead) continue;
    const ai = v.ai;
    // At an intersection, sometimes turn onto the cross road.
    const onV = Math.abs(v.x - nearestRoadCoord(v.x)) < 6;
    const onH = Math.abs(v.y - nearestRoadCoord(v.y)) < 6;
    if (onV && onH && Math.random() < dt * 0.25) {
      ai.axis = ai.axis === 'v' ? 'h' : 'v';
      ai.dir = Math.random() < 0.5 ? 1 : -1;
    }
    // Stop at a red light when approaching an intersection.
    let want = ai.cruise;
    const ix = Math.round(v.x / 300), iy = Math.round(v.y / 300);
    const phase = lightPhase(S.time, ix, iy);
    const toCross = ai.axis === 'v'
      ? nearestRoadCoord(v.y) - v.y
      : nearestRoadCoord(v.x) - v.x;
    const distToCross = Math.abs(toCross) * (ai.dir > 0 ? 1 : -1);
    if (phase === 'red' && distToCross > 0 && distToCross < 110) want = 0;
    if (phase === 'amber' && distToCross > 0 && distToCross < 70) want = 0;
    // Do not rear-end the car ahead.
    const ahead = carAhead(S, v, 90);
    if (ahead) want = Math.min(want, Math.max(0, ahead.speed - 20));
    // Steer smoothly onto the lane, then cruise.
    const targetAngle = ai.axis === 'v' ? (ai.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (ai.dir > 0 ? 0 : Math.PI);
    v.angle += angleDiff(v.angle, targetAngle) * clamp(3 * dt, 0, 1);
    v.speed += clamp(want - v.speed, -260 * dt, 160 * dt);
    const nx = v.x + Math.cos(v.angle) * v.speed * dt;
    const ny = v.y + Math.sin(v.angle) * v.speed * dt;
    if (!hitsBuilding(S.city, nx, ny, 18)) { v.x = nx; v.y = ny; }
    else { v.speed = 0; ai.axis = ai.axis === 'v' ? 'h' : 'v'; }
    // Keep traffic near the player: recycle cars that drift far away.
    if (dist(v.x, v.y, S.player.x, S.player.y) > 1100) {
      const p = randomRoadPoint(S.rng);
      v.x = p.x; v.y = p.y;
    }
  }
}

// ------------------------------------------------------------------- damage
export function damageVehicle(S, v, amount) {
  if (v.dead || v.exploded) return;
  v.hp -= amount;
  if (v.hp <= 0) {
    v.hp = 0;
    if (v.driver === 'player') S.notify.push({ text: 'Your car is wrecked!', t: 3, color: '#ff6b5e' });
    explodeVehicle(S, v);
  }
}

export function explodeVehicle(S, v) {
  if (v.exploded) return;
  v.exploded = true;
  v.dead = true;
  S.audio.explosion();
  S.shake = 14;
  for (let i = 0; i < 26; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const sp = 40 + Math.random() * 160;
    S.parts.push({ kind: i % 3 === 0 ? 'fire' : 'smoke', x: v.x, y: v.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.8 + Math.random() * 0.7, max: 1.5, size: 8 + Math.random() * 10 });
  }
  S.parts.push({ kind: 'flash', x: v.x, y: v.y, life: 0.18, max: 0.18, size: 90 });
  // Area damage to anyone nearby.
  const px = S.player.x, py = S.player.y;
  if (dist(px, py, v.x, v.y) < 90 && !S.playerCar) {
    if (damagePlayerRef(S, 35)) S.gameOver('wasted');
  }
  for (const ped of S.peds) {
    if (dist(ped.x, ped.y, v.x, v.y) < 90) ped.hp = 0;
  }
  // If the player was driving it, throw her out.
  if (v.driver === 'player') {
    S.playerCar = null;
    v.driver = 'none';
    S.player.x = v.x + 40; S.player.y = v.y + 40;
  }
  // Chain: parked cars too close catch fire as well.
  for (const o of S.vehicles) {
    if (o !== v && !o.exploded && dist(o.x, o.y, v.x, v.y) < 70) damageVehicle(S, o, 60);
  }
}

// Lazy import dodge: damagePlayer lives in player.js; vehicles.js must not
// import it back (cycle). main.js wires this hook.
export let damagePlayerRef = () => false;
export function setDamagePlayer(fn) { damagePlayerRef = fn; }

// ------------------------------------------------------------------ stealing
export function nearestStealableCar(S, maxDist) {
  let best = null, bestD = maxDist;
  for (const v of S.vehicles) {
    if (v.dead || v.driver === 'player') continue;
    const d = dist(S.player.x, S.player.y, v.x, v.y);
    if (d < bestD) { best = v; bestD = d; }
  }
  return best;
}

// Steal a car: the driver (if any) is thrown out and may fight back.
export function stealCar(S, v) {
  const hadDriver = v.driver === 'traffic' || v.driver === 'npc';
  if (hadDriver) {
    // The driver jumps out as a pedestrian; sometimes they swing at you.
    const angry = Math.random() < 0.4;
    S.peds.push({
      x: v.x + 26, y: v.y + 26, angle: 0, hp: 40, speed: 0,
      state: angry ? 'angry' : 'flee', timer: 2.5, target: null,
      color: '#e8b13c', name: 'Driver',
    });
    if (angry) S.notify.push({ text: 'The driver fights back!', t: 2.5, color: '#ffb14d' });
  }
  v.driver = 'player';
  S.playerCar = v;
  S.stats.carsStolen += 1;
  S.audio.pickup();
  S.notify.push({ text: `You took the ${v.name}`, t: 2.5, color: '#7dff8a' });
  // Stealing is a crime — unless it is your own mission car.
  if (!v.missionCar) raiseWanted(S, 1, 'theft');
  return true;
}

// Exit the car on foot.
export function exitCar(S) {
  const v = S.playerCar;
  if (!v) return;
  v.driver = 'parked';
  S.playerCar = null;
  S.player.x = v.x + Math.cos(v.angle + Math.PI / 2) * 30;
  S.player.y = v.y + Math.sin(v.angle + Math.PI / 2) * 30;
  S.player.angle = v.angle;
}

// Wanted helpers live in police.js; this hook is wired by main.js.
export let raiseWanted = () => {};
export function setRaiseWanted(fn) { raiseWanted = fn; }
