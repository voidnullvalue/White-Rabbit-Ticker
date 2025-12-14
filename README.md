# White Rabbit Ticker

White Rabbit Ticker is a **modular Node.js framework** for driving a WLED 2D matrix as a scrolling text ticker.

It doesn’t care where the text comes from. Each module returns a string; the framework turns it into pixels and shoves it at WLED over UDP.

Built-in example modules:

* Home Assistant – date + indoor temps
* MPD – “Now Playing”
* Weather via wttr.in
* Local time (12-hour)
* Lobsters RSS headlines
* Plain text file
* Octoprint status (new 12/2/2025)

---

## 0. Quick start (I just want text on the LEDs)

Follow this in order.

### Step 1 – Make sure WLED is sane

1. Power up your WLED controller with the matrix attached.
2. Open the WLED web UI (hostname like `wled-xxxx.local` or the IP).
3. In **LED Preferences**:

   * Set total LEDs to `256` for a 32×8 panel (or whatever `WIDTH * HEIGHT` will be).
   * Enable **2D** and set it to `32` columns × `8` rows (or your actual size).
4. Note the **hostname or IP**. Example:
   `wled-2f1f50.local` or `192.168.88.50`.

### Step 2 – Check Node.js

In a terminal on the machine that will run the ticker:

```bash
node -v
```

* If it prints **v18.x** or **v20.x**, good.
* If it says “command not found” or some ancient version, install a current Node.js (nvm, distro packages, etc.).

### Step 3 – Put the project somewhere

Example:

```bash
mkdir -p ~/white-rabbit-ticker && cd ~/white-rabbit-ticker
# put matrix.mjs and all the *.mjs modules in this folder
```

You should end up with something like:

* `matrix.mjs`
* `hadata.mjs`
* `mpddata.mjs`
* `wttr.mjs`
* `time.mjs`
* `filedata.mjs`
* `lobsters.mjs`

### Step 4 – Init Node + install deps

Inside the project folder:

```bash
npm init -y && npm install node-fetch
```

That creates a `package.json` and installs `node-fetch` (used by the HA module).

### Step 5 – Basic config in `matrix.mjs`

Open `matrix.mjs` and set these near the top:

```js
const WLED_IP = "wled-2f1f50.local";
const UDP_PORT = 21324;

const WIDTH = 32;
const HEIGHT = 8;

// ms between column steps (bigger = slower)
const SCROLL_INTERVAL_MS = 40;
```

Change:

* `WLED_IP` to your actual WLED hostname or IP.
* `WIDTH`/`HEIGHT` if your matrix isn’t 32×8.
* `SCROLL_INTERVAL_MS` if you want faster/slower scroll.

### Step 6 – Start the thing

From the project folder:

```bash
node matrix.mjs
```

Optional: if your host machine timezone isn’t what you want for the day/night schedule, run with a timezone override:

```bash
MATRIX_TZ=America/Chicago node matrix.mjs
```

---

## 1. What this thing actually is

* **Engine**: `matrix.mjs`

  * Opens a UDP socket to WLED (DRGB realtime mode).
  * Holds a small 5×7 bitmap font.
  * Converts strings → 5-column glyphs → a stream of frames.
  * Sends those frames to WLED as `[2, 2] + RGB bytes` over UDP.
  * Walks a list of modules; each module runs once per loop and returns one string.

* **Modules**: ES modules that export an object with `id` and `getText()`:

  ```js
  export default {
    id: "example-module",
    getText: async () => "TEXT TO SCROLL",
  };
  ```

If `getText()` returns `""`, the engine skips that module for that pass.

---

## 2. Project layout

Typical folder contents:

* `matrix.mjs` – core engine / main loop
* `hadata.mjs` – Home Assistant date + room temperatures
* `mpddata.mjs` – MPD “Now Playing”
* `wttr.mjs` – weather via wttr.in
* `time.mjs` – local clock, 12-hour
* `filedata.mjs` – scroll a local text file
* `lobsters.mjs` – Lobsters RSS titles

