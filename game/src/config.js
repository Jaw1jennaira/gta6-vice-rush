// VICE RUSH — configuration, world constants, vehicle and mission data.
// Solmar Bay is a wholly original fictional city. Nothing here comes from
// any commercial game: all names, places, people and vehicles are invented.

export const WORLD = 2400;            // city is WORLD x WORLD pixels
export const ROAD_W = 84;             // road width (asphalt)
export const ROAD_HALF = ROAD_W / 2;
export const BLOCK = 300;             // distance between road centrelines
export const ROAD_LINES = [150, 450, 750, 1050, 1350, 1650, 1950, 2250];

// ------------------------------------------------------------- utilities
export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
export function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }
export function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
export function circleHitsRect(cx, cy, r, rect) {
  const nx = clamp(cx, rect.x, rect.x + rect.w);
  const ny = clamp(cy, rect.y, rect.y + rect.h);
  return (cx - nx) * (cx - nx) + (cy - ny) * (cy - ny) < r * r;
}
// Deterministic PRNG so the city (and the screenshots) are reproducible.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

// ------------------------------------------------------------- districts
// name, rect, ground tint, building palette, flavour
export const DISTRICTS = [
  { name: 'Portside', x: 0, y: 0, w: 600, h: 900, ground: '#7d8a6a', roofs: ['#8a6f5c', '#6b7f8e', '#a08a6a'] },
  { name: 'Solmar Intl', x: 1800, y: 0, w: 600, h: 480, ground: '#5f6a72', roofs: ['#7d8891', '#5a6a74'] },
  { name: 'Palm Heights', x: 1500, y: 480, w: 900, h: 1020, ground: '#8a9a6b', roofs: ['#c9a86a', '#b98a7a', '#d8c49a'] },
  { name: 'Old Town', x: 0, y: 900, w: 900, h: 900, ground: '#8f8a70', roofs: ['#a4553f', '#96502f', '#7a5a44'] },
  { name: 'Neon Mile', x: 900, y: 900, w: 900, h: 900, ground: '#6b6f7d', roofs: ['#3d4a6b', '#5a3d6b', '#2f4a5a'] },
  { name: 'The Docks', x: 0, y: 1800, w: 900, h: 600, ground: '#6e7d72', roofs: ['#5c6a5e', '#74604e'] },
  { name: 'Marina Beach', x: 900, y: 1800, w: 1500, h: 600, ground: '#d9c08a', roofs: ['#e8d9a8', '#c9b183'] },
];
export function districtAt(x, y) {
  for (const d of DISTRICTS) if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d;
  return DISTRICTS[0];
}

// ------------------------------------------------------------- vehicles
export const VEHICLES = {
  vulture: { name: 'Vulture', kind: 'sedan', top: 330, accel: 210, turn: 2.6, hp: 100, colors: ['#b03a3a', '#3a6db0', '#c9c9c9', '#3f4a55'] },
  comet:   { name: 'Comet GT', kind: 'sport', top: 460, accel: 300, turn: 3.1, hp: 80, colors: ['#e8b73a', '#d94f2b', '#27a3a3', '#e8e8e8'] },
  bison:   { name: 'Bison', kind: 'pickup', top: 280, accel: 180, turn: 2.2, hp: 150, colors: ['#5a6e3f', '#7a4a2b', '#4a5a6e'] },
  lobo:    { name: 'Lobo', kind: 'van', top: 250, accel: 150, turn: 2.0, hp: 140, colors: ['#d9d9d9', '#8a8a8a', '#4a7a5a'] },
  sunset:  { name: 'Sunset Taxi', kind: 'taxi', top: 320, accel: 200, turn: 2.6, hp: 100, colors: ['#f2c230'] },
  rustler: { name: 'Rustler', kind: 'sedan', top: 270, accel: 170, turn: 2.4, hp: 90, colors: ['#7a5a3f', '#5a6a4a', '#8a2f2f'] },
  wave:    { name: 'Wave', kind: 'sport', top: 400, accel: 260, turn: 3.0, hp: 75, colors: ['#2b9ad9', '#e85aa0', '#f2f2f2'] },
  patrol:  { name: 'Patrol Interceptor', kind: 'police', top: 430, accel: 290, turn: 3.0, hp: 120, colors: ['#20242c'] },
};
export const VEHICLE_KEYS = Object.keys(VEHICLES);

