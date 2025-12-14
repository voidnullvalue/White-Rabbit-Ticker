// matrix.mjs - WLED matrix framework

const WLED_IP = "192.168.88.85";
const UDP_PORT = 21324;

let WLED_ADDR = WLED_IP;
let USE_CONNECTED_SEND = false;

const WIDTH = 32;
const HEIGHT = 8;
const LEDS = WIDTH * HEIGHT;

const FRAME_RGB = new Uint8Array(LEDS * 3);

const SCROLL_INTERVAL_MS = 24;

const MATRIX_TZ = process.env.MATRIX_TZ; // optional, e.g. America/Chicago

const NIGHT_COLOR = { r: 4, g: 0, b: 0 };

// Full hue loop time during daytime
const DAY_CYCLE_SECONDS = 120; // 1 hour per full cycle

// Daytime brightness/saturation (tune these)
const DAY_SAT = 1.0;
const DAY_VAL = 0.12;

// Temporal dithering helps smooth low values (1 = on, 0 = off)
const ENABLE_DITHER = 1;

import dgram from "dgram";
import { lookup } from "node:dns/promises";
import haData from "./hadata.mjs";
import mpdData from "./mpddata.mjs";
import wttr from "./wttr.mjs";
import time from "./time.mjs";

const MODULES = [haData, mpdData, wttr, time];

const sock = dgram.createSocket("udp4");

async function initWledTarget() {
  try {
    const res = await lookup(WLED_IP, { family: 4 });
    if (res && res.address) WLED_ADDR = res.address;
  } catch (e) {
    WLED_ADDR = WLED_IP;
  }

  try {
    sock.connect(UDP_PORT, WLED_ADDR);
    USE_CONNECTED_SEND = true;
  } catch (e) {
    USE_CONNECTED_SEND = false;
  }
}

