const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const bmp = require('bmp-js');
const { default: pngToIco } = require('png-to-ico');

const root = path.join(__dirname, '..');
const outDir = path.join(root, 'build');

function rgbaToAbgr(rgba) {
  const out = Buffer.alloc(rgba.length);
  for (let i = 0; i < rgba.length; i += 4) {
    out[i] = rgba[i + 3];
    out[i + 1] = rgba[i + 2];
    out[i + 2] = rgba[i + 1];
    out[i + 3] = rgba[i];
  }
  return out;
}

async function toRgba(pipeline) {
  const { data, info } = await pipeline.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

function writeBmp(file, { data, width, height }) {
  const encoded = bmp.encode({ data: rgbaToAbgr(data), width, height });
  fs.writeFileSync(file, encoded.data);
  console.log(`wrote ${path.relative(root, file)} (${width}x${height})`);
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });

  const frame = path.join(root, 'Icons', 'NSIS_Frame.svg');
  const logo = path.join(root, 'Icons', 'logo_exact.svg');

  const sidebar = await toRgba(
    sharp(frame, { density: 300 })
      .resize(164, 314, { fit: 'cover', position: 'centre' })
      .flatten({ background: '#101018' })
  );
  writeBmp(path.join(outDir, 'installerSidebar.bmp'), sidebar);
  fs.copyFileSync(
    path.join(outDir, 'installerSidebar.bmp'),
    path.join(outDir, 'uninstallerSidebar.bmp')
  );
  console.log('wrote build/uninstallerSidebar.bmp (copy)');

  const logoPng = await sharp(logo, { density: 300 })
    .resize(41, 41, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const headerPng = await sharp({
    create: { width: 150, height: 57, channels: 4, background: '#ffffff' }
  })
    .composite([{ input: logoPng, left: 101, top: 8 }])
    .png()
    .toBuffer();
  writeBmp(path.join(outDir, 'installerHeader.bmp'), await toRgba(sharp(headerPng)));

  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const iconPngs = await Promise.all(
    sizes.map((size) =>
      sharp(logo, { density: 300 })
        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer()
    )
  );
  fs.writeFileSync(path.join(outDir, 'icon.ico'), await pngToIco(iconPngs));
  console.log(`wrote build/icon.ico (${sizes.join(',')})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
