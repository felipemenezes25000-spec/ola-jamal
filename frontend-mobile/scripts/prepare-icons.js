#!/usr/bin/env node
/**
 * Redimensiona ícones para dimensões quadradas exigidas pelo Expo.
 * Uso: node scripts/prepare-icons.js
 */
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SIZE = 1024;
const BG = { r: 14, g: 165, b: 233 }; // #0EA5E9

const assetsDir = path.join(__dirname, '..', 'assets');
const files = ['icon.png', 'adaptive-icon.png'];

async function makeSquare(inputPath) {
  const meta = await sharp(inputPath).metadata();
  if (meta.width === meta.height && meta.width === SIZE) return;
  const scale = Math.min(SIZE / meta.width, SIZE / meta.height);
  const w = Math.round(meta.width * scale);
  const h = Math.round(meta.height * scale);
  const top = Math.floor((SIZE - h) / 2);
  const left = Math.floor((SIZE - w) / 2);
  const tempPath = inputPath + '.tmp';
  await sharp(inputPath)
    .resize(w, h)
    .extend({
      top,
      bottom: SIZE - h - top,
      left,
      right: SIZE - w - left,
      background: BG,
    })
    .toFile(tempPath);
  fs.renameSync(tempPath, inputPath);
  console.log(`  ${path.basename(inputPath)} → ${SIZE}x${SIZE}`);
}

async function main() {
  for (const file of files) {
    const p = path.join(assetsDir, file);
    if (!fs.existsSync(p)) {
      console.warn(`  ${file} não encontrado, pulando`);
      continue;
    }
    await makeSquare(p);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
