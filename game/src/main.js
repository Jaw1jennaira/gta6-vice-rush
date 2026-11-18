// VICE RUSH — bootstrap, game loop and state machine.
// Modes: title → play ⇄ pause → over (Wasted / Busted) → title.
// The loop updates the world, then draws it; the HUD is DOM, the world is
// canvas. Every system module is wired here through the shared state object.

import { WORLD, PLACES, VEHICLES, mulberry32, clamp, dist } from './config.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { buildCity } from './world.js';
import { createPlayer, updatePlayerOnFoot, damagePlayer, healPlayer } from './player.js';
import { makeVehicle, updatePlayerVehicle, updateTraffic, spawnTrafficCar, nearestStealableCar, stealCar, exitCar, damageVehicle, setDamagePlayer, setRaiseWanted } from './vehicles.js';
import { spawnPed, updatePeds } from './pedestrians.js';
import { raiseWanted, updateWanted, updatePolice, trySprayShop } from './police.js';
import { updateCombat, spawnPickup } from './combat.js';
import { startMission, updateMissions, currentMissionDef } from './missions.js';
import { saveGameData, loadGameData, hasSave, applySave } from './save.js';
import { createHud, updateHud, drawMinimap, showDialogBox, advanceDialog, setScreen } from './hud.js';
import { drawWorld, drawTitleBackdrop } from './render.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const hud = createHud(document);

const S = {
  mode: 'title',
  time: 0,
  clock: 8 * 3600,          // 08:00 on day one
  money: 250,
  wanted: 0,
  lastCrimeAt: -999,
  hiddenTimer: 0,
  copSpawnTimer: 0,
  player: null,
  playerCar: null,
  vehicles: [],
  peds: [],
  cops: [],
  enemies: [],
  bullets: [],
  parts: [],
  pickups: [],
  city: null,
  rng: mulberry32(20261118),
  input: createInput(canvas),
  audio: createAudio(),
  camera: { x: 0, y: 0 },
  view: { w: 1280, h: 720 },
  shake: 0,
  nightFactor: 0,
  rain: 0,
  rainTimer: 120,
  rainDrops: [],
  alarm: 0,
  shootCooldown: 0,
  notify: [],
  dialog: null,
  mission: null,
  missionIndex: 0,
  taxi: { active: false, cooldown: 40, state: 'pickup', pickup: null, drop: null, fare: 0 },
  stats: { kills: 0, carsStolen: 0, xp: 0 },
  lastDistrict: '',
  overReason: 'wasted',
  shotMode: 0,
};

// --- cross-module wiring (each system calls back through S) -------------
S.damagePlayer = (amount) => damagePlayer(S, amount);
S.healPlayer = (amount) => healPlayer(S, amount);
S.damageVehicle = (v, amount) => damageVehicle(S, v, amount);
S.raiseWanted = (stars, reason) => raiseWanted(S, stars, reason);
S.showDialog = (lines, onDone) => showDialogBox(S, hud, lines, onDone);
S.saveGame = () => saveGameData(S);
S.gameOver = (reason) => gameOver(reason);
setDamagePlayer((state, amount) => damagePlayer(state, amount));
setRaiseWanted((state, stars, reason) => raiseWanted(state, stars, reason));

// --- world setup --------------------------------------------------------
S.resetWorld = (seed) => {
  S.city = buildCity(seed);
  S.vehicles = []; S.peds = []; S.cops = []; S.enemies = [];
  S.bullets = []; S.parts = []; S.pickups = [];
  S.playerCar = null; S.wanted = 0; S.hiddenTimer = 0;
  S.taxi = { active: false, cooldown: 40, state: 'pickup', pickup: null, drop: null, fare: 0 };
  S.player = createPlayer(PLACES.start.x, PLACES.start.y);
  // Parked cars in the lots, plus a few on the street.
  const rng = S.rng;
  const models = ['vulture', 'rustler', 'bison', 'lobo', 'sunset', 'wave'];
  for (const lot of S.city.parkingLots.slice(0, 10)) {
    const n = 1 + Math.floor(rng() * 2);
    for (let i = 0; i < n; i += 1) {
      const v = makeVehicle(models[Math.floor(rng() * models.length)],
        lot.x + 20 + rng() * Math.max(1, lot.w - 40), lot.y + 20 + rng() * Math.max(1, lot.h - 40),
        rng() * Math.PI * 2, 'parked');
      S.vehicles.push(v);
    }
  }
  // Traffic + crowd.
  for (let i = 0; i < 12; i += 1) spawnTrafficCar(S);
  for (let i = 0; i < 22; i += 1) spawnPed(S);
  // Static pickups around the city.
  spawnPickup(S, 'health', 500, 800);
  spawnPickup(S, 'armor', 1400, 800);
  spawnPickup(S, 'ammo', 800, 1400);
  spawnPickup(S, 'health', 1900, 1900);
  S.camera.x = S.player.x - S.view.w / 2;
  S.camera.y = S.player.y - S.view.h / 2;
};

