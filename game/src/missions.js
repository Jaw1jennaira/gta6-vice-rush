// Story missions: six chained jobs for Mara Voss, plus taxi fares on the side.
// Each mission is a small state machine: steps advance on proximity, pickups,
// kills or timers. The HUD reads S.mission for its objective line and marker.

import { MISSIONS, MISSION_REWARDS, PLACES, dist, clamp, angleDiff } from './config.js';
import { makeVehicle } from './vehicles.js';
import { makeEnemy, spawnPickup } from './combat.js';

export function currentMissionDef(S) {
  return S.missionIndex < MISSIONS.length ? MISSIONS[S.missionIndex] : null;
}

export function missionObjectiveText(S) {
  const m = S.mission;
  if (S.missionIndex >= MISSIONS.length) return 'Story complete — free roam Solmar Bay';
  if (!m) return '';
  return m.objective || '';
}

function setObjective(S, text, x, y, label) {
  S.mission.objective = text;
  S.mission.marker = { x, y, label: label || '' };
}

export function startMission(S, index) {
  S.missionIndex = index;
  const def = MISSIONS[index];
  S.mission = { id: def.id, title: def.title, step: 0, timer: 0, objective: '', marker: null, data: {} };
  S.showDialog(def.brief.slice(), () => { beginMissionSteps(S); });
  S.audio.missionDone();
}

function beginMissionSteps(S) {
  const i = S.missionIndex;
  if (i === 0) {
    setObjective(S, 'Pick up Eddie at the Portside Cafe', PLACES.cafe.x, PLACES.cafe.y, 'Eddie');
  } else if (i === 1) {
    setObjective(S, 'Pick up the package at the warehouse', 600, 450, 'Package');
    spawnPickup(S, 'ammo', 620, 470);
  } else if (i === 2) {
    setObjective(S, 'Steal the yellow Comet GT at the Marina', PLACES.marinaComet.x, PLACES.marinaComet.y, 'Comet GT');
    const v = makeVehicle('comet', PLACES.marinaComet.x, PLACES.marinaComet.y, -Math.PI / 2, 'parked');
    v.color = '#e8b73a'; v.missionCar = true;
    S.vehicles.push(v);
    S.mission.data.comet = v;
  } else if (i === 3) {
    // Eddie hands Mara the pistol before the fight.
    S.player.gun = true; S.player.ammo += 48;
    setObjective(S, 'Go to the Old Town alley — Kane\'s boys are waiting', PLACES.oldTownAmbush.x, PLACES.oldTownAmbush.y, 'Ambush');
  } else if (i === 4) {
    setObjective(S, 'Get to the Corner Store on Palm Heights', PLACES.cornerStore.x, PLACES.cornerStore.y, 'Store');
  } else if (i === 5) {
    setObjective(S, 'Kane is fleeing to Solmar Intl — cut him off at the gate', PLACES.airportGate.x, PLACES.airportGate.y, 'Airport');
  }
}

