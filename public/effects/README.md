# DeepAR wrist effects

Drop the `.deepar` files you export from **DeepAR Studio** here. They are served
at `/effects/<name>.deepar` and referenced from `src/config/deeparEffects.ts`.

Expected (matches the current config):
- `chrono.deepar` — Chronograph watch on the wrist (Wrist Position + occluder).

After adding a file: `git add public/effects && git commit && git push` → Vercel
auto-deploys → pick the watch in the `?engine=deepar` page.
