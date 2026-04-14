# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

**Auuki** is a browser-based Progressive Web App for structured indoor cycling training. It connects to smart trainers and sensors via Web Bluetooth, records `.FIT` files, and integrates with Strava and Intervals.icu. It runs entirely in the browser with no backend.

The watch page is the primary experience: an immersive ride HUD where AI route videos are first-class, not decorative. Route progress, lap counting, and workout metrics are overlaid on video.

## Commands

```bash
npm start                              # Dev server (Parcel)
npm run starttls                       # Dev server with HTTPS (requires dev_cert/cert.pem and key.pem)
npm run build                          # Production build to dist/
npm run build -- --no-cache           # Force rebuild, bypasses Parcel cache
npm test                               # Run Jest tests
npx jest test/functions.test.js        # Run a single test file
```

The entry point is `src/index.html`. Parcel handles all bundling from there.

**Stale cache warning:** When UI changes appear to do nothing, the cause is almost always stale `dist/` assets or a stale service worker. Rebuild with `--no-cache` and bump the cache version string in `src/sw.js` (currently `Flux-v009`).

## Core Architecture

### Event System (`src/functions.js` — `xf`)

Everything communicates through a custom reactive event system built on browser `CustomEvent`s dispatched on `window`:

```js
xf.reg('db:power', (value, db) => { ... })  // handler receives value + full db state
xf.sub('ui:mode-set', (value) => { ... })   // handler receives value only
xf.dispatch('db:power', 250)
```

Event naming convention: `namespace:property` (e.g., `db:power`, `ui:mode-set`, `watch:elapsed`). Dispatch events — don't call functions directly. This is how all components stay decoupled.

### Reactive Store (`src/db.js`)

`db` is a JavaScript `Proxy` that auto-dispatches `db:<property>` events on any mutation. It holds all app state: sensor readings, targets, workout state, session stats, UI state, and user profile. Handlers in `db.js` validate and transform values through the model layer before storing.

### Model Layer (`src/models/models.js`)

Every data property is a `Model` instance with a consistent interface: `set()`, `restore()`, `backup()`, `isValid()`, `parse()`. Models handle validation, unit conversion, and persistence. To understand any property's behavior, find its model.

**To add a new data property:** Create a `Model` subclass in `src/models/models.js`, add it to the `models` export, register its event handler in `src/db.js`.

### Views (`src/views/`)

UI is built with native Web Components extending `HTMLElement`. The base `DataView` class (`src/views/data-views.js`) provides reactive bindings to `xf` events. Use `connectedCallback`/`disconnectedCallback` with `AbortController` for cleanup. No framework, no JSX.

**To add a new view:** Extend `DataView`. Subscribe in `connectedCallback`, clean up via `AbortController` in `disconnectedCallback`.

### BLE Devices (`src/ble/`)

Each Bluetooth protocol lives in its own directory (`ftms/`, `cps/`, `hrs/`, etc.). `ReactiveConnectable` (`reactive-connectable.js`) is the base class for device connection management. `devices.js` defines discovery filters per device type.

### Storage (`src/storage/`)

- `idb.js` — IndexedDB with three stores: `session`, `workouts`, `activity`
- `local-storage.js` — LocalStorage for settings and auth tokens

### Timer (`src/watch.js` + `src/timer.js`)

`src/watch.js` is the timer logic class (not the view). It uses a Web Worker (`src/timer.js`) for background timing to avoid main-thread jank.

**Important:** `lapTime` in this app is **remaining** time in the current interval, not elapsed time. Any code computing interval progress position must convert: `elapsed = intervalDuration - lapTime`.

### Other Key Files

| File | Purpose |
|---|---|
| `src/functions.js` | Core utilities: `xf` event system, functional helpers, bit ops, spec encoding |
| `src/physics.js` | Cycling physics: power, speed, gradient, altitude simulation |
| `src/fit/` | FIT file encoding/decoding for activity export |
| `src/workouts/zwo.js` | Zwift `.ZWO` XML format parser |
| `src/sw.js` | Service Worker — cache version string is `Flux-v009` |
| `src/models/strava.js` | Strava OAuth and activity upload |
| `src/models/api.js` | OAuth redirect router (handles Strava/Intervals.icu query params on load) |

## Route Video System

Route media and manifests live in `dist/videos/` and ship with the app so playback is predictable and offline-capable during rides. The system uses:

- CSV manifests listing local `.mp4` segments
- Sequential segment advancement via `videoIndex`
- A "wiggly circle" route progress indicator in the overlay

One full wrap from the last segment back to the first is treated as **one route lap**. Route laps are distinct from workout intervals — the lap count shown in the overlay increments when `videoIndex` wraps to `0`.

## Strava Integration

The app uses a **browser-local Strava mode**: the user brings their own Strava app credentials (`client_id` + `client_secret`), which are stored in LocalStorage. Token exchange, refresh, and upload happen directly from the browser. This is intentional for personal use — it is not a public-app architecture.

The setup flow lives in Settings: a guided card walks the user through creating a Strava API app, entering credentials (auto-saved while typing), and connecting. When `Stop` is pressed, the app auto-uploads if local Strava is configured and connected.

There is no server-side Strava path — do not reintroduce one.

## Testing

Jest with Babel. Tests live in `/test/` mirroring `src/` structure. IndexedDB is mocked with `fake-indexeddb`. Browser APIs (Web Bluetooth, Web Workers, Proxy reactivity) must be stubbed in tests.
