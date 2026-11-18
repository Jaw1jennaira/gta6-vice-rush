// Save / load: one localStorage slot plus an autosave after every mission.
// The save is small JSON: money, mission progress, player state, clock.

const KEY = 'vice-rush-save-v1';

export function saveGameData(S) {
  try {
    const data = {
      money: S.money,
      xp: S.stats.xp,
      missionIndex: S.missionIndex,
      clock: S.clock,
      player: {
        x: S.player.x, y: S.player.y, hp: S.player.hp, armor: S.player.armor,
        gun: S.player.gun, ammo: S.player.ammo,
      },
      stats: S.stats,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGameData() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return data;
  } catch {
    return null;
  }
}

export function hasSave() {
  return loadGameData() !== null;
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

// Apply a loaded save onto a fresh state object. Missions restart from the
// saved mission's beginning — progress inside a mission is not stored.
export function applySave(S, data) {
  S.money = data.money || 0;
  S.stats.xp = data.xp || 0;
  S.missionIndex = data.missionIndex || 0;
  S.clock = data.clock || 8 * 3600;
  if (data.player) {
    S.player.x = data.player.x || 450;
    S.player.y = data.player.y || 750;
    S.player.hp = data.player.hp || 100;
    S.player.armor = data.player.armor || 0;
    S.player.gun = !!data.player.gun;
    S.player.ammo = data.player.ammo || 0;
  }
  if (data.stats) S.stats = { ...S.stats, ...data.stats };
}
