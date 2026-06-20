# AR Watch Studio — WebAR Luxury Watch Try-On

A realistic, **browser-based** AR watch try-on built with React, MediaPipe Hand
Landmarker, Three.js and React Three Fiber. The watch attaches to your wrist,
rotates with your hand, scales to your wrist size, and convincingly wraps around
it using an invisible depth occluder — no app install required.

> Works on **iPhone Safari** and **Android Chrome**, and on desktop with a webcam.

## ✨ Features

- Real-time single-hand / wrist tracking (MediaPipe Hand Landmarker, GPU with CPU fallback)
- **Quaternion** wrist-anchor system (cross-product orthonormal basis → no gimbal flips)
- Motion smoothing: **One-Euro filter** for position + adaptive slerp for rotation
- **Invisible occlusion cylinder** (`colorWrite=false`, `depthWrite=true`) so the bracelet wraps the wrist
- Dynamic wrist-width scaling from landmark geometry
- PBR metal materials + baked studio reflections (no external HDR download)
- 5-watch luxury carousel with smooth, async GLB switching
- **3 real test GLBs included** (a realistic PBR chronograph + 2 Poly watches) — see `public/models/`
- **Auto-orienting GLB loader** — rotates/recenters/normalizes any dropped model to the wrist frame
- **Procedural fallback watches** — runs fully before you add any GLB assets
- Screenshot capture → native share sheet or download
- Mobile-first luxury UI, camera flip, on-device only (no upload)

## 🚀 Quick start

```bash
npm install
npm run dev
```

Open the printed **https** URL.

### Testing on a phone (recommended)

`getUserMedia` requires a secure context. This project uses
`vite-plugin-basic-ssl`, so `npm run dev` serves over **HTTPS** on your LAN:

1. Make sure your phone and computer are on the same Wi-Fi.
2. Run `npm run dev` and note the `https://192.168.x.x:5173` URL.
3. Open it on the phone and **accept the self-signed certificate warning** once.
4. Grant camera permission, then hold your wrist in view.

> Tip: point the **rear** camera at your outstretched wrist (default). Tap the
> flip icon to switch to the front camera (auto-mirrored).

## 🧠 How it works

```
 MediaPipe Hand Landmarker      (useMediaPipe.ts)
        │  21 landmarks @ ≤35fps
        ▼
 HandTracker singleton          (ar/HandTracker.ts)   ← no React re-renders
        │
        ▼  read each render frame
 WristAnchor.compute()          (ar/WristAnchor.ts)
   • position+scale: unproject landmarks to z=0 plane
   • orientation: cross-product basis → quaternion (dial-faces-camera constraint)
        │
        ▼
 Motion smoothing               (ar/Smoothing.ts)
   • One-Euro (position) · adaptive slerp (rotation) · exp (scale)
        │
        ▼
 Watch group  ── child ──►  Invisible occlusion cylinder (ar/OcclusionCylinder.tsx)
        │                        depth-only forearm volume
        ▼
 GLB or procedural watch        (ar/WatchRenderer.tsx, ar/ProceduralWatch.tsx)
        │
        ▼
 R3F Canvas over <video>        (components/CameraView.tsx)  → final AR composite
```

### Why these choices

- **Screen-plane placement + 3D-geometry orientation.** Position/scale are solved
  by unprojecting image landmarks onto a plane, keeping the watch pixel-locked to
  the wrist with no depth calibration. Orientation is solved separately from the
  relative 3D landmark vectors, so the two never fight.
- **Dial-faces-camera constraint.** The wrist-plane normal is forced toward the
  camera, which removes the left/right-hand and palm-up/down ambiguity that
  otherwise flips the watch inside-out.
- **One-Euro filter.** Adapts smoothing to speed: heavy damping when still, low
  lag when moving — the difference between "swimming" and "premium".

## 🗂 Project structure

```
src/
├── ar/
│   ├── HandTracker.ts        # landmark frame buffer + indices (no re-renders)
│   ├── WristAnchor.ts        # quaternion wrist pose solver
│   ├── Smoothing.ts          # One-Euro / slerp / scalar smoothers
│   ├── OcclusionCylinder.tsx # invisible depth-only forearm
│   ├── ProceduralWatch.tsx   # parametric zero-asset fallback watch
│   ├── WatchRenderer.tsx     # anchor → smooth → occlude → render
│   └── capture.ts            # screenshot compositor + share/download
├── components/
│   ├── CameraView.tsx        # video + R3F canvas + lighting/env + debug
│   ├── WatchSelector.tsx     # luxury carousel
│   ├── CaptureButton.tsx     # shutter
│   └── LoadingScreen.tsx
├── hooks/useMediaPipe.ts     # model load + detection loop (GPU→CPU fallback)
├── config/watches.ts         # catalogue + per-model tuning
├── store/useARStore.ts       # Zustand UI state
└── pages/WatchTryOnPage.tsx  # flow: intro → camera → try-on
```

## ⚙️ Watch models

Three real test GLBs ship in `public/models/` and are already wired into
`src/config/watches.ts` (the other two entries are procedural). To add your own,
drop a `.glb` in `public/models/` and point an entry's `model` at it — the
loader auto-orients/recenters/normalizes it. Tune `scale` / `offset` /
`rotation` (radians) for the final nudge. Full details + licences:
[`public/models/README.md`](public/models/README.md).

## 📱 Performance notes

- Detection is capped at ~35 FPS via `requestVideoFrameCallback`; rendering runs
  at display rate.
- `Environment frames={1}` bakes reflections once instead of every frame.
- Landmarks flow through a mutable singleton, not React state — no per-frame re-renders.
- Keep GLBs < 5 MB and textures ≤ 1–2k for smooth mobile performance.

## 🔒 Privacy

All camera processing happens on-device in the browser. No frames are uploaded.
