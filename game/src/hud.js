// HUD: DOM readouts (money, health, armor, ammo, wanted stars, clock,
// speed, objective) plus a canvas minimap, notifications and the dialog box.

import { WORLD, districtAt } from './config.js';
import { missionObjectiveText } from './missions.js';

export function createHud(doc) {
  const $ = (id) => doc.getElementById(id);
  return {
    root: $('hud'), money: $('hud-money'), hp: $('hud-hp-fill'), hpText: $('hud-hp-text'),
    armor: $('hud-armor-fill'), ammo: $('hud-ammo'), stars: $('hud-stars'),
    clock: $('hud-clock'), speed: $('hud-speed'), objective: $('hud-objective'),
    district: $('hud-district'), station: $('hud-station'), notify: $('notify'),
    dialog: $('dialog'), dialogText: $('dialog-text'), dialogHint: $('dialog-hint'),
    minimap: $('minimap'), menu: $('menu'), pause: $('pause-screen'),
    over: $('over-screen'), overTitle: $('over-title'), overText: $('over-text'),
    title: $('title-screen'), howto: $('howto-screen'),
  };
}

function fmtClock(seconds) {
  const h = Math.floor(seconds / 3600) % 24;
  const m = Math.floor((seconds % 3600) / 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function updateHud(S, hud) {
  const p = S.player;
  hud.money.textContent = `$${S.money}`;
  hud.hp.style.width = `${p.hp}%`;
  hud.hpText.textContent = `${Math.ceil(p.hp)}`;
  hud.armor.style.width = `${p.armor}%`;
  hud.ammo.textContent = p.gun ? `AMMO ${p.ammo}` : 'NO GUN — F TO PUNCH';
  hud.stars.textContent = '★'.repeat(S.wanted) + '☆'.repeat(5 - S.wanted);
  hud.stars.style.color = S.wanted > 0 ? '#ff5a4d' : '#8a93a6';
  hud.clock.textContent = fmtClock(S.clock) + (S.rain > 0.3 ? '  🌧' : '');
  const spd = S.playerCar ? Math.abs(S.playerCar.speed) * 0.36 : 0;
  hud.speed.textContent = S.playerCar ? `${Math.round(spd)} km/h · ${S.playerCar.name}` : '';
  hud.objective.textContent = missionObjectiveText(S);
  const d = districtAt(p.x, p.y);
  if (d.name !== S.lastDistrict) {
    S.lastDistrict = d.name;
    hud.district.textContent = d.name;
    S.districtBannerUntil = S.time + 2.5; // banner fades out on its own
  }
  hud.district.classList.toggle('show', S.time < (S.districtBannerUntil || 0));
  hud.station.textContent = S.audio.stationName() + (S.audio.muted ? ' (muted)' : '');
  // Notifications: keep the last three, fade by age.
  hud.notify.innerHTML = '';
  for (const n of S.notify.slice(-3)) {
    const div = document.createElement('div');
    div.className = 'note';
    div.style.color = n.color || '#fff';
    div.style.opacity = String(Math.min(1, n.t / 1.5));
    div.textContent = n.text;
    hud.notify.appendChild(div);
  }
}

// Minimap: roads, mission marker (yellow), police (red/blue), taxi fare
// (green), player arrow (white). Drawn every frame on a 190px canvas.
export function drawMinimap(S, hud) {
  const c = hud.minimap;
  const ctx = c.getContext('2d');
  const scale = c.width / WORLD;
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.fillStyle = 'rgba(12, 18, 26, 0.85)';
  ctx.fillRect(0, 0, c.width, c.height);
  // Roads.
  ctx.strokeStyle = '#5a6472';
  ctx.lineWidth = 3;
  for (const line of [150, 450, 750, 1050, 1350, 1650, 1950, 2250]) {
    ctx.beginPath(); ctx.moveTo(line * scale, 0); ctx.lineTo(line * scale, c.height); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, line * scale); ctx.lineTo(c.width, line * scale); ctx.stroke();
  }
  // Buildings as faint blocks.
  ctx.fillStyle = 'rgba(140, 150, 165, 0.5)';
  for (const b of S.city.buildings) ctx.fillRect(b.x * scale, b.y * scale, Math.max(1, b.w * scale), Math.max(1, b.h * scale));
  const dot = (x, y, color, r) => {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x * scale, y * scale, r || 3, 0, Math.PI * 2); ctx.fill();
  };
  // Mission marker (pulsing yellow diamond).
  const m = S.mission && S.mission.marker;
  if (m) {
    const pulse = 3 + Math.sin(S.time * 5) * 1.5;
    ctx.fillStyle = '#ffe14d';
    ctx.save();
    ctx.translate(m.x * scale, m.y * scale);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-pulse, -pulse, pulse * 2, pulse * 2);
    ctx.restore();
  }
  // Taxi fare.
  if (S.taxi.active) {
    const t = S.taxi.state === 'pickup' ? S.taxi.pickup : S.taxi.drop;
    dot(t.x, t.y, '#7dff8a', 3);
  }
  // Police.
  for (const cop of S.cops) {
    if (cop.dead) continue;
    dot(cop.x, cop.y, cop.onFoot ? '#ff5a4d' : '#4d8dff', 3);
  }
  // Player arrow.
  const px = S.player.x * scale, py = S.player.y * scale;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(S.player.angle);
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill();
  ctx.restore();
  // North + border.
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, c.width - 1, c.height - 1);
}

// Dialog box: shows lines one at a time; Enter/click advances.
export function showDialogBox(S, hud, lines, onDone) {
  S.dialog = { lines, i: 0, onDone };
  hud.dialog.classList.remove('hidden');
  hud.dialogText.textContent = lines[0];
  hud.dialogHint.textContent = lines.length > 1 ? 'ENTER — next' : 'ENTER — continue';
}

export function advanceDialog(S, hud) {
  if (!S.dialog) return;
  S.dialog.i += 1;
  if (S.dialog.i >= S.dialog.lines.length) {
    const done = S.dialog.onDone;
    S.dialog = null;
    hud.dialog.classList.add('hidden');
    if (done) done();
  } else {
    hud.dialogText.textContent = S.dialog.lines[S.dialog.i];
    hud.dialogHint.textContent = S.dialog.i + 1 >= S.dialog.lines.length ? 'ENTER — continue' : 'ENTER — next';
  }
}

export function setScreen(S, hud, name) {
  // name: 'title' | 'howto' | 'play' | 'pause' | 'over'
  hud.title.classList.toggle('hidden', name !== 'title');
  hud.howto.classList.toggle('hidden', name !== 'howto');
  hud.pause.classList.toggle('hidden', name !== 'pause');
  hud.over.classList.toggle('hidden', name !== 'over');
  hud.root.classList.toggle('hidden', name === 'title' || name === 'howto');
  // The menu overlay shows for every screen except live play.
  if (name === 'play') hud.menu.classList.add('hidden');
  else hud.menu.classList.remove('hidden');
}
