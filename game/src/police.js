// Wanted level + Solmar PD. Stars 1–5 rise with crimes and fall when the
// player hides, changes cars, or pays at the Spray Shop. Police cars chase
// and ram; foot officers chase and arrest. Getting caught = Busted, dying =
// Wasted.

import { WORLD, clamp, dist } from './config.js';
import { makeVehicle } from './vehicles.js';
import { randomRoadPoint } from './world.js';

export function raiseWanted(S, stars, reason) {
  if (S.mode !== 'play') return;
  const before = S.wanted;
  S.wanted = clamp(S.wanted + stars, 0, 5);
  S.lastCrimeAt = S.time;
  S.hiddenTimer = 0;
  if (S.wanted > before) {
    S.notify.push({ text: `Wanted level ${'★'.repeat(S.wanted)} — ${reason}`, t: 3, color: '#ff6b5e' });
  }
}

export function updateWanted(S, dt) {
  if (S.wanted === 0) return;
  // Heat decays only while no cop can see the player.
  const seen = S.cops.some((c) => !c.dead && dist(c.x, c.y, S.player.x, S.player.y) < (c.onFoot ? 260 : 420));
  if (seen) {
    S.hiddenTimer = 0;
  } else {
    S.hiddenTimer += dt;
    if (S.hiddenTimer > 9) {
      S.hiddenTimer = 0;
      S.wanted -= 1;
      S.notify.push({ text: S.wanted === 0 ? 'You lost the cops.' : `Wanted level down to ${'★'.repeat(S.wanted)}`, t: 3, color: '#7dff8a' });
    }
  }
  // Maintain the pursuit force: more stars, more units.
  const wantCars = Math.min(S.wanted, 3);
  const wantFoot = S.wanted >= 2 ? Math.min(S.wanted - 1, 3) : 0;
  const cars = S.cops.filter((c) => !c.onFoot && !c.dead).length;
  const foot = S.cops.filter((c) => c.onFoot && !c.dead).length;
  if (cars < wantCars && S.copSpawnTimer <= 0) {
    spawnCopCar(S);
    S.copSpawnTimer = 2.5;
  }
  if (foot < wantFoot && S.copSpawnTimer <= 0) {
    spawnFootCop(S);
    S.copSpawnTimer = 2.5;
  }
  if (S.copSpawnTimer > 0) S.copSpawnTimer -= dt;
}

function spawnCopCar(S) {
  const a = Math.random() * Math.PI * 2;
  const d = 500 + Math.random() * 200;
  const x = clamp(S.player.x + Math.cos(a) * d, 60, WORLD - 60);
  const y = clamp(S.player.y + Math.sin(a) * d, 60, WORLD - 60);
  const v = makeVehicle('patrol', x, y, Math.atan2(S.player.y - y, S.player.x - x), 'police');
  v.ai = { axis: 'v', dir: 1, cruise: 0, lane: 0 };
  S.vehicles.push(v);
  S.cops.push({ vehicle: v, onFoot: false, x, y, dead: false, bustTimer: 0 });
}

function spawnFootCop(S) {
  const a = Math.random() * Math.PI * 2;
  const x = clamp(S.player.x + Math.cos(a) * 220, 40, WORLD - 40);
  const y = clamp(S.player.y + Math.sin(a) * 220, 40, WORLD - 40);
  S.cops.push({ vehicle: null, onFoot: true, x, y, angle: 0, hp: 50, dead: false, bustTimer: 0, punchTimer: 0 });
}

export function updatePolice(S, dt) {
  let nearestCop = Infinity;
  for (const c of S.cops) {
    if (c.dead) continue;
    if (c.onFoot) {
      const d = dist(c.x, c.y, S.player.x, S.player.y);
      nearestCop = Math.min(nearestCop, d);
      c.angle = Math.atan2(S.player.y - c.y, S.player.x - c.x);
      if (S.playerCar) {
        // Foot cops cannot catch a car: they run to the nearest road and wait.
        if (d > 30) { c.x += Math.cos(c.angle) * 190 * dt; c.y += Math.sin(c.angle) * 190 * dt; }
      } else if (d > 26) {
        c.x += Math.cos(c.angle) * 200 * dt;
        c.y += Math.sin(c.angle) * 200 * dt;
        c.bustTimer = 0;
      } else {
        // On top of the player: the arrest clock runs.
        c.bustTimer += dt;
        if (c.bustTimer > 1.4) { S.gameOver('busted'); return; }
      }
      // A foot cop can be punched or shot (combat handles hp).
      if (c.hp <= 0) { c.dead = true; S.stats.kills += 1; raiseWanted(S, 1, 'cop down'); }
    } else {
      const v = c.vehicle;
      if (!v || v.dead || v.exploded) { c.dead = true; continue; }
      c.x = v.x; c.y = v.y;
      nearestCop = Math.min(nearestCop, dist(v.x, v.y, S.player.x, S.player.y));
      // Pursuit steering: aim at the player, with a little wobble so it
      // feels like a chase, not a homing missile.
      const target = Math.atan2(S.player.y - v.y, S.player.x - v.x) + Math.sin(S.time * 1.7 + v.id) * 0.12;
      let diff = target - v.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      v.angle += clamp(diff, -2.6 * dt, 2.6 * dt);
      const wantSpeed = S.playerCar ? 430 : 300;
      v.speed += clamp(wantSpeed - v.speed, -300 * dt, 240 * dt);
      const nx = v.x + Math.cos(v.angle) * v.speed * dt;
      const ny = v.y + Math.sin(v.angle) * v.speed * dt;
      const blocked = S.city.buildings.some((b) => nx > b.x - 18 && nx < b.x + b.w + 18 && ny > b.y - 18 && ny < b.y + b.h + 18);
      if (!blocked) { v.x = nx; v.y = ny; }
      else { v.speed *= 0.4; v.angle += 0.9 * dt; }
      // Ramming the player car damages it; touching the player on foot
      // starts the arrest clock.
      const d = dist(v.x, v.y, S.player.x, S.player.y);
      if (d < 46) {
        if (S.playerCar) {
          S.damageVehicle(S.playerCar, 4 * dt * 4); // rams hurt, but slowly
          v.speed *= 0.85;
          if (Math.random() < dt * 2) S.audio.punch();
        } else {
          c.bustTimer += dt;
          if (c.bustTimer > 1.2) { S.gameOver('busted'); return; }
        }
      } else {
        c.bustTimer = 0;
      }
      if (v.hp <= 0 && !v.exploded) { c.dead = true; }
    }
  }
  S.cops = S.cops.filter((c) => !c.dead || (c.onFoot && c.hp > 0));
  // Siren volume follows the nearest unit.
  S.audio.siren(S.wanted > 0, clamp(nearestCop / 700, 0, 1));
}

// Pay-n-spray: drive into the Spray Shop marker and the heat is gone.
export function trySprayShop(S) {
  if (S.wanted === 0 || !S.playerCar) return;
  const d = dist(S.playerCar.x, S.playerCar.y, 1050, 1650);
  if (d < 70 && S.money >= 100) {
    S.money -= 100;
    S.wanted = 0;
    S.cops = [];
    S.audio.cash();
    S.notify.push({ text: 'Spray Shop: fresh paint, clean record. -$100', t: 3, color: '#7dff8a' });
    S.playerCar.color = '#e8e8e8';
  }
}
