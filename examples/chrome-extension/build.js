import * as esbuild from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';

const watch = process.argv.includes('--watch');

const config = {
  entryPoints: [
    'src/background.ts',
    'src/content.ts',
    'src/popup.ts',
  ],
  bundle: true,
  outdir: 'dist',
  format: 'esm',
  platform: 'browser',
  target: 'chrome120',
  sourcemap: true,
};

// Copy static files to dist
function copyStaticFiles() {
  const filesToCopy = ['manifest.json', 'popup.html'];

  if (!fs.existsSync('dist')) {
    fs.mkdirSync('dist', { recursive: true });
  }

  for (const file of filesToCopy) {
    fs.copyFileSync(file, path.join('dist', file));
  }
}

if (watch) {
  const ctx = await esbuild.context(config);
  await ctx.watch();
  copyStaticFiles();
  console.log('Watching for changes...');
} else {
  await esbuild.build(config);
  copyStaticFiles();
  console.log('Build complete');
}
