// Run with: node scripts/generate-icons.mjs
// Generates simple PWA icons using canvas (Node.js doesn't have canvas by default)
// Instead, we create SVG icons that can be used directly

import { writeFileSync } from "fs";

const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192">
  <rect width="192" height="192" rx="24" fill="#131722"/>
  <polyline points="24,140 72,80 96,110 130,60 168,52"
    fill="none" stroke="#26a69a" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="96" y="175" text-anchor="middle" font-family="sans-serif"
    font-size="20" font-weight="bold" fill="#2962ff">IOL</text>
</svg>`;

writeFileSync("public/icon.svg", svgIcon);
console.log("Created public/icon.svg");
console.log("To create PNG icons, convert icon.svg to PNG at 192x192 and 512x512");
console.log("Or use an online converter: https://convertio.co/svg-png/");
