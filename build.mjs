import { build } from 'esbuild';
import fs from 'node:fs';

// Hersteller-Logos: alle Bilder in public/logos/ stehen in den Einstellungen zur Auswahl.
const logos = fs.existsSync('public/logos')
  ? fs.readdirSync('public/logos').filter((f) => /^[a-z0-9][a-z0-9._-]*\.(png|svg|webp|jpg)$/.test(f)).sort()
  : [];

await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'esm',
  minify: true,
  target: 'es2020',
  outfile: 'public/app.js',
  define: { LOGOS: JSON.stringify(logos) },
  logLevel: 'info',
});