// ------------------------------------------------------------- people
export const PLAYER = {
  name: 'Mara Voss', walkSpeed: 150, runSpeed: 235, radius: 13,
  maxHp: 100, maxArmor: 100, punchDmg: 12, pistolDmg: 26,
};
export const PED_NAMES = ['Rosa', 'Dario', 'Ines', 'Tomas', 'Lena', 'Marco', 'Pilar', 'Hugo', 'Nadia', 'Felix', 'Carmen', 'Otto'];

// ------------------------------------------------------------- economy
export const PRICES = { spray: 100, gun: 0, healthPack: 0, taxiFareBase: 40 };
export const MISSION_REWARDS = [200, 350, 500, 650, 900, 1500];

// ------------------------------------------------------------- missions
// Each mission: id, title, briefing lines, reward. The step logic lives in
// missions.js; this table is the story bible the HUD and save file share.
export const MISSIONS = [
  {
    id: 1, title: 'First Pickup',
    brief: [
      'EDDIE SOL: Mara! You made it. Solmar Bay eats the slow, kid.',
      'EDDIE SOL: I am at the Portside cafe. Come get me, and do not be late.',
      'MARA VOSS: On my way, Eddie. Try not to start any trouble before I arrive.',
    ],
  },
  {
    id: 2, title: 'The Package',
    brief: [
      'EDDIE SOL: Got a package for a friend on the Neon Mile. Hot cargo.',
      'EDDIE SOL: Cops are jumpy tonight. Keep it smooth, no sirens behind us.',
      'MARA VOSS: Smooth is my middle name. Mostly.',
    ],
  },
  {
    id: 3, title: 'Borrowed Comet',
    brief: [
      'EDDIE SOL: A Comet GT is parked near the Marina. Yellow. Hard to miss.',
      'EDDIE SOL: "Borrow" it. Bring it to the Spray Shop on Old Town and we repaint it.',
      'MARA VOSS: Borrow. Right. I will return it in spirit.',
    ],
  },
  {
    id: 4, title: 'Payback',
    brief: [
      'EDDIE SOL: Kane Maro\'s boys jumped my courier in Old Town. Three of them.',
      'EDDIE SOL: Go remind them who runs this side of the bay. Bring the pistol.',
      'MARA VOSS: Tell the courier I said thanks for the warning.',
    ],
  },
  {
    id: 5, title: 'Quick Cash',
    brief: [
      'EDDIE SOL: The corner store on Palm Heights keeps its till full on Fridays.',
      'EDDIE SOL: Ninety seconds, in and out. Then lose the cops. You know the drill.',
      'MARA VOSS: Ninety seconds. I can do ninety seconds.',
    ],
  },
  {
    id: 6, title: 'The Last Run',
    brief: [
      'EDDIE SOL: Kane is running. His convoy is heading for Solmar Intl airport.',
      'EDDIE SOL: Stop his car before the plane leaves. This ends tonight, Mara.',
      'MARA VOSS: Then tonight it ends. Buckle up, Eddie.',
    ],
  },
];

// Landmarks the world and missions both reference (single source of truth).
export const PLACES = {
  cafe: { x: 300, y: 320, label: 'Portside Cafe' },
  eddieHouse: { x: 300, y: 320, label: 'Eddie\'s Cafe' },
  neonDrop: { x: 1350, y: 1350, label: 'Neon Mile Drop' },
  marinaComet: { x: 1650, y: 2050, label: 'Marina Parking' },
  sprayShop: { x: 1050, y: 1650, label: 'Spray Shop' },
  oldTownAmbush: { x: 600, y: 1200, label: 'Old Town Alley' },
  cornerStore: { x: 1800, y: 1050, label: 'Corner Store' },
  airportGate: { x: 2050, y: 420, label: 'Solmar Intl Gate' },
  hospital: { x: 600, y: 600, label: 'Bay General Hospital' },
  policeHQ: { x: 1800, y: 1500, label: 'Solmar PD HQ' },
  start: { x: 450, y: 750, label: 'Mara\'s Apartment' },
};
