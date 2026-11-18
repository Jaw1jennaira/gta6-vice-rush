// Rendering: top-down canvas drawing of Solmar Bay — ground, roads with
// markings and traffic lights, buildings with lit windows, beach and water,
// vehicles, people, particles, and the day/night + rain atmosphere.

import { WORLD, ROAD_LINES, ROAD_HALF, districtAt } from './config.js';
import { lightPhase } from './world.js';

export function drawWorld(S, ctx, vw, vh) {
  const cam = S.camera;
  ctx.save();
  if (S.shake > 0) ctx.translate((Math.random() - 0.5) * S.shake, (Math.random() - 0.5) * S.shake);
  ctx.translate(-cam.x, -cam.y);

  drawGround(S, ctx);
  drawRoads(S, ctx);
  drawParks(S, ctx);
  drawBuildings(S, ctx);
  drawProps(S, ctx);
  drawPickups(S, ctx);
  drawSprayShop(S, ctx);
  drawMarker(S, ctx);
  drawVehicles(S, ctx);
  drawPeds(S, ctx);
  drawEnemies(S, ctx);
  drawPlayer(S, ctx);
  drawBullets(S, ctx);
  drawParticles(S, ctx);
  drawRain(S, ctx);
  ctx.restore();

  drawNight(S, ctx, vw, vh);
  drawVignette(ctx, vw, vh);
  if (S.player.hurtFlash > 0) {
    ctx.fillStyle = `rgba(255, 40, 30, ${S.player.hurtFlash * 0.5})`;
    ctx.fillRect(0, 0, vw, vh);
  }
}

function visible(S, x, y, margin) {
  const cam = S.camera;
  return x > cam.x - margin && x < cam.x + S.view.w + margin && y > cam.y - margin && y < cam.y + S.view.h + margin;
}

function drawGround(S, ctx) {
  const cam = S.camera;
  // Base grass.
  ctx.fillStyle = '#6f8f5a';
  ctx.fillRect(cam.x - 40, cam.y - 40, S.view.w + 80, S.view.h + 80);
  // District ground tints.
  for (const d of S.city.districts) {
    if (!visible(S, d.x + d.w / 2, d.y + d.h / 2, Math.max(d.w, d.h) / 2)) continue;
    ctx.fillStyle = d.ground;
    ctx.fillRect(d.x, d.y, d.w, d.h);
  }
  // Beach sand + sea at the south edge.
  ctx.fillStyle = '#d9c08a';
  ctx.fillRect(0, 2260, WORLD, 140);
  ctx.fillStyle = '#2b7fb8';
  ctx.fillRect(0, 2340, WORLD, 60);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  for (let x = 0; x < WORLD; x += 90) {
    const wob = Math.sin(S.time * 1.2 + x * 0.05) * 6;
    ctx.fillRect(x, 2342 + wob, 60, 3);
  }
  // Airport tarmac.
  ctx.fillStyle = '#565e66';
  ctx.fillRect(1800, 0, 600, 480);
  ctx.fillStyle = '#e8e8e8';
  for (let x = 1830; x < 2380; x += 60) ctx.fillRect(x, 250, 30, 6);
  ctx.fillStyle = '#c9a13a';
  ctx.fillRect(1800, 470, 600, 6);
}

function drawRoads(S, ctx) {
  // Asphalt.
  ctx.fillStyle = '#33383f';
  for (const c of ROAD_LINES) {
    ctx.fillRect(c - ROAD_HALF, 0, ROAD_HALF * 2, WORLD);
    ctx.fillRect(0, c - ROAD_HALF, WORLD, ROAD_HALF * 2);
  }
  // Diagonal avenue (x + y = 2100), drawn as a rotated band.
  ctx.save();
  ctx.translate(1050, 1050);
  ctx.rotate(-Math.PI / 4);
  ctx.fillRect(-1700, -ROAD_HALF, 3400, ROAD_HALF * 2);
  ctx.restore();
  // Centre dashes.
  ctx.fillStyle = '#e8d24d';
  for (const c of ROAD_LINES) {
    for (let t = 0; t < WORLD; t += 56) {
      if (Math.abs(t - c) < ROAD_HALF + 20) continue; // skip intersections
      ctx.fillRect(c - 2, t, 4, 26);
      ctx.fillRect(t, c - 2, 26, 4);
    }
  }
  // Crosswalks at intersections.
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (const cx of ROAD_LINES) {
    for (const cy of ROAD_LINES) {
      for (let i = -3; i <= 3; i += 1) {
        ctx.fillRect(cx + i * 11 - 3, cy - ROAD_HALF - 4, 6, 8);
        ctx.fillRect(cx + i * 11 - 3, cy + ROAD_HALF - 4, 6, 8);
      }
    }
  }
  // Traffic lights.
  for (let ix = 0; ix < ROAD_LINES.length; ix += 1) {
    for (let iy = 0; iy < ROAD_LINES.length; iy += 1) {
      const cx = ROAD_LINES[ix], cy = ROAD_LINES[iy];
      if (!visible(S, cx, cy, 60)) continue;
      const phase = lightPhase(S.time, ix, iy);
      const col = phase === 'green' ? '#37d67a' : phase === 'amber' ? '#ffb13c' : '#ff4d3d';
      ctx.fillStyle = '#1c1f24';
      ctx.fillRect(cx + ROAD_HALF + 2, cy - ROAD_HALF - 18, 8, 22);
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(cx + ROAD_HALF + 6, cy - ROAD_HALF - 7, 3.5, 0, Math.PI * 2); ctx.fill();
    }
  }
}

