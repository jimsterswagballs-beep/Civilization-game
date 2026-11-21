import * as esbuild from 'esbuild';
import fs from 'fs';

const result = await esbuild.build({
  entryPoints: ['main.js'],
  bundle: true,
  minify: true,
  format: 'iife',
  platform: 'browser',
  loader: { '.png': 'dataurl', '.mp3': 'dataurl', '.mp4': 'dataurl' },
  write: false,
  target: 'es2020',
  logLevel: 'warning'
});
const js = result.outputFiles[0].text.replace(/<\/script>/g, '<\\/script>');
const css = fs.readFileSync('style.css', 'utf8');
let html = fs.readFileSync('template.html', 'utf8');
html = html.replace('/*CSS*/', () => css).replace('/*JS*/', () => js);
fs.writeFileSync('index.html', html);
console.log('Built index.html (' + (html.length / 1024 / 1024).toFixed(2) + ' MB)');