export function updateMissions(S, dt) {
  const m = S.mission;
  if (!m || S.missionIndex >= MISSIONS.length) { updateTaxi(S, dt); return; }
  const p = S.player;
  const i = S.missionIndex;

  if (i === 0) {
    if (m.step === 0 && dist(p.x, p.y, PLACES.cafe.x, PLACES.cafe.y) < 55) {
      m.step = 1;
      S.showDialog(['EDDIE SOL: There she is! Get in the car, Mara — Neon Mile, and step on it.'], () => {});
      setObjective(S, 'Drive Eddie to the Neon Mile drop', PLACES.neonDrop.x, PLACES.neonDrop.y, 'Drop-off');
    } else if (m.step === 1 && dist(p.x, p.y, PLACES.neonDrop.x, PLACES.neonDrop.y) < 70) {
      completeMission(S, 'Eddie is delivered. The Mile never sleeps.');
    }
  } else if (i === 1) {
    if (m.step === 0 && dist(p.x, p.y, 600, 450) < 55) {
      m.step = 1;
      S.raiseWanted(2, 'hot cargo spotted');
      setObjective(S, 'Deliver the package — lose the cops on the way', PLACES.neonDrop.x, PLACES.neonDrop.y, 'Drop-off');
      S.showDialog(['EDDIE SOL: Package secured. Now the cops are awake — drive like you mean it.'], () => {});
    } else if (m.step === 1 && dist(p.x, p.y, PLACES.neonDrop.x, PLACES.neonDrop.y) < 70) {
      completeMission(S, 'Package delivered. Clean work, Mara.');
    }
  } else if (i === 2) {
    const comet = m.data.comet;
    if (m.step === 0 && S.playerCar === comet) {
      m.step = 1;
      setObjective(S, 'Take the Comet GT to the Spray Shop in Old Town', PLACES.sprayShop.x, PLACES.sprayShop.y, 'Spray Shop');
      S.notify.push({ text: 'Nice ride. Now get it repainted.', t: 3, color: '#ffe14d' });
    } else if (m.step === 1 && S.playerCar === comet && dist(comet.x, comet.y, PLACES.sprayShop.x, PLACES.sprayShop.y) < 80) {
      S.wanted = 0; S.cops = [];
      comet.color = '#2b9ad9'; comet.missionCar = false;
      completeMission(S, 'Fresh paint, new plates. The Comet is yours now.');
    }
  } else if (i === 3) {
    if (m.step === 0 && dist(p.x, p.y, PLACES.oldTownAmbush.x, PLACES.oldTownAmbush.y) < 120) {
      m.step = 1;
      m.data.enemies = [
        makeEnemy(S, PLACES.oldTownAmbush.x - 60, PLACES.oldTownAmbush.y - 40, 60),
        makeEnemy(S, PLACES.oldTownAmbush.x + 50, PLACES.oldTownAmbush.y + 30, 60),
        makeEnemy(S, PLACES.oldTownAmbush.x + 10, PLACES.oldTownAmbush.y - 80, 80),
      ];
      setObjective(S, 'Deal with Kane\'s three thugs (0/3 down)', PLACES.oldTownAmbush.x, PLACES.oldTownAmbush.y, 'Fight');
      S.alarm = 2;
    } else if (m.step === 1) {
      const down = (m.data.enemies || []).filter((e) => e.dead).length;
      setObjective(S, `Deal with Kane's three thugs (${down}/3 down)`, PLACES.oldTownAmbush.x, PLACES.oldTownAmbush.y, 'Fight');
      if (down >= 3) completeMission(S, 'Old Town is quiet again. Kane will hear about this.');
    }
  } else if (i === 4) {
    if (m.step === 0 && dist(p.x, p.y, PLACES.cornerStore.x, PLACES.cornerStore.y) < 60) {
      m.step = 1; m.timer = 90;
      S.showDialog(['MARA VOSS: Ninety seconds. Hands where I can see them.'], () => {});
      setObjective(S, 'Hold up the store — stay inside 90s', PLACES.cornerStore.x, PLACES.cornerStore.y, 'Robbery');
    } else if (m.step === 1) {
      m.timer -= dt;
      setObjective(S, `Hold up the store — ${Math.max(0, Math.ceil(m.timer))}s left`, PLACES.cornerStore.x, PLACES.cornerStore.y, 'Robbery');
      if (dist(p.x, p.y, PLACES.cornerStore.x, PLACES.cornerStore.y) > 120) {
        failMission(S, 'You left the store too early.');
        return;
      }
      if (m.timer <= 0) {
        m.step = 2;
        S.raiseWanted(3, 'store robbery');
        setObjective(S, 'Escape! Lose the cops to finish the job', PLACES.sprayShop.x, PLACES.sprayShop.y, 'Escape');
        S.notify.push({ text: 'Till emptied. Now run!', t: 3, color: '#ff6b5e' });
      }
    } else if (m.step === 2 && S.wanted === 0) {
      completeMission(S, 'Clean getaway. The till was worth it.');
    }
  } else if (i === 5) {
    if (m.step === 0 && dist(p.x, p.y, PLACES.airportGate.x, PLACES.airportGate.y) < 160) {
      m.step = 1;
      const kane = makeVehicle('comet', 2100, 300, Math.PI, 'npc');
      kane.color = '#1c1c22'; kane.hp = 220; kane.maxHp = 220; kane.missionCar = true;
      kane.ai = { axis: 'h', dir: -1, cruise: 200, lane: 0 };
      S.vehicles.push(kane);
      m.data.kane = kane;
      makeEnemy(S, 2050, 380, 70);
      makeEnemy(S, 2150, 340, 70);
      setObjective(S, 'Stop Kane\'s car before it reaches the runway!', 2100, 300, 'Kane');
      S.showDialog(['KANE MARO: You think you can stop me, Voss? This city is MINE.', 'MARA VOSS: Not anymore, Tiburon.'], () => {});
    } else if (m.step === 1) {
      const kane = m.data.kane;
      if (kane) {
        // Kane's car flees east along the runway road toward the gate.
        kane.angle += clamp(angleDiff(kane.angle, 0), -1.5 * dt, 1.5 * dt);
        kane.x += Math.cos(kane.angle) * 240 * dt;
        kane.y += Math.sin(kane.angle) * 240 * dt;
        if (kane.hp <= 0 || kane.exploded) {
          completeMission(S, 'Kane\'s car is wrecked on the tarmac. Solmar Bay is yours, Mara.');
        } else if (kane.x > 2320) {
          failMission(S, 'Kane reached his plane and flew away.');
        }
      }
    }
  }
  updateTaxi(S, dt);
}