function drawParks(S, ctx) {
  for (const pk of S.city.parks) {
    if (!visible(S, pk.x + pk.w / 2, pk.y + pk.h / 2, pk.w)) continue;
    ctx.fillStyle = '#5d8a4a';
    ctx.fillRect(pk.x, pk.y, pk.w, pk.h);
    ctx.fillStyle = '#6f9a55';
    ctx.fillRect(pk.x + 8, pk.y + 8, pk.w - 16, pk.h - 16);
  }
  for (const pl of S.city.plazas) {
    ctx.fillStyle = '#9a948a';
    ctx.fillRect(pl.x, pl.y, pl.w, pl.h);
  }
  for (const lot of S.city.parkingLots) {
    ctx.fillStyle = '#4a4f55';
    ctx.fillRect(lot.x, lot.y, lot.w, lot.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    for (let x = lot.x + 12; x < lot.x + lot.w - 10; x += 34) {
      ctx.beginPath(); ctx.moveTo(x, lot.y + 6); ctx.lineTo(x, lot.y + 26); ctx.stroke();
    }
  }
}

function drawBuildings(S, ctx) {
  const night = S.nightFactor;
  for (const b of S.city.buildings) {
    if (!visible(S, b.x + b.w / 2, b.y + b.h / 2, Math.max(b.w, b.h))) continue;
    // Drop shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x + 5, b.y + 6, b.w, b.h);
    // Walls + roof edge.
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
    // Windows: warm lit squares at night, dark by day.
    const cols = Math.max(2, Math.floor(b.w / 22));
    const rows = Math.max(2, Math.floor(b.h / 22));
    for (let i = 0; i < cols; i += 1) {
      for (let j = 0; j < rows; j += 1) {
        const lit = ((i * 7 + j * 13 + (b.x | 0)) % 5) < 2;
        ctx.fillStyle = night > 0.4 && lit ? '#ffd97a' : 'rgba(20,26,34,0.55)';
        ctx.fillRect(b.x + 8 + i * ((b.w - 16) / cols), b.y + 8 + j * ((b.h - 16) / rows), 8, 8);
      }
    }
    // Neon signs on Neon Mile towers.
    if (b.neon) {
      ctx.fillStyle = b.neon;
      ctx.globalAlpha = 0.65 + Math.sin(S.time * 3 + b.x) * 0.3;
      ctx.fillRect(b.x + b.w / 2 - 14, b.y - 4, 28, 6);
      ctx.globalAlpha = 1;
    }
  }
}

function drawProps(S, ctx) {
  for (const t of S.city.trees) {
    if (!visible(S, t.x, t.y, 20)) continue;
    ctx.fillStyle = '#4a7a35';
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5d9a44';
    ctx.beginPath(); ctx.arc(t.x - 3, t.y - 3, t.r * 0.6, 0, Math.PI * 2); ctx.fill();
  }
  // Street lamps glow at night.
  if (S.nightFactor > 0.4) {
    ctx.fillStyle = 'rgba(255, 220, 120, 0.12)';
    for (const l of S.city.lamps) {
      if (!visible(S, l.x, l.y, 60)) continue;
      ctx.beginPath(); ctx.arc(l.x, l.y, 46, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.fillStyle = '#2a2f36';
  for (const l of S.city.lamps) {
    if (!visible(S, l.x, l.y, 10)) continue;
    ctx.fillRect(l.x - 2, l.y - 2, 4, 4);
  }
}

function drawPickups(S, ctx) {
  for (const pk of S.pickups) {
    if (pk.taken || !visible(S, pk.x, pk.y, 30)) continue;
    const bob = Math.sin(S.time * 4 + pk.x) * 2;
    const col = pk.kind === 'health' ? '#ff5a5a' : pk.kind === 'armor' ? '#5aa8ff' : '#ffe14d';
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(pk.x, pk.y + bob, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(pk.kind === 'health' ? '+' : pk.kind === 'armor' ? 'A' : '•', pk.x, pk.y + bob);
  }
}

function drawSprayShop(S, ctx) {
  const x = 1050, y = 1650;
  if (!visible(S, x, y, 120)) return;
  ctx.fillStyle = '#c94f6d';
  ctx.fillRect(x - 60, y - 34, 120, 68);
  ctx.fillStyle = '#e8e8e8';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('SPRAY SHOP', x, y - 8);
  ctx.font = '11px sans-serif';
  ctx.fillText('wanted gone · $100', x, y + 10);
  // Pulsing ring so the player can find it.
  ctx.strokeStyle = `rgba(255, 225, 77, ${0.5 + Math.sin(S.time * 4) * 0.3})`;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(x, y, 74, 0, Math.PI * 2); ctx.stroke();
}

function drawMarker(S, ctx) {
  const m = S.mission && S.mission.marker;
  if (!m) return;
  const bob = Math.sin(S.time * 5) * 6;
  // Ground ring + floating diamond.
  ctx.strokeStyle = 'rgba(255, 225, 77, 0.8)';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(m.x, m.y, 26 + Math.sin(S.time * 3) * 4, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#ffe14d';
  ctx.save();
  ctx.translate(m.x, m.y - 34 + bob);
  ctx.rotate(Math.PI / 4);
  ctx.fillRect(-9, -9, 18, 18);
  ctx.restore();
  // Edge arrow when the marker is off-screen.
  const cam = S.camera;
  const sx = m.x - cam.x, sy = m.y - cam.y;
  if (sx < 0 || sx > S.view.w || sy < 0 || sy > S.view.h) {
    const cx = Math.max(40, Math.min(S.view.w - 40, sx));
    const cy = Math.max(40, Math.min(S.view.h - 40, sy));
    const a = Math.atan2(sy - S.view.h / 2, sx - S.view.w / 2);
    ctx.save();
    ctx.translate(cam.x + cx, cam.y + cy);
    ctx.rotate(a);
    ctx.fillStyle = '#ffe14d';
    ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-10, -11); ctx.lineTo(-10, 11); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  // Taxi fare marker.
  if (S.taxi.active) {
    const t = S.taxi.state === 'pickup' ? S.taxi.pickup : S.taxi.drop;
    ctx.fillStyle = '#7dff8a';
    ctx.beginPath(); ctx.arc(t.x, t.y - 20 + Math.sin(S.time * 5) * 4, 8, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#7dff8a';
    ctx.beginPath(); ctx.arc(t.x, t.y, 22, 0, Math.PI * 2); ctx.stroke();
  }
}

function drawVehicles(S, ctx) {
  for (const v of S.vehicles) {
    if (v.dead && v.exploded) continue;
    if (!visible(S, v.x, v.y, 80)) continue;
    ctx.save();
    ctx.translate(v.x, v.y);
    ctx.rotate(v.angle);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-v.w / 2 + 3, -v.h / 2 + 4, v.w, v.h);
    // Body.
    ctx.fillStyle = v.color;
    roundRect(ctx, -v.w / 2, -v.h / 2, v.w, v.h, 7);
    ctx.fill();
    // Cabin / windshield.
    ctx.fillStyle = 'rgba(30,40,52,0.85)';
    const cab = v.model === 'lobo' ? { x: -v.w / 2 + 4, w: v.w - 8 } : { x: -6, w: 18 };
    ctx.fillRect(cab.x, -v.h / 2 + 4, cab.w, v.h - 8);
    // Headlights + brake lights.
    ctx.fillStyle = '#fff6b0';
    ctx.fillRect(v.w / 2 - 2, -v.h / 2 + 3, 3, 5);
    ctx.fillRect(v.w / 2 - 2, v.h / 2 - 8, 3, 5);
    ctx.fillStyle = v.brakeLight ? '#ff2d1e' : '#8a1d14';
    ctx.fillRect(-v.w / 2 - 1, -v.h / 2 + 3, 3, 5);
    ctx.fillRect(-v.w / 2 - 1, v.h / 2 - 8, 3, 5);
    // Police livery + light bar.
    if (v.model === 'patrol') {
      ctx.fillStyle = '#e8e8e8';
      ctx.fillRect(-v.w / 2 + 8, -v.h / 2 + 2, v.w - 16, 4);
      ctx.fillRect(-v.w / 2 + 8, v.h / 2 - 6, v.w - 16, 4);
      const blink = Math.sin(S.time * 10) > 0;
      ctx.fillStyle = blink ? '#ff2d1e' : '#2d6bff';
      ctx.fillRect(-4, -v.h / 2 - 2, 8, 5);
      ctx.fillStyle = blink ? '#2d6bff' : '#ff2d1e';
      ctx.fillRect(-4, v.h / 2 - 3, 8, 5);
    }
    if (v.model === 'sunset') {
      ctx.fillStyle = '#20242c';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TAXI', 0, 3);
    }
    ctx.restore();
    // Damage smoke handled by particles; wrecked cars get a dark tint.
    if (v.hp < v.maxHp * 0.35) {
      ctx.fillStyle = 'rgba(20,20,20,0.35)';
      ctx.beginPath(); ctx.arc(v.x, v.y, 24, 0, Math.PI * 2); ctx.fill();
    }
    // "E" prompt above a stealable car near the player.
    if (!S.playerCar && v.driver !== 'player' && Math.hypot(v.x - S.player.x, v.y - S.player.y) < 64) {
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      roundRect(ctx, v.x - 52, v.y - 52, 104, 20, 5); ctx.fill();
      ctx.fillStyle = '#ffe14d';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('E — take the ' + v.name, v.x, v.y - 42);
    }
  }
}

function drawPeds(S, ctx) {
  for (const p of S.peds) {
    if (!visible(S, p.x, p.y, 30)) continue;
    if (p.dead) {
      ctx.fillStyle = 'rgba(60,20,20,0.8)';
      ctx.beginPath(); ctx.ellipse(p.x, p.y, 12, 7, p.angle, 0, Math.PI * 2); ctx.fill();
      continue;
    }
    const bob = Math.sin(p.walkPhase) * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(p.x, p.y + 8, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y + bob * 0.3, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f2c79a';
    ctx.beginPath(); ctx.arc(p.x + Math.cos(p.angle) * 3, p.y + Math.sin(p.angle) * 3 + bob * 0.3, 5.5, 0, Math.PI * 2); ctx.fill();
  }
}

function drawEnemies(S, ctx) {
  for (const e of S.enemies) {
    if (e.dead || !visible(S, e.x, e.y, 40)) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(e.x, e.y + 9, 10, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3f3a4a';
    ctx.beginPath(); ctx.arc(e.x, e.y, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8c9a0';
    ctx.beginPath(); ctx.arc(e.x + Math.cos(e.angle) * 3, e.y + Math.sin(e.angle) * 3, 6, 0, Math.PI * 2); ctx.fill();
    // Gun barrel.
    ctx.strokeStyle = '#1c1f24';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(e.x + Math.cos(e.angle) * 10, e.y + Math.sin(e.angle) * 10);
    ctx.lineTo(e.x + Math.cos(e.angle) * 22, e.y + Math.sin(e.angle) * 22);
    ctx.stroke();
    // Health bar.
    ctx.fillStyle = '#1c1f24';
    ctx.fillRect(e.x - 14, e.y - 22, 28, 4);
    ctx.fillStyle = '#ff5a4d';
    ctx.fillRect(e.x - 14, e.y - 22, 28 * Math.max(0, e.hp / 80), 4);
  }
  // Foot cops.
  for (const c of S.cops) {
    if (!c.onFoot || c.dead || !visible(S, c.x, c.y, 30)) continue;
    ctx.fillStyle = '#20242c';
    ctx.beginPath(); ctx.arc(c.x, c.y, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#4d8dff';
    ctx.beginPath(); ctx.arc(c.x, c.y - 3, 5, 0, Math.PI * 2); ctx.fill();
    if (c.bustTimer > 0) {
      ctx.fillStyle = '#ff5a4d';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('BUSTED?', c.x, c.y - 20);
    }
  }
}

function drawPlayer(S, ctx) {
  const p = S.player;
  if (S.playerCar) return; // she is inside the car
  if (!visible(S, p.x, p.y, 40)) return;
  const bob = p.moving ? Math.sin(S.time * (p.running ? 14 : 9)) * 2 : 0;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(p.x, p.y + 9, 10, 5, 0, 0, Math.PI * 2); ctx.fill();
  // Mara: teal jacket, dark hair, white sneakers.
  ctx.fillStyle = '#0f8a7a';
  ctx.beginPath(); ctx.arc(p.x, p.y + bob * 0.3, 11, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f2c79a';
  ctx.beginPath(); ctx.arc(p.x + Math.cos(p.angle) * 4, p.y + Math.sin(p.angle) * 4 + bob * 0.3, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2b2118';
  ctx.beginPath(); ctx.arc(p.x - Math.cos(p.angle) * 2, p.y - Math.sin(p.angle) * 2 + bob * 0.3, 5, 0, Math.PI * 2); ctx.fill();
  // Pistol in hand when armed.
  if (p.gun) {
    ctx.strokeStyle = '#1c1f24';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(p.x + Math.cos(p.angle) * 10, p.y + Math.sin(p.angle) * 10);
    ctx.lineTo(p.x + Math.cos(p.angle) * 20, p.y + Math.sin(p.angle) * 20);
    ctx.stroke();
  }
  // Punch swing.
  if (p.punchTimer > 0) {
    ctx.strokeStyle = '#f2c79a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.cos(p.angle) * 26, p.y + Math.sin(p.angle) * 26);
    ctx.stroke();
  }
  // Direction tick so the player reads facing at a glance.
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath(); ctx.arc(p.x + Math.cos(p.angle) * 14, p.y + Math.sin(p.angle) * 14, 2.5, 0, Math.PI * 2); ctx.fill();
}

function drawBullets(S, ctx) {
  ctx.fillStyle = '#ffe14d';
  for (const b of S.bullets) {
    ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,225,77,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
}

function drawParticles(S, ctx) {
  for (const pt of S.parts) {
    const a = Math.max(0, pt.life / pt.max);
    if (pt.kind === 'smoke') {
      ctx.fillStyle = `rgba(90,90,90,${a * 0.55})`;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size * (1.6 - a * 0.6), 0, Math.PI * 2); ctx.fill();
    } else if (pt.kind === 'fire') {
      ctx.fillStyle = `rgba(255,${Math.floor(120 + a * 100)},40,${a})`;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size * a, 0, Math.PI * 2); ctx.fill();
    } else if (pt.kind === 'flash') {
      ctx.fillStyle = `rgba(255,220,120,${a})`;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size * (1.4 - a), 0, Math.PI * 2); ctx.fill();
    } else if (pt.kind === 'blood') {
      ctx.fillStyle = `rgba(180,30,30,${a * 0.8})`;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size * a, 0, Math.PI * 2); ctx.fill();
    } else if (pt.kind === 'spark') {
      ctx.fillStyle = `rgba(255,240,150,${a})`;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size * a, 0, Math.PI * 2); ctx.fill();
    } else if (pt.kind === 'skid') {
      ctx.fillStyle = `rgba(20,20,20,${a * 0.5})`;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2); ctx.fill();
    }
  }
}

function drawRain(S, ctx) {
  if (S.rain <= 0.05) return;
  ctx.strokeStyle = `rgba(180,200,230,${0.35 * S.rain})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const d of S.rainDrops) {
    ctx.moveTo(d.x, d.y);
    ctx.lineTo(d.x - 4, d.y + 14);
  }
  ctx.stroke();
}

// Night tint + warm window glow baked into buildings already; this is the
// global overlay. factor 0 = noon, 1 = midnight.
function drawNight(S, ctx, vw, vh) {
  const f = S.nightFactor;
  if (f <= 0.02) return;
  ctx.fillStyle = `rgba(10, 16, 42, ${f * 0.55})`;
  ctx.fillRect(0, 0, vw, vh);
}

function drawVignette(ctx, vw, vh) {
  const g = ctx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.45, vw / 2, vh / 2, Math.max(vw, vh) * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, vw, vh);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Title screen backdrop: a slow pan over the Neon Mile at dusk.
export function drawTitleBackdrop(S, ctx, vw, vh) {
  const t = S.time * 12;
  S.camera.x = 900 + Math.sin(t * 0.01) * 200;
  S.camera.y = 900 + Math.cos(t * 0.008) * 120;
  S.nightFactor = 0.45;
  drawWorld(S, ctx, vw, vh);
}
