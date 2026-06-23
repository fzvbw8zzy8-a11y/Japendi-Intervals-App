// Copy the static web app into www/ so Capacitor can bundle it into the iOS app.
// Keeps the repo root as the source of truth (also served by GitHub Pages).
import { cpSync, rmSync, mkdirSync } from 'node:fs';

const out = 'www';
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const files = ['index.html', 'manifest.webmanifest', 'sw.js'];
const dirs = ['css', 'js', 'icons'];

for (const f of files) cpSync(f, `${out}/${f}`);
for (const d of dirs) cpSync(d, `${out}/${d}`, { recursive: true });

console.log(`Copied web assets → ${out}/`);
