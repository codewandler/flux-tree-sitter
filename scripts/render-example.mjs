#!/usr/bin/env node
// Render a .flux file to a syntax-highlighted SVG, coloured by THIS repo's own
// grammar + queries/highlights.scm (via `tree-sitter query`). Used to embed a
// highlighted example in the README, since GitHub can't highlight .flux natively.
//
//   node scripts/render-example.mjs examples/readme-example.flux assets/example.svg "route-call.flux"

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const [, , srcPath, outPath = "assets/example.svg", title = ""] = process.argv;
if (!srcPath) {
  console.error("usage: render-example.mjs <src.flux> [out.svg] [title]");
  process.exit(1);
}

// One Dark-ish theme. Keys are highlight capture names; lookup falls back to
// progressively shorter dotted prefixes (keyword.control.repeat -> keyword).
const BG = "#282c34";
const FG = "#abb2bf";
const DOTS = ["#e06c75", "#e5c07b", "#98c379"];
const THEME = {
  comment: "#7f848e",
  keyword: "#c678dd",
  function: "#61afef",
  "function.builtin": "#56b6c2",
  variable: "#e06c75",
  "variable.parameter": "#d19a66",
  "variable.other.member": "#e06c75",
  property: "#e06c75",
  type: "#e5c07b",
  namespace: "#e5c07b",
  constant: "#d19a66",
  "constant.numeric": "#d19a66",
  string: "#98c379",
  operator: "#56b6c2",
  attribute: "#56b6c2",
  "punctuation.special": "#56b6c2",
  "punctuation.bracket": "#abb2bf",
  "punctuation.delimiter": "#828997",
};

function colorFor(name) {
  const parts = name.split(".");
  for (let i = parts.length; i > 0; i--) {
    const key = parts.slice(0, i).join(".");
    if (THEME[key]) return THEME[key];
  }
  return FG;
}

// Ask the grammar what each token is.
const out = execFileSync(
  "npx",
  ["--no-install", "tree-sitter", "query", "queries/highlights.scm", srcPath],
  { encoding: "utf8" }
);

const captures = [];
let pattern = 0;
for (const line of out.split("\n")) {
  const p = line.match(/pattern:\s*(\d+)/);
  if (p) { pattern = Number(p[1]); continue; }
  const m = line.match(
    /capture:\s*\d+\s*-\s*([\w.]+),\s*start:\s*\((\d+),\s*(\d+)\),\s*end:\s*\((\d+),\s*(\d+)\)/
  );
  if (!m) continue;
  const [, name, sr, sc, er, ec] = m;
  if (sr !== er) continue; // single-line captures only (this example has no multi-line tokens)
  captures.push({ row: +sr, start: +sc, end: +ec, name, pattern: +pattern });
}
// later query patterns win -> apply lowest pattern first so higher ones overwrite
captures.sort((a, b) => a.pattern - b.pattern);

const src = readFileSync(srcPath, "utf8").replace(/\n$/, "");
const lines = src.split("\n");
const colors = lines.map((l) => new Array(l.length).fill(null));
for (const c of captures) {
  const rowColors = colors[c.row];
  if (!rowColors) continue;
  const col = colorFor(c.name);
  for (let i = c.start; i < c.end && i < rowColors.length; i++) rowColors[i] = col;
}

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function lineToTspans(text, rowColors) {
  const spans = [];
  let i = 0;
  while (i < text.length) {
    const col = rowColors[i] ?? FG;
    let j = i;
    while (j < text.length && (rowColors[j] ?? FG) === col) j++;
    spans.push(`<tspan fill="${col}">${esc(text.slice(i, j))}</tspan>`);
    i = j;
  }
  return spans.join("");
}

// Layout
const FS = 15;
const CH = 9.4; // monospace advance estimate at 15px, slightly padded so no viewer font clips
                // the longest line (canvas sizing only — tspans flow at the font's real advance)
const LH = 22;
const PAD = 22;
const HEADER = 44;
const BOTTOM = 18;
const maxCols = Math.max(1, ...lines.map((l) => l.length));
const W = Math.ceil(PAD * 2 + maxCols * CH);
const H = HEADER + lines.length * LH + BOTTOM;
const FONT =
  "ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, Consolas, 'Liberation Mono', monospace";

const body = lines
  .map((l, i) => {
    const y = HEADER + 16 + i * LH;
    return `  <text x="${PAD}" y="${y}" xml:space="preserve">${lineToTspans(l, colors[i])}</text>`;
  })
  .join("\n");

const dots = DOTS.map((c, i) => `<circle cx="${20 + i * 20}" cy="${HEADER / 2}" r="6" fill="${c}"/>`).join(
  ""
);
const titleEl = title
  ? `<text x="${W / 2}" y="${HEADER / 2 + 4}" text-anchor="middle" fill="#5c6370" font-size="12" font-family="${FONT}">${esc(title)}</text>`
  : "";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}" font-size="${FS}">
  <rect width="${W}" height="${H}" rx="10" fill="${BG}"/>
  ${dots}
  ${titleEl}
${body}
</svg>
`;

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, svg);
console.log(`wrote ${outPath} (${W}x${H}, ${lines.length} lines, ${captures.length} captures)`);
