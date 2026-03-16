#!/usr/bin/env node
/**
 * Gera icon.png e adaptive-icon.png a partir da logo em alta resolução.
 * Garante que a logo inteira (ícone + texto) fique visível e nítida.
 * Uso: node scripts/generate-app-icons.js
 */
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SIZE = 1024;
const BG = { r: 14, g: 165, b: 233 }; // #0EA5E9
/** Zona segura Android: logo deve caber em 66% central para não ser cortada no squircle. */
const SAFE_ZONE_RATIO = 66 / 108;

const assetsDir = path.join(__dirname, '..', 'assets');
const sourcePath = path.join(assetsDir, 'logo-source.png');

async function generateIcons() {
  if (!fs.existsSync(sourcePath)) {
    console.error('Erro: logo-source.png não encontrado em assets/');
    console.error('Coloque a logo em alta resolução em frontend-mobile/assets/logo-source.png');
    process.exit(1);
  }

  const meta = await sharp(sourcePath).metadata();
  console.log(`  Fonte: ${meta.width}x${meta.height}`);
  if (meta.width < 1024 || meta.height < 1024) {
    console.warn('\n  ⚠️  AVISO: Logo com menos de 1024px pode ficar pixelada no celular.');
    console.warn('  Para melhor qualidade, exporte a logo em 1024x1024 ou maior do Figma/design.');
  }

  // icon.png: logo ocupa ~85% do quadrado, centralizada, fundo azul
  const iconScale = Math.min((SIZE * 0.85) / meta.width, (SIZE * 0.85) / meta.height);
  const iconW = Math.round(meta.width * iconScale);
  const iconH = Math.round(meta.height * iconScale);
  const iconTop = Math.floor((SIZE - iconH) / 2);
  const iconLeft = Math.floor((SIZE - iconW) / 2);

  await sharp(sourcePath)
    .resize(iconW, iconH, { fit: 'contain', background: BG })
    .extend({
      top: iconTop,
      bottom: SIZE - iconH - iconTop,
      left: iconLeft,
      right: SIZE - iconW - iconLeft,
      background: BG,
    })
    .png({ quality: 100 })
    .toFile(path.join(assetsDir, 'icon.png'));
  console.log('  icon.png → 1024x1024');

  // adaptive-icon.png: logo na zona segura (66%) para Android não cortar
  const safeSize = Math.floor(SIZE * SAFE_ZONE_RATIO);
  const adaptiveScale = Math.min(safeSize / meta.width, safeSize / meta.height);
  const adaptiveW = Math.round(meta.width * adaptiveScale);
  const adaptiveH = Math.round(meta.height * adaptiveScale);
  const adaptiveTop = Math.floor((SIZE - adaptiveH) / 2);
  const adaptiveLeft = Math.floor((SIZE - adaptiveW) / 2);

  await sharp(sourcePath)
    .resize(adaptiveW, adaptiveH, { fit: 'contain', background: BG })
    .extend({
      top: adaptiveTop,
      bottom: SIZE - adaptiveH - adaptiveTop,
      left: adaptiveLeft,
      right: SIZE - adaptiveW - adaptiveLeft,
      background: BG,
    })
    .png({ quality: 100 })
    .toFile(path.join(assetsDir, 'adaptive-icon.png'));
  console.log('  adaptive-icon.png → 1024x1024 (zona segura)');

  console.log('\nÍcones gerados. Execute "npx expo prebuild --clean" e rebuild para aplicar.');
}

generateIcons().catch((e) => {
  console.error(e);
  process.exit(1);
});