Module wiring is at the top of `matrix.mjs`:

```js
import haData from "./hadata.mjs";
import mpdData from "./mpddata.mjs";
// import lobsters from "./lobsters.mjs";
// import filedata from "./filedata.mjs";
import wttr from "./wttr.mjs";
import time from "./time.mjs";

const MODULES = [
  haData,
  mpdData,
  // lobsters,
  // filedata,
  wttr,
  time,
];
```

* Comment/uncomment imports and entries in `MODULES` to turn modules on or off.
* Reorder items in `MODULES` to change the display order.

---

## 3. Text color behavior (day/night schedule)

The engine supports **scheduled color behavior**:

* **Day mode (color cycling):** 07:00 → 18:00
* **Night mode (static dim red):** 18:00 → 07:00

This is implemented in `getCurrentTextColor()` by comparing `secondsSinceMidnight` against:

```js
const dayStart = 7 * 3600;   // 07:00
const dayEnd   = 18 * 3600;  // 18:00
```

Outside that window, it returns `NIGHT_COLOR`:

```js
const NIGHT_COLOR = { r: 4, g: 0, b: 0 };
```

### 3.1 Daytime color cycling

During day mode, text color cycles smoothly through hue space. The **full loop time** is:

```js
const DAY_CYCLE_SECONDS = 3600; // example: 1 hour per full color cycle
```

Daytime brightness/saturation are controlled by:

```js
const DAY_SAT = 1.0;
const DAY_VAL = 0.12;
```

If you’re running very dim, low values can look “steppy” on LEDs. There’s an optional temporal dither to smooth the quantization:

```js
const ENABLE_DITHER = 1; // 1 = on, 0 = off
```

### 3.2 Timezone for the schedule

By default, the day/night schedule uses the host’s local time.

If the box running Node has a different timezone than you want, set `MATRIX_TZ`:

```bash
MATRIX_TZ=America/Chicago node matrix.mjs
```

`MATRIX_TZ` must be an IANA timezone string (e.g. `America/Chicago`, `America/New_York`, etc.).

### 3.3 Changing the schedule

To change the schedule window, edit these in `getCurrentTextColor()`:

```js
const dayStart = 7 * 3600;
const dayEnd   = 18 * 3600;
```

Examples:

* Cycle 06:00 → 22:00

  ```js
  const dayStart = 6 * 3600;
  const dayEnd   = 22 * 3600;
  ```

* Cycle only 09:00 → 17:00

  ```js
  const dayStart = 9 * 3600;
  const dayEnd   = 17 * 3600;
  ```

---

## 4. Engine configuration options (quick reference)

Edit in `matrix.mjs` unless noted.

### 4.1 WLED + matrix

```js
const WLED_IP = "wled-xxxx.local"; // or an IP
const UDP_PORT = 21324;

const WIDTH = 32;
const HEIGHT = 8;
```

### 4.2 Scrolling speed

```js
const SCROLL_INTERVAL_MS = 40;
```

Higher = slower. Lower = faster.

### 4.3 Color schedule + cycling

```js
const NIGHT_COLOR = { r: 4, g: 0, b: 0 };

const DAY_CYCLE_SECONDS = 3600;
const DAY_SAT = 1.0;
const DAY_VAL = 0.12;

const ENABLE_DITHER = 1;

// env var (optional)
// MATRIX_TZ=America/Chicago
```

And the window itself is inside `getCurrentTextColor()`:

```js
const dayStart = 7 * 3600;
const dayEnd   = 18 * 3600;
```

---

## 5. Module configuration

### 5.1 Home Assistant – `hadata.mjs`

Top of the file looks like:

```js
const HA_URL   = "http://YOURHOMEASSISTANTINSTANCE:8123";
const HA_TOKEN = "YOUR_LONG_LIVED_TOKEN_HERE";

const INSIDE1 = "sensor.master_bedroom_govee_sensor_temperature";
const INSIDE2 = "sensor.bedroom_temperature";
const INSIDE3 = "sensor.living_room_temperature";
```