function nightFactorFor(clockSeconds) {
  const h = (clockSeconds / 3600) % 24;
  if (h >= 6 && h < 18) return 0;
  if (h >= 18 && h < 20) return (h - 18) / 2 * 0.5;
  if (h >= 20 || h < 5) return 0.85;
  return (1 - (h - 5)) * 0.85; // 05:00–06:00 dawn
}

// --- screens ------------------------------------------------------------
function gameOver(reason) {
  if (S.mode !== 'play') return;
  S.overReason = reason;
  S.mode = 'over';
  S.audio.busted();
  S.audio.engine(0, false);
  const lost = Math.min(S.money, 100);
  S.money -= lost;
  document.getElementById('over-title').textContent = reason === 'busted' ? 'BUSTED!' : 'WASTED';
  document.getElementById('over-text').textContent =
    reason === 'busted'
      ? `Solmar PD hauled you in. Bail cost $${lost}. Eddie is already working on it.`
      : `You went down in Solmar Bay. The hospital patched you up — bill $${lost}.`;
  setScreen(S, hud, 'over');
}

function respawn() {
  S.player = createPlayer(PLACES.hospital.x, PLACES.hospital.y);
  S.player.hp = 100;
  S.playerCar = null;
  S.wanted = 0;
  S.cops = [];
  S.enemies = [];
  S.bullets = [];
  S.mode = 'play';
  setScreen(S, hud, 'play');
  // The current mission restarts from its beginning.
  if (S.missionIndex < 6) startMission(S, S.missionIndex);
  else S.mission = null;
  S.notify.push({ text: 'Back on your feet. Stay out of trouble — or don\'t.', t: 4, color: '#7dff8a' });
}

function newGame() {
  S.resetWorld(20261118);
  S.money = 250;
  S.missionIndex = 0;
  S.stats = { kills: 0, carsStolen: 0, xp: 0 };
  S.clock = 8 * 3600;
  S.mode = 'play';
  setScreen(S, hud, 'play');
  S.audio.init(); S.audio.resume();
  startMission(S, 0);
}

function continueGame() {
  const data = loadGameData();
  if (!data) { newGame(); return; }
  S.resetWorld(20261118);
  applySave(S, data);
  S.mode = 'play';
  setScreen(S, hud, 'play');
  S.audio.init(); S.audio.resume();
  if (S.missionIndex < 6) startMission(S, S.missionIndex);
  else S.mission = null;
  S.notify.push({ text: 'Welcome back to Solmar Bay, Mara.', t: 4, color: '#7dff8a' });
}

function togglePause() {
  if (S.mode === 'play') { S.mode = 'pause'; setScreen(S, hud, 'pause'); }
  else if (S.mode === 'pause') { S.mode = 'play'; setScreen(S, hud, 'play'); }
}

// --- menu buttons -------------------------------------------------------
document.getElementById('btn-new').addEventListener('click', () => { S.audio.click(); newGame(); });
document.getElementById('btn-continue').addEventListener('click', () => { S.audio.click(); continueGame(); });
document.getElementById('btn-howto').addEventListener('click', () => { S.audio.click(); setScreen(S, hud, 'howto'); });
document.getElementById('btn-howto-back').addEventListener('click', () => { S.audio.click(); setScreen(S, hud, 'title'); });
document.getElementById('btn-resume').addEventListener('click', () => { S.audio.click(); togglePause(); });
document.getElementById('btn-quit').addEventListener('click', () => {
  S.audio.click(); S.saveGame(); S.mode = 'title'; setScreen(S, hud, 'title');
});
document.getElementById('btn-retry').addEventListener('click', () => { S.audio.click(); respawn(); });
document.getElementById('btn-over-title').addEventListener('click', () => {
  S.audio.click(); S.saveGame(); S.mode = 'title'; setScreen(S, hud, 'title');
});
document.getElementById('btn-continue').disabled = !hasSave();

