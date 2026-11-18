// Combat: fists, pistol, bullets, enemy shooters, and pickups (health,
// armor, ammo). Enemies are mission thugs and Kane's guards; they take
// cover, shoot at the player, and drop pickups when they fall.

import { clamp, dist } from './config.js';
import { killPed } from './pedestrians.js';

export function makeEnemy(S, x, y, hp) {
  const e = {
    x, y, angle: 0, hp: hp || 60, speed: 120, state: 'guard',
    shootTimer: 1 + Math.random(), punchTimer: 0, dead: false,
    color: '#3f3a4a', name: 'Maro thug', walkPhase: 0,
  };
  S.enemies.push(e);
  return e;
}

export function updateCombat(S, dt) {
  const p = S.player;
  const inp = S.input;
  // --- Player punch (F or click while unarmed).
  if (inp.hit('punch') && !S.playerCar && p.punchCooldown <= 0) {
    p.punchTimer = 0.22; p.punchCooldown = 0.45;
    S.audio.punch();
    const reach = 34;
    const hx = p.x + Math.cos(p.angle) * reach;
    const hy = p.y + Math.sin(p.angle) * reach;
    for (const e of S.enemies) {
      if (!e.dead && dist(e.x, e.y, hx, hy) < 30) damageEnemy(S, e, 14);
    }
    for (const ped of S.peds) {
      if (!ped.dead && dist(ped.x, ped.y, hx, hy) < 26) killPed(S, ped, 'punched');
    }
    for (const c of S.cops) {
      if (c.onFoot && !c.dead && dist(c.x, c.y, hx, hy) < 28) { c.hp -= 14; if (c.hp <= 0) c.dead = true; }
    }
  }
  // --- Player shoot (click with the pistol out).
  if (p.gun && !S.playerCar && (inp.mouseClicked || inp.mouseDown) && S.shootCooldown <= 0 && p.ammo > 0) {
    S.shootCooldown = 0.22;
    p.ammo -= 1;
    S.audio.shoot();
    const a = p.angle + (Math.random() - 0.5) * 0.06;
    S.bullets.push({ x: p.x + Math.cos(a) * 20, y: p.y + Math.sin(a) * 20, vx: Math.cos(a) * 780, vy: Math.sin(a) * 780, from: 'player', life: 1.1, dmg: 26 });
    S.shake = Math.max(S.shake, 2);
  }
  if (S.shootCooldown > 0) S.shootCooldown -= dt;
  if (S.alarm > 0) S.alarm -= dt;

  // --- Bullets fly.
  for (const b of S.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0) continue;
    // Walls stop bullets.
    if (S.city.buildings.some((r) => b.x > r.x && b.x < r.x + r.w && b.y > r.y && b.y < r.y + r.h)) { b.life = 0; spark(S, b.x, b.y); continue; }
    if (b.from === 'player') {
      for (const e of S.enemies) {
        if (!e.dead && dist(e.x, e.y, b.x, b.y) < 16) { damageEnemy(S, e, b.dmg); b.life = 0; break; }
      }
      if (b.life <= 0) continue;
      for (const ped of S.peds) {
        if (!ped.dead && dist(ped.x, ped.y, b.x, b.y) < 13) { killPed(S, ped, 'shot'); b.life = 0; break; }
      }
      if (b.life <= 0) continue;
      for (const c of S.cops) {
        if (c.onFoot && !c.dead && dist(c.x, c.y, b.x, b.y) < 14) { c.hp -= b.dmg; S.raiseWanted(1, 'shot a cop'); b.life = 0; break; }
      }
      if (b.life <= 0) continue;
      for (const v of S.vehicles) {
        if (!v.dead && v.driver !== 'player' && dist(v.x, v.y, b.x, b.y) < 24) {
          S.damageVehicle(v, b.dmg); S.parts.push({ kind: 'spark', x: b.x, y: b.y, life: 0.2, max: 0.2, size: 6 });
          b.life = 0; break;
        }
      }
    } else {
      // Enemy bullets can hit the player (on foot or in a car).
      const tx = S.playerCar ? S.playerCar.x : p.x;
      const ty = S.playerCar ? S.playerCar.y : p.y;
      if (dist(tx, ty, b.x, b.y) < (S.playerCar ? 24 : 13)) {
        if (S.playerCar) S.damageVehicle(S.playerCar, b.dmg * 0.5);
        else if (S.damagePlayer(b.dmg)) S.gameOver('wasted');
        b.life = 0;
      }
    }
  }
  S.bullets = S.bullets.filter((b) => b.life > 0);

  // --- Enemies think and shoot.
  for (const e of S.enemies) {
    if (e.dead) continue;
    e.walkPhase += dt * 6;
    const d = dist(e.x, e.y, p.x, p.y);
    const seePlayer = d < 520;
    if (seePlayer) {
      e.state = 'fight';
      e.angle = Math.atan2(p.y - e.y, p.x - e.x);
      if (d > 240) {
        e.x += Math.cos(e.angle) * e.speed * dt;
        e.y += Math.sin(e.angle) * e.speed * dt;
      } else if (d < 130) {
        e.x -= Math.cos(e.angle) * e.speed * 0.6 * dt;
        e.y -= Math.sin(e.angle) * e.speed * 0.6 * dt;
      }
      e.shootTimer -= dt;
      if (e.shootTimer <= 0 && d < 480) {
        e.shootTimer = 0.9 + Math.random() * 0.9;
        S.audio.shoot();
        S.alarm = 1.5;
        const a = e.angle + (Math.random() - 0.5) * 0.16;
        S.bullets.push({ x: e.x + Math.cos(a) * 20, y: e.y + Math.sin(a) * 20, vx: Math.cos(a) * 620, vy: Math.sin(a) * 620, from: 'enemy', life: 1.2, dmg: 9 });
      }
      if (d < 30 && e.punchTimer <= 0) {
        e.punchTimer = 0.9;
        if (S.damagePlayer(8)) S.gameOver('wasted');
      }
    } else {
      e.state = 'guard';
    }
    if (e.punchTimer > 0) e.punchTimer -= dt;
  }

  // --- Pickups.
  for (const pk of S.pickups) {
    if (pk.taken) continue;
    const d = dist(p.x, p.y, pk.x, pk.y);
    if (d < 26 && !S.playerCar) {
      pk.taken = true;
      S.audio.pickup();
      if (pk.kind === 'health') { S.healPlayer(40); S.notify.push({ text: '+40 HP', t: 2, color: '#7dff8a' }); }
      if (pk.kind === 'armor') { p.armor = clamp(p.armor + 50, 0, 100); S.notify.push({ text: '+50 Armor', t: 2, color: '#7db8e8' }); }
      if (pk.kind === 'ammo') { p.ammo += 24; S.notify.push({ text: '+24 Ammo', t: 2, color: '#ffe14d' }); }
    }
  }
  S.pickups = S.pickups.filter((pk) => !pk.taken);
}

export function damageEnemy(S, e, amount) {
  if (e.dead) return;
  e.hp -= amount;
  S.parts.push({ kind: 'blood', x: e.x, y: e.y, life: 0.5, max: 0.5, size: 8 });
  if (e.hp <= 0) {
    e.dead = true;
    S.stats.kills += 1;
    S.audio.pickup();
    // Fallen enemies drop something useful.
    const roll = Math.random();
    const kind = roll < 0.4 ? 'health' : roll < 0.7 ? 'ammo' : 'armor';
    S.pickups.push({ kind, x: e.x + 14, y: e.y + 14, taken: false });
    S.raiseWanted(0, ''); // no extra heat for mission targets
  }
}

function spark(S, x, y) {
  S.parts.push({ kind: 'spark', x, y, life: 0.25, max: 0.25, size: 7 });
}

// Spawn a pickup at a fixed place (used by missions and the world setup).
export function spawnPickup(S, kind, x, y) {
  S.pickups.push({ kind, x, y, taken: false });
}