What to do:

1. Set `HA_URL` to your Home Assistant base URL.
2. Create a long-lived access token and paste it as `HA_TOKEN`.
3. Change `INSIDE1/2/3` to real entity IDs.

Example output:

```text
Dec 1  Mbr: 72°F  BDR: 70°F  LR: 71°F
```

### 5.2 MPD – `mpddata.mjs`

At the top:

```js
const MPD_HOST = "YOURMPDINSTANCEBYIP";
const MPD_PORT = 6600;
const MPD_PASSWORD = "";
const MPD_TIMEOUT_MS = 250;
```

Behavior:

* If MPD is playing: returns `Artist - Title` (fallbacks if needed).
* If paused/stopped/unreachable: returns `""` so the module is skipped.

### 5.3 Weather – `wttr.mjs`

At the top:

```js
const LOCATION = "YourCity";
const WTTR_URL = "https://wttr.in/YourCity?format=j1";
const CACHE_MS = 15 * 60 * 1000;
```

### 5.4 Time – `time.mjs`

No real config. Uses system time and returns a 12-hour string:

```text
6:42 PM
```

### 5.5 File ticker – `filedata.mjs`

At the top:

```js
const FILE_PATH = "/home/youruser/wled-matrix/output.txt";
```

Behavior:

* Reads the file.
* Collapses whitespace/newlines into one long line.
* Returns cleaned content, or `[FILE EMPTY]`, or `[FILE ERROR]`.

### 5.6 Lobsters RSS – `lobsters.mjs`

Defaults to `https://lobste.rs/rss`.

Config options inside that module let you change:

* How many items to include
* Separator between titles

---

## 6. Running it

From the project folder:

```bash
node matrix.mjs
```

With a timezone override:

```bash
MATRIX_TZ=America/Chicago node matrix.mjs
```

For long-running:

* Use `tmux`/`screen`, or
* Write a small `systemd` unit to run `node /path/to/matrix.mjs`.

---

## 7. How the scrolling works (short version)

1. The engine normalizes text and looks up each character in a 5×7 font map.
2. Each character becomes 5 columns of bits plus a blank spacer column.
3. All columns are concatenated into a “virtual strip” wider than your matrix.
4. The engine slides a window of width `WIDTH` across that strip.
5. For each step:

   * It builds a full `WIDTH × HEIGHT` RGB frame.
   * It sends `[2, 2, r, g, b, r, g, b, ...]` over UDP.
   * It waits `SCROLL_INTERVAL_MS` and moves one column.

Pixel index mapping is **row-major**:

```text
index = y * WIDTH + x
x: 0 → WIDTH-1 (left to right)
y: 0 → HEIGHT-1 (top to bottom)
```

If it looks mirrored / upside-down, fix the **2D layout** in WLED, not the code.

---

## 8. Troubleshooting

### Nothing shows on the matrix

Checklist:

1. Can you reach WLED from the Node box?

   ```bash
   ping yourwled.local
   # or
   ping 192.168.88.50
   ```

2. LED count correct?

   * Total LEDs should equal `WIDTH * HEIGHT`.

3. Realtime allowed?

   * In WLED → Sync Interfaces: make sure UDP realtime is enabled/allowed.

4. Firewall:

   * Ensure UDP/21324 isn’t being dropped.

### Text is backwards / scrambled

* The code assumes straight row-major mapping.
* In WLED’s 2D settings, flip rotation/mirroring/serpentine until it’s correct.

### MPD never shows anything

From the Node box:

```bash
telnet MPD_HOST MPD_PORT
```

You should see something like `OK MPD 0.22.x`.

### Home Assistant line looks wrong

* Verify `HA_URL` and token.
* Confirm entity IDs actually exist.

### Weather line is empty/weird

* Open the wttr URL in a browser.
* Lower `CACHE_MS` for faster testing.

---

Once the basic config is in place and it’s running without errors, you basically leave it alone and let White Rabbit Ticker drag whatever text you throw at it across the LEDs.
