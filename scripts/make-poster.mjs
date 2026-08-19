/**
 * Generates a printable A4 poster with the join QR code.
 *
 *   PUBLIC_URL=https://pizza.example.com npm run poster
 *
 * Writes public/poster/index.html (also served at /poster/ once deployed) and
 * public/poster/join-qr.png for slide decks and table tents.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import QRCode from "qrcode";

const url = process.env.PUBLIC_URL || process.argv[2];
if (!url) {
  console.error("Set PUBLIC_URL (or pass the URL as an argument):");
  console.error("  PUBLIC_URL=https://pizza.example.com npm run poster");
  process.exit(1);
}

const outDir = path.join(process.cwd(), "public", "poster");
await mkdir(outDir, { recursive: true });

const qrOptions = { margin: 1, width: 1200, color: { dark: "#2B1B12", light: "#FFFFFF" } };
const dataUrl = await QRCode.toDataURL(url, qrOptions);
const png = Buffer.from(dataUrl.split(",")[1], "base64");
await writeFile(path.join(outDir, "join-qr.png"), png);

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Build Your Pizza — scan to join</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0; font-family: ui-rounded, "SF Pro Rounded", system-ui, sans-serif;
    color: #2B1B12; background: #FFF6E9;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    text-align: center; gap: 18px; min-height: 100vh; padding: 24px;
  }
  h1 { font-size: 62px; margin: 0; letter-spacing: -0.03em; line-height: 1; }
  h2 { font-size: 26px; margin: 0; font-weight: 700; color: #8A7461; }
  img { width: 320px; height: 320px; border: 6px solid #E3A852; border-radius: 20px; background: #fff; padding: 12px; }
  .url { font-family: ui-monospace, Menlo, monospace; font-size: 19px; color: #C8442E; font-weight: 700; word-break: break-all; }
  ol { text-align: left; font-size: 20px; line-height: 1.5; max-width: 460px; margin: 0; padding-left: 24px; }
  .foot { font-size: 15px; color: #8A7461; }
  @media print { body { background: #fff; } }
</style>
</head>
<body>
  <h1>🍕 Build Your Pizza</h1>
  <h2>Five slices. Five new friends.</h2>
  <img src="join-qr.png" alt="QR code to join">
  <p class="url">${url}</p>
  <ol>
    <li>Scan, enter your name and table number.</li>
    <li>Fill in your five slices.</li>
    <li>Find someone new, chat for 60 seconds.</li>
    <li>Sign one slice each — 5 different people fills your pizza.</li>
  </ol>
  <p class="foot">Complete pizzas go into the dessert-pizza raffle 🎁</p>
</body>
</html>
`;

await writeFile(path.join(outDir, "index.html"), html);

console.log(`Poster written for ${url}`);
console.log(`  ${path.join(outDir, "index.html")}   (open and print, or serve at /poster/)`);
console.log(`  ${path.join(outDir, "join-qr.png")}  (drop into slides or table tents)`);
