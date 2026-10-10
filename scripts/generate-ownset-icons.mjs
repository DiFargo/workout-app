// Render all install icons from the approved, editable 05B vector master.
import { readFile, writeFile, mkdir, readdir, copyFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const source = await readFile('public/brand/ownset.svg', 'utf8');
const defs = source.match(/<defs>[\s\S]*?<\/defs>/)[0];
const symbol = source.match(/<g[\s\S]*<\/g>/)[0];
const svg = (background, scale = 1, round = false) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 444 444">${defs}<${round ? 'circle cx="222" cy="222" r="222"' : 'rect width="444" height="444"'} fill="${background}"/><g transform="translate(${222 * (1 - scale)} ${222 * (1 - scale)}) scale(${scale})">${symbol}</g></svg>`;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ deviceScaleFactor: 1 });
async function render(path, width, height, artwork, backdrop = 'transparent', iconSize = width) {
  await page.setViewportSize({ width, height });
  await page.setContent(`<html><body style="margin:0;width:100vw;height:100vh;display:grid;place-items:center;background:${backdrop}"><div style="width:${iconSize}px;height:${iconSize}px">${artwork.replace('<svg ', '<svg width="100%" height="100%" ')}</div></body></html>`);
  await page.screenshot({ path, omitBackground: backdrop === 'transparent' });
}
try {
  await mkdir('public/icons', { recursive: true });
  for (const size of [180, 192, 512]) await render(`public/icons/ownset-${size}.png`, size, size, svg('url(#ownset-gradient)'));
  await render('public/icons/ownset-maskable-512.png', 512, 512, svg('url(#ownset-gradient)', 0.76));
  await copyFile('public/brand/ownset.svg', 'public/favicon.svg');
  for (const size of [192, 512]) await copyFile(`public/icons/ownset-${size}.png`, `public/icons/icon-${size}.png`);
  const root = 'android/app/src/main/res';
  for (const [density, size, foreground] of [['mdpi',48,108],['hdpi',72,162],['xhdpi',96,216],['xxhdpi',144,324],['xxxhdpi',192,432]]) {
    const folder = `${root}/mipmap-${density}`;
    await render(`${folder}/ic_launcher.png`, size, size, source);
    await render(`${folder}/ic_launcher_round.png`, size, size, svg('url(#ownset-gradient)', 0.9, true));
    await render(`${folder}/ic_launcher_foreground.png`, foreground, foreground, svg('none', 0.64));
  }
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith('drawable')) continue;
    const path = `${root}/${entry.name}/splash.png`;
    let buffer;
    try { buffer = await readFile(path); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    const width = buffer.readUInt32BE(16), height = buffer.readUInt32BE(20);
    const scale = Math.min(width, height) / 360;
    await render(path, width, height, source, '#F5F7F8', Math.round(100 * scale));
  }
  const paths = [...symbol.matchAll(/<path d="([^"]+)"/g)].map((match) => `<path android:fillColor="#FFFFFF" android:pathData="${match[1]}"/>`).join('\n');
  await writeFile(`${root}/drawable-v24/ic_launcher_foreground.xml`, `<?xml version="1.0" encoding="utf-8"?>\n<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="444" android:viewportHeight="444"><group android:pivotX="222" android:pivotY="222" android:scaleX="0.64" android:scaleY="0.64"><group android:translateX="-137" android:translateY="-95">${paths}</group></group></vector>\n`);
  await writeFile(`${root}/drawable/ic_launcher_background.xml`, '<?xml version="1.0" encoding="utf-8"?>\n<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle"><gradient android:angle="0" android:startColor="#467B72" android:centerColor="#3E748B" android:endColor="#3565A3" android:type="linear"/></shape>\n');
  console.log('OwnSet: web, Apple, Android launcher and splash assets generated.');
} finally { await browser.close(); }
