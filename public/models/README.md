# Watch models

## ✅ Included test models (real GLBs)

These were downloaded for testing and are wired up in `src/config/watches.ts`:

| File                     | Watch        | Source / Licence                                   |
| ------------------------ | ------------ | -------------------------------------------------- |
| `chronograph_watch.glb`  | Chronograph  | Khronos glTF-Sample-Assets — © DGG, **CC BY 4.0**  |
| `poly_wristwatch.glb`    | Wrist Watch  | Poly by Google — **CC BY 3.0**                     |
| `poly_watch.glb`         | Classic Watch| Poly by Google — **CC BY 3.0**                     |

The other two catalogue entries (Sport Shock, Smart Ultra) have no GLB and use
the built-in **procedural** watch renderer — so the app always shows something.

> The loader **auto-orients** any GLB (rotates its thinnest axis — the dial
> normal — to point up), recenters it, and normalizes its size to the wrist
> fit. So a freshly dropped model usually appears roughly right; use
> `rotation` / `offset` / `scale` in `watches.ts` for the final nudge. Turn the
> on-screen **debug** toggle on to see the wrist landmarks + occluder.

### Note on the included models

- `chronograph_watch.glb` is a realistic PBR model authored by DGG specifically
  for AR wrist try-on (origin near the wrist). It is ~7 MB — fine for testing,
  but compress it (below) before shipping.
- The two Poly watches are stylized low-poly. Like most flat watch GLBs their
  strap is straight, not pre-curved, so it won't wrap the wrist as tightly as
  the procedural watch — the occluder still hides the parts that pass behind.

## Adding your own models

Drop a `.glb` into this folder and point a `watches.ts` entry's `model` at it
(e.g. `/models/my_watch.glb`). Use direct-download sources:

- Khronos glTF-Sample-Assets: https://github.com/KhronosGroup/glTF-Sample-Assets
- Poly Pizza (CDN `https://static.poly.pizza/<uuid>.glb`): https://poly.pizza/search/watch
- Sketchfab (downloadable filter): https://sketchfab.com/search?features=downloadable&q=watch&type=models

Always check the licence before shipping, and credit CC-BY authors (the
catalogue's `credit` field is shown in the UI).

## Requirements & optimization

- Format **GLB**, ideally **< 5 MB**, textures ≤ 1–2k, mobile-friendly geometry.

```bash
# Draco-compress + resize textures
npx @gltf-transform/cli optimize input.glb output.glb --texture-size 1024
```
