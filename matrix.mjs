// matrix.mjs - WLED matrix framework
//
// This file is the "engine": it talks to WLED, scrolls text on the 8x32 matrix,
// and calls modules (like hadata.mjs) to get text to show.
// Modules only need to export: { id, getText() } where getText() returns a string.

// ====== BASIC DISPLAY + WLED CONFIG ======

// Hostname or IP of your WLED matrix device
const WLED_IP = "wled-2f1f50.local";

// WLED UDP Realtime (DRGB) port (default 21324 in WLED Sync Interfaces)
const UDP_PORT = 21324;

// Physical matrix dimensions
const WIDTH = 32;
const HEIGHT = 8;
const LEDS = WIDTH * HEIGHT;

// Reusable RGB frame buffer to avoid per-frame allocations
const FRAME_RGB = new Uint8Array(LEDS * 3);

// Scroll timing: how fast the text moves (ms between column steps).
// Bigger number = slower scroll; smaller = faster.
// Try values like:
//   80  = fast
//   120 = medium
//   180 = slower
const SCROLL_INTERVAL_MS = 60;

// Default text color (for all modules).
// Very dim red: tweak r down if you want even dimmer.
const DEFAULT_COLOR = { r: 4, g: 0, b: 0 };

// =========================================

import dgram from "dgram";
import haData from "./hadata.mjs";   // HA temps + date module
import mpdData from "./mpddata.mjs";
// import lobsters from "./lobsters.mjs";
// import filedata from "./filedata.mjs";
import wttr from "./wttr.mjs";
import time from "./time.mjs";
import octoprint from "./octoprint.mjs";

// List of modules that will be shown in sequence.
//
// Each module must export:
//   {
//     id: "someName",
//     getText: async () => "STRING TO SCROLL"
//   }
//
// The main loop will:
//   module 0 → scroll once
//   module 1 → scroll once
//   ... then back to module 0
const MODULES = [
  haData,
  mpdData,
//  lobsters,
//  filedata,
  wttr,
  octoprint,
  time, 
];

// Create UDP socket for sending DRGB packets to WLED
const sock = dgram.createSocket("udp4");

// 5x7 bitmap font (monospace-ish).
// Each entry is 5 bytes, one per column, with bits as vertical pixels.
// Bit layout: LSB = top pixel (y=0), next bit = y=1, etc.
const FONT = {
  " ": [0x00,0x00,0x00,0x00,0x00],

  // Digits 0–9
  "0": [0x3E,0x51,0x49,0x45,0x3E],
  "1": [0x00,0x42,0x7F,0x40,0x00],
  "2": [0x42,0x61,0x51,0x49,0x46],
  "3": [0x21,0x41,0x45,0x4B,0x31],
  "4": [0x18,0x14,0x12,0x7F,0x10],
  "5": [0x27,0x45,0x45,0x45,0x39],
  "6": [0x3C,0x4A,0x49,0x49,0x30],
  "7": [0x01,0x71,0x09,0x05,0x03],
  "8": [0x36,0x49,0x49,0x49,0x36],
  "9": [0x06,0x49,0x49,0x29,0x1E],

  // Uppercase A–Z
  "A": [0x7E,0x11,0x11,0x11,0x7E],
  "B": [0x7F,0x49,0x49,0x49,0x36],
  "C": [0x3E,0x41,0x41,0x41,0x22],
  "D": [0x7F,0x41,0x41,0x22,0x1C],
  "E": [0x7F,0x49,0x49,0x49,0x41],
  "F": [0x7F,0x09,0x09,0x09,0x01],
  "G": [0x3E,0x41,0x49,0x49,0x7A],
  "H": [0x7F,0x08,0x08,0x08,0x7F],
  "I": [0x00,0x41,0x7F,0x41,0x00],
  "J": [0x20,0x40,0x41,0x3F,0x01],
  "K": [0x7F,0x08,0x14,0x22,0x41],
  "L": [0x7F,0x40,0x40,0x40,0x40],
  "M": [0x7F,0x02,0x0C,0x02,0x7F],
  "N": [0x7F,0x04,0x08,0x10,0x7F],
  "O": [0x3E,0x41,0x41,0x41,0x3E],
  "P": [0x7F,0x09,0x09,0x09,0x06],
  "Q": [0x3E,0x41,0x51,0x21,0x5E],
  "R": [0x7F,0x09,0x19,0x29,0x46],
  "S": [0x46,0x49,0x49,0x49,0x31],
  "T": [0x01,0x01,0x7F,0x01,0x01],
  "U": [0x3F,0x40,0x40,0x40,0x3F],
  "V": [0x1F,0x20,0x40,0x20,0x1F],
  "W": [0x3F,0x40,0x38,0x40,0x3F],
  "X": [0x63,0x14,0x08,0x14,0x63],
  "Y": [0x07,0x08,0x70,0x08,0x07],
  "Z": [0x61,0x51,0x49,0x45,0x43],

  // Basic punctuation
  "-": [0x08,0x08,0x08,0x08,0x08],
  ":": [0x00,0x36,0x36,0x00,0x00],
  ".": [0x00,0x40,0x60,0x00,0x00],
  ",": [0x00,0x40,0x20,0x00,0x00],
  "/": [0x20,0x10,0x08,0x04,0x02],

  // Extra chars (subset of ASCII)
  "!": [0x00,0x00,0x5F,0x00,0x00],
  "?": [0x02,0x01,0x51,0x09,0x06],
  "+": [0x08,0x08,0x3E,0x08,0x08],
  "=": [0x14,0x14,0x14,0x14,0x14],
  "(": [0x00,0x1C,0x22,0x41,0x00],
  ")": [0x00,0x41,0x22,0x1C,0x00],
  "[": [0x00,0x7F,0x41,0x41,0x00],
  "]": [0x00,0x41,0x41,0x7F,0x00],
  "_": [0x40,0x40,0x40,0x40,0x40],
  "@": [0x3E,0x41,0x5D,0x55,0x1E],
  "#": [0x14,0x7F,0x14,0x7F,0x14],
  "$": [0x24,0x2A,0x7F,0x2A,0x12],
  "%": [0x23,0x13,0x08,0x64,0x62],
  "&": [0x36,0x49,0x55,0x22,0x50],
  "*": [0x14,0x08,0x3E,0x08,0x14],
  "<": [0x08,0x14,0x22,0x41,0x00],
  ">": [0x41,0x22,0x14,0x08,0x00],
  "^": [0x04,0x02,0x01,0x02,0x04],
  "`": [0x00,0x03,0x07,0x00,0x00],
};

