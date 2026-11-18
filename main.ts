// VICE RUSH — make.fun entry program for the gta6-01 bounty (Node 22,
// standard library only). The game itself is plain static files under
// game/ (index.html + ES modules, no libraries, no network requests), and
// the screenshots live in screenshots/. This program hands the entry in: it
// copies both folders into the output directory and writes dossier.json,
// the summary the judge reads, using the vendored make.fun library.
//
// Play it locally first with `node serve.ts`, then open http://localhost:8080.
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// The program is deterministic: run it twice and the bytes are identical.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// The caps mirror the scorer's gate: at most 4 screenshots of 256 KiB, at
// most 993 files / 48 MiB under game/, paths under 1000 bytes, and the
// dossier text capped at 160 KiB. An entry over a cap is refused here
// instead of at the gate, so a bad build fails loudly and locally.
writeFileSync(
  join(outputDir, 'dossier.json'),
  buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
