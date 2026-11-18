# gta6-vice-rush

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Jaw1jennaira/gta6-vice-rush/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Jaw1jennaira/gta6-vice-rush/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**VICE RUSH** is a top-down 2D open-world crime game set in the sun-soaked fictional city of Solmar Bay. Play as Mara Voss: steal cars, outrun the Solmar PD through five wanted levels, fight Kane Maro's crew, and run six story missions — from a quiet pickup at the Portside Cafe to a final chase at Solmar Intl airport. Traffic, pedestrians, a day/night cycle with rain, procedural radio stations, and a minimap included. Everything (city, characters, vehicles, story, art, music) is original and made for this bounty — no assets from any commercial game.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 — no build step, no network, just static files under `game/`.

## Controls

- **WASD / Arrows** — walk & drive · **Shift** run · **Space** handbrake
- **Mouse + Click** — aim & shoot (pistol from mission 2) · **F** punch
- **E** — steal / enter / exit a car · **H** horn · **R** change radio · **M** mute · **Esc** pause · **Enter** advance dialog

## What's inside

- `game/index.html` — page, canvas, HUD
- `game/src/` — one module per system: `config`, `world` (procedural city), `player`, `vehicles` (driving, traffic AI, stealing), `pedestrians`, `police` (wanted level), `combat`, `missions` (6 story jobs + taxi fares), `hud` (HUD + minimap), `render`, `audio` (synth SFX + procedural radio), `save`, `input`, `shots`, `main`
- `screenshots/` — 4 real renders of the game (chase cover, Neon Mile street, mission combat, title screen)
- `main.ts` — the make.fun entry program (copies `game/` + `screenshots/` to `/output`, writes `dossier.json`)

---

<sub>Entered on [make.fun](https://make.fun/?ref=e870440b&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