function normalizeChar(ch) {
  const up = ch.toUpperCase();
  if (FONT[up]) return up;
  return " ";
}

// Render a text string into an array of columns (each column is a byte).
// We add one blank column (0x00) between characters.
function renderText(str) {
  const cols = [];
  for (const rawCh of str) {
    const ch = normalizeChar(rawCh);
    const glyph = FONT[ch] || FONT[" "];
    for (const col of glyph) {
      cols.push(col & 0x7F); // 7 bits used
    }
    cols.push(0x00); // spacing
  }
  return cols;
}

// =======================
// MATRIX HELPERS
// =======================

// Straight row-major mapping.
// X: left→right, Y: top→bottom.
// No serpentine, every row goes left→right in memory.
function xyToIndex(x, y) {
  return y * WIDTH + x;
}

// Convert a font bit (0/1) into RGB using the default color.
function colToRGB(bit) {
  if (!bit) return [0,0,0];
  const c = DEFAULT_COLOR;
  return [c.r, c.g, c.b];
}

// =======================
// PACKING DRGB FOR WLED
// =======================
//
// Original super-simple DRGB v2 header: [2,2] followed by raw RGB bytes.

function packUDP(rgbArray) {
  const header = Buffer.from([2, 2]);
  return Buffer.concat([header, Buffer.from(rgbArray)]);
}

// Simple sleep helper
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// =======================
// SCROLLING LOGIC
// =======================

async function scrollMessage(text) {
  const textCols = renderText(text);
  const totalCols = textCols.length;
  if (totalCols === 0) return;

  // Treat text as a virtual strip. offset = how far it's shifted left.
  const startOffset = WIDTH;        // start fully off-screen to the right
  const endOffset   = -totalCols;   // finish fully off-screen to the left

  for (let offset = startOffset; offset > endOffset; offset--) {
    // Clear frame each step
    FRAME_RGB.fill(0);

    for (let x = 0; x < WIDTH; x++) {
      const srcIndex = x - offset;
      if (srcIndex < 0 || srcIndex >= totalCols) continue;

      const col = textCols[srcIndex] || 0;

      for (let y = 0; y < HEIGHT; y++) {
        const bit = (col >> y) & 1;
        const [r,g,b] = colToRGB(bit);

        const idx = xyToIndex(x, y);
        const base = idx * 3;
        if (base + 2 < FRAME_RGB.length) {
          FRAME_RGB[base]   = r;
          FRAME_RGB[base+1] = g;
          FRAME_RGB[base+2] = b;
        }
      }
    }

    sock.send(packUDP(FRAME_RGB), UDP_PORT, WLED_IP);
    await sleep(SCROLL_INTERVAL_MS);
  }

  // A couple of blank frames for a tiny pause between messages
  FRAME_RGB.fill(0);
  for (let i = 0; i < 2; i++) {
    sock.send(packUDP(FRAME_RGB), UDP_PORT, WLED_IP);
    await sleep(SCROLL_INTERVAL_MS);
  }
}

// Main loop:
//  - runs forever
//  - for each module in MODULES:
//      - calls module.getText() to get a string
//      - scrolls that string once using scrollMessage()
//  - after the last module, wraps back to the first
async function main() {
  console.log("Starting WLED matrix scroller (UDP Realtime DRGB)…");
  console.log("WLED target:", WLED_IP + ":" + UDP_PORT);
  console.log("Matrix size:", WIDTH, "x", HEIGHT, "(", LEDS, "LEDs )");

  while (true) {
    for (const mod of MODULES) {
      try {
        const text = await mod.getText();
        console.log(`Module [${mod.id}] text:`, text);
        await scrollMessage(text);
      } catch (e) {
        console.error(`Module [${mod.id}] failed:`, e?.message || e);
      }
    }
  }
}

main();