// ------------------------------------------------------------------- taxi
// Side work: after mission 2, fares pop up near the player. Drive a fare's
// passenger to their destination for cash. Only while driving a taxi or any
// car with room — keep it simple: any player car works.
function updateTaxi(S, dt) {
  if (S.missionIndex < 2) return;
  const t = S.taxi;
  if (!t.active) {
    t.cooldown -= dt;
    if (t.cooldown <= 0 && S.playerCar) {
      const a = Math.random() * Math.PI * 2;
      t.pickup = { x: S.player.x + Math.cos(a) * 260, y: S.player.y + Math.sin(a) * 260 };
      t.pickup.x = Math.max(80, Math.min(2320, t.pickup.x));
      t.pickup.y = Math.max(80, Math.min(2320, t.pickup.y));
      t.active = true; t.state = 'pickup'; t.fare = 40 + Math.floor(Math.random() * 60);
      S.notify.push({ text: `Taxi fare nearby — pick up the passenger ($${t.fare})`, t: 4, color: '#ffe14d' });
    }
    return;
  }
  if (t.state === 'pickup' && S.playerCar && dist(S.playerCar.x, S.playerCar.y, t.pickup.x, t.pickup.y) < 50) {
    t.state = 'dropoff';
    const a = Math.random() * Math.PI * 2;
    t.drop = { x: Math.max(80, Math.min(2320, S.player.x + Math.cos(a) * 420)), y: Math.max(80, Math.min(2320, S.player.y + Math.sin(a) * 420)) };
    S.notify.push({ text: 'Passenger aboard — drive to the destination', t: 3, color: '#ffe14d' });
  } else if (t.state === 'dropoff' && S.playerCar && dist(S.playerCar.x, S.playerCar.y, t.drop.x, t.drop.y) < 55) {
    S.money += t.fare;
    S.audio.cash();
    S.notify.push({ text: `Fare complete: +$${t.fare}`, t: 3, color: '#7dff8a' });
    t.active = false; t.cooldown = 35 + Math.random() * 25;
  }
  if (t.active && !S.playerCar) { t.active = false; t.cooldown = 20; }
}

export function completeMission(S, line) {
  const reward = MISSION_REWARDS[S.missionIndex] || 100;
  S.money += reward;
  S.stats.xp += 100;
  S.audio.missionDone();
  S.audio.cash();
  S.saveGame();
  const title = S.mission ? S.mission.title : '';
  S.showDialog([`MISSION COMPLETE: ${title}`, line, `Reward: $${reward}. ${S.missionIndex + 1 < MISSIONS.length ? 'Next job is marked on the map.' : 'That is the whole story — Solmar Bay is yours.'}`], () => {
    S.missionIndex += 1;
    if (S.missionIndex < MISSIONS.length) startMission(S, S.missionIndex);
    else { S.mission = null; S.notify.push({ text: 'STORY COMPLETE — free roam!', t: 5, color: '#ffe14d' }); }
  });
}

export function failMission(S, reason) {
  S.audio.fail();
  S.showDialog([`MISSION FAILED: ${reason}`, 'Eddie will pretend he never saw that. Try again.'], () => {
    startMission(S, S.missionIndex);
  });
}