// --- per-frame update ---------------------------------------------------
function update(dt) {
  S.time += dt;
  if (S.shake > 0) S.shake = Math.max(0, S.shake - dt * 30);
  // Notifications age out.
  for (const n of S.notify) n.t -= dt;
  S.notify = S.notify.filter((n) => n.t > 0);

  if (S.mode === 'title') {
    S.clock += dt * 60;
    S.nightFactor = nightFactorFor(S.clock);
    return;
  }
  // The pause key must work while paused too, so it is read before the
  // play-only gate below (a paused game otherwise could never resume).
  if (S.input.hit('pause')) {
    if (S.mode === 'play' || S.mode === 'pause') { togglePause(); return; }
  }
  if (S.mode !== 'play') return;

  // Clock: a full day takes 8 minutes of play.
  S.clock = (S.clock + dt * 180) % 86400;
  S.nightFactor = nightFactorFor(S.clock);

  // Weather: occasional rain.
  S.rainTimer -= dt;
  if (S.rainTimer <= 0) {
    S.rainTimer = 90 + Math.random() * 120;
    S.rain = S.rain > 0.3 ? 0 : 0.4 + Math.random() * 0.6;
    if (S.rain > 0.3) S.notify.push({ text: 'Rain over Solmar Bay — roads are slick.', t: 3, color: '#7db8e8' });
  }
  if (S.rain > 0.05) {
    for (let i = 0; i < 3; i += 1) {
      S.rainDrops.push({ x: S.camera.x + Math.random() * S.view.w, y: S.camera.y + Math.random() * S.view.h, v: 500 + Math.random() * 300 });
    }
  }
  for (const d of S.rainDrops) d.y += d.v * dt;
  S.rainDrops = S.rainDrops.filter((d) => d.y < S.camera.y + S.view.h + 20).slice(-120);

  // Dialog freezes the world but not the render.
  if (S.dialog) {
    if (S.input.hit('confirm') || S.input.mouseClicked) advanceDialog(S, hud);
    return;
  }

  const inp = S.input;
  if (inp.hit('mute')) { S.audio.setMuted(!S.audio.muted); S.notify.push({ text: S.audio.muted ? 'Sound muted' : 'Sound on', t: 1.5, color: '#fff' }); }
  if (inp.hit('radio')) { S.audio.nextStation(); S.notify.push({ text: `Radio: ${S.audio.stationName()}`, t: 2, color: '#ffe14d' }); }

  // Enter / exit a car.
  if (inp.hit('enter')) {
    if (S.playerCar) exitCar(S);
    else {
      const car = nearestStealableCar(S, 64);
      if (car) stealCar(S, car);
    }
  }

  // Move the player (on foot or driving).
  if (S.playerCar) {
    updatePlayerVehicle(S, dt);
    S.player.x = S.playerCar.x;
    S.player.y = S.playerCar.y;
    S.player.angle = S.playerCar.angle;
  } else {
    updatePlayerOnFoot(S, dt);
  }

  updateTraffic(S, dt);
  updatePeds(S, dt);
  updatePolice(S, dt);
  updateWanted(S, dt);
  updateCombat(S, dt);
  updateMissions(S, dt);
  trySprayShop(S);

  // Keep the crowd topped up near the player.
  if (S.vehicles.filter((v) => v.driver === 'traffic').length < 12) spawnTrafficCar(S);
  if (S.peds.filter((p) => !p.dead).length < 18) spawnPed(S);

  // Particles.
  for (const pt of S.parts) {
    pt.life -= dt;
    if (pt.vx !== undefined) { pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vx *= 0.98; pt.vy *= 0.98; }
  }
  S.parts = S.parts.filter((pt) => pt.life > 0);
  // Dead pedestrians fade out.
  for (const p of S.peds) if (p.dead && p.deathT !== undefined) p.deathT -= dt;

  // Camera follows the player, clamped to the city.
  const tx = S.player.x, ty = S.player.y;
  S.camera.x += clamp(tx - S.view.w / 2 - S.camera.x, -400 * dt * 4, 400 * dt * 4);
  S.camera.y += clamp(ty - S.view.h / 2 - S.camera.y, -400 * dt * 4, 400 * dt * 4);
  S.camera.x = clamp(S.camera.x, -40, WORLD - S.view.w + 40);
  S.camera.y = clamp(S.camera.y, -40, WORLD - S.view.h + 40);

  // Audio: engine, music.
  S.audio.engine(S.playerCar ? Math.abs(S.playerCar.speed) / 460 : 0, !!S.playerCar);
  S.audio.musicTick();
}

// --- per-frame draw -----------------------------------------------------
function draw() {
  ctx.clearRect(0, 0, S.view.w, S.view.h);
  if (S.mode === 'title' || S.mode === 'howto') {
    drawTitleBackdrop(S, ctx, S.view.w, S.view.h);
    return;
  }
  drawWorld(S, ctx, S.view.w, S.view.h);
  drawMinimap(S, hud);
  updateHud(S, hud);
}

// --- main loop ----------------------------------------------------------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  draw();
  S.input.endFrame();
  requestAnimationFrame(frame);
}

function resize() {
  S.view.w = window.innerWidth;
  S.view.h = window.innerHeight;
  canvas.width = S.view.w;
  canvas.height = S.view.h;
  const mm = hud.minimap;
  mm.width = 190; mm.height = 190;
}
window.addEventListener('resize', resize);
resize();

// --- boot ---------------------------------------------------------------
// Debug hook for automated play-testing (read-only state inspection).
window.__viceRush = S;
S.resetWorld(20261118);
const params = new URLSearchParams(window.location.search);
const shot = Number(params.get('shot') || 0);
if (shot >= 1 && shot <= 4) {
  S.shotMode = shot;
  stageShot(S, shot);
  setScreen(S, hud, shot === 4 ? 'title' : 'play');
  // In shot mode the game renders the posed state immediately.
  S.camera.x = clamp(S.player.x - S.view.w / 2, -40, WORLD - S.view.w + 40);
  S.camera.y = clamp(S.player.y - S.view.h / 2, -40, WORLD - S.view.h + 40);
} else {
  setScreen(S, hud, 'title');
  document.getElementById('menu').classList.remove('hidden');
}
requestAnimationFrame(frame);
