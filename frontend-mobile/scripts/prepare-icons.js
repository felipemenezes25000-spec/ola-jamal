#!/usr/bin/env node
/**
 * Redimensiona ícones para dimensões quadradas exigidas pelo Expo.
 * O adaptive-icon usa zona segura Android (66/108 ≈ 61%) para evitar corte em squircle.
 * Uso: node scripts/prepare-icons.js
 */
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SIZE = 1024;
const BG = { r: 14, g: 165, b: 233 }; // #0EA5E9
/** Zona segura Android: 66dp em 108dp — conteúdo deve caber aqui para não ser cortado. */
const SAFE_ZONE_RATIO = 66 / 108;

const assetsDir = path.join(__dirname, '..', 'assets');
const files = ['icon.png', 'adaptive-icon.png'];

async function makeSquare(inputPath, isAdaptiveIcon = false) {
  const meta = await sharp(inputPath).metadata();
  const targetSize = SIZE;
  let scale = Math.min(targetSize / meta.width, targetSize / meta.height);

  if (isAdaptiveIcon) {
    scale *= SAFE_ZONE_RATIO;
  } else if (meta.width === meta.height && meta.width === targetSize) {
    return;
  }

  const w = Math.round(meta.width * scale);
  const h = Math.round(meta.height * scale);
  const top = Math.floor((targetSize - h) / 2);
  const left = Math.floor((targetSize - w) / 2);
  const tempPath = inputPath + '.tmp';
  await sharp(inputPath)
    .resize(w, h)
    .extend({
      top,
      bottom: targetSize - h - top,
      left,
      right: targetSize - w - left,
      background: BG,
    })
    .toFile(tempPath);
  fs.renameSync(tempPath, inputPath);
  console.log(`  ${path.basename(inputPath)} → ${targetSize}x${targetSize}${isAdaptiveIcon ? ' (safe zone)' : ''}`);
}

async function main() {
  for (const file of files) {
    const p = path.join(assetsDir, file);
    if (!fs.existsSync(p)) {
      console.warn(`  ${file} não encontrado, pulando`);
      continue;
    }
    await makeSquare(p, file === 'adaptive-icon.png');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