const FONT = {
  " ": [0x00,0x00,0x00,0x00,0x00],
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

  "-": [0x08,0x08,0x08,0x08,0x08],
  ":": [0x00,0x36,0x36,0x00,0x00],
  ".": [0x00,0x40,0x60,0x00,0x00],
  ",": [0x00,0x40,0x20,0x00,0x00],
  "/": [0x20,0x10,0x08,0x04,0x02],

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

function renderText(str) {
  const cols = [];
  for (const rawCh of str) {
    const ch = normalizeChar(rawCh);
    const glyph = FONT[ch] || FONT[" "];
    for (const col of glyph) cols.push(col & 0x7F);
    cols.push(0x00);
  }
  return cols;
}

function xyToIndex(x, y) {
  return y * WIDTH + x;
}

function getLocalHMS() {
  if (!MATRIX_TZ) {
    const d = new Date();
    return { h: d.getHours(), m: d.getMinutes(), s: d.getSeconds() };
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: MATRIX_TZ,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date());

  const get = (type) => Number(parts.find(p => p.type === type)?.value ?? 0);
  return { h: get("hour"), m: get("minute"), s: get("second") };
}

// HSV -> RGB in 0..1 floats
function hsv01ToRgb01(h01, s, v) {
  const h = (h01 % 1) * 6;
  const i = Math.floor(h);
  const f = h - i;
  const p = v * (1 - s);
  const q = v * (1 - s * f);
  const t = v * (1 - s * (1 - f));

  let r=0,g=0,b=0;
  if (i === 0)      { r=v; g=t; b=p; }
  else if (i === 1) { r=q; g=v; b=p; }
  else if (i === 2) { r=p; g=v; b=t; }
  else if (i === 3) { r=p; g=q; b=v; }
  else if (i === 4) { r=t; g=p; b=v; }
  else              { r=v; g=p; b=q; }

  return { r, g, b };
}

// Quantize with optional temporal dithering.
// phase should change slowly (we use frameCounter).
function quantize255(x, phase) {
  const y = x * 255;
  const base = Math.floor(y);
  const frac = y - base;
  if (!ENABLE_DITHER) return Math.max(0, Math.min(255, base));
  // simple 1D dither: bump up on alternating phases proportional to frac
  const bump = (phase % 256) < (frac * 256) ? 1 : 0;
  return Math.max(0, Math.min(255, base + bump));
}

function getCurrentTextColor(frameCounter) {
  const { h, m, s } = getLocalHMS();
  const secondsSinceMidnight = (h * 3600) + (m * 60) + s;

  const dayStart = 7 * 3600;
  const dayEnd   = 20 * 3600;

  if (secondsSinceMidnight < dayStart || secondsSinceMidnight >= dayEnd) {
    return NIGHT_COLOR;
  }

  // Smooth hue: 0..1 over DAY_CYCLE_SECONDS with sub-second precision
  const nowSec = Date.now() / 1000;
  const h01 = (nowSec % DAY_CYCLE_SECONDS) / DAY_CYCLE_SECONDS;

  const rgb01 = hsv01ToRgb01(h01, DAY_SAT, DAY_VAL);

  // Quantize to 0..255 with dithering to smooth low-level steps
  const phase = frameCounter & 255;
  return {
    r: quantize255(rgb01.r, phase + 0),
    g: quantize255(rgb01.g, phase + 85),
    b: quantize255(rgb01.b, phase + 170),
  };
}

const PACKET = Buffer.allocUnsafe(2 + FRAME_RGB.length);
PACKET[0] = 2;
PACKET[1] = 2;

function getPacket() {
  PACKET.set(FRAME_RGB, 2);
  return PACKET;
}

function nowMs() {
  return Number(process.hrtime.bigint() / 1000000n);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function udpSend(packet) {
  return new Promise((resolve) => {
    if (USE_CONNECTED_SEND) {
      sock.send(packet, () => resolve());
    } else {
      sock.send(packet, UDP_PORT, WLED_ADDR, () => resolve());
    }
  });
}

async function scrollMessage(text) {
  const textCols = renderText(text);
  const totalCols = textCols.length;
  if (totalCols === 0) return;

  const startOffset = WIDTH;
  const endOffset   = -totalCols;

  let frameCounter = 0;

  for (let offset = startOffset; offset > endOffset; offset--) {
    const frameStart = nowMs();
    FRAME_RGB.fill(0);

    // IMPORTANT FIX: lock the color ONCE per frame (no intra-frame time drift)
    const frameColor = getCurrentTextColor(frameCounter++);

    for (let x = 0; x < WIDTH; x++) {
      const srcIndex = x - offset;
      if (srcIndex < 0 || srcIndex >= totalCols) continue;

      const col = textCols[srcIndex] || 0;

      for (let y = 0; y < HEIGHT; y++) {
        const bit = (col >> y) & 1;
        if (!bit) continue;

        const idx = xyToIndex(x, y);
        const base = idx * 3;
        FRAME_RGB[base]   = frameColor.r;
        FRAME_RGB[base+1] = frameColor.g;
        FRAME_RGB[base+2] = frameColor.b;
      }
    }

    await udpSend(getPacket());

    const elapsed = nowMs() - frameStart;
    let delay = SCROLL_INTERVAL_MS - elapsed;
    if (delay < 0) delay = SCROLL_INTERVAL_MS;
    await sleep(delay);
  }

  FRAME_RGB.fill(0);
  for (let i = 0; i < 2; i++) {
    const frameStart = nowMs();
    await udpSend(getPacket());

    const elapsed = nowMs() - frameStart;
    let delay = SCROLL_INTERVAL_MS - elapsed;
    if (delay < 0) delay = SCROLL_INTERVAL_MS;
    await sleep(delay);
  }
}

async function main() {
  await initWledTarget();
  console.log("Starting WLED matrix scroller (UDP Realtime DRGB)…");
  console.log("WLED target:", WLED_ADDR + ":" + UDP_PORT, USE_CONNECTED_SEND ? "(connected)" : "(unconnected)");
  console.log("Matrix size:", WIDTH, "x", HEIGHT, "(", LEDS, "LEDs )");
  if (MATRIX_TZ) console.log("MATRIX_TZ:", MATRIX_TZ);
  console.log("Day cycle seconds:", DAY_CYCLE_SECONDS);

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
