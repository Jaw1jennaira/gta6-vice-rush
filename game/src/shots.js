// Screenshot poses behind ?shot=1..4. Each pose sets up real game state
// (position, car, wanted level, mission, time of day) and then lets the
// normal loop run a few seconds, so every screenshot is a genuine render of
// the game — no fake overlays, no staged DOM.

import { PLACES } from './config.js';
import { makeVehicle } from './vehicles.js';
import { makeEnemy, spawnPickup } from './combat.js';

export function stageShot(S, n) {
  // Fresh world, fixed seed, so the same shot always looks the same.
  S.resetWorld(7);
  if (n === 4) {
    // Title screen over a dusk pan of the Neon Mile.
    S.mode = 'title';
    S.clock = 18.5 * 3600;
    S.nightFactor = 0.45;
    return 'title';
  }
  S.mode = 'play';
  S.audio.ready = false; // headless: stay silent
  if (n === 1) {
    // COVER — a police chase: Mara in a yellow Comet GT, wanted 3, two
    // patrol cars on her tail, mission 2 objective on the HUD.
    S.clock = 15 * 3600;
    S.missionIndex = 1;
    S.mission = { id: 2, title: 'The Package', step: 1, timer: 0, objective: 'Deliver the package — lose the cops on the way', marker: { x: PLACES.neonDrop.x, y: PLACES.neonDrop.y, label: 'Drop-off' }, data: {} };
    const car = makeVehicle('comet', 1200, 1050, 0, 'player');
    car.color = '#e8b73a';
    car.speed = 380;
    car.hp = 600; car.maxHp = 600; // the cover chase must survive the pose
    S.vehicles.push(car);
    S.playerCar = car;
    S.player.x = car.x; S.player.y = car.y;
    S.player.gun = true; S.player.ammo = 48;
    S.money = 540;
    S.wanted = 3;
    const cop1 = makeVehicle('patrol', 1080, 1050, 0, 'police');
    cop1.speed = 330;
    const cop2 = makeVehicle('patrol', 1120, 1105, 0, 'police');
    cop2.speed = 320;
    S.vehicles.push(cop1, cop2);
    S.cops.push(
      { vehicle: cop1, onFoot: false, x: cop1.x, y: cop1.y, dead: false, bustTimer: 0 },
      { vehicle: cop2, onFoot: false, x: cop2.x, y: cop2.y, dead: false, bustTimer: 0 },
    );
    S.camera.x = 1200 - 640; S.camera.y = 1050 - 360;
    return 'play';
  }
  if (n === 2) {
    // On foot in the Neon Mile at noon: traffic, pedestrians, towers.
    S.clock = 12 * 3600;
    S.missionIndex = 0;
    S.mission = { id: 1, title: 'First Pickup', step: 0, timer: 0, objective: 'Pick up Eddie at the Portside Cafe', marker: { x: PLACES.cafe.x, y: PLACES.cafe.y, label: 'Eddie' }, data: {} };
    S.player.x = 1050; S.player.y = 1150;
    S.player.angle = -Math.PI / 2;
    S.money = 250;
    S.camera.x = 1050 - 640; S.camera.y = 1150 - 360;
    return 'play';
  }
  // Shot 3 — mission 4 in progress: the Old Town ambush, pistol out,
  // thugs closing in, dialog briefing on screen.
  S.clock = 19 * 3600;
  S.nightFactor = 0.35;
  S.missionIndex = 3;
  S.mission = { id: 4, title: 'Payback', step: 1, timer: 0, objective: 'Deal with Kane\'s three thugs (1/3 down)', marker: { x: PLACES.oldTownAmbush.x, y: PLACES.oldTownAmbush.y, label: 'Fight' }, data: {} };
  S.player.x = PLACES.oldTownAmbush.x;
  S.player.y = PLACES.oldTownAmbush.y + 90;
  S.player.gun = true; S.player.ammo = 36;
  S.player.angle = -Math.PI / 2;
  S.money = 890;
  const e1 = makeEnemy(S, PLACES.oldTownAmbush.x - 60, PLACES.oldTownAmbush.y - 30, 60);
  const e2 = makeEnemy(S, PLACES.oldTownAmbush.x + 55, PLACES.oldTownAmbush.y + 20, 60);
  const e3 = makeEnemy(S, PLACES.oldTownAmbush.x + 10, PLACES.oldTownAmbush.y - 70, 80);
  e3.dead = true; // one already down — the (1/3) in the objective is real
  S.stats.kills = 1;
  S.camera.x = S.player.x - 640; S.camera.y = S.player.y - 360;
  S.showDialog(['EDDIE SOL: Three of Kane\'s boys. Make it hurt, Mara.'], () => {});
  return 'play';
}
