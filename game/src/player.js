// Mara Voss on foot: movement, running, health/armor, punching, aiming.
// The player is a circle with a facing angle; the render layer draws her.

import { PLAYER, clamp } from './config.js';
import { moveWithCollision } from './world.js';

export function createPlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, radius: PLAYER.radius,
    hp: PLAYER.maxHp, armor: 0, gun: false, ammo: 0,
    speed: 0, moving: false, running: false,
    punchTimer: 0, punchCooldown: 0, hurtFlash: 0, invuln: 0,
  };
}

export function updatePlayerOnFoot(S, dt) {
  const p = S.player;
  const inp = S.input;
  let mx = 0, my = 0;
  if (inp.down('up')) my -= 1;
  if (inp.down('down')) my += 1;
  if (inp.down('left')) mx -= 1;
  if (inp.down('right')) mx += 1;
  const running = inp.down('run') && (mx !== 0 || my !== 0);
  const speed = running ? PLAYER.runSpeed : PLAYER.walkSpeed;
  p.running = running;
  p.moving = mx !== 0 || my !== 0;
  if (p.moving) {
    const len = Math.hypot(mx, my);
    const dx = (mx / len) * speed * dt;
    const dy = (my / len) * speed * dt;
    moveWithCollision(S.city, p, dx, dy, p.radius);
    // Face movement direction when not aiming with the mouse.
    if (!p.gun || !S.input.mouseDown) p.angle = Math.atan2(dy, dx);
    p.speed = speed;
  } else {
    p.speed = 0;
  }
  // Aim at the mouse whenever the pistol is out.
  if (p.gun) {
    const wx = S.camera.x + inp.mouseX;
    const wy = S.camera.y + inp.mouseY;
    p.angle = Math.atan2(wy - p.y, wx - p.x);
  }
  if (p.punchTimer > 0) p.punchTimer -= dt;
  if (p.punchCooldown > 0) p.punchCooldown -= dt;
  if (p.hurtFlash > 0) p.hurtFlash -= dt;
  if (p.invuln > 0) p.invuln -= dt;
}

// Damage the player, armor absorbs first. Returns true if she went down.
export function damagePlayer(S, amount) {
  const p = S.player;
  if (p.invuln > 0 || S.mode !== 'play') return false;
  let rest = amount;
  if (p.armor > 0) {
    const absorbed = Math.min(p.armor, rest);
    p.armor -= absorbed;
    rest -= absorbed;
  }
  p.hp -= rest;
  p.hurtFlash = 0.35;
  p.invuln = 0.25;
  if (p.hp <= 0) {
    p.hp = 0;
    return true;
  }
  return false;
}

export function healPlayer(S, amount) {
  const p = S.player;
  p.hp = clamp(p.hp + amount, 0, PLAYER.maxHp);
}
